import { Bell, LogOut, Search, Menu, Moon, Sun, Globe, AlertCircle, Users, Stethoscope, Heart, Calendar, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useTableQuery, useInsertMutation } from "@/hooks/useSupabaseQuery";
import { crudApi } from "@/lib/api";
import { useRole } from "@/hooks/usePermissions";
import { useDataFiltering } from "@/hooks/useDataFiltering";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEffect, useRef, useState, useMemo } from "react";
import { toast } from "sonner";
import { useMobileSidebar } from "./Sidebar";
import { playNotificationSound } from "@/lib/notificationSound";

export const Topbar = () => {
  const { profile, signOut, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const role = useRole();
  const isAdmin = role === "admin";
  const isSuperAdmin = role === "super_admin";
  const { filterNotifications, filterAppointments, filterPatients, filterParents } = useDataFiltering();
  const { theme, toggleTheme } = useTheme();
  const { lang, setLang, t, dir } = useLanguage();
  const alertedRef = useRef<Set<string>>(new Set());
  const notifiedRef = useRef<Set<string>>(new Set());
  const notifiedInitRef = useRef(false);
  const [alertCount, setAlertCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [alertedAppointments, setAlteredAppointments] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLDivElement>(null);

  const isReceptionist = role === "receptionist";
  // For admin, super_admin, and receptionist: fetch all notifications, then filter client-side
  // For other roles: fetch only their own notifications from backend
  const { data: notificationsRaw = [] } = useTableQuery(
    "notifications",
    !(isAdmin || isSuperAdmin || isReceptionist) ? { filters: { user_id: user?.id } } : undefined
  );

  const { data: appointmentsRaw = [] } = useTableQuery("appointments");
  const { data: patients = [] } = useTableQuery("patients");
  const { data: profiles = [] } = useTableQuery("profiles");
  const { data: parents = [] } = useTableQuery("parents");
  const { data: userRoles = [] } = useTableQuery("user_roles");
  const insertNotification = useInsertMutation("notifications");

  // -------------------------------------------------------------------------
  // Sound preference: read `notification_sound_enabled` from the current
  // user's profile. Default to `true` so sound plays until the user opts out.
  // We reuse the `profiles` list we already fetch so no extra request is
  // needed. Falls back to `true` when the column is missing (e.g. migration
  // not applied yet) — this keeps the feature backward-compatible.
  // -------------------------------------------------------------------------
  const soundEnabled = useMemo<boolean>(() => {
    if (!user?.id) return true;
    const me = profiles.find((p: any) => p.id === user.id);
    if (!me) return true;
    // Treat undefined / null as enabled (default on).
    return me.notification_sound_enabled !== false;
  }, [profiles, user?.id]);

  const soundEnabledRef = useRef(soundEnabled);
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);

  const isParent = role === "parent";
  
  const appointments = (() => {
    if (isParent) {
      const parentRecord = parents.find((p: any) => p.user_id === user?.id);
      if (!parentRecord) return [];
      const myChildIds = patients.filter((p: any) => p.parent_id === parentRecord.id).map((p: any) => p.id);
      return appointmentsRaw.filter((a: any) => myChildIds.includes(a.patient_id));
    }
    return filterAppointments ? filterAppointments(appointmentsRaw) : appointmentsRaw;
  })();
  
  // Apply client-side filtering for roles that fetch all notifications
  const filteredByRole = (isAdmin || isSuperAdmin || isReceptionist) ? filterNotifications(notificationsRaw) : notificationsRaw;
  
  // Filter out expired appointment notifications (appointment date has passed)
  const notifications = useMemo(() => {
    const now = new Date().getTime();
    return filteredByRole.filter((n: any) => {
      if (!n.message) return true;
      const match = n.message.match(/\[APT:([a-f0-9-]+)\]/) || n.message.match(/\(ID: ([a-f0-9-]+)\)/);
      if (!match) return true;
      const aptId = match[1];
      const apt = appointmentsRaw.find((a: any) => a.id === aptId);
      if (!apt) return true;
      if (apt.status === "ملغي" || apt.status === "مكتمل") return false;
      return new Date(apt.date).getTime() > now;
    });
  }, [filteredByRole, appointmentsRaw]);
  
  const unreadCount = notifications.filter((n: any) => !n.read).length;

  // -------------------------------------------------------------------------
  // Audio cue: play a beep whenever a brand-new appointment notification
  // arrives (any notification id we have never seen before). We seed the
  // "seen" set on the first render so we don't play sounds for notifications
  // that were already in the DB before the user opened the page.
  // -------------------------------------------------------------------------
  const seenNotifIdsRef = useRef<Set<string>>(new Set());
  const seenSeededRef = useRef(false);

  useEffect(() => {
    if (!Array.isArray(notificationsRaw)) return;

    if (!seenSeededRef.current) {
      notificationsRaw.forEach((n: any) => {
        if (n?.id) seenNotifIdsRef.current.add(n.id);
      });
      seenSeededRef.current = true;
      return;
    }

    const freshIds: string[] = [];
    notificationsRaw.forEach((n: any) => {
      if (!n?.id) return;
      if (!seenNotifIdsRef.current.has(n.id)) {
        freshIds.push(n.id);
        seenNotifIdsRef.current.add(n.id);
      }
    });

    if (freshIds.length > 0 && soundEnabledRef.current) {
      // One ding is enough even if several notifications came in together.
      playNotificationSound();
    }
  }, [notificationsRaw]);

  const getPatientName = (id: string) => patients.find((p: any) => p.id === id)?.name || "";
  const getDoctorName = (id: string) => profiles.find((p: any) => p.id === id)?.full_name || "";

  // Global search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return { doctors: [], patients: [], parents: [], appointments: [] };
    const q = searchQuery.toLowerCase();

    const doctorIds = new Set(userRoles.filter((r: any) => r.role === "user").map((r: any) => r.user_id));
    const matchedDoctors = profiles
      .filter((p: any) => doctorIds.has(p.id) && (p.full_name?.toLowerCase().includes(q) || p.specialty?.toLowerCase().includes(q) || p.phone?.includes(q)))
      .slice(0, 5);

    const scopedPatients = filterPatients ? filterPatients(patients) : patients;
    const matchedPatients = scopedPatients
      .filter((p: any) => p.name?.toLowerCase().includes(q) || p.diagnosis_type?.toLowerCase().includes(q))
      .slice(0, 5);

    const scopedParents = filterParents ? filterParents(parents) : parents;
    const matchedParents = scopedParents
      .filter((p: any) => p.full_name?.toLowerCase().includes(q) || p.phone?.includes(q))
      .slice(0, 5);

    const locale = lang === "fr" ? "fr-FR" : "ar-DZ";
    const matchedAppointments = appointments
      .filter((a: any) => {
        const patientName = getPatientName(a.patient_id).toLowerCase();
        const doctorName = getDoctorName(a.doctor_id).toLowerCase();
        const dateStr = new Date(a.date).toLocaleDateString(locale).toLowerCase();
        return patientName.includes(q) || doctorName.includes(q) || dateStr.includes(q) || (a.type || "").toLowerCase().includes(q);
      })
      .slice(0, 5);

    return { doctors: matchedDoctors, patients: matchedPatients, parents: matchedParents, appointments: matchedAppointments };
  }, [searchQuery, profiles, patients, parents, appointments, userRoles, lang]);

  const hasResults = searchResults.doctors.length + searchResults.patients.length + searchResults.parents.length + searchResults.appointments.length > 0;

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowResults(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Initialize alerted appointments from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('alertedAppointments');
    if (stored) {
      try {
        const aptIds = JSON.parse(stored);
        const newSet = new Set(aptIds);
        setAlteredAppointments(newSet);
        alertedRef.current = newSet;
      } catch (e) {
        console.error('[Topbar] Failed to parse alertedAppointments:', e);
      }
    }
  }, []);

  // Sync notifiedRef with actual DB notifications
  // Also build a map of appointment ID -> notification date info for change detection
  const aptNotifMapRef = useRef<Map<string, { notifIds: string[]; aptDate: string }>>(new Map());
  
  useEffect(() => {
    const dbAptIds = new Set<string>();
    const aptNotifMap = new Map<string, { notifIds: string[]; aptDate: string }>();
    
    notificationsRaw.forEach((n: any) => {
      if (n.message) {
        const match = n.message.match(/\[APT:([a-f0-9-]+)\]/) || n.message.match(/\(ID: ([a-f0-9-]+)\)/);
        if (match) {
          const aptId = match[1];
          dbAptIds.add(aptId);
          const existing = aptNotifMap.get(aptId) || { notifIds: [], aptDate: "" };
          existing.notifIds.push(n.id);
          aptNotifMap.set(aptId, existing);
        }
      }
    });
    
    // Store the date from the appointment for each notified appointment
    appointmentsRaw.forEach((apt: any) => {
      if (aptNotifMap.has(apt.id)) {
        const entry = aptNotifMap.get(apt.id)!;
        entry.aptDate = apt.date;
      }
    });
    
    aptNotifMapRef.current = aptNotifMap;
    notifiedRef.current = dbAptIds;
    notifiedInitRef.current = true;
  }, [notificationsRaw, appointmentsRaw]);

  const latestDataRef = useRef({ appointments, patients, profiles, notificationsRaw, lang, t, parents });
  useEffect(() => {
    latestDataRef.current = { appointments, patients, profiles, notificationsRaw, lang, t, parents };
  });

  useEffect(() => {
    if (!user?.id) return;
    if (!notifiedInitRef.current) return;

    const checkUpcoming = async () => {
      const { appointments, patients, profiles, notificationsRaw, lang, t } = latestDataRef.current;
      const now = new Date().getTime();
      const thirtyMin = 30 * 60 * 1000;
      const twoDays = 2 * 24 * 60 * 60 * 1000;
      let immediateCount = 0;

      const getPatientNameLocal = (id: string) => patients.find((p: any) => p.id === id)?.name || "";
      const getDoctorNameLocal = (id: string) => profiles.find((p: any) => p.id === id)?.full_name || "";

      // 1. AUTO-CLEANUP: Delete expired appointment notifications (appointment date has passed)
      const expiredNotifIds: string[] = [];
      notificationsRaw.forEach((n: any) => {
        if (!n.message) return;
        const match = n.message.match(/\[APT:([a-f0-9-]+)\]/) || n.message.match(/\(ID: ([a-f0-9-]+)\)/);
        if (!match) return;
        const aptId = match[1];
        // Check in all available appointment sources
        const apt = appointmentsRaw.find((a: any) => a.id === aptId) ||
                     appointments.find((a: any) => a.id === aptId);
        if (apt) {
          const aptTime = new Date(apt.date).getTime();
          if (aptTime <= now) {
            expiredNotifIds.push(n.id);
          }
          if (apt.status === "ملغي" || apt.status === "مكتمل") {
            if (!expiredNotifIds.includes(n.id)) {
              expiredNotifIds.push(n.id);
            }
          }
        }
      });

      // Delete expired notifications from DB
      for (const notifId of expiredNotifIds) {
        try {
          await crudApi.delete("notifications", notifId);
        } catch (e) { /* silent */ }
      }
      if (expiredNotifIds.length > 0) {
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
      }

      // 2. DETECT STALE NOTIFICATIONS: Any notification whose encoded message
      //    no longer matches the current appointment date/time OR which
      //    references an appointment that no longer exists must be deleted.
      //    The backend already drops notifications on appointment UPDATE/DELETE,
      //    this is a belt-and-suspenders sweep for edge cases (e.g. stale
      //    notifications created by older clients).
      const staleNotifIds: string[] = [];
      notificationsRaw.forEach((n: any) => {
        if (!n.message) return;
        const m = n.message.match(/\[APT:([a-f0-9-]+)\]/) || n.message.match(/\(ID: ([a-f0-9-]+)\)/);
        if (!m) return;
        const aptId = m[1];
        const apt = appointmentsRaw.find((a: any) => a.id === aptId);
        if (!apt) {
          staleNotifIds.push(n.id);
          return;
        }
        if (apt.status === "ملغي" || apt.status === "مكتمل") {
          staleNotifIds.push(n.id);
          return;
        }
        // Check if the notification message still encodes the current date.
        const aptDate = new Date(apt.date);
        const timeStrAr = aptDate.toLocaleTimeString("ar-DZ", { hour: "2-digit", minute: "2-digit" });
        const timeStrFr = aptDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
        const dayAr = aptDate.toLocaleDateString("ar-DZ", { day: "numeric", month: "long", year: "numeric" });
        const dayFr = aptDate.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
        const msg: string = n.message;
        const stillMatches =
          (msg.includes(timeStrAr) && msg.includes(dayAr)) ||
          (msg.includes(timeStrFr) && msg.includes(dayFr));
        if (!stillMatches) {
          staleNotifIds.push(n.id);
          // Allow a fresh notification to be created below
          notifiedRef.current.delete(aptId);
          alertedRef.current.delete(aptId);
        }
      });

      for (const notifId of staleNotifIds) {
        try { await crudApi.delete("notifications", notifId); } catch { /* silent */ }
      }
      if (staleNotifIds.length > 0) {
        setAlteredAppointments(prev => {
          const newSet = new Set(prev);
          staleNotifIds.forEach(() => { /* noop, handled per-apt above */ });
          localStorage.setItem('alertedAppointments', JSON.stringify(Array.from(newSet)));
          return newSet;
        });
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
      }

      // 3. IMMEDIATE ALERTS (within 30 minutes)
      appointments.forEach((apt: any) => {
        if (apt.status === "ملغي" || apt.status === "مكتمل") return;
        const aptTime = new Date(apt.date).getTime();
        const diff = aptTime - now;
        
        if (diff > 0 && diff <= thirtyMin) {
          immediateCount++;
          if (!alertedRef.current.has(apt.id)) {
            alertedRef.current.add(apt.id);
            setAlteredAppointments(prev => {
              const newSet = new Set(prev);
              newSet.add(apt.id);
              localStorage.setItem('alertedAppointments', JSON.stringify(Array.from(newSet)));
              return newSet;
            });
            const patientName = getPatientNameLocal(apt.patient_id);
            const timeStr = new Date(apt.date).toLocaleTimeString(lang === "fr" ? "fr-FR" : "ar-DZ", { hour: "2-digit", minute: "2-digit" });
            toast.warning(
              `${t.appointmentReminder}: ${patientName} - ${timeStr}`,
              { duration: 10000, icon: <AlertCircle className="h-5 w-5" /> }
            );
            // Audible cue for the imminent-reminder toast too.
            if (soundEnabledRef.current) {
              playNotificationSound();
            }
          }
        }

        // 4. CREATE NOTIFICATIONS for upcoming appointments (within 2 days)
        if (diff > 0 && diff <= twoDays && !notifiedRef.current.has(apt.id)) {
          const aptIdTag = `[APT:${apt.id}]`;
          const oldIdTag = `(ID: ${apt.id})`;
          const alreadyExists = notificationsRaw.some((n: any) => 
            n.message?.includes(aptIdTag) || n.message?.includes(oldIdTag) || n.message?.includes(apt.id)
          );

          notifiedRef.current.add(apt.id);

          if (!alreadyExists) {
            const patientName = getPatientNameLocal(apt.patient_id);
            const doctorName = getDoctorNameLocal(apt.doctor_id);
            const dateStr = new Date(apt.date).toLocaleDateString(lang === "fr" ? "fr-FR" : "ar-DZ", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
            const timeStr = new Date(apt.date).toLocaleTimeString(lang === "fr" ? "fr-FR" : "ar-DZ", { hour: "2-digit", minute: "2-digit" });

            const message = lang === "fr" 
              ? `Rendez-vous proche : ${patientName} avec Dr. ${doctorName} le ${dateStr} à ${timeStr} ${aptIdTag}`
              : `موعد قريب: ${patientName} مع د. ${doctorName} بتاريخ ${dateStr} الساعة ${timeStr} ${aptIdTag}`;

            insertNotification.mutate({
              user_id: user.id,
              title: t.appointmentReminder,
              message,
              type: "warning",
            });
          }
        }
      });
      setAlertCount(immediateCount);
    };

    const timeout = setTimeout(() => {
      checkUpcoming();
    }, 2000);
    const interval = setInterval(checkUpcoming, 60000);
    return () => { clearTimeout(timeout); clearInterval(interval); };
  }, [user?.id, appointmentsRaw]);

  const { setOpen: setMobileSidebarOpen } = useMobileSidebar();

  const locale = lang === "fr" ? "fr-FR" : "ar-DZ";

  return (
    <header className="flex items-center justify-between px-3 py-3 md:px-6 md:py-4 gap-2" dir={dir}>
      <button className="md:hidden neu-flat-sm rounded-xl p-2 bg-background flex-shrink-0" onClick={() => setMobileSidebarOpen(true)}>
        <Menu className="h-5 w-5 text-foreground" />
      </button>

      {/* Global Search */}
      <div className="relative max-w-md flex-1 mx-2 hidden sm:block" ref={searchRef}>
        <div className="flex items-center gap-2 rounded-2xl px-4 py-2.5 neu-flat-sm bg-background">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setShowResults(true); }}
            onFocus={() => setShowResults(true)}
            placeholder={t.searchPlaceholder}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground font-cairo"
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(""); setShowResults(false); }}>
              <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {showResults && searchQuery.length >= 2 && (
          <div className="absolute top-full mt-2 w-full rounded-2xl bg-background border border-border shadow-xl z-50 max-h-[400px] overflow-y-auto">
            {!hasResults ? (
              <div className="p-4 text-center text-sm text-muted-foreground font-cairo">{t.noData}</div>
            ) : (
              <div className="p-2 space-y-1">
                {/* Doctors */}
                {searchResults.doctors.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-muted-foreground font-cairo px-3 py-1.5 flex items-center gap-1.5">
                      <Stethoscope className="h-3.5 w-3.5" /> {t.statDoctors}
                    </p>
                    {searchResults.doctors.map((doc: any) => (
                      <button key={doc.id} onClick={() => { setShowResults(false); setSearchQuery(""); }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-muted/50 transition-colors text-right">
                        <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center text-primary-foreground font-bold text-xs shrink-0">
                          {doc.full_name?.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium font-cairo truncate">{doc.full_name}</p>
                          <p className="text-xs text-muted-foreground font-cairo">{doc.specialty || "-"} {doc.phone ? `• ${doc.phone}` : ""}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Patients */}
                {searchResults.patients.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-muted-foreground font-cairo px-3 py-1.5 flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" /> {t.statPatients}
                    </p>
                    {searchResults.patients.map((p: any) => (
                      <button key={p.id} onClick={() => { navigate(`/patients/${p.id}`); setShowResults(false); setSearchQuery(""); }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-muted/50 transition-colors text-right">
                        <div className="h-8 w-8 rounded-lg gradient-accent flex items-center justify-center text-primary-foreground font-bold text-xs shrink-0">
                          {p.name?.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium font-cairo truncate">{p.name}</p>
                          <p className="text-xs text-muted-foreground font-cairo">{p.age} {t.years} • {p.status || "-"}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Parents */}
                {searchResults.parents.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-muted-foreground font-cairo px-3 py-1.5 flex items-center gap-1.5">
                      <Heart className="h-3.5 w-3.5" /> {t.statParents}
                    </p>
                    {searchResults.parents.map((p: any) => (
                      <button key={p.id} onClick={() => { navigate("/parents"); setShowResults(false); setSearchQuery(""); }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-muted/50 transition-colors text-right">
                        <div className="h-8 w-8 rounded-lg gradient-success flex items-center justify-center text-primary-foreground font-bold text-xs shrink-0">
                          {p.full_name?.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium font-cairo truncate">{p.full_name}</p>
                          <p className="text-xs text-muted-foreground font-cairo">{p.phone || "-"}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Appointments */}
                {searchResults.appointments.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-muted-foreground font-cairo px-3 py-1.5 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" /> {t.appointments}
                    </p>
                    {searchResults.appointments.map((a: any) => (
                      <button key={a.id} onClick={() => { setShowResults(false); setSearchQuery(""); }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-muted/50 transition-colors text-right">
                        <div className="h-8 w-8 rounded-lg gradient-warning flex items-center justify-center text-primary-foreground shrink-0">
                          <Calendar className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium font-cairo truncate">{getPatientName(a.patient_id)} - {getDoctorName(a.doctor_id)}</p>
                          <p className="text-xs text-muted-foreground font-cairo">
                            {new Date(a.date).toLocaleDateString(locale, { month: "short", day: "numeric" })} • {a.type || "-"} • {a.status || "-"}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
        <button
          onClick={() => setLang(lang === "ar" ? "fr" : "ar")}
          className="neu-flat-sm rounded-xl p-2 md:p-2.5 bg-background hover:scale-105 transition-transform"
          title={t.language}
        >
          <div className="flex items-center gap-1">
            <Globe className="h-4 w-4 text-foreground" />
            <span className="text-xs font-bold text-foreground">{lang === "ar" ? "FR" : "AR"}</span>
          </div>
        </button>

        <button
          onClick={toggleTheme}
          className="neu-flat-sm rounded-xl p-2 md:p-2.5 bg-background hover:scale-105 transition-transform"
          title={theme === "light" ? t.darkMode : t.lightMode}
        >
          {theme === "light" ? (
            <Moon className="h-4 w-4 md:h-5 md:w-5 text-foreground" />
          ) : (
            <Sun className="h-4 w-4 md:h-5 md:w-5 text-foreground" />
          )}
        </button>

        {alertCount > 0 && (
          <button
            onClick={() => navigate("/appointments")}
            className="relative neu-flat-sm rounded-xl p-2 md:p-2.5 bg-background hover:scale-105 transition-transform animate-pulse"
            title={t.appointmentSoon}
          >
            <AlertCircle className="h-4 w-4 md:h-5 md:w-5 text-destructive" />
            <span className="absolute -top-1 -right-1 flex h-4 w-4 md:h-5 md:w-5 items-center justify-center rounded-full bg-destructive text-[9px] md:text-[10px] font-bold text-destructive-foreground">
              {alertCount}
            </span>
          </button>
        )}

        <button onClick={() => navigate("/notifications")} className="relative neu-flat-sm rounded-xl p-2 md:p-2.5 bg-background hover:scale-105 transition-transform">
          <Bell className="h-4 w-4 md:h-5 md:w-5 text-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 md:h-5 md:w-5 items-center justify-center rounded-full gradient-warning text-[9px] md:text-[10px] font-bold text-primary-foreground">
              {unreadCount}
            </span>
          )}
        </button>

        <div className="neu-flat-sm rounded-2xl bg-background px-2 py-1.5 md:px-4 md:py-2 flex items-center gap-2 md:gap-3">
          <div className="h-7 w-7 md:h-8 md:w-8 rounded-xl gradient-primary flex items-center justify-center">
            <span className="text-[10px] md:text-xs font-bold text-primary-foreground">{profile?.full_name?.charAt(0) || "?"}</span>
          </div>
          <div className="hidden sm:block text-right">
            <p className="text-sm font-semibold font-cairo">{profile?.full_name || t.welcomeUser}</p>
          </div>
        </div>

        <button onClick={signOut} className="neu-flat-sm rounded-xl p-2 md:p-2.5 bg-background hover:scale-105 transition-transform" title={t.logout}>
          <LogOut className="h-4 w-4 md:h-5 md:w-5 text-foreground" />
        </button>
      </div>
    </header>
  );
};