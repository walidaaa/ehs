import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { motion } from "framer-motion";
import { Stethoscope, Users, Heart, Calendar, Search, Clock, User, Phone, FileText, Activity, ChevronDown } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useState, useMemo } from "react";
import { TodayAppointments } from "@/components/dashboard/TodayAppointments";
import { useTableQuery, useUpdateMutation } from "@/hooks/useSupabaseQuery";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/shared/PaginationControls";
import { translateValue, appointmentStatusMap, appointmentTypeMap, patientStatusMap, diagnosisMap } from "@/lib/translationMaps";
import { StatCard } from "@/components/dashboard/StatCard";
import logoImg from "@/assets/logo-themed.png";

const statusStyles: Record<string, string> = {
  "مجدول": "gradient-primary text-primary-foreground",
  "مكتمل": "gradient-success text-primary-foreground",
  "ملغي": "bg-destructive/20 text-destructive",
  "غائب": "bg-orange-500/20 text-orange-600 dark:text-orange-400",
};

type ViewTab = "all" | "doctors" | "patients" | "parents" | "appointments";

const Reception = () => {
  const { t, dir, lang } = useLanguage();
  const { user, profile } = useAuth();
  const [globalSearch, setGlobalSearch] = useState("");
  const [viewTab, setViewTab] = useState<ViewTab>("all");
  const [apptTab, setApptTab] = useState("today");

  const { data: profiles = [] } = useTableQuery("profiles");
  const { data: userRoles = [] } = useTableQuery("user_roles");
  const { data: patients = [] } = useTableQuery("patients");
  const { data: parents = [] } = useTableQuery("parents");
  const { data: appointments = [] } = useTableQuery("appointments");
  const { data: patientDoctors = [] } = useTableQuery("patient_doctors");
  const updateApptMut = useUpdateMutation("appointments");

  // Get doctors in the same service
  const myProfile = profiles.find((p: any) => p.id === user?.id);
  const myCreatedBy = myProfile?.created_by;
  // Include all users created by the same admin (doctors, receptionists, etc.)
  const serviceUserIds = profiles
    .filter((p: any) => p.created_by === myCreatedBy || p.id === myCreatedBy)
    .map((p: any) => p.id);
  const serviceDoctorIds = serviceUserIds
    .filter((id: string) => userRoles.some((r: any) => r.user_id === id && (r.role === "user" || r.role === "admin")));
  // Only actual doctors (role=user) for display
  const displayDoctorIds = serviceUserIds
    .filter((id: string) => userRoles.some((r: any) => r.user_id === id && r.role === "user"));

  const serviceDoctors = profiles.filter((p: any) => displayDoctorIds.includes(p.id));

  // Patients linked to service doctors
  const servicePatientIds = new Set<string>();
  patients.forEach((p: any) => {
    if (serviceDoctorIds.includes(p.doctor_id)) servicePatientIds.add(p.id);
  });
  patientDoctors.forEach((pd: any) => {
    if (serviceDoctorIds.includes(pd.doctor_id)) servicePatientIds.add(pd.patient_id);
  });
  const servicePatients = patients.filter((p: any) => servicePatientIds.has(p.id));

  // Parents of service patients
  const parentIds = new Set(servicePatients.map((p: any) => p.parent_id).filter(Boolean));
  const serviceParents = parents.filter((p: any) => parentIds.has(p.id));

  // Appointments of service doctors
  const serviceAppointments = appointments.filter((a: any) => serviceDoctorIds.includes(a.doctor_id));

  const getPatientName = (id: string) => patients.find((p: any) => p.id === id)?.name || "-";
  const getDoctorName = (id: string) => profiles.find((p: any) => p.id === id)?.full_name || "-";
  const getParentForPatient = (patientId: string) => {
    const patient = patients.find((p: any) => p.id === patientId);
    if (!patient?.parent_id) return null;
    return parents.find((p: any) => p.id === patient.parent_id);
  };

  const now = new Date();
  const todayStr = now.toDateString();

  const todayAppts = serviceAppointments.filter((a: any) => new Date(a.date).toDateString() === todayStr).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const upcomingAppts = serviceAppointments.filter((a: any) => new Date(a.date) > now && new Date(a.date).toDateString() !== todayStr).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const pastAppts = serviceAppointments.filter((a: any) => new Date(a.date) < now && new Date(a.date).toDateString() !== todayStr).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const locale = lang === "fr" ? "fr-FR" : "ar-DZ";

  // Global search filtering
  const searchLower = globalSearch.toLowerCase();
  const filteredDoctors = serviceDoctors.filter((d: any) =>
    !globalSearch || d.full_name?.toLowerCase().includes(searchLower) || d.specialty?.toLowerCase().includes(searchLower)
  );
  const filteredPatients = servicePatients.filter((p: any) =>
    !globalSearch || p.name?.toLowerCase().includes(searchLower) || p.diagnosis_type?.toLowerCase().includes(searchLower)
  );
  const filteredParents = serviceParents.filter((p: any) =>
    !globalSearch || p.full_name?.toLowerCase().includes(searchLower) || p.phone?.includes(globalSearch)
  );

  const currentAppts = apptTab === "today" ? todayAppts : apptTab === "upcoming" ? upcomingAppts : pastAppts;
  const filteredAppts = currentAppts.filter((a: any) =>
    !globalSearch ||
    getPatientName(a.patient_id).toLowerCase().includes(searchLower) ||
    getDoctorName(a.doctor_id).toLowerCase().includes(searchLower) ||
    (a.type || "").toLowerCase().includes(searchLower)
  );

  return (
    <DashboardLayout>
      <div dir={dir} className="space-y-5">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="neu-flat rounded-3xl p-5 bg-background overflow-hidden relative">
          <div className="absolute inset-0 gradient-primary opacity-[0.07] rounded-3xl" />
          <div className="relative flex items-center gap-4">
            <img src={logoImg} alt="EHS" className="h-12 w-12 rounded-xl object-contain" />
            <div className="flex-1">
              <h2 className="text-xl font-bold font-cairo">{t.receptionTitle}</h2>
              <p className="text-muted-foreground text-sm font-cairo">{t.receptionSubtitle}</p>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={Stethoscope} title={t.receptionDoctors} value={serviceDoctors.length} subtitle={t.registered} gradient="gradient-primary" />
          <StatCard icon={Users} title={t.receptionPatients} value={servicePatients.length} subtitle={t.registered} gradient="gradient-accent" />
          <StatCard icon={Heart} title={t.receptionParents} value={serviceParents.length} subtitle={t.registered} gradient="gradient-success" />
          <StatCard icon={Calendar} title={t.statTodayAppts} value={todayAppts.length} subtitle={`${t.of} ${serviceAppointments.length}`} gradient="gradient-warning" />
        </div>

        {/* Today's & Tomorrow's Appointments Widget */}
        <TodayAppointments />

        {/* Global Search */}
        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
          className="neu-flat rounded-2xl bg-background px-4 py-3 flex items-center gap-3">
          <Search className="h-5 w-5 text-primary shrink-0" />
          <input
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            placeholder={t.receptionSearchAll}
            className="bg-transparent outline-none text-sm flex-1 font-cairo placeholder:text-muted-foreground"
          />
          {globalSearch && (
            <button onClick={() => setGlobalSearch("")} className="text-xs text-muted-foreground hover:text-foreground font-cairo">
              {t.cancel}
            </button>
          )}
        </motion.div>

        {/* View Tabs */}
        <Tabs value={viewTab} onValueChange={(v) => setViewTab(v as ViewTab)}>
          <TabsList className="w-full sm:w-auto bg-muted/30">
            <TabsTrigger value="all" className="font-cairo text-xs">{t.receptionAllData}</TabsTrigger>
            <TabsTrigger value="doctors" className="font-cairo text-xs">{t.receptionFilterDoctors} ({filteredDoctors.length})</TabsTrigger>
            <TabsTrigger value="patients" className="font-cairo text-xs">{t.receptionFilterPatients} ({filteredPatients.length})</TabsTrigger>
            <TabsTrigger value="parents" className="font-cairo text-xs">{t.receptionFilterParents} ({filteredParents.length})</TabsTrigger>
            <TabsTrigger value="appointments" className="font-cairo text-xs">{t.receptionFilterAppointments}</TabsTrigger>
          </TabsList>

          {/* ALL tab - overview cards */}
          <TabsContent value="all" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <DoctorsCard doctors={filteredDoctors} t={t} />
              <PatientsCard patients={filteredPatients} allPatients={patients} parents={parents} profiles={profiles} t={t} lang={lang} />
              <ParentsCard parents={filteredParents} servicePatients={servicePatients} t={t} />
            </div>
            <AppointmentsSection
              todayAppts={todayAppts} upcomingAppts={upcomingAppts} pastAppts={pastAppts}
              filteredAppts={filteredAppts} apptTab={apptTab} setApptTab={setApptTab}
              patients={patients} profiles={profiles} parents={parents}
              locale={locale} t={t} globalSearch={globalSearch} updateApptMut={updateApptMut}
            />
          </TabsContent>

          {/* Doctors tab */}
          <TabsContent value="doctors" className="mt-4">
            <DoctorsDetailCard doctors={filteredDoctors} servicePatients={servicePatients} t={t} />
          </TabsContent>

          {/* Patients tab */}
          <TabsContent value="patients" className="mt-4">
            <PatientsDetailCard patients={filteredPatients} parents={parents} profiles={profiles} t={t} lang={lang} />
          </TabsContent>

          {/* Parents tab */}
          <TabsContent value="parents" className="mt-4">
            <ParentsDetailCard parents={filteredParents} servicePatients={servicePatients} profiles={profiles} t={t} />
          </TabsContent>

          {/* Appointments tab */}
          <TabsContent value="appointments" className="mt-4">
            <AppointmentsSection
              todayAppts={todayAppts} upcomingAppts={upcomingAppts} pastAppts={pastAppts}
              filteredAppts={filteredAppts} apptTab={apptTab} setApptTab={setApptTab}
              patients={patients} profiles={profiles} parents={parents}
              locale={locale} t={t} globalSearch={globalSearch} updateApptMut={updateApptMut}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

// --- Sub-components ---

function DoctorsCard({ doctors, t }: any) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="neu-flat rounded-3xl bg-background p-5 space-y-3">
      <h3 className="text-base font-bold font-cairo flex items-center gap-2">
        <Stethoscope className="h-5 w-5 text-primary" /> {t.receptionDoctors}
      </h3>
      <div className="space-y-2 max-h-[250px] overflow-y-auto">
        {doctors.length === 0 ? (
          <p className="text-sm text-muted-foreground font-cairo">{t.noData}</p>
        ) : doctors.map((doc: any) => (
          <div key={doc.id} className="flex items-center gap-3 bg-muted/30 rounded-xl p-3">
            <div className="h-9 w-9 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground font-bold shrink-0 text-sm">
              {doc.full_name?.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium font-cairo truncate">{doc.full_name}</p>
              <p className="text-xs text-muted-foreground font-cairo">{doc.specialty || "-"}</p>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function PatientsCard({ patients, allPatients, parents, profiles, t, lang }: any) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="neu-flat rounded-3xl bg-background p-5 space-y-3">
      <h3 className="text-base font-bold font-cairo flex items-center gap-2">
        <Users className="h-5 w-5 text-primary" /> {t.receptionPatients}
      </h3>
      <div className="space-y-2 max-h-[250px] overflow-y-auto">
        {patients.length === 0 ? (
          <p className="text-sm text-muted-foreground font-cairo">{t.noData}</p>
        ) : patients.map((p: any) => {
          const parent = parents.find((par: any) => par.id === p.parent_id);
          const doctor = profiles.find((pr: any) => pr.id === p.doctor_id);
          return (
            <div key={p.id} className="bg-muted/30 rounded-xl p-3 space-y-1">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl gradient-accent flex items-center justify-center text-primary-foreground font-bold shrink-0 text-sm">
                  {p.name?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium font-cairo truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground font-cairo">{p.age} {t.years} • {translateValue(p.status, patientStatusMap, t)}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground font-cairo mr-12">
                {doctor && <span className="flex items-center gap-1"><Stethoscope className="h-3 w-3" />{doctor.full_name}</span>}
                {parent && <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{parent.full_name}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function ParentsCard({ parents, servicePatients, t }: any) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="neu-flat rounded-3xl bg-background p-5 space-y-3">
      <h3 className="text-base font-bold font-cairo flex items-center gap-2">
        <Heart className="h-5 w-5 text-primary" /> {t.receptionParents}
      </h3>
      <div className="space-y-2 max-h-[250px] overflow-y-auto">
        {parents.length === 0 ? (
          <p className="text-sm text-muted-foreground font-cairo">{t.noData}</p>
        ) : parents.map((p: any) => {
          const childrenCount = servicePatients.filter((pt: any) => pt.parent_id === p.id).length;
          return (
            <div key={p.id} className="flex items-center gap-3 bg-muted/30 rounded-xl p-3">
              <div className="h-9 w-9 rounded-xl gradient-success flex items-center justify-center text-primary-foreground font-bold shrink-0 text-sm">
                {p.full_name?.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium font-cairo truncate">{p.full_name}</p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground font-cairo">
                  {p.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{p.phone}</span>}
                  <span>{childrenCount} {t.receptionPatients}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function DoctorsDetailCard({ doctors, servicePatients, t }: any) {
  const { paginatedItems, page, setPage, pageSize, setPageSize, totalPages, totalItems } = usePagination(doctors);

  if (doctors.length === 0) return <EmptyState t={t} />;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="neu-flat rounded-3xl bg-background p-5 space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm font-cairo">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-right py-3 px-3 font-semibold text-muted-foreground">{t.name}</th>
              <th className="text-right py-3 px-3 font-semibold text-muted-foreground">{t.receptionSpecialty}</th>
              <th className="text-right py-3 px-3 font-semibold text-muted-foreground">{t.phone}</th>
              <th className="text-right py-3 px-3 font-semibold text-muted-foreground">{t.receptionPatients}</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((doc: any) => {
              const patCount = servicePatients.filter((p: any) => p.doctor_id === doc.id).length;
              return (
                <tr key={doc.id} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center text-primary-foreground font-bold text-xs shrink-0">
                        {doc.full_name?.charAt(0)}
                      </div>
                      <span className="font-medium">{doc.full_name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-muted-foreground">{doc.specialty || "-"}</td>
                  <td className="py-3 px-3 text-muted-foreground">{doc.phone || "-"}</td>
                  <td className="py-3 px-3">
                    <span className="bg-primary/10 text-primary rounded-lg px-2 py-0.5 text-xs font-medium">{patCount}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <PaginationControls page={page} totalPages={totalPages} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} onPageSizeChange={setPageSize} />
    </motion.div>
  );
}

function PatientsDetailCard({ patients, parents, profiles, t, lang }: any) {
  const { paginatedItems, page, setPage, pageSize, setPageSize, totalPages, totalItems } = usePagination(patients);
  const locale = lang === "fr" ? "fr-FR" : "ar-DZ";

  if (patients.length === 0) return <EmptyState t={t} />;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="neu-flat rounded-3xl bg-background p-5 space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm font-cairo">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-right py-3 px-3 font-semibold text-muted-foreground">{t.name}</th>
              <th className="text-right py-3 px-3 font-semibold text-muted-foreground">{t.receptionAge}</th>
              <th className="text-right py-3 px-3 font-semibold text-muted-foreground">{t.receptionDiagnosis}</th>
              <th className="text-right py-3 px-3 font-semibold text-muted-foreground">{t.doctor}</th>
              <th className="text-right py-3 px-3 font-semibold text-muted-foreground">{t.receptionParentName}</th>
              <th className="text-right py-3 px-3 font-semibold text-muted-foreground">{t.receptionParentPhone}</th>
              <th className="text-right py-3 px-3 font-semibold text-muted-foreground">{t.status}</th>
              <th className="text-right py-3 px-3 font-semibold text-muted-foreground">{t.receptionEntryDate}</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((p: any) => {
              const parent = parents.find((par: any) => par.id === p.parent_id);
              const doctor = profiles.find((pr: any) => pr.id === p.doctor_id);
              return (
                <tr key={p.id} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg gradient-accent flex items-center justify-center text-primary-foreground font-bold text-xs shrink-0">
                        {p.name?.charAt(0)}
                      </div>
                      <span className="font-medium">{p.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-muted-foreground">{p.age} {t.years}</td>
                  <td className="py-3 px-3 text-primary text-xs">{translateValue(p.diagnosis_type, diagnosisMap, t)}</td>
                  <td className="py-3 px-3 text-muted-foreground">{doctor?.full_name || "-"}</td>
                  <td className="py-3 px-3 text-muted-foreground">{parent?.full_name || "-"}</td>
                  <td className="py-3 px-3 text-muted-foreground">{parent?.phone || "-"}</td>
                  <td className="py-3 px-3">
                    <span className="bg-muted rounded-lg px-2 py-0.5 text-xs">{translateValue(p.status, patientStatusMap, t)}</span>
                  </td>
                  <td className="py-3 px-3 text-xs text-muted-foreground">
                    {p.entry_date ? new Date(p.entry_date).toLocaleDateString(locale) : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <PaginationControls page={page} totalPages={totalPages} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} onPageSizeChange={setPageSize} />
    </motion.div>
  );
}

function ParentsDetailCard({ parents, servicePatients, profiles, t }: any) {
  const { paginatedItems, page, setPage, pageSize, setPageSize, totalPages, totalItems } = usePagination(parents);

  if (parents.length === 0) return <EmptyState t={t} />;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="neu-flat rounded-3xl bg-background p-5 space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm font-cairo">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-right py-3 px-3 font-semibold text-muted-foreground">{t.name}</th>
              <th className="text-right py-3 px-3 font-semibold text-muted-foreground">{t.phone}</th>
              <th className="text-right py-3 px-3 font-semibold text-muted-foreground">{t.receptionPatients}</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((p: any) => {
              const children = servicePatients.filter((pt: any) => pt.parent_id === p.id);
              return (
                <tr key={p.id} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg gradient-success flex items-center justify-center text-primary-foreground font-bold text-xs shrink-0">
                        {p.full_name?.charAt(0)}
                      </div>
                      <span className="font-medium">{p.full_name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-muted-foreground">{p.phone || "-"}</td>
                  <td className="py-3 px-3">
                    <div className="flex flex-wrap gap-1">
                      {children.length === 0 ? (
                        <span className="text-muted-foreground text-xs">-</span>
                      ) : children.map((c: any) => (
                        <span key={c.id} className="bg-accent/10 text-accent-foreground rounded-lg px-2 py-0.5 text-xs">{c.name}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <PaginationControls page={page} totalPages={totalPages} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} onPageSizeChange={setPageSize} />
    </motion.div>
  );
}

function AppointmentsSection({ todayAppts, upcomingAppts, pastAppts, filteredAppts, apptTab, setApptTab, patients, profiles, parents, locale, t, globalSearch, updateApptMut }: any) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="neu-flat rounded-3xl bg-background p-5 space-y-4">
      <h3 className="text-lg font-bold font-cairo flex items-center gap-2">
        <Calendar className="h-5 w-5 text-primary" /> {t.receptionAppointments}
      </h3>

      <Tabs value={apptTab} onValueChange={setApptTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="today" className="font-cairo text-xs">{t.todayAppointments} ({todayAppts.length})</TabsTrigger>
          <TabsTrigger value="upcoming" className="font-cairo text-xs">{t.upcomingAppointments2} ({upcomingAppts.length})</TabsTrigger>
          <TabsTrigger value="past" className="font-cairo text-xs">{t.pastAppointments} ({pastAppts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value={apptTab} className="mt-4">
          <AppointmentsGrid appointments={filteredAppts} patients={patients} profiles={profiles} parents={parents} locale={locale} t={t} updateApptMut={updateApptMut} />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}

function AppointmentsGrid({ appointments, patients, profiles, parents, locale, t, updateApptMut }: any) {
  const { paginatedItems, page, setPage, pageSize, setPageSize, totalPages, totalItems } = usePagination(appointments);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>("");

  const getPatientName = (id: string) => patients.find((p: any) => p.id === id)?.name || "-";
  const getDoctorName = (id: string) => profiles.find((p: any) => p.id === id)?.full_name || "-";
  const getParent = (patientId: string) => {
    const patient = patients.find((p: any) => p.id === patientId);
    if (!patient?.parent_id) return null;
    return parents.find((p: any) => p.id === patient.parent_id);
  };

  const statusOptions = [
    { value: "مجدول", label: t.statusScheduled || "مجدول", style: "gradient-primary text-primary-foreground" },
    { value: "مكتمل", label: t.statusCompleted || "مكتمل", style: "gradient-success text-primary-foreground" },
    { value: "غائب", label: t.statusAbsent || "غائب", style: "bg-orange-500 text-white" },
  ];

  const getStatusStyle = (status: string) => {
    const opt = statusOptions.find(o => o.value === status);
    return opt?.style || "bg-muted";
  };

  const getStatusLabel = (status: string) => {
    const opt = statusOptions.find(o => o.value === status);
    return opt?.label || status;
  };

  const openStatusPicker = (aptId: string, currentStatus: string) => {
    setOpenDropdown(aptId);
    setSelectedStatus(currentStatus || "مجدول");
  };

  const confirmStatus = (aptId: string) => {
    updateApptMut.mutate({ id: aptId, status: selectedStatus });
    setOpenDropdown(null);
  };

  if (appointments.length === 0) {
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
              <th className="text-right py-3 px-3 font-semibold text-muted-foreground">{t.receptionParentName}</th>
              <th className="text-right py-3 px-3 font-semibold text-muted-foreground">{t.receptionParentPhone}</th>
              <th className="text-right py-3 px-3 font-semibold text-muted-foreground">{t.dateTime}</th>
              <th className="text-right py-3 px-3 font-semibold text-muted-foreground">{t.appointmentType}</th>
              <th className="text-right py-3 px-3 font-semibold text-muted-foreground">{t.status}</th>
              <th className="text-right py-3 px-3 font-semibold text-muted-foreground">{t.notes}</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((apt: any) => {
              const parent = getParent(apt.patient_id);
              const isOpen = openDropdown === apt.id;
              return (
                <tr key={apt.id} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-3 font-medium">{getPatientName(apt.patient_id)}</td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-primary" />
                      {getDoctorName(apt.doctor_id)}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-muted-foreground">{parent?.full_name || "-"}</td>
                  <td className="py-3 px-3 text-muted-foreground">{parent?.phone || "-"}</td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      {new Date(apt.date).toLocaleString(locale, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </td>
                  <td className="py-3 px-3">{translateValue(apt.type, appointmentTypeMap, t)}</td>
                  <td className="py-3 px-3 relative">
                    {!isOpen ? (
                      <button
                        onClick={() => openStatusPicker(apt.id, apt.status)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium flex items-center gap-1 cursor-pointer transition-all hover:opacity-80 ${getStatusStyle(apt.status)}`}
                      >
                        {getStatusLabel(apt.status)}
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    ) : (
                      <div className="absolute z-20 top-1 right-0 neu-flat rounded-xl bg-background p-2 shadow-lg border border-border/50 min-w-[140px] space-y-2">
                        <div className="space-y-1">
                          {statusOptions.map(opt => (
                            <button
                              key={opt.value}
                              onClick={() => setSelectedStatus(opt.value)}
                              className={`w-full text-right rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                                selectedStatus === opt.value ? opt.style : "hover:bg-muted/50"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-1 pt-1 border-t border-border/30">
                          <button
                            onClick={() => confirmStatus(apt.id)}
                            disabled={updateApptMut.isPending}
                            className="flex-1 gradient-primary text-primary-foreground rounded-lg px-2 py-1 text-xs font-medium disabled:opacity-50"
                          >
                            {t.confirm}
                          </button>
                          <button
                            onClick={() => setOpenDropdown(null)}
                            className="flex-1 bg-muted rounded-lg px-2 py-1 text-xs font-medium"
                          >
                            {t.cancel}
                          </button>
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3 text-muted-foreground text-xs max-w-[120px] truncate">{apt.notes || "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <PaginationControls page={page} totalPages={totalPages} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} onPageSizeChange={setPageSize} />
    </>
  );
}

function EmptyState({ t }: any) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="neu-flat rounded-3xl bg-background p-10 text-center">
      <p className="text-muted-foreground font-cairo">{t.receptionNoResults || t.noData}</p>
    </motion.div>
  );
}

export default Reception;
