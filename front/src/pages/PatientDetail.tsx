import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { motion } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArrowRight, Plus, Edit, Trash2, Calendar, Pill, ClipboardList, Check, X, Upload, Phone, ListTodo, User, Heart, Baby, Stethoscope, FileText, Clock } from "lucide-react";
import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTableQuery, useInsertMutation, useUpdateMutation, useDeleteMutation } from "@/hooks/useSupabaseQuery";
import { CrudDialog } from "@/components/shared/CrudDialog";
import { DeleteConfirm } from "@/components/shared/DeleteConfirm";
import { usePermissions, useRole } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";
import { crudApi } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PatientTasks from "@/components/patient/PatientTasks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

import { diagnosisKeys, birthTypeKeys, appointmentStatusMap, appointmentTypeMap, appointmentTypeKeys, patientStatusMap, diagnosisMap, birthTypeMap, serviceMap, specialtyMap, translateValue, getTranslatedOptions } from "@/lib/translationMaps";
import { shouldHaveNotif, deleteAptNotifications, createAptNotification } from "@/lib/apptNotifications";

const diagnosisOptions = diagnosisKeys.map(d => d.value);
const birthTypeOptions = birthTypeKeys.map(b => b.value);

// Convert backend URLs to full accessible URLs
const API_BASE_DETAIL = import.meta.env.VITE_API_URL || 'http://localhost:3003/api';

const getImageUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  if (url.startsWith('blob:')) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  
  const backendOrigin = API_BASE_DETAIL.replace(/\/api\/?$/, '');
  const token = localStorage.getItem('token');
  
  // Build full URL
  let fullUrl = url;
  if (!url.startsWith('http')) {
    fullUrl = url.startsWith('/') ? `${backendOrigin}${url}` : `${backendOrigin}/${url}`;
  }
  
  // Add token for authenticated endpoints
  if (fullUrl.includes('/files/') && token) {
    const separator = fullUrl.includes('?') ? '&' : '?';
    fullUrl = `${fullUrl}${separator}token=${encodeURIComponent(token)}`;
  }
  
  return fullUrl;
};

const PatientDetail = () => {
  const { t, dir, lang } = useLanguage();
  const locale = lang === "fr" ? "fr-FR" : "ar-DZ";
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = useRole();
  const perms = usePermissions("patients");
  const apptPerms = usePermissions("appointments");
  const treatPerms = usePermissions("treatments");
  const attPerms = usePermissions("attendance");

  const { data: patients = [] } = useTableQuery("patients");
  const { data: parents = [] } = useTableQuery("parents");
  const { data: profiles = [] } = useTableQuery("profiles");
  const { data: appointments = [] } = useTableQuery("appointments");
  const { data: treatments = [] } = useTableQuery("treatments");
  const { data: attendance = [] } = useTableQuery("attendance");
  const { data: userRoles = [] } = useTableQuery("user_roles");
  const { data: patientDoctors = [] } = useTableQuery("patient_doctors");
  const queryClient = useQueryClient();

  const patient = patients.find((p: any) => p.id === id);
  const parentInfo = parents.find((p: any) => p.id === patient?.parent_id);
  const doctorInfo = profiles.find((p: any) => p.id === patient?.doctor_id);

  // All doctors assigned to this patient via patient_doctors
  const assignedDoctorIds = patientDoctors.filter((pd: any) => pd.patient_id === id).map((pd: any) => pd.doctor_id);
  const assignedDoctors = profiles.filter((p: any) => assignedDoctorIds.includes(p.id));
  // Fallback to single doctor_id if no patient_doctors entries
  const allDoctors = assignedDoctors.length > 0 ? assignedDoctors : (doctorInfo ? [doctorInfo] : []);

  const doctorProfiles = profiles.filter((p: any) =>
    userRoles.some((r: any) => r.user_id === p.id && r.role === "user")
  );

  // Doctor: sees only their own data for this patient
  // Parent/Admin/SuperAdmin: sees all data for this patient
  const isDoctor = role === "user";
  const patientAppts = appointments.filter((a: any) => {
    if (a.patient_id !== id) return false;
    if (isDoctor) return a.doctor_id === user?.id || a.created_by === user?.id;
    return true;
  });
  const patientTreatments = treatments.filter((tr: any) => {
    if (tr.patient_id !== id) return false;
    if (isDoctor) return tr.created_by === user?.id;
    return true;
  });
  const patientAttendance = attendance.filter((a: any) => {
    if (a.patient_id !== id) return false;
    if (isDoctor) return a.recorded_by === user?.id;
    return true;
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const updatePatient = useUpdateMutation("patients");

  const [apptOpen, setApptOpen] = useState(false);
  const [apptEditItem, setApptEditItem] = useState<any>(null);
  const [apptForm, setApptForm] = useState({ date: "", type: "", status: "مجدول", notes: "" });
  const insertAppt = useInsertMutation("appointments");
  const updateAppt = useUpdateMutation("appointments");
  const deleteAppt = useDeleteMutation("appointments");
  const [deleteApptId, setDeleteApptId] = useState<string | null>(null);

  const [treatOpen, setTreatOpen] = useState(false);
  const [treatEditItem, setTreatEditItem] = useState<any>(null);
  const [treatForm, setTreatForm] = useState({ start_date: "", end_date: "", notes: "" });
  const [treatMeds, setTreatMeds] = useState<{ medication_name: string; morning_dose: number; evening_dose: number; night_dose: number; meal_timing: string }[]>([
    { medication_name: "", morning_dose: 0, evening_dose: 0, night_dose: 0, meal_timing: "بعد الأكل" }
  ]);
  const insertTreat = useInsertMutation("treatments");
  const updateTreat = useUpdateMutation("treatments");
  const deleteTreat = useDeleteMutation("treatments");
  const [deleteTreatId, setDeleteTreatId] = useState<string | null>(null);
  const { data: treatmentMedications = [] } = useTableQuery("treatment_medications");
  const insertTreatMed = useInsertMutation("treatment_medications");
  const updateTreatMed = useUpdateMutation("treatment_medications");
  const deleteTreatMed = useDeleteMutation("treatment_medications");

  const [attOpen, setAttOpen] = useState(false);
  const [attEditItem, setAttEditItem] = useState<any>(null);
  const [attForm, setAttForm] = useState({ date: new Date().toISOString().slice(0, 10), present: true, notes: "" });
  const insertAtt = useInsertMutation("attendance");
  const updateAtt = useUpdateMutation("attendance");
  const deleteAtt = useDeleteMutation("attendance");
  const [deleteAttId, setDeleteAttId] = useState<string | null>(null);
  const [editSelectedDoctorIds, setEditSelectedDoctorIds] = useState<string[]>([]);
  const [viewCardDialog, setViewCardDialog] = useState<{ title: string; content: React.ReactNode } | null>(null);
  const updateParent = useUpdateMutation("parents");

  if (!patient) {
    return (
      <DashboardLayout>
        <div dir={dir} className="text-center py-20 font-cairo text-muted-foreground">
          <p>{t.patientNotFound}</p>
          <button onClick={() => navigate("/patients")} className="mt-4 text-primary underline">{t.backToList}</button>
        </div>
      </DashboardLayout>
    );
  }

  const openEdit = () => {
    const parentData = parents.find((p: any) => p.id === patient.parent_id);
    setEditForm({
      name: patient.name, age: String(patient.age), status: patient.status,
      notes: patient.notes || "", diagnosis_type: patient.diagnosis_type || "",
      birth_type: patient.birth_type || "طبيعية", pregnancy_months: String(patient.pregnancy_months ?? 9),
      mother_health_notes: patient.mother_health_notes || "", birth_complications: patient.birth_complications || "",
      parent_name: parentData?.full_name || "", parent_phone: parentData?.phone || "",
    });
    setEditSelectedDoctorIds(assignedDoctorIds.length > 0 ? assignedDoctorIds : (patient.doctor_id ? [patient.doctor_id] : []));
    setPhotoPreview(patient.photo_url || null);
    setPhotoFile(null);
    setEditOpen(true);
  };

  const syncPatientDoctors = async (patientId: string, doctorIds: string[]) => {
    await crudApi.deletePatientDoctors(patientId);
    if (doctorIds.length > 0) {
      const rows = doctorIds.map(did => ({ patient_id: patientId, doctor_id: did }));
      await crudApi.insertPatientDoctorsBatch(rows);
    }
    queryClient.invalidateQueries({ queryKey: ["patient_doctors"] });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let photo_url = patient.photo_url;
    
    // Upload photo if a new one was selected
    if (photoFile) {
      try {
        const { uploadMedia } = await import("@/lib/apiClient");
        const uploadedUrl = await uploadMedia(photoFile);
        if (uploadedUrl) {
          photo_url = uploadedUrl;
        }
      } catch (err: any) {
        console.error("[PatientDetail] Photo upload error:", err);
        toast.error(err.message || "Failed to upload photo");
      }
    }
    
    const primaryDoctorId = editSelectedDoctorIds[0] || patient.doctor_id || user?.id;
    const { parent_name, parent_phone, ...patientFields } = editForm;
    updatePatient.mutate({
      id: patient.id, ...patientFields, age: Number(patientFields.age),
      pregnancy_months: Number(patientFields.pregnancy_months) || 9, photo_url,
      doctor_id: primaryDoctorId,
    }, {
      onSuccess: async () => {
        await syncPatientDoctors(patient.id, editSelectedDoctorIds);
        if (patient.parent_id && (parent_name || parent_phone)) {
          updateParent.mutate({ id: patient.parent_id, full_name: parent_name, phone: parent_phone });
        }
        setEditOpen(false);
      }
    });
  };

  const statusColor = (s: string) => {
    if (s === "تحسن" || s === "amélioration") return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    if (s === "تدهور" || s === "détérioration") return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
  };

  const apptStatusColor = (s: string) => {
    if (s === "مكتمل") return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    if (s === "ملغي") return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
  };

  return (
    <DashboardLayout>
      <div dir={dir} className="space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
          <button onClick={() => navigate("/patients")} className="neu-flat-sm rounded-xl p-2.5 hover:scale-110 transition-transform">
            <ArrowRight className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h2 className="text-2xl font-bold font-cairo">{patient.name}</h2>
            <p className="text-sm text-muted-foreground font-cairo">{patient.age} {t.years} {patient.diagnosis_type ? `• ${translateValue(patient.diagnosis_type, diagnosisMap, t)}` : ""}</p>
          </div>
          {perms.canEdit && (
            <button onClick={openEdit} className="gradient-primary rounded-xl px-4 py-2 flex items-center gap-2 text-sm font-cairo text-primary-foreground hover:scale-105 transition-transform">
              <Edit className="h-4 w-4" />{t.edit}
            </button>
          )}
        </motion.div>

        {/* Patient Info Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Personal Info Card */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="neu-flat rounded-2xl bg-background p-5 flex flex-col h-[280px]">
            <div className="flex items-center gap-3 border-b border-border pb-3 mb-3">
              <div className="gradient-primary rounded-xl p-2"><User className="h-5 w-5 text-primary-foreground" /></div>
              <h3 className="font-bold font-cairo text-sm">{t.personalInfoTitle}</h3>
            </div>
            <div className="flex items-center gap-4 mb-3">
              {patient.photo_url ? (
                <img src={getImageUrl(patient.photo_url) || undefined} alt={patient.name} className="h-14 w-14 rounded-xl object-cover shadow-md shrink-0" />
              ) : (
                <div className="h-14 w-14 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground font-bold text-lg shadow-md shrink-0">
                  {patient.name?.charAt(0)}
                </div>
              )}
              <div className="space-y-1">
                <p className="font-bold font-cairo text-sm">{patient.name}</p>
                <p className="text-xs text-muted-foreground font-cairo">{patient.age} {t.years}</p>
                <Badge className={`${statusColor(patient.status)} border-0 font-cairo text-xs`}>{translateValue(patient.status, patientStatusMap, t)}</Badge>
              </div>
            </div>
            <div className="space-y-1.5 text-sm font-cairo flex-1 overflow-hidden">
              <InfoRow icon={<Stethoscope className="h-4 w-4" />} label={t.diagnosis} value={translateValue(patient.diagnosis_type, diagnosisMap, t)} />
              <InfoRow icon={<Calendar className="h-4 w-4" />} label={t.entryDateLabel} value={patient.entry_date || "-"} />
            </div>
            {(patient.notes) && (
              <button onClick={() => setViewCardDialog({
                title: t.personalInfoTitle,
                content: (
                  <div className="space-y-3 text-sm font-cairo" dir={dir}>
                    <InfoRow icon={<Stethoscope className="h-4 w-4" />} label={t.diagnosis} value={translateValue(patient.diagnosis_type, diagnosisMap, t)} />
                    <InfoRow icon={<Calendar className="h-4 w-4" />} label={t.entryDateLabel} value={patient.entry_date || "-"} />
                    {patient.notes && <InfoRow icon={<FileText className="h-4 w-4" />} label={t.notesLabel} value={patient.notes} />}
                  </div>
                )
              })} className="mt-2 text-xs text-primary font-cairo font-medium hover:underline self-start">
                {t.viewMore}
              </button>
            )}
          </motion.div>

          {/* Medical / Birth Info Card */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="neu-flat rounded-2xl bg-background p-5 flex flex-col h-[280px]">
            <div className="flex items-center gap-3 border-b border-border pb-3 mb-3">
              <div className="gradient-accent rounded-xl p-2"><Baby className="h-5 w-5 text-primary-foreground" /></div>
              <h3 className="font-bold font-cairo text-sm">{t.birthInfo}</h3>
            </div>
            <div className="space-y-1.5 text-sm font-cairo flex-1 overflow-hidden">
              <InfoRow icon={<Heart className="h-4 w-4" />} label={t.birthTypeLabel} value={translateValue(patient.birth_type, birthTypeMap, t)} />
              <InfoRow icon={<Clock className="h-4 w-4" />} label={t.pregnancyMonthsLabel} value={`${patient.pregnancy_months ?? 9} ${t.months}`} />
            </div>
            {(patient.birth_complications || patient.mother_health_notes) && (
              <button onClick={() => setViewCardDialog({
                title: t.birthInfo,
                content: (
                  <div className="space-y-3 text-sm font-cairo" dir={dir}>
                    <InfoRow icon={<Heart className="h-4 w-4" />} label={t.birthTypeLabel} value={translateValue(patient.birth_type, birthTypeMap, t)} />
                    <InfoRow icon={<Clock className="h-4 w-4" />} label={t.pregnancyMonthsLabel} value={`${patient.pregnancy_months ?? 9} ${t.months}`} />
                    {patient.birth_complications && <InfoRow icon={<FileText className="h-4 w-4" />} label={t.complicationsLabel} value={patient.birth_complications} />}
                    {patient.mother_health_notes && <InfoRow icon={<Heart className="h-4 w-4" />} label={t.motherHealthLabel} value={patient.mother_health_notes} />}
                  </div>
                )
              })} className="mt-2 text-xs text-primary font-cairo font-medium hover:underline self-start">
                {t.viewMore}
              </button>
            )}
          </motion.div>

          {/* Parent & Doctor Info Card */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="neu-flat rounded-2xl bg-background p-5 flex flex-col h-[280px]">
            <div className="flex items-center gap-3 border-b border-border pb-3 mb-3">
              <div className="gradient-success rounded-xl p-2"><User className="h-5 w-5 text-primary-foreground" /></div>
              <h3 className="font-bold font-cairo text-sm">{t.doctorAndParent}</h3>
            </div>
            <div className="space-y-3 text-sm font-cairo flex-1 overflow-hidden">
              {allDoctors.length > 0 ? allDoctors.map((doc: any) => (
                <div key={doc.id} className="neu-flat-sm rounded-xl p-3 space-y-1">
                  <p className="text-xs text-muted-foreground">{t.doctor}</p>
                  <p className="font-medium">{doc.full_name}</p>
                  {doc.specialty && <p className="text-xs text-muted-foreground">{translateValue(doc.specialty, specialtyMap, t)}</p>}
                </div>
              )) : (
                <div className="neu-flat-sm rounded-xl p-3 space-y-1">
                  <p className="text-xs text-muted-foreground">{t.doctor}</p>
                  <p className="font-medium">-</p>
                </div>
              )}
              <div className="neu-flat-sm rounded-xl p-3 space-y-1">
                <p className="text-xs text-muted-foreground">{t.parentLabel}</p>
                <p className="font-medium">{parentInfo?.full_name || "-"}</p>
                {parentInfo?.phone && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" />{parentInfo.phone}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </div>

        {/* View Card Dialog */}
        <Dialog open={!!viewCardDialog} onOpenChange={() => setViewCardDialog(null)}>
          <DialogContent className="max-w-lg" dir={dir}>
            <DialogHeader>
              <DialogTitle className="font-cairo">{viewCardDialog?.title}</DialogTitle>
            </DialogHeader>
            <div className="py-2">{viewCardDialog?.content}</div>
          </DialogContent>
        </Dialog>

        {/* Tabs with Tables */}
        <Tabs defaultValue="appointments" dir={dir}>
          <TabsList className="w-full justify-start bg-muted/50 rounded-2xl p-1 flex-wrap">
            <TabsTrigger value="appointments" className="font-cairo rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Calendar className="h-4 w-4 ml-2" />{t.tabAppointments} ({patientAppts.length})
            </TabsTrigger>
            <TabsTrigger value="treatments" className="font-cairo rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Pill className="h-4 w-4 ml-2" />{t.tabTreatments} ({patientTreatments.length})
            </TabsTrigger>
            <TabsTrigger value="attendance" className="font-cairo rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <ClipboardList className="h-4 w-4 ml-2" />{t.tabAttendance} ({patientAttendance.length})
            </TabsTrigger>
            <TabsTrigger value="tasks" className="font-cairo rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <ListTodo className="h-4 w-4 ml-2" />{t.tabTasks}
            </TabsTrigger>
          </TabsList>

          {/* Appointments Table */}
          <TabsContent value="appointments" className="space-y-4 mt-4">
            {apptPerms.canCreate && (
              <button onClick={() => { setApptEditItem(null); setApptForm({ date: "", type: "فحص", status: "مجدول", notes: "" }); setApptOpen(true); }}
                className="gradient-primary rounded-2xl px-4 py-2 flex items-center gap-2 text-sm font-cairo text-primary-foreground hover:scale-105 transition-transform">
                <Plus className="h-4 w-4" />{t.newAppointment}
              </button>
            )}
            {patientAppts.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground font-cairo">{t.noAppointmentsFound}</p>
            ) : (
              <div className="neu-flat rounded-2xl bg-background overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="font-cairo text-right">{t.dateTime}</TableHead>
                      <TableHead className="font-cairo text-right">{t.type}</TableHead>
                      <TableHead className="font-cairo text-right">{t.status}</TableHead>
                      <TableHead className="font-cairo text-right">{t.notes}</TableHead>
                      <TableHead className="font-cairo text-right">{t.actions}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {patientAppts.map((a: any) => (
                      <TableRow key={a.id} className="hover:bg-muted/10">
                        <TableCell className="font-cairo text-sm">
                          {new Date(a.date).toLocaleDateString(locale)} - {new Date(a.date).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                        </TableCell>
                        <TableCell className="font-cairo text-sm">{a.type}</TableCell>
                        <TableCell>
                          <Badge className={`${apptStatusColor(a.status)} border-0 font-cairo text-xs`}>{a.status}</Badge>
                        </TableCell>
                        <TableCell className="font-cairo text-sm text-muted-foreground max-w-[200px] truncate">{a.notes || "-"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {apptPerms.canEdit && (
                              <button onClick={() => {
              setApptEditItem(a);
              setApptForm({ date: a.date?.slice(0, 16) || "", type: a.type || "فحص", status: a.status || "مجدول", notes: a.notes || "" });
              setApptOpen(true);
              // Note: Appointment type and status use Arabic values from database for data consistency
                              }} className="p-1.5 hover:scale-110 transition-transform rounded-lg hover:bg-primary/10">
                                <Edit className="h-4 w-4 text-primary" />
                              </button>
                            )}
                            {apptPerms.canDelete && (
                              <button onClick={() => setDeleteApptId(a.id)} className="p-1.5 hover:scale-110 transition-transform rounded-lg hover:bg-destructive/10">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>


          {/* Treatments Tab - Professional View */}
          <TabsContent value="treatments" className="space-y-4 mt-4">
            {treatPerms.canCreate && (
              <button onClick={() => {
                setTreatForm({ start_date: "", end_date: "", notes: "" });
                setTreatMeds([{ medication_name: "", morning_dose: 0, evening_dose: 0, night_dose: 0, meal_timing: "بعد الأكل" }]);
                setTreatOpen(true);
              }}
                className="gradient-primary rounded-2xl px-4 py-2 flex items-center gap-2 text-sm font-cairo text-primary-foreground hover:scale-105 transition-transform">
                <Plus className="h-4 w-4" />{t.newTreatment}
              </button>
            )}
            {patientTreatments.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground font-cairo">{t.noTreatments}</p>
            ) : (
              <div className="space-y-4">
                {patientTreatments.map((tr: any) => {
                  const meds = treatmentMedications.filter((m: any) => m.treatment_id === tr.id);
                  const isActive = !tr.end_date || new Date(tr.end_date) >= new Date();
                  return (
                    <motion.div key={tr.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      className="neu-flat rounded-2xl bg-background p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`rounded-xl p-2.5 ${isActive ? "gradient-success" : "bg-muted"}`}>
                            <Pill className="h-5 w-5 text-primary-foreground" />
                          </div>
                          <div>
                            <span className={`text-xs rounded-lg px-2.5 py-1 font-cairo font-medium ${isActive ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                              {isActive ? t.treatmentActive : t.treatmentEnded}
                            </span>
                            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground font-cairo">
                              {tr.start_date && <span>📅 {t.startDate}: {tr.start_date}</span>}
                              {tr.end_date && <span>📅 {t.endDate}: {tr.end_date}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {treatPerms.canEdit && (
                            <button onClick={() => {
                              setTreatEditItem(tr);
                              setTreatForm({ start_date: tr.start_date || "", end_date: tr.end_date || "", notes: tr.notes || "" });
                              const existingMeds = treatmentMedications.filter((m: any) => m.treatment_id === tr.id);
                              setTreatMeds(existingMeds.length > 0
                                ? existingMeds.map((m: any) => ({ medication_name: m.medication_name, morning_dose: m.morning_dose || 0, evening_dose: m.evening_dose || 0, night_dose: m.night_dose || 0, meal_timing: m.meal_timing || "بعد الأكل" }))
                                : [{ medication_name: tr.medication || "", morning_dose: 0, evening_dose: 0, night_dose: 0, meal_timing: "بعد الأكل" }]);
                              setTreatOpen(true);
                            }} className="p-1.5 hover:scale-110 transition-transform rounded-lg hover:bg-primary/10">
                              <Edit className="h-4 w-4 text-primary" />
                            </button>
                          )}
                          {treatPerms.canDelete && (
                            <button onClick={() => setDeleteTreatId(tr.id)} className="p-1.5 hover:scale-110 transition-transform rounded-lg hover:bg-destructive/10">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </button>
                          )}
                        </div>
                      </div>
                      {meds.length === 0 && tr.medication && (
                        <div className="neu-flat-sm rounded-xl p-3 flex items-center gap-3">
                          <span className="text-lg">💊</span>
                          <div>
                            <p className="font-medium font-cairo text-sm">{tr.medication}</p>
                            <p className="text-xs text-muted-foreground font-cairo">{t.dosage}: {tr.dosage} • {t.frequency}: {tr.frequency}</p>
                          </div>
                        </div>
                      )}
                      {meds.length > 0 && (
                        <div className="grid gap-3">
                          {meds.map((med: any) => (
                            <div key={med.id} className="neu-flat-sm rounded-xl p-3 space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">💊</span>
                                <p className="font-medium font-cairo text-sm">{med.medication_name}</p>
                              </div>
                              <div className="flex flex-wrap gap-3 text-xs font-cairo">
                                {med.morning_dose > 0 && (
                                  <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg px-2.5 py-1">
                                    🌅 {t.morningDose}: {med.morning_dose} {t.doses}
                                  </span>
                                )}
                                {med.evening_dose > 0 && (
                                  <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-lg px-2.5 py-1">
                                    🌇 {t.eveningDose}: {med.evening_dose} {t.doses}
                                  </span>
                                )}
                                {med.night_dose > 0 && (
                                  <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-lg px-2.5 py-1">
                                    🌙 {t.nightDose}: {med.night_dose} {t.doses}
                                  </span>
                                )}
                                <span className="bg-muted rounded-lg px-2.5 py-1">🍽️ {med.meal_timing}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {tr.notes && (
                        <p className="text-xs text-muted-foreground font-cairo border-t border-border/30 pt-2">{t.notes}: {tr.notes}</p>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="attendance" className="space-y-4 mt-4">
            {attPerms.canCreate && (
              <button onClick={() => { setAttEditItem(null); setAttForm({ date: new Date().toISOString().slice(0, 10), present: true, notes: "" }); setAttOpen(true); }}
                className="gradient-primary rounded-2xl px-4 py-2 flex items-center gap-2 text-sm font-cairo text-primary-foreground hover:scale-105 transition-transform">
                <Plus className="h-4 w-4" />{t.recordAttendance}
              </button>
            )}
            {patientAttendance.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground font-cairo">{t.noAttendance}</p>
            ) : (
              <div className="neu-flat rounded-2xl bg-background overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="font-cairo text-right">{t.date}</TableHead>
                      <TableHead className="font-cairo text-right">{t.status}</TableHead>
                      <TableHead className="font-cairo text-right">{t.notes}</TableHead>
                      <TableHead className="font-cairo text-right">{t.actions}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {patientAttendance.map((a: any) => (
                      <TableRow key={a.id} className="hover:bg-muted/10">
                        <TableCell className="font-cairo text-sm">{a.date}</TableCell>
                        <TableCell>
                          <Badge className={`${a.present ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"} border-0 font-cairo text-xs`}>
                            {a.present ? <><Check className="h-3 w-3 inline mr-1" />{t.present}</> : <><X className="h-3 w-3 inline mr-1" />{t.absent}</>}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-cairo text-sm text-muted-foreground max-w-[200px] truncate">{a.notes || "-"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {attPerms.canEdit !== false && (
                              <button onClick={() => { setAttEditItem(a); setAttForm({ date: a.date, present: a.present, notes: a.notes || "" }); setAttOpen(true); }}
                                className="p-1.5 hover:scale-110 transition-transform rounded-lg hover:bg-primary/10">
                                <Edit className="h-4 w-4 text-primary" />
                              </button>
                            )}
                            {attPerms.canDelete !== false && (
                              <button onClick={() => setDeleteAttId(a.id)}
                                className="p-1.5 hover:scale-110 transition-transform rounded-lg hover:bg-destructive/10">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="tasks" className="mt-4">
            <PatientTasks patientId={id!} parentId={patient.parent_id} doctorId={patient.doctor_id} />
          </TabsContent>
        </Tabs>

        {/* Edit Patient Dialog */}
        <CrudDialog open={editOpen} onOpenChange={setEditOpen} title={t.editPatientData}>
          <form onSubmit={handleEditSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
            <div className="space-y-2">
              <label className="text-sm font-cairo font-medium">{t.photo}</label>
              <div className="flex items-center gap-4">
                {photoPreview ? <img src={getImageUrl(photoPreview) || photoPreview} alt="" className="h-16 w-16 rounded-2xl object-cover" /> : <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center"><Upload className="h-6 w-6 text-muted-foreground" /></div>}
                <input ref={fileRef} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) { setPhotoFile(f); setPhotoPreview(URL.createObjectURL(f)); }}} className="hidden" />
                <button type="button" onClick={() => fileRef.current?.click()} className="neu-flat-sm rounded-xl px-4 py-2 text-sm font-cairo">{t.change}</button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-cairo font-medium">{t.name}</label>
              <div className="neu-pressed rounded-xl"><input value={editForm.name} onChange={e => setEditForm((f: any) => ({ ...f, name: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" required /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-cairo font-medium">{t.age}</label>
                <div className="neu-pressed rounded-xl"><input type="number" value={editForm.age} onChange={e => setEditForm((f: any) => ({ ...f, age: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" required /></div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-cairo font-medium">{t.status}</label>
                <div className="neu-pressed rounded-xl">
                  <select value={editForm.status} onChange={e => setEditForm((f: any) => ({ ...f, status: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl">
                    <option value="تحسن">{t.improvement}</option><option value="استقرار">{t.stable}</option><option value="تدهور">{t.deterioration}</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-cairo font-medium">{t.diagnosis}</label>
              <div className="neu-pressed rounded-xl">
                <select value={editForm.diagnosis_type} onChange={e => setEditForm((f: any) => ({ ...f, diagnosis_type: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl">
                  <option value="">{t.select}</option>
                  {diagnosisKeys.map(d => <option key={d.value} value={d.value}>{t[d.key as keyof typeof t]}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-cairo font-medium">{t.birthTypeLabel}</label>
              <div className="neu-pressed rounded-xl">
                <select value={editForm.birth_type} onChange={e => setEditForm((f: any) => ({ ...f, birth_type: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl">
                  {birthTypeKeys.map(b => <option key={b.value} value={b.value}>{t[b.key as keyof typeof t]}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-cairo font-medium">{t.pregnancyMonthsLabel}</label>
              <div className="neu-pressed rounded-xl"><input type="number" value={editForm.pregnancy_months} onChange={e => setEditForm((f: any) => ({ ...f, pregnancy_months: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" /></div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-cairo font-medium">{t.complicationsLabel}</label>
              <div className="neu-pressed rounded-xl"><input value={editForm.birth_complications} onChange={e => setEditForm((f: any) => ({ ...f, birth_complications: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" placeholder={t.complicationsPlaceholder} /></div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-cairo font-medium">{t.motherHealthLabel}</label>
              <div className="neu-pressed rounded-xl"><textarea value={editForm.mother_health_notes} onChange={e => setEditForm((f: any) => ({ ...f, mother_health_notes: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" rows={2} /></div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-cairo font-medium">{t.notes}</label>
              <div className="neu-pressed rounded-xl"><textarea value={editForm.notes} onChange={e => setEditForm((f: any) => ({ ...f, notes: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" rows={2} /></div>
            </div>
            {/* Parent info */}
            {patient.parent_id && (
              <div className="space-y-3 border-t pt-3">
              <h4 className="text-sm font-cairo font-semibold flex items-center gap-2"><User className="h-4 w-4" />{"بيانات ولي الأمر"}</h4>
                <div className="space-y-2">
                  <label className="text-sm font-cairo font-medium">{t.parentName}</label>
                  <div className="neu-pressed rounded-xl"><input value={editForm.parent_name} onChange={e => setEditForm((f: any) => ({ ...f, parent_name: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" /></div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-cairo font-medium">{t.phone}</label>
                  <div className="neu-pressed rounded-xl"><input value={editForm.parent_phone} onChange={e => setEditForm((f: any) => ({ ...f, parent_phone: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" placeholder="0xxxxxxxxx" /></div>
                </div>
              </div>
            )}
            {/* Multi-select doctors for admin */}
            {(role === "admin" || role === "super_admin") && (
              <div className="space-y-2">
                <label className="text-sm font-cairo font-medium">{t.assignedDoctors || "الأطباء المعالجون"}</label>
                {editSelectedDoctorIds.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {editSelectedDoctorIds.map((did: string) => {
                      const doc = profiles.find((p: any) => p.id === did);
                      return (
                        <span key={did} className="inline-flex items-center gap-1 rounded-xl bg-primary/10 text-primary px-3 py-1 text-xs font-cairo">
                          <Stethoscope className="h-3 w-3" />
                          {doc?.full_name || did}
                          <button type="button" onClick={() => setEditSelectedDoctorIds(ids => ids.filter(i => i !== did))}
                            className="hover:text-destructive ml-1"><X className="h-3 w-3" /></button>
                        </span>
                      );
                    })}
                  </div>
                )}
                <div className="neu-pressed rounded-xl">
                  <select value="" onChange={e => {
                    const val = e.target.value;
                    if (val && !editSelectedDoctorIds.includes(val)) {
                      setEditSelectedDoctorIds(ids => [...ids, val]);
                    }
                  }} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl">
                    <option value="">{t.selectMultipleDoctors || "اختر أطباء..."}</option>
                    {doctorProfiles.filter((p: any) => !editSelectedDoctorIds.includes(p.id)).map((p: any) => (
                      <option key={p.id} value={p.id}>{p.full_name} {p.specialty ? `(${translateValue(p.specialty, specialtyMap, t)})` : ""}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            <button type="submit" disabled={updatePatient.isPending} className="w-full gradient-primary rounded-xl px-4 py-2.5 text-primary-foreground font-cairo font-medium hover:opacity-90 disabled:opacity-50">{t.update}</button>
          </form>
        </CrudDialog>

        <CrudDialog open={apptOpen} onOpenChange={o => { setApptOpen(o); if (!o) setApptEditItem(null); }} title={apptEditItem ? t.editAppointment : t.newAppointment}>
          <form onSubmit={async e => {
            e.preventDefault();
            const patientName = patient?.name || "";
            const reminderTitle = t.appointmentReminder || "تذكير بالموعد";
            if (apptEditItem) {
              updateAppt.mutate({ id: apptEditItem.id, ...apptForm }, {
                onSuccess: async () => {
                  // Always wipe stale notifications for this appointment, then
                  // re-create a fresh one if it should still have a reminder.
                  await deleteAptNotifications(apptEditItem.id);
                  const targetDoctorId = apptEditItem.doctor_id || user?.id;
                  const doctorName = profiles.find((p: any) => p.id === targetDoctorId)?.full_name || "";
                  if (shouldHaveNotif(apptForm.date, apptForm.status) && targetDoctorId) {
                    await createAptNotification({
                      aptId: apptEditItem.id,
                      dateISO: apptForm.date,
                      userId: targetDoctorId,
                      title: reminderTitle,
                      patientName,
                      doctorName,
                      lang,
                      locale,
                    });
                  }
                  queryClient.invalidateQueries({ queryKey: ["notifications"] });
                  setApptOpen(false);
                  setApptEditItem(null);
                },
              });
            } else {
              insertAppt.mutate({ patient_id: id!, ...apptForm, doctor_id: user?.id, created_by: user?.id }, {
                onSuccess: async (created: any) => {
                  const newId = created?.id || created?.data?.id;
                  const targetDoctorId = user?.id;
                  const doctorName = profiles.find((p: any) => p.id === targetDoctorId)?.full_name || "";
                  if (newId && targetDoctorId && shouldHaveNotif(apptForm.date, apptForm.status)) {
                    await createAptNotification({
                      aptId: newId,
                      dateISO: apptForm.date,
                      userId: targetDoctorId,
                      title: reminderTitle,
                      patientName,
                      doctorName,
                      lang,
                      locale,
                    });
                    queryClient.invalidateQueries({ queryKey: ["notifications"] });
                  }
                  setApptOpen(false);
                },
              });
            }
          }} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-cairo font-medium">{t.dateTime}</label>
              <div className="neu-pressed rounded-xl"><input type="datetime-local" value={apptForm.date} onChange={e => setApptForm(f => ({ ...f, date: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" required /></div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-cairo font-medium">{t.type}</label>
              <div className="neu-pressed rounded-xl">
                <select value={apptForm.type} onChange={e => setApptForm(f => ({ ...f, type: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl">
                  {getTranslatedOptions(appointmentTypeKeys, t).map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
            {apptEditItem && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-cairo font-medium">{t.status}</label>
                  <div className="neu-pressed rounded-xl">
                    <select value={apptForm.status} onChange={e => setApptForm(f => ({ ...f, status: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl">
                      <option value="مجدول">{t.scheduled}</option><option value="مكتمل">{t.completed}</option><option value="ملغي">{t.cancelled}</option><option value="��ائب">{t.statusAbsent}</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-cairo font-medium">{t.notes}</label>
                  <div className="neu-pressed rounded-xl"><input value={apptForm.notes} onChange={e => setApptForm(f => ({ ...f, notes: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" /></div>
                </div>
              </>
            )}
            <button type="submit" disabled={insertAppt.isPending || updateAppt.isPending} className="w-full gradient-primary rounded-xl px-4 py-2.5 text-primary-foreground font-cairo font-medium hover:opacity-90 disabled:opacity-50">
              {apptEditItem ? t.update : t.add}
            </button>
          </form>
        </CrudDialog>

        <CrudDialog open={treatOpen} onOpenChange={o => { setTreatOpen(o); if (!o) setTreatEditItem(null); }} title={treatEditItem ? t.editTreatment : t.newTreatment}>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const medNames = treatMeds.map(m => m.medication_name).filter(Boolean).join(", ");
            const dosageSummary = treatMeds.map(m => `${m.morning_dose + m.evening_dose + m.night_dose}`).join(", ");
            if (treatEditItem) {
              updateTreat.mutate({
                id: treatEditItem.id,
                medication: medNames,
                dosage: dosageSummary,
                frequency: "يومي",
                start_date: treatForm.start_date || null,
                end_date: treatForm.end_date || null,
                notes: treatForm.notes || null,
              }, {
                onSuccess: async () => {
                  // Delete old medications and re-insert
                  const oldMeds = treatmentMedications.filter((m: any) => m.treatment_id === treatEditItem.id);
                  for (const om of oldMeds) {
                    await crudApi.delete("treatment_medications", om.id);
                  }
                  treatMeds.filter(m => m.medication_name).forEach(med => {
                    insertTreatMed.mutate({
                      treatment_id: treatEditItem.id,
                      medication_name: med.medication_name,
                      morning_dose: med.morning_dose,
                      evening_dose: med.evening_dose,
                      night_dose: med.night_dose,
                      meal_timing: med.meal_timing,
                    });
                  });
                  queryClient.invalidateQueries({ queryKey: ["treatment_medications"] });
                  setTreatOpen(false);
                  setTreatEditItem(null);
                }
              });
            } else {
              insertTreat.mutate({
                patient_id: id!,
                medication: medNames,
                dosage: dosageSummary,
                frequency: "يومي",
                start_date: treatForm.start_date || null,
                end_date: treatForm.end_date || null,
                notes: treatForm.notes || null,
                created_by: user?.id,
              }, {
                onSuccess: (data: any) => {
                  treatMeds.filter(m => m.medication_name).forEach(med => {
                    insertTreatMed.mutate({
                      treatment_id: data.id,
                      medication_name: med.medication_name,
                      morning_dose: med.morning_dose,
                      evening_dose: med.evening_dose,
                      night_dose: med.night_dose,
                      meal_timing: med.meal_timing,
                    });
                  });
                  setTreatOpen(false);
                }
              });
            }
          }} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
            
            {/* Medications List */}
            <div className="space-y-3">
              <label className="text-sm font-cairo font-bold flex items-center gap-2">💊 {t.medicationList}</label>
              {treatMeds.map((med, idx) => (
                <div key={idx} className="neu-flat-sm rounded-2xl p-4 space-y-3 relative">
                  {treatMeds.length > 1 && (
                    <button type="button" onClick={() => setTreatMeds(m => m.filter((_, i) => i !== idx))}
                      className="absolute top-2 left-2 text-xs text-destructive font-cairo hover:underline">{t.removeMedication}</button>
                  )}
                  <div className="space-y-2">
                    <label className="text-xs font-cairo font-medium">{t.medicationName}</label>
                    <div className="neu-pressed rounded-xl">
                      <input value={med.medication_name} onChange={e => {
                        const v = e.target.value;
                        setTreatMeds(m => m.map((item, i) => i === idx ? { ...item, medication_name: v } : item));
                      }} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" required placeholder={t.medicationNamePlaceholder} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs font-cairo">{t.morningDose}</label>
                      <div className="neu-pressed rounded-xl">
                        <input type="number" min="0" value={med.morning_dose} onChange={e => {
                          const v = Number(e.target.value);
                          setTreatMeds(m => m.map((item, i) => i === idx ? { ...item, morning_dose: v } : item));
                        }} className="w-full bg-transparent px-3 py-2 text-sm outline-none font-cairo rounded-xl text-center" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-cairo">{t.eveningDose}</label>
                      <div className="neu-pressed rounded-xl">
                        <input type="number" min="0" value={med.evening_dose} onChange={e => {
                          const v = Number(e.target.value);
                          setTreatMeds(m => m.map((item, i) => i === idx ? { ...item, evening_dose: v } : item));
                        }} className="w-full bg-transparent px-3 py-2 text-sm outline-none font-cairo rounded-xl text-center" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-cairo">{t.nightDose}</label>
                      <div className="neu-pressed rounded-xl">
                        <input type="number" min="0" value={med.night_dose} onChange={e => {
                          const v = Number(e.target.value);
                          setTreatMeds(m => m.map((item, i) => i === idx ? { ...item, night_dose: v } : item));
                        }} className="w-full bg-transparent px-3 py-2 text-sm outline-none font-cairo rounded-xl text-center" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-cairo">{t.mealTiming}</label>
                    <div className="neu-pressed rounded-xl">
                      <select value={med.meal_timing} onChange={e => {
                        const v = e.target.value;
                        setTreatMeds(m => m.map((item, i) => i === idx ? { ...item, meal_timing: v } : item));
                      }} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl">
                        <option value="بعد الأكل">{t.afterMeal}</option>
                        <option value="قبل الأكل">{t.beforeMeal}</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => setTreatMeds(m => [...m, { medication_name: "", morning_dose: 0, evening_dose: 0, night_dose: 0, meal_timing: "بعد الأكل" }])}
                className="w-full neu-flat-sm rounded-xl px-4 py-2.5 text-sm font-cairo text-primary hover:scale-[1.02] transition-transform">
                {t.addMedication}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-cairo font-medium">{t.startDate}</label>
                <div className="neu-pressed rounded-xl"><input type="date" value={treatForm.start_date} onChange={e => setTreatForm(f => ({ ...f, start_date: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" /></div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-cairo font-medium">{t.endDate}</label>
                <div className="neu-pressed rounded-xl"><input type="date" value={treatForm.end_date} onChange={e => setTreatForm(f => ({ ...f, end_date: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" /></div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-cairo font-medium">{t.notes}</label>
              <div className="neu-pressed rounded-xl"><textarea value={treatForm.notes} onChange={e => setTreatForm(f => ({ ...f, notes: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" rows={2} /></div>
            </div>
            <button type="submit" disabled={insertTreat.isPending || updateTreat.isPending} className="w-full gradient-primary rounded-xl px-4 py-2.5 text-primary-foreground font-cairo font-medium hover:opacity-90 disabled:opacity-50">
              {treatEditItem ? t.update : t.add}
            </button>
          </form>
        </CrudDialog>

        <CrudDialog open={attOpen} onOpenChange={setAttOpen} title={attEditItem ? t.editAttendance : t.recordAttendance}>
          <form onSubmit={e => {
            e.preventDefault();
            if (attEditItem) {
              updateAtt.mutate({ id: attEditItem.id, ...attForm }, { onSuccess: () => { setAttOpen(false); setAttEditItem(null); } });
            } else {
              insertAtt.mutate({ patient_id: id!, ...attForm, recorded_by: user?.id }, { onSuccess: () => setAttOpen(false) });
            }
          }} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-cairo font-medium">{t.date}</label>
              <div className="neu-pressed rounded-xl"><input type="date" value={attForm.date} onChange={e => setAttForm(f => ({ ...f, date: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" required /></div>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-cairo font-medium">{t.status}</label>
              <button type="button" onClick={() => setAttForm(f => ({ ...f, present: !f.present }))}
                className={`rounded-xl px-4 py-2 text-sm font-cairo ${attForm.present ? "gradient-success text-primary-foreground" : "bg-destructive/20 text-destructive"}`}>
                {attForm.present ? t.presentMark : t.absentMark}
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-cairo font-medium">{t.notes}</label>
              <div className="neu-pressed rounded-xl"><textarea value={attForm.notes} onChange={e => setAttForm(f => ({ ...f, notes: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" rows={2} /></div>
            </div>
            <button type="submit" disabled={insertAtt.isPending || updateAtt.isPending} className="w-full gradient-primary rounded-xl px-4 py-2.5 text-primary-foreground font-cairo font-medium hover:opacity-90 disabled:opacity-50">
              {attEditItem ? t.update : t.register}
            </button>
          </form>
        </CrudDialog>

        <DeleteConfirm open={!!deleteApptId} onOpenChange={() => setDeleteApptId(null)} onConfirm={() => {
          if (deleteApptId) {
            const targetId = deleteApptId;
            deleteAppt.mutate(targetId, {
              onSuccess: async () => {
                await deleteAptNotifications(targetId);
                queryClient.invalidateQueries({ queryKey: ["notifications"] });
              },
            });
            setDeleteApptId(null);
          }
        }} />
        <DeleteConfirm open={!!deleteTreatId} onOpenChange={() => setDeleteTreatId(null)} onConfirm={() => { if (deleteTreatId) { deleteTreat.mutate(deleteTreatId); setDeleteTreatId(null); } }} />
        <DeleteConfirm open={!!deleteAttId} onOpenChange={() => setDeleteAttId(null)} onConfirm={() => { if (deleteAttId) { deleteAtt.mutate(deleteAttId); setDeleteAttId(null); } }} />
      </div>
    </DashboardLayout>
  );
};

// Helper component for info rows
const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex items-start gap-2">
    <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
    <div>
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-medium">{value}</span>
    </div>
  </div>
);

export default PatientDetail;
