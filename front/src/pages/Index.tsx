import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { TodayAppointments } from "@/components/dashboard/TodayAppointments";
import { Users, Calendar, Stethoscope, Building2, Bell, Baby, Phone, ListTodo, Search, Clock, User, Pencil, Check, X } from "lucide-react";
import logoImg from "@/assets/logo-themed.png";
import { motion } from "framer-motion";
import { useState } from "react";
import { crudApi } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/shared/PaginationControls";
import { useTableQuery } from "@/hooks/useSupabaseQuery";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/usePermissions";
import { useDataFiltering } from "@/hooks/useDataFiltering";
import { useNavigate, Navigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Skeleton } from "@/components/ui/skeleton";

import { appointmentStatusMap, appointmentTypeMap, translateValue } from "@/lib/translationMaps";

const statusStyles: Record<string, string> = {
  "مجدول": "gradient-primary text-primary-foreground",
  "مكتمل": "gradient-success text-primary-foreground",
  "ملغي": "bg-destructive/20 text-destructive",
};

const AppointmentsTable = ({ appointments, patients, profiles, searchTerm }: { appointments: any[]; patients: any[]; profiles: any[]; searchTerm: string }) => {
  const { t, lang } = useLanguage();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState("");
  const getPatientName = (id: string) => patients.find((p: any) => p.id === id)?.name || "-";
  const getDoctorName = (id: string) => profiles.find((p: any) => p.id === id)?.full_name || "-";
  const locale = lang === "fr" ? "fr-FR" : "ar-DZ";

  const saveNote = async (id: string) => {
    await crudApi.update("appointments", id, { notes: editNote });
    queryClient.invalidateQueries({ queryKey: ["appointments"] });
    setEditingId(null);
  };

  const filtered = appointments.filter((a: any) =>
    getPatientName(a.patient_id).includes(searchTerm) ||
    getDoctorName(a.doctor_id).includes(searchTerm) ||
    (a.type || "").includes(searchTerm)
  );

  const { paginatedItems, page, setPage, pageSize, setPageSize, totalPages, totalItems } = usePagination(filtered);

  if (filtered.length === 0) {
    return <div className="text-center py-8 font-cairo text-muted-foreground text-sm">{t.noAppointments}</div>;
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm font-cairo">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-right py-3 px-3 font-semibold text-muted-foreground">{t.patient}</th>
              <th className="text-right py-3 px-3 font-semibold text-muted-foreground">{t.doctor}</th>
              <th className="text-right py-3 px-3 font-semibold text-muted-foreground">{t.dateTime}</th>
              <th className="text-right py-3 px-3 font-semibold text-muted-foreground">{t.appointmentType}</th>
              <th className="text-right py-3 px-3 font-semibold text-muted-foreground">{t.status}</th>
              <th className="text-right py-3 px-3 font-semibold text-muted-foreground">{t.appointmentNotes}</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((apt: any) => (
              <tr key={apt.id} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-3 font-medium">{getPatientName(apt.patient_id)}</td>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-primary" />
                    {getDoctorName(apt.doctor_id)}
                  </div>
                </td>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    {new Date(apt.date).toLocaleString(locale, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </td>
                <td className="py-3 px-3">{translateValue(apt.type, appointmentTypeMap, t)}</td>
                <td className="py-3 px-3">
                  <span className={`rounded-lg px-2.5 py-1 text-xs font-medium ${statusStyles[apt.status] || "bg-muted"}`}>
                    {translateValue(apt.status, appointmentStatusMap, t)}
                  </span>
                </td>
                <td className="py-3 px-3 text-muted-foreground max-w-[180px]">
                  {editingId === apt.id ? (
                    <div className="flex items-center gap-1">
                      <input value={editNote} onChange={(e) => setEditNote(e.target.value)} className="bg-muted/50 rounded-lg px-2 py-1 text-xs w-full outline-none border border-border focus:border-primary font-cairo" autoFocus />
                      <button onClick={() => saveNote(apt.id)} className="text-primary hover:text-primary/80 shrink-0"><Check className="h-3.5 w-3.5" /></button>
                      <button onClick={() => setEditingId(null)} className="text-destructive hover:text-destructive/80 shrink-0"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 group">
                      <span className="truncate">{apt.notes || "-"}</span>
                      <button onClick={() => { setEditingId(apt.id); setEditNote(apt.notes || ""); }} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary shrink-0"><Pencil className="h-3 w-3" /></button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginationControls page={page} totalPages={totalPages} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} onPageSizeChange={setPageSize} />
    </>
  );
};

const ParentDashboard = ({ profile }: { profile: any }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t, dir, lang } = useLanguage();
  const [apptSearch, setApptSearch] = useState("");
  const { data: parents = [] } = useTableQuery("parents");
  const { data: patients = [] } = useTableQuery("patients");
  const { data: appointments = [] } = useTableQuery("appointments");
  const { data: notifications = [] } = useTableQuery("notifications", { filters: { user_id: user?.id } });
  const { data: profiles = [] } = useTableQuery("profiles");
  const { data: tasks = [] } = useTableQuery("patient_tasks");

  const parentRecord = parents.find((p: any) => p.user_id === user?.id);
  const myChildren = patients.filter((p: any) => p.parent_id === parentRecord?.id);
  const myChildIds = myChildren.map((c: any) => c.id);
  const myAppointments = appointments.filter((a: any) => myChildIds.includes(a.patient_id));
  const unreadNotifs = notifications.filter((n: any) => !n.read).length;
  const myTasks = tasks.filter((t: any) => t.parent_id === parentRecord?.id || myChildIds.includes(t.patient_id));
  const pendingTasksCount = myTasks.length;

  const doctorIds = [...new Set(myChildren.map((c: any) => c.doctor_id).filter(Boolean))];
  const doctors = doctorIds.map((id) => profiles.find((p: any) => p.id === id)).filter(Boolean);

  const todayAppts = myAppointments.filter((a: any) => {
    const d = new Date(a.date);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }).length;

  return (
    <DashboardLayout>
      <div dir={dir} className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="neu-flat rounded-3xl p-6 bg-background overflow-hidden relative">
          <div className="absolute inset-0 gradient-primary opacity-[0.07] rounded-3xl" />
          <div className="relative flex items-center gap-4">
            <img src={logoImg} alt="EHS" className="h-14 w-14 rounded-xl object-contain" />
            <div>
              <h2 className="text-2xl font-bold font-cairo">{t.welcome} {profile?.full_name || t.welcomeParent} 👋</h2>
              <p className="text-muted-foreground mt-1 font-cairo">{t.parentDashSubtitle}</p>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard icon={Baby} title={t.myChildren} value={myChildren.length} subtitle={t.registered} gradient="gradient-primary" />
          <StatCard icon={Calendar} title={t.scheduledAppointments} value={myAppointments.filter((a: any) => a.status === "مجدول").length} subtitle={`${t.of} ${myAppointments.length}`} gradient="gradient-accent" />
          <StatCard icon={ListTodo} title={t.myTasks} value={pendingTasksCount} subtitle={`${t.of} ${myTasks.length}`} gradient="gradient-warning" />
          <StatCard icon={Bell} title={t.statNotifications} value={unreadNotifs} subtitle={t.unread} gradient="gradient-success" />
        </div>

        {/* Row 1: Mes enfants + Médecins traitants */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Mes enfants */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="neu-flat rounded-3xl bg-background p-5 space-y-3">
            <h3 className="text-base font-bold font-cairo flex items-center gap-2">
              <Baby className="h-5 w-5 text-primary" /> {t.myChildren}
            </h3>
            {myChildren.length === 0 ? (
              <p className="text-sm text-muted-foreground font-cairo">{t.noData}</p>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto">
                {myChildren.map((child: any, i: number) => {
                  const doctor = profiles.find((p: any) => p.id === child.doctor_id);
                  return (
                    <div key={child.id} onClick={() => navigate(`/patients/${child.id}`)}
                      className="flex items-center gap-3 bg-muted/30 rounded-xl p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                      {child.photo_url ? (
                        <img src={child.photo_url} alt={child.name} className="h-10 w-10 rounded-xl object-cover shrink-0" />
                      ) : (
                        <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground font-bold shrink-0">
                          {child.name?.charAt(0)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium font-cairo truncate">{child.name}</p>
                        <p className="text-xs text-muted-foreground font-cairo">{child.age} {t.years} • {child.status}</p>
                        {child.diagnosis_type && <p className="text-xs text-primary font-cairo">{child.diagnosis_type}</p>}
                      </div>
                      {doctor && (
                        <span className="text-xs text-muted-foreground font-cairo shrink-0 flex items-center gap-1">
                          <Stethoscope className="h-3 w-3" />{doctor.full_name}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* Médecins traitants */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="neu-flat rounded-3xl bg-background p-5 space-y-3">
            <h3 className="text-base font-bold font-cairo flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-primary" /> {t.treatingDoctors}
            </h3>
            {doctors.length === 0 ? (
              <p className="text-sm text-muted-foreground font-cairo">{t.noData}</p>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto">
                {doctors.map((doc: any) => {
                  const docChildren = myChildren.filter((c: any) => c.doctor_id === doc.id);
                  const docAppts = myAppointments.filter((a: any) => docChildren.some((c: any) => c.id === a.patient_id));
                  return (
                    <div key={doc.id} className="bg-muted/30 rounded-xl p-3 space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl gradient-accent flex items-center justify-center text-primary-foreground font-bold shrink-0">
                          {doc.full_name?.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold font-cairo text-sm truncate">{doc.full_name}</h4>
                          {doc.specialty && <p className="text-xs text-muted-foreground font-cairo">{doc.specialty}</p>}
                        </div>
                      </div>
                      {doc.phone && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-cairo">
                          <Phone className="h-3.5 w-3.5" /><span>{doc.phone}</span>
                        </div>
                      )}
                      <div className="flex gap-2 text-xs font-cairo">
                        <span className="bg-primary/10 text-primary rounded-lg px-2 py-0.5">
                          <Users className="h-3 w-3 inline ml-1" />{docChildren.length} {t.children}
                        </span>
                        <span className="bg-accent/10 text-accent-foreground rounded-lg px-2 py-0.5">
                          <Calendar className="h-3 w-3 inline ml-1" />{docAppts.length} {t.appointments}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>

        {/* Row 2: RDV programmés + Mes tâches */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* RDV programmés */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="neu-flat rounded-3xl bg-background p-5 space-y-3">
            <h3 className="text-base font-bold font-cairo flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" /> {t.scheduledAppointments}
            </h3>
            {myAppointments.filter((a: any) => a.status === "مجدول").length === 0 ? (
              <p className="text-sm text-muted-foreground font-cairo">{t.noAppointments}</p>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto">
                {myAppointments.filter((a: any) => a.status === "مجدول").map((apt: any) => {
                  const child = myChildren.find((c: any) => c.id === apt.patient_id);
                  const doc = profiles.find((p: any) => p.id === apt.doctor_id);
                  return (
                    <div key={apt.id} className="flex items-center gap-3 bg-muted/30 rounded-xl p-3">
                      <div className="h-9 w-9 rounded-xl gradient-accent flex items-center justify-center shrink-0">
                        <Calendar className="h-4 w-4 text-primary-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium font-cairo truncate">{child?.name || "-"}</p>
                        <p className="text-xs text-muted-foreground font-cairo">
                          {doc?.full_name || "-"} • {new Date(apt.date).toLocaleDateString(lang === "fr" ? "fr-FR" : "ar-DZ", { month: "short", day: "numeric" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* Mes tâches */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="neu-flat rounded-3xl bg-background p-5 space-y-3">
            <h3 className="text-base font-bold font-cairo flex items-center gap-2">
              <ListTodo className="h-5 w-5 text-primary" /> {t.myTasks}
            </h3>
            {myTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground font-cairo">{t.noTasks}</p>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto">
                {myTasks.map((task: any) => {
                  const child = myChildren.find((c: any) => c.id === task.patient_id);
                  return (
                    <div key={task.id} className="bg-muted/30 rounded-xl p-3 space-y-1">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl gradient-warning flex items-center justify-center shrink-0">
                          <ListTodo className="h-4 w-4 text-primary-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium font-cairo truncate">{task.title}</p>
                          <p className="text-xs text-muted-foreground font-cairo">{child?.name || "-"} • {task.type || "-"}</p>
                        </div>
                      </div>
                      {task.description && (
                        <div className="text-xs text-muted-foreground font-cairo">
                          <p className="line-clamp-2">{task.description}</p>
                          {task.description.length > 80 && (
                            <button onClick={() => navigate(`/patients/${task.patient_id}`)}
                              className="text-primary hover:underline text-xs font-cairo mt-1">
                              {t.viewMore}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="neu-flat rounded-3xl bg-background p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-bold font-cairo flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" /> {t.appointments}
            </h3>
            <div className="neu-flat-sm rounded-xl bg-background px-3 py-2 flex items-center gap-2 w-full sm:w-64">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input value={apptSearch} onChange={(e) => setApptSearch(e.target.value)} placeholder={t.searchAppointments} className="bg-transparent outline-none text-sm flex-1 font-cairo" />
            </div>
          </div>
          <AppointmentsTable appointments={myAppointments} patients={patients} profiles={profiles} searchTerm={apptSearch} />
        </motion.div>
      </div>
    </DashboardLayout>
  );
};

const DashboardSkeleton = () => {
  const { dir } = useLanguage();
  return (
    <DashboardLayout>
      <div dir={dir} className="space-y-6">
        <Skeleton className="h-24 w-full rounded-3xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-3xl" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    </DashboardLayout>
  );
};

const Index = () => {
  const { profile, user } = useAuth();
  const role = useRole();
  const { t, dir } = useLanguage();
  const [apptSearch, setApptSearch] = useState("");
  const { filterPatients, filterAppointments, filterParents } = useDataFiltering();
  const { data: patientsRaw = [], isLoading: loadingPatients } = useTableQuery("patients");
  const { data: appointmentsRaw = [], isLoading: loadingAppts } = useTableQuery("appointments");
  const { data: userRoles = [] } = useTableQuery("user_roles");
  const { data: parentsRaw = [] } = useTableQuery("parents");
  const { data: profiles = [] } = useTableQuery("profiles");
  const { data: allNotifications = [] } = useTableQuery("notifications");
  const { data: allTasks = [] } = useTableQuery("patient_tasks");

  if (role === "parent") {
    return <ParentDashboard profile={profile} />;
  }

  if (role === "receptionist") {
    return <Navigate to="/reception" replace />;
  }

  const isLoading = loadingPatients || loadingAppts;
  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const roleLabelsTranslated: Record<string, string> = {
    super_admin: t.roleSuperAdmin,
    admin: t.roleAdmin,
    user: t.roleUser,
    parent: t.roleParent,
    receptionist: t.roleReceptionist,
  };

  const patients = filterPatients(patientsRaw);
  const appointments = filterAppointments(appointmentsRaw);
  const parentsList = filterParents(parentsRaw);
  
  // Calculate doctor count based on role
  // For admins: count doctors created by this admin (use user.id, not profile.id)
  // For super admins: count all doctors
  const doctorCount = role === "admin" 
    ? profiles.filter((p: any) => 
        p.created_by === user?.id && 
        userRoles.some((r: any) => r.user_id === p.id && r.role === "user")
      ).length
    : (role === "super_admin" 
        ? userRoles.filter((r: any) => r.role === "user").length
        : 0
      );
  const patientIds = patients.map((p: any) => p.id);
  const scopedTasks = allTasks.filter((t: any) => patientIds.includes(t.patient_id));
  const serviceCount = userRoles.filter((r: any) => r.role === "admin").length;
  const todayAppts = appointments.filter((a: any) => {
    const d = new Date(a.date);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }).length;

  return (
    <DashboardLayout>
      <div dir={dir} className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="neu-flat rounded-3xl p-6 bg-background overflow-hidden relative">
          <div className="absolute inset-0 gradient-primary opacity-[0.07] rounded-3xl" />
          <div className="relative flex items-center gap-4">
            <img src={logoImg} alt="EHS" className="h-14 w-14 rounded-xl object-contain" />
            <div>
              <h2 className="text-2xl font-bold font-cairo">{t.welcome} {profile?.full_name || t.welcomeUser} 👋</h2>
              <p className="text-muted-foreground mt-1 font-cairo">
                {role ? `${roleLabelsTranslated[role]} - ` : ""}{t.systemSummary}
              </p>
            </div>
          </div>
        </motion.div>

        <div className={`grid grid-cols-1 sm:grid-cols-2 ${role === "super_admin" ? "lg:grid-cols-3" : "lg:grid-cols-4"} gap-4`}>
          <StatCard icon={Users} title={t.statPatients} value={patients.length} subtitle={role === "user" ? t.yourPatients : t.inDepartment} gradient="gradient-primary" />
          {role === "super_admin" && (
            <StatCard icon={Building2} title={t.statDepartments} value={serviceCount} subtitle={t.department} gradient="gradient-warning" />
          )}
          {(role === "super_admin" || role === "admin") && (
            <StatCard icon={Stethoscope} title={t.statDoctors} value={doctorCount} subtitle={t.registered} gradient="gradient-accent" />
          )}
          {(role === "super_admin" || role === "admin" || role === "user") && (
            <StatCard icon={Users} title={t.statParents} value={parentsList.length} subtitle={t.registered} gradient="gradient-success" />
          )}
          <StatCard icon={Calendar} title={t.statTodayAppts} value={todayAppts} subtitle={`${t.of} ${appointments.length}`} gradient="gradient-warning" />
          {role === "user" && (
            <StatCard icon={ListTodo} title={t.tabTasks} value={scopedTasks.length} subtitle={t.total} gradient="gradient-accent" />
          )}
          {role === "super_admin" && (
            <StatCard icon={Bell} title={t.statNotifications} value={allNotifications.length} subtitle={`${allNotifications.filter((n: any) => !n.read).length} ${t.unread}`} gradient="gradient-accent" />
          )}
        </div>

        {/* Today's Appointments Widget */}
        <TodayAppointments />

        {/* Full Appointments Schedule */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="neu-flat rounded-3xl bg-background p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-bold font-cairo flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" /> {t.appointmentsSchedule}
            </h3>
            <div className="neu-flat-sm rounded-xl bg-background px-3 py-2 flex items-center gap-2 w-full sm:w-64">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input value={apptSearch} onChange={(e) => setApptSearch(e.target.value)} placeholder={t.searchAppointments} className="bg-transparent outline-none text-sm flex-1 font-cairo" />
            </div>
          </div>
          <AppointmentsTable appointments={appointments} patients={patients} profiles={profiles} searchTerm={apptSearch} />
        </motion.div>
      </div>
    </DashboardLayout>
  );
};

export default Index;
