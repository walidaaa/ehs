import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { motion } from "framer-motion";
import { Search, Plus, Edit, Trash2, Calendar, Clock, User, CalendarCheck, CalendarClock, History, Filter } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTableQuery, useInsertMutation, useUpdateMutation, useDeleteMutation } from "@/hooks/useSupabaseQuery";
import { crudApi } from "@/lib/api";
import { CrudDialog } from "@/components/shared/CrudDialog";
import { DeleteConfirm } from "@/components/shared/DeleteConfirm";
import { usePermissions, useRole } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";
import { useDataFiltering } from "@/hooks/useDataFiltering";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/shared/PaginationControls";
import { ListSkeleton } from "@/components/shared/ListSkeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DetailedAppointmentsTable } from "@/components/appointments/DetailedAppointmentsTable";
import { appointmentStatusMap, appointmentTypeMap, appointmentTypeKeys, appointmentStatusKeys, translateValue, getTranslatedOptions } from "@/lib/translationMaps";
import { getRoleImage, getRoleColors } from "@/lib/roleColors";

const statusStyles: Record<string, string> = {
  "مجدول": "bg-gradient-to-r from-orange-400 to-orange-600 text-white",
  "مكتمل": "gradient-success text-primary-foreground",
  "ملغي": "bg-destructive/20 text-destructive",
  "غائب": "bg-orange-500/20 text-orange-600 dark:text-orange-400",
};

const AppointmentCard = ({ apt, getPatientName, getDoctorName, getDoctorRole, getDoctorImage, perms, openEdit, setDeleteId, isToday, locale, t }: any) => {
  const doctorRole = getDoctorRole(apt.doctor_id);
  const doctorImage = getDoctorImage(apt.doctor_id);
  const roleColors = getRoleColors(doctorRole);
  
  return (
  <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
    className={`neu-flat rounded-3xl bg-background p-5 ${isToday ? "ring-2 ring-primary/30" : ""}`}>
    <div className="flex flex-wrap items-center gap-4">
      <div className={`bg-gradient-to-r ${roleColors.gradient} rounded-2xl p-3 shrink-0 overflow-hidden h-12 w-12 flex items-center justify-center`}>
        <img src={doctorImage} alt="Doctor" className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold font-cairo">{getPatientName(apt.patient_id)}</h4>
        <p className="text-sm text-muted-foreground font-cairo">{translateValue(apt.type, appointmentTypeMap, t)}</p>
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <User className="h-4 w-4" />
        <span className="font-cairo">{getDoctorName(apt.doctor_id)}</span>
      </div>
      <div className="flex items-center gap-2 text-sm font-medium">
        <Clock className="h-4 w-4" />
        <span>{new Date(apt.date).toLocaleString(locale, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
      </div>
      <span className={`rounded-xl px-3 py-1 text-xs font-medium font-cairo ${statusStyles[apt.status] || ""}`}>{translateValue(apt.status, appointmentStatusMap, t)}</span>
      {apt.notes && <p className="w-full text-xs text-muted-foreground font-cairo mt-1 truncate max-w-xs">{apt.notes}</p>}
      {(perms.canEdit || perms.canDelete) && (
        <div className="flex gap-2">
          {perms.canEdit && <button onClick={() => openEdit(apt)} className="neu-flat-sm rounded-xl p-2 hover:scale-110 transition-transform"><Edit className="h-4 w-4 text-primary" /></button>}
          {perms.canDelete && <button onClick={() => setDeleteId(apt.id)} className="neu-flat-sm rounded-xl p-2 hover:scale-110 transition-transform"><Trash2 className="h-4 w-4 text-destructive" /></button>}
        </div>
      )}
    </div>
  </motion.div>
);
};

const PaginatedList = ({ items, t, ...props }: any) => {
  const { paginatedItems, page, setPage, pageSize, setPageSize, totalPages, totalItems } = usePagination(items);
  if (items.length === 0) return <div className="text-center py-12 font-cairo text-muted-foreground">{t.noAppointments}</div>;
  return (
    <>
      <div className="space-y-4">
        {paginatedItems.map((apt: any) => (
          <AppointmentCard key={apt.id} apt={apt} isToday={false} t={t} {...props} />
        ))}
      </div>
      <PaginationControls page={page} totalPages={totalPages} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} onPageSizeChange={setPageSize} />
    </>
  );
};

const Appointments = () => {
  const { t, dir, lang } = useLanguage();
  const locale = lang === "fr" ? "fr-FR" : "ar-DZ";
  const [search, setSearch] = useState("");
  const [filterDoctor, setFilterDoctor] = useState("");
  const [filterPatient, setFilterPatient] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ patient_id: "", date: "", type: "فحص", status: "مجدول", notes: "", doctor_id: "" });
  const [showFilters, setShowFilters] = useState(false);

  const { user } = useAuth();
  const role = useRole();
  const queryClient = useQueryClient();
  const perms = usePermissions("appointments");
  const { filterAppointments, filterPatients } = useDataFiltering();

  const { data: appointmentsRaw = [], isLoading } = useTableQuery("appointments");
  const { data: patientsRaw = [] } = useTableQuery("patients");
  const { data: profiles = [] } = useTableQuery("profiles");
  
  // Apply role-based filtering to ensure proper data scoping
  const appointments = useMemo(() => {
    const filtered = filterAppointments(appointmentsRaw);
    if (role === "user") {
      console.log("[v0] Doctor Appointments - user:", user?.id, "total:", appointmentsRaw.length, "filtered:", filtered.length);
      if (appointmentsRaw.length > 0) {
        console.log("[v0] First few raw appts:", appointmentsRaw.slice(0, 2).map((a: any) => ({ id: a.id.slice(0, 8), doctor_id: a.doctor_id?.slice(0, 8), patient_id: a.patient_id?.slice(0, 8) })));
      }
    }
    return filtered;
  }, [filterAppointments, appointmentsRaw, role, user?.id]);
  
  const patients = useMemo(() => {
    const filtered = filterPatients(patientsRaw);
    if (role === "user") {
      console.log("[v0] Doctor Patients - user:", user?.id, "total:", patientsRaw.length, "filtered:", filtered.length);
    }
    return filtered;
  }, [filterPatients, patientsRaw, role, user?.id]);
  
  const insertMut = useInsertMutation("appointments");
  const updateMut = useUpdateMutation("appointments");
  const deleteMut = useDeleteMutation("appointments");

  const getPatientName = (id: string) => patients.find((p: any) => p.id === id)?.name || "-";
  const getDoctorName = (id: string) => profiles.find((p: any) => p.id === id)?.full_name || "-";
  const getDoctorRole = (id: string) => {
    const profile = profiles.find((p: any) => p.id === id);
    return profile?.role || "doctor";
  };
  const getDoctorImage = (id: string) => {
    const profile = profiles.find((p: any) => p.id === id);
    return profile?.profile_image_url || getRoleImage(profile?.role || "doctor");
  };

  const filtered = useMemo(() => {
    return appointments.filter((a: any) => {
      const matchSearch = !search || getPatientName(a.patient_id).includes(search) || getDoctorName(a.doctor_id).includes(search) || (a.type || "").includes(search);
      const matchDoctor = !filterDoctor || a.doctor_id === filterDoctor;
      const matchPatient = !filterPatient || a.patient_id === filterPatient;
      return matchSearch && matchDoctor && matchPatient;
    });
  }, [appointments, search, filterDoctor, filterPatient, patients, profiles]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const { todayAppts, upcomingAppts, pastAppts } = useMemo(() => {
    const todayAppts: any[] = [];
    const upcomingAppts: any[] = [];
    const pastAppts: any[] = [];
    filtered.forEach((a: any) => {
      const d = new Date(a.date);
      if (d >= today && d < tomorrow) todayAppts.push(a);
      else if (d >= tomorrow) upcomingAppts.push(a);
      else pastAppts.push(a);
    });
    todayAppts.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    upcomingAppts.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    pastAppts.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return { todayAppts, upcomingAppts, pastAppts };
  }, [filtered]);

  const uniqueDoctors = useMemo(() => {
    const ids = [...new Set(appointments.map((a: any) => a.doctor_id).filter(Boolean))];
    return ids.map(id => ({ id, name: getDoctorName(id) }));
  }, [appointments, profiles]);

  const uniquePatients = useMemo(() => {
    const ids = [...new Set(appointments.map((a: any) => a.patient_id).filter(Boolean))];
    return ids.map(id => ({ id, name: getPatientName(id) }));
  }, [appointments, patients]);

  const openAdd = () => { 
  setEditItem(null); 
  // Auto-set doctor_id to current user if they're a doctor
  const doctorId = role === "user" ? user?.id : "";
  setForm({ patient_id: "", date: "", type: "فحص", status: "مجدول", notes: "", doctor_id: doctorId || "" }); 
  setDialogOpen(true); 
};
  const openEdit = (a: any) => {
  setEditItem(a);
  // Ensure doctor_id is set - for doctors, should be their ID; for super_admin, use appointment's doctor_id
  const doctorId = role === "user" ? (a.doctor_id || user?.id) : (a.doctor_id || "");
  setForm({ patient_id: a.patient_id, date: a.date?.slice(0, 16) || "", type: a.type, status: a.status, notes: a.notes || "", doctor_id: doctorId || "" });
  setDialogOpen(true);
  };

  const handleSubmit = async () => {
    const isSuperAdmin = role === "super_admin";
    const payload = { ...form, doctor_id: isSuperAdmin ? (form.doctor_id || null) : user?.id, created_by: user?.id };

    // Helper: build notification message for an appointment, in current language
    const buildAptNotifMessage = (aptId: string, dateISO: string, patientId: string, doctorId: string) => {
      const patientName = patients.find((p: any) => p.id === patientId)?.name || "";
      const doctorName = profiles.find((p: any) => p.id === doctorId)?.full_name || "";
      const d = new Date(dateISO);
      const dateStr = d.toLocaleDateString(locale, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
      const timeStr = d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
      const aptIdTag = `[APT:${aptId}]`;
      return lang === "fr"
        ? `Rendez-vous proche : ${patientName} avec Dr. ${doctorName} le ${dateStr} à ${timeStr} ${aptIdTag}`
        : `موعد قريب: ${patientName} مع د. ${doctorName} بتاريخ ${dateStr} الساعة ${timeStr} ${aptIdTag}`;
    };

    // Helper: delete all notifications tied to a given appointment id
    const deleteAptNotifications = async (aptId: string) => {
      try {
        const allNotifs = await crudApi.getAll("notifications");
        const related = allNotifs.filter((n: any) => {
          if (!n.message) return false;
          return n.message.includes(`[APT:${aptId}]`) ||
                 n.message.includes(`(ID: ${aptId})`) ||
                 n.message.includes(aptId);
        });
        for (const n of related) {
          try { await crudApi.delete("notifications", n.id); } catch (e) { /* silent */ }
        }
      } catch (e) {
        console.error("[Appointments] Failed to cleanup notifications:", e);
      }
    };

    // Helper: decide if an appointment should currently have a notification
    const shouldHaveNotif = (dateISO: string, status: string) => {
      if (status === "ملغي" || status === "مكتمل") return false;
      const aptTime = new Date(dateISO).getTime();
      const now = Date.now();
      const twoDays = 2 * 24 * 60 * 60 * 1000;
      // Keep notification for any future appointment; Topbar will also auto-create within 2 days.
      // We proactively create on edit/add so the user sees the fresh date immediately.
      return aptTime > now && aptTime - now <= Math.max(twoDays, 365 * 24 * 60 * 60 * 1000);
    };

    if (editItem) {
      const dateChanged = editItem.date?.slice(0, 16) !== form.date?.slice(0, 16);
      const statusChangedToCompleted = form.status === "مكتمل" && editItem.status !== "مكتمل";
      const statusChangedToCancelled = form.status === "ملغي" && editItem.status !== "ملغي";
      const doctorChanged = (editItem.doctor_id || null) !== (payload.doctor_id || null);

      updateMut.mutate({ id: editItem.id, ...payload }, {
        onSuccess: async () => {
          // On any of these changes, resync notifications to reflect the latest appointment state
          if (dateChanged || statusChangedToCompleted || statusChangedToCancelled || doctorChanged) {
            // 1) Delete ALL old notifications for this appointment
            await deleteAptNotifications(editItem.id);

            // 2) Recreate a fresh notification ONLY if the appointment is still active & in the future
            if (shouldHaveNotif(form.date, form.status)) {
              const targetDoctorId = payload.doctor_id || user?.id;
              if (targetDoctorId) {
                try {
                  await crudApi.insert("notifications", {
                    user_id: targetDoctorId,
                    title: t.appointmentReminder,
                    message: buildAptNotifMessage(editItem.id, form.date, form.patient_id, targetDoctorId),
                    type: "warning",
                    read: false,
                  });
                } catch (e) {
                  console.error("[Appointments] Failed to recreate notification:", e);
                }
              }
            }

            // 3) Invalidate caches so UI refreshes everywhere
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
          }
          setDialogOpen(false);
        }
      });
    } else {
      insertMut.mutate(payload, {
        onSuccess: async (created: any) => {
          // For a newly-created appointment in the future, create a linked notification right away
          const newAptId = created?.id || created?.data?.id;
          if (newAptId && shouldHaveNotif(form.date, form.status)) {
            const targetDoctorId = payload.doctor_id || user?.id;
            if (targetDoctorId) {
              try {
                await crudApi.insert("notifications", {
                  user_id: targetDoctorId,
                  title: t.appointmentReminder,
                  message: buildAptNotifMessage(newAptId, form.date, form.patient_id, targetDoctorId),
                  type: "warning",
                  read: false,
                });
                queryClient.invalidateQueries({ queryKey: ["notifications"] });
              } catch (e) { /* silent */ }
            }
          }
          setDialogOpen(false);
        }
      });
    }
  };

  const myPatients = role === "user" ? patients.filter((p: any) => p.doctor_id === user?.id) : patients;
  const cardProps = { getPatientName, getDoctorName, getDoctorRole, getDoctorImage, perms, openEdit, setDeleteId, locale, t };


  return (
    <DashboardLayout>
      <div dir={dir} className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-2xl font-bold font-cairo">{t.appointmentsTitle}</h2>
          <p className="text-muted-foreground font-cairo mt-1">{role === "user" ? t.yourAppointments : t.allAppointments}</p>
        </motion.div>

        <div className="grid grid-cols-3 gap-4">
          <div className="neu-flat rounded-2xl bg-background p-4 text-center">
            <div className="bg-gradient-to-r from-orange-400 to-orange-600 rounded-xl p-2 w-10 h-10 mx-auto flex items-center justify-center mb-2">
              <CalendarCheck className="h-5 w-5 text-white" />
            </div>
            <p className="text-2xl font-bold font-cairo">{todayAppts.length}</p>
            <p className="text-xs text-muted-foreground font-cairo">{t.todayTab}</p>
          </div>
          <div className="neu-flat rounded-2xl bg-background p-4 text-center">
            <div className="gradient-accent rounded-xl p-2 w-10 h-10 mx-auto flex items-center justify-center mb-2">
              <CalendarClock className="h-5 w-5 text-primary-foreground" />
            </div>
            <p className="text-2xl font-bold font-cairo">{upcomingAppts.length}</p>
            <p className="text-xs text-muted-foreground font-cairo">{t.upcomingTab}</p>
          </div>
          <div className="neu-flat rounded-2xl bg-background p-4 text-center">
            <div className="gradient-warning rounded-xl p-2 w-10 h-10 mx-auto flex items-center justify-center mb-2">
              <History className="h-5 w-5 text-primary-foreground" />
            </div>
            <p className="text-2xl font-bold font-cairo">{pastAppts.length}</p>
            <p className="text-xs text-muted-foreground font-cairo">{t.pastTab}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <div className="neu-flat-sm rounded-2xl bg-background px-4 py-2.5 flex items-center gap-2 flex-1 max-w-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.searchAppointmentsDetailed} className="bg-transparent outline-none text-sm flex-1 font-cairo" />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={`neu-flat-sm rounded-2xl px-4 py-2.5 flex items-center gap-2 text-sm font-cairo transition-colors ${showFilters ? "text-primary" : "text-muted-foreground"}`}>
            <Filter className="h-4 w-4" /> {t.filter}
          </button>
          {perms.canCreate && (
            <button onClick={openAdd} className="bg-gradient-to-r from-orange-400 to-orange-600 rounded-2xl px-5 py-2.5 flex items-center gap-2 text-sm font-cairo text-white hover:from-orange-500 hover:to-orange-700 transition-all">
              <Plus className="h-4 w-4" />{t.addAppointment}
            </button>
          )}
        </div>

        {showFilters && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="flex flex-wrap gap-3">
            <div className="neu-flat-sm rounded-xl bg-background">
              <select value={filterDoctor} onChange={e => setFilterDoctor(e.target.value)} className="bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl">
                <option value="">{t.filterByDoctor}</option>
                {uniqueDoctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="neu-flat-sm rounded-xl bg-background">
              <select value={filterPatient} onChange={e => setFilterPatient(e.target.value)} className="bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl">
                <option value="">{t.filterByPatient}</option>
                {uniquePatients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            {(filterDoctor || filterPatient) && (
              <button onClick={() => { setFilterDoctor(""); setFilterPatient(""); }} className="text-xs text-destructive font-cairo hover:underline">{t.clearFilters}</button>
            )}
          </motion.div>
        )}

        {isLoading ? <ListSkeleton /> : (
          <Tabs defaultValue="today" className="w-full" dir={dir}>
            <TabsList className="w-full neu-flat rounded-2xl bg-background p-1 h-auto">
              <TabsTrigger value="today" className="flex-1 rounded-xl font-cairo text-sm gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-400 data-[state=active]:to-orange-600 data-[state=active]:text-white py-2.5">
                <CalendarCheck className="h-4 w-4" /> {t.todayTab} ({todayAppts.length})
              </TabsTrigger>
              <TabsTrigger value="upcoming" className="flex-1 rounded-xl font-cairo text-sm gap-2 data-[state=active]:gradient-accent data-[state=active]:text-primary-foreground py-2.5">
                <CalendarClock className="h-4 w-4" /> {t.upcomingTab} ({upcomingAppts.length})
              </TabsTrigger>
              <TabsTrigger value="past" className="flex-1 rounded-xl font-cairo text-sm gap-2 data-[state=active]:gradient-warning data-[state=active]:text-primary-foreground py-2.5">
                <History className="h-4 w-4" /> {t.pastTab} ({pastAppts.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="today" className="mt-4">
              <DetailedAppointmentsTable
                appointments={todayAppts}
                patients={patients}
                profiles={profiles}
                onEdit={openEdit}
                onDelete={(id) => setDeleteId(id)}
                searchTerm={search}
                onSearchChange={setSearch}
              />
            </TabsContent>
            <TabsContent value="upcoming" className="mt-4">
              <DetailedAppointmentsTable
                appointments={upcomingAppts}
                patients={patients}
                profiles={profiles}
                onEdit={openEdit}
                onDelete={(id) => setDeleteId(id)}
                searchTerm={search}
                onSearchChange={setSearch}
              />
            </TabsContent>
            <TabsContent value="past" className="mt-4">
              <DetailedAppointmentsTable
                appointments={pastAppts}
                patients={patients}
                profiles={profiles}
                onEdit={openEdit}
                onDelete={(id) => setDeleteId(id)}
                searchTerm={search}
                onSearchChange={setSearch}
              />
            </TabsContent>
          </Tabs>
        )}

        <CrudDialog open={dialogOpen} onOpenChange={setDialogOpen} title={editItem ? t.editAppointment : t.addNewAppointment}>
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-cairo font-medium">{t.patient}</label>
              <div className="neu-pressed rounded-xl">
                <select value={form.patient_id} onChange={e => setForm(f => ({ ...f, patient_id: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" required>
                  <option value="">{t.selectPatient}</option>
                  {myPatients.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-cairo font-medium">{t.dateTime}</label>
              <div className="neu-pressed rounded-xl"><input type="datetime-local" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" required /></div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-cairo font-medium">{t.type}</label>
              <div className="neu-pressed rounded-xl">
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl">
                  {getTranslatedOptions(appointmentTypeKeys, t).map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-cairo font-medium">{t.status}</label>
              <div className="neu-pressed rounded-xl">
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl">
                  {appointmentStatusKeys.map(s => <option key={s.value} value={s.value}>{t[s.key as keyof typeof t]}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-cairo font-medium">{t.notes}</label>
              <div className="neu-pressed rounded-xl"><textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl resize-none" rows={3} placeholder={t.optionalNotes} /></div>
            </div>
            {role === "super_admin" && (
              <div className="space-y-2">
                <label className="text-sm font-cairo font-medium">{t.doctor}</label>
                <div className="neu-pressed rounded-xl">
                  <select value={form.doctor_id} onChange={e => setForm(f => ({ ...f, doctor_id: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl">
                    <option value="">{t.selectDoctor}</option>
                    {profiles.map((p: any) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </select>
                </div>
              </div>
            )}
            {role === "user" && (
              // Hidden field to maintain doctor_id for doctors
              <input type="hidden" value={form.doctor_id} />
            )}
            <button type="submit" disabled={insertMut.isPending || updateMut.isPending} className="w-full gradient-primary rounded-xl px-4 py-2.5 text-primary-foreground font-cairo font-medium hover:opacity-90 disabled:opacity-50">
              {editItem ? t.update : t.add}
            </button>
          </form>
        </CrudDialog>
        <DeleteConfirm open={!!deleteId} onOpenChange={() => setDeleteId(null)} onConfirm={async () => {
          if (!deleteId) return;
          const aptIdToDelete = deleteId;
          // First, remove any notifications that reference this appointment
          try {
            const allNotifs = await crudApi.getAll("notifications");
            const related = allNotifs.filter((n: any) => {
              if (!n.message) return false;
              return n.message.includes(`[APT:${aptIdToDelete}]`) ||
                     n.message.includes(`(ID: ${aptIdToDelete})`) ||
                     n.message.includes(aptIdToDelete);
            });
            for (const n of related) {
              try { await crudApi.delete("notifications", n.id); } catch (e) { /* silent */ }
            }
          } catch (e) { /* silent */ }
          deleteMut.mutate(aptIdToDelete, {
            onSuccess: () => {
              queryClient.invalidateQueries({ queryKey: ["notifications"] });
            }
          });
          setDeleteId(null);
        }} />
      </div>
    </DashboardLayout>
  );
};

export default Appointments;
