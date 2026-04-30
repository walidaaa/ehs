import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { motion } from "framer-motion";
import { Search, Plus, Trash2, Upload, Phone, Eye, Baby, Stethoscope, Heart, Calendar, UserPlus, Edit, X, Building2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTableQuery, useInsertMutation } from "@/hooks/useSupabaseQuery";
import { CrudDialog } from "@/components/shared/CrudDialog";
import { DeleteConfirm } from "@/components/shared/DeleteConfirm";
import { usePermissions, useRole } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";
import { useDataFiltering } from "@/hooks/useDataFiltering";
import { crudApi, authApi } from "@/lib/api";
import { uploadMedia } from "@/lib/apiClient";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/shared/PaginationControls";
import { CardSkeleton } from "@/components/shared/ListSkeleton";
import { patientStatusMap, diagnosisKeys, birthTypeKeys, diagnosisMap, translateValue } from "@/lib/translationMaps";

const statusStyles: Record<string, string> = {
  "تحسن": "gradient-success text-primary-foreground",
  "استقرار": "bg-primary/20 text-primary",
  "تدهور": "bg-destructive/20 text-destructive",
};

// diagnosisOptions and birthTypeOptions now come from translationMaps
// DB values remain Arabic, display uses translations

// Helper: calculate age from birth date
const calculateAge = (birthDate: string): number => {
  if (!birthDate) return 0;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return Math.max(0, age);
};

const defaultForm = {
  name: "", birth_date: "", parent_id: "", status: "استقرار", notes: "", doctor_id: "",
  birth_type: "طبيعية", pregnancy_months: "9", mother_health_notes: "", birth_complications: "", diagnosis_type: "",
  entry_date: new Date().toISOString().slice(0, 10),
  selectedDoctorIds: [] as string[],
};

const Patients = () => {
  const { t, dir } = useLanguage();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [createParentMode, setCreateParentMode] = useState(false);
  const [newParent, setNewParent] = useState({ full_name: "", phone: "", email: "", password: "" });

  const { user } = useAuth();
  const role = useRole();
  const perms = usePermissions("patients");
  const { filterPatients, filterParents: filterParentsScope } = useDataFiltering();

  const { data: patientsRaw = [], isLoading } = useTableQuery("patients");
  const { data: parents = [] } = useTableQuery("parents");
  const { data: profiles = [] } = useTableQuery("profiles");
  const { data: userRoles = [] } = useTableQuery("user_roles");
  const { data: patientDoctors = [] } = useTableQuery("patient_doctors");
  const insertMut = useInsertMutation("patients");
  const insertParent = useInsertMutation("parents");

  // Apply role-based filtering to ensure proper data scoping
  const patients = useMemo(() => 
    filterPatients(patientsRaw).filter((p: any) => !p.archived),
    [filterPatients, patientsRaw]
  );
  const filtered = patients.filter((p: any) => p.name?.includes(search));
  const { paginatedItems, page, setPage, pageSize, setPageSize, totalPages, totalItems } = usePagination(filtered);

  const getDoctorName = (id: string) => profiles.find((p: any) => p.id === id)?.full_name || "-";
  const getServiceForPatient = (patient: any) => {
    // Find the doctor's created_by (admin), then get admin's service_name
    const doctorIds = patientDoctors.filter((pd: any) => pd.patient_id === patient.id).map((pd: any) => pd.doctor_id);
    if (doctorIds.length === 0 && patient.doctor_id) doctorIds.push(patient.doctor_id);
    for (const did of doctorIds) {
      const doc = profiles.find((p: any) => p.id === did);
      if (doc?.created_by) {
        const admin = profiles.find((p: any) => p.id === doc.created_by);
        if (admin?.service_name) return admin.service_name;
      }
    }
    return null;
  };
  const getDoctorsForPatient = (patientId: string) => {
    const pds = patientDoctors.filter((pd: any) => pd.patient_id === patientId);
    if (pds.length > 0) return pds.map((pd: any) => getDoctorName(pd.doctor_id)).filter((n: string) => n !== "-");
    const p = patientsRaw.find((pt: any) => pt.id === patientId);
    return p?.doctor_id ? [getDoctorName(p.doctor_id)] : [];
  };
  const getParentName = (parentId: string) => parents.find((p: any) => p.id === parentId)?.full_name || "";
  const getParentPhone = (parentId: string) => parents.find((p: any) => p.id === parentId)?.phone || "";
  
  // Convert backend URLs to full accessible URLs
  // Supports both /api/files/... (SeaweedFS) and /api/uploads/... (legacy local) paths
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3003/api';
  const getImageUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    // If it's a blob URL (local preview), return as-is
    if (url.startsWith('blob:')) return url;
    // If it's already a full http URL, return as-is
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    // If it's a relative backend path like /api/uploads/... or /api/files/..., prepend the backend origin
    if (url.startsWith('/api/')) {
      const backendOrigin = API_BASE.replace(/\/api\/?$/, '');
      return `${backendOrigin}${url}`;
    }
    // If it's any other relative path, prepend backend origin
    if (url.startsWith('/')) {
      const backendOrigin = API_BASE.replace(/\/api\/?$/, '');
      return `${backendOrigin}${url}`;
    }
    return url;
  };

  const openAdd = () => {
    setEditItem(null);
    setForm(defaultForm);
    setPhotoFile(null);
    setPhotoPreview(null);
    setCreateParentMode(false);
    setNewParent({ full_name: "", phone: "", email: "", password: "" });
    setDialogOpen(true);
  };

  const openEdit = (patient: any) => {
    setEditItem(patient);
    const doctorIds = patientDoctors.filter((pd: any) => pd.patient_id === patient.id).map((pd: any) => pd.doctor_id);
    // Format entry_date to YYYY-MM-DD for date input (handles ISO timestamps like 2026-06-22T23:00:00.000Z)
    let entryDate = new Date().toISOString().slice(0, 10);
    if (patient.entry_date) {
      const d = patient.entry_date;
      entryDate = typeof d === 'string' && d.length >= 10 ? d.slice(0, 10) : d;
    }
    // Try to recover birth_date from patient data; if not stored, estimate from age
    let birthDate = "";
    if (patient.birth_date) {
      birthDate = typeof patient.birth_date === 'string' && patient.birth_date.length >= 10 ? patient.birth_date.slice(0, 10) : patient.birth_date;
    } else if (patient.age) {
      // Estimate birth date from age (approximate: use Jan 1 of the estimated birth year)
      const estimatedYear = new Date().getFullYear() - Number(patient.age);
      birthDate = `${estimatedYear}-01-01`;
    }
    setForm({
      name: patient.name || "",
      birth_date: birthDate,
      parent_id: patient.parent_id || "",
      status: patient.status || "استقرار",
      notes: patient.notes || "",
      doctor_id: patient.doctor_id || "",
      birth_type: patient.birth_type || "طبيعية",
      pregnancy_months: String(patient.pregnancy_months || 9),
      mother_health_notes: patient.mother_health_notes || "",
      birth_complications: patient.birth_complications || "",
      diagnosis_type: patient.diagnosis_type || "",
      entry_date: entryDate,
      selectedDoctorIds: doctorIds.length > 0 ? doctorIds : (patient.doctor_id ? [patient.doctor_id] : []),
    });
    setPhotoFile(null);
    setPhotoPreview(patient.photo_url || null);
    setCreateParentMode(false);
    setNewParent({ full_name: "", phone: "", email: "", password: "" });
    setDialogOpen(true);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error(t.photoSizeError); return; }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const uploadPhoto = async (_patientId: string): Promise<string | null> => {
    if (!photoFile) return null;
    try {
      const url = await uploadMedia(photoFile);
      toast.success(t.photoUploaded || "Photo uploaded successfully");
      return url;
    } catch (error: any) {
      console.error("[uploadPhoto] Error:", error);
      toast.error(error.message || "Failed to upload photo");
      return null;
    }
  };

  const handleArchive = async () => {
    if (!deleteId) return;
    try {
      // Get patient's parent_id before archiving
      const patient = await crudApi.getOne("patients", deleteId);
      await crudApi.update("patients", deleteId, { archived: true });
      // Auto-archive parent if no other active patients
      if (patient?.parent_id) {
        const otherPatients = patientsRaw.filter(
          (p: any) => p.parent_id === patient.parent_id && !p.archived && p.id !== deleteId
        );
        if (otherPatients.length === 0) {
          await crudApi.update("parents", patient.parent_id, { archived: true });
        }
      }
      toast.success(t.archivedSuccess);
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      queryClient.invalidateQueries({ queryKey: ["parents"] });
    } catch {
      toast.error(t.archiveError);
    }
  };

  const syncPatientDoctors = async (patientId: string, doctorIds: string[]) => {
    // Delete existing
    await crudApi.deletePatientDoctors(patientId);
    // Insert new
    if (doctorIds.length > 0) {
      const rows = doctorIds.map(did => ({ patient_id: patientId, doctor_id: did }));
      await crudApi.insertPatientDoctorsBatch(rows);
    }
    queryClient.invalidateQueries({ queryKey: ["patient_doctors"] });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!createParentMode && !form.parent_id) {
      toast.error(t.parentRequired);
      return;
    }

    const selectedDocs = form.selectedDoctorIds.length > 0 ? form.selectedDoctorIds : (form.doctor_id ? [form.doctor_id] : []);
    const primaryDoctorId = selectedDocs[0] || form.doctor_id || user?.id;

    setUploading(true);
    try {
      let parentId = form.parent_id;

      if (createParentMode) {
        if (!newParent.full_name) { toast.error(t.parentNameRequired); setUploading(false); return; }
        try {
          if (newParent.email && newParent.password) {
            console.log("[v0] Creating parent user with:", { email: newParent.email, full_name: newParent.full_name, role: "parent" });
            const userData = await authApi.createUser({
              email: newParent.email, password: newParent.password, full_name: newParent.full_name, phone: newParent.phone, role: "parent"
            });
            console.log("[v0] Parent user created:", userData);
            const parentData = await crudApi.insert("parents", { full_name: newParent.full_name, phone: newParent.phone, created_by: user?.id, user_id: userData.id });
            parentId = parentData.id;
          } else {
            const parentData = await crudApi.insert("parents", { full_name: newParent.full_name, phone: newParent.phone, created_by: user?.id });
            parentId = parentData.id;
          }
          queryClient.invalidateQueries({ queryKey: ["parents"] });
        } catch (err: any) {
          console.error("[v0] Parent creation error:", err);
          let msg = t.errorGeneric;
          if (err.message === 'EMAIL_ALREADY_REGISTERED') msg = t.emailAlreadyRegistered;
          else if (err.message.includes('Doctors can only create parents')) msg = "Only doctors can create parents. Check your role.";
          else if (err.message.includes('missing required fields') || err.message.includes('required')) msg = "Please fill all required fields (email, password, full name)";
          else msg = err.message || t.errorGeneric;
          toast.error(msg); setUploading(false); return;
        }
      }

      // EDIT MODE
      if (editItem) {
        try {
          const calculatedAge = form.birth_date ? calculateAge(form.birth_date) : 0;
          const updatePayload: any = {
            name: form.name, age: calculatedAge, birth_date: form.birth_date || null, parent_id: parentId || null,
            status: form.status, notes: form.notes || null, doctor_id: primaryDoctorId,
            birth_type: form.birth_type, pregnancy_months: Number(form.pregnancy_months) || 9,
            mother_health_notes: form.mother_health_notes || null, birth_complications: form.birth_complications || null,
            diagnosis_type: form.diagnosis_type || null, entry_date: form.entry_date || null,
          };
          await crudApi.update("patients", editItem.id, updatePayload);

          if (photoFile) {
            const photoUrl = await uploadPhoto(editItem.id);
            if (photoUrl) {
              console.log("[v0] Saving photo URL to edited patient:", photoUrl);
              await crudApi.update("patients", editItem.id, { photo_url: photoUrl });
              // Force refresh patients cache
              queryClient.invalidateQueries({ queryKey: ["patients"] });
            }
          }
          await syncPatientDoctors(editItem.id, selectedDocs);
          toast.success(t.patientUpdated);
          queryClient.invalidateQueries({ queryKey: ["patients"] });
          setDialogOpen(false);
        } catch {
          toast.error(t.updateError);
          setUploading(false);
        }
        return;
      }

      // ADD MODE - check for archived match
      const patientName = form.name.trim();
      const archivedMatch = patientsRaw.filter((p: any) => p.name === patientName && p.archived);

      if (archivedMatch.length > 0) {
        const restoredId = archivedMatch[0].id;
        const calculatedAgeRestore = form.birth_date ? calculateAge(form.birth_date) : 0;
        await crudApi.update("patients", restoredId, {
          archived: false, age: calculatedAgeRestore, birth_date: form.birth_date || null, parent_id: parentId || null,
          status: form.status, notes: form.notes || null, doctor_id: primaryDoctorId,
          birth_type: form.birth_type, pregnancy_months: Number(form.pregnancy_months) || 9,
          mother_health_notes: form.mother_health_notes || null, birth_complications: form.birth_complications || null,
          diagnosis_type: form.diagnosis_type || null, entry_date: form.entry_date || null,
        });

        if (photoFile) {
          const photoUrl = await uploadPhoto(restoredId);
          if (photoUrl) {
            console.log("[v0] Saving photo URL to restored patient:", photoUrl);
            await crudApi.update("patients", restoredId, { photo_url: photoUrl });
            // Force refresh patients cache
            queryClient.invalidateQueries({ queryKey: ["patients"] });
          }
        }
        await syncPatientDoctors(restoredId, selectedDocs);
        toast.success(t.restoredAndUpdated);
        queryClient.invalidateQueries({ queryKey: ["patients"] });
        setDialogOpen(false);
      } else {
        setUploading(true);
        try {
          // Upload photo if provided
          let photoUrl = null;
          if (photoFile) {
            photoUrl = await uploadPhoto("");
            console.log("[v0] Photo upload result:", photoUrl);
          }

          // Create patient with photo URL
          const calculatedAgeInsert = form.birth_date ? calculateAge(form.birth_date) : 0;
          const basePayload: any = {
            name: form.name, age: calculatedAgeInsert, birth_date: form.birth_date || null, parent_id: parentId || null,
            status: form.status, notes: form.notes || null, doctor_id: primaryDoctorId,
            birth_type: form.birth_type, pregnancy_months: Number(form.pregnancy_months) || 9,
            mother_health_notes: form.mother_health_notes || null, birth_complications: form.birth_complications || null,
            diagnosis_type: form.diagnosis_type || null, entry_date: form.entry_date || null,
            photo_url: photoUrl || null,
          };
          
          insertMut.mutate(basePayload, {
            onSuccess: async (data: any) => {
              const newId = data?.id || data?.[0]?.id;
              if (newId) {
                await syncPatientDoctors(newId, selectedDocs);
              }
              toast.success(t.patientAdded);
              queryClient.invalidateQueries({ queryKey: ["patients"] });
              setForm(defaultForm);
              setPhotoFile(null);
              setPhotoPreview(null);
              setEditItem(null);
              setDialogOpen(false);
              setUploading(false);
            },
            onError: (err: any) => {
              console.error("[v0] Insert error:", err);
              toast.error(t.errorGeneric);
              setUploading(false);
            }
          });
        } catch (err: any) {
          console.error("[v0] Error:", err);
          toast.error(err.message || t.errorGeneric);
          setUploading(false);
        }
        return;
      }
    } finally {
      setUploading(false);
    }
  };

  const myParents = role === "user" ? parents.filter((p: any) => p.created_by === user?.id) : filterParentsScope(parents);
  const doctorProfiles = role === "admin"
    ? profiles.filter((p: any) => p.created_by === user?.id && userRoles.some((r: any) => r.user_id === p.id && r.role === "user"))
    : profiles.filter((p: any) => userRoles.some((r: any) => r.user_id === p.id && r.role === "user"));

  return (
    <DashboardLayout>
      <div dir={dir} className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-2xl font-bold font-cairo">
            {role === "parent" ? t.myChildren : t.patientsTitle}
          </h2>
        </motion.div>

        <div className="flex flex-wrap gap-3 items-center">
          <div className="neu-flat-sm rounded-2xl bg-background px-4 py-2.5 flex items-center gap-2 flex-1 max-w-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.searchByName} className="bg-transparent outline-none text-sm flex-1 font-cairo" />
          </div>
          {perms.canCreate && (
            <button onClick={openAdd} className="gradient-primary rounded-2xl px-5 py-2.5 flex items-center gap-2 text-sm font-cairo text-primary-foreground hover:scale-105 transition-transform">
              <Plus className="h-4 w-4" />
              {t.newPatient}
            </button>
          )}
        </div>

        {isLoading ? (
          <CardSkeleton />
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 font-cairo text-muted-foreground">{t.noData}</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {paginatedItems.map((patient: any, i: number) => {
                const parentName = getParentName(patient.parent_id);
                const parentPhone = getParentPhone(patient.parent_id);
                return (
                  <motion.div key={patient.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    className="neu-flat rounded-3xl bg-background overflow-hidden hover:scale-[1.02] transition-transform cursor-pointer"
                    onClick={() => navigate(`/patients/${patient.id}`)}>
                    <div className="flex items-center gap-3 p-4 pb-3">
                      {patient.photo_url ? (
                        <img src={getImageUrl(patient.photo_url) || undefined} alt={patient.name} className="h-14 w-14 rounded-2xl object-cover flex-shrink-0" />
                      ) : (
                        <div className="h-14 w-14 rounded-2xl gradient-primary flex items-center justify-center text-primary-foreground font-bold text-lg flex-shrink-0">
                          {patient.name?.charAt(0)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold font-cairo text-base truncate">{patient.name}</h4>
                        <p className="text-xs text-muted-foreground font-cairo">{patient.age} {t.years}</p>
                      </div>
                      <span className={`rounded-xl px-3 py-1 text-xs font-medium font-cairo flex-shrink-0 ${statusStyles[patient.status] || ""}`}>
                        {translateValue(patient.status, patientStatusMap, t)}
                      </span>
                    </div>
                    <div className="px-4 pb-2 space-y-1.5">
                  {patient.diagnosis_type && (
                    <div className="flex items-center gap-2 text-xs font-cairo">
                      <Baby className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      <span className="text-primary font-medium">{translateValue(patient.diagnosis_type, diagnosisMap, t)}</span>
                    </div>
                  )}
                      <div className="flex items-center gap-2 text-xs font-cairo text-muted-foreground flex-wrap">
                        <Stethoscope className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>{getDoctorsForPatient(patient.id).join(" • ") || "-"}</span>
                      </div>
                      {parentName && (
                        <div className="flex items-center gap-2 text-xs font-cairo text-muted-foreground">
                          <Heart className="h-3.5 w-3.5 flex-shrink-0" />
                          <span>{parentName}</span>
                          {parentPhone && (<><span className="text-border">|</span><Phone className="h-3 w-3 flex-shrink-0" /><span>{parentPhone}</span></>)}
                        </div>
                      )}
                      {role === "super_admin" && getServiceForPatient(patient) && (
                        <div className="flex items-center gap-2 text-xs font-cairo text-muted-foreground">
                          <Building2 className="h-3.5 w-3.5 text-accent flex-shrink-0" />
                          <span className="text-accent font-medium">{getServiceForPatient(patient)}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs font-cairo text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>{t.entry}: {patient.entry_date ? String(patient.entry_date).slice(0, 10) : "—"} • {t.birth}: {translateValue(patient.birth_type, birthTypeKeys.reduce((acc: any, b: any) => { acc[b.value] = b.key; return acc; }, {}), t) || patient.birth_type || "—"}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 p-3 pt-2 justify-end border-t border-border/30 mt-2" onClick={e => e.stopPropagation()}>
                      <button onClick={() => navigate(`/patients/${patient.id}`)} className="neu-flat-sm rounded-xl p-2 hover:scale-110 transition-transform"><Eye className="h-4 w-4 text-primary" /></button>
                      {perms.canEdit && <button onClick={() => openEdit(patient)} className="neu-flat-sm rounded-xl p-2 hover:scale-110 transition-transform"><Edit className="h-4 w-4 text-primary" /></button>}
                      {perms.canDelete && <button onClick={() => setDeleteId(patient.id)} className="neu-flat-sm rounded-xl p-2 hover:scale-110 transition-transform"><Trash2 className="h-4 w-4 text-destructive" /></button>}
                    </div>
                  </motion.div>
                );
              })}
            </div>
            <PaginationControls page={page} totalPages={totalPages} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} onPageSizeChange={setPageSize} />
          </>
        )}

        <CrudDialog open={dialogOpen} onOpenChange={setDialogOpen} title={editItem ? t.editPatient : t.addNewPatient}>
          <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
            {/* Photo */}
            <div className="space-y-2">
              <label className="text-sm font-cairo font-medium">{t.patientPhoto}</label>
              <div className="flex items-center gap-4">
                {photoPreview ? <img src={getImageUrl(photoPreview) || photoPreview} alt="preview" className="h-16 w-16 rounded-2xl object-cover" /> : <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center"><Upload className="h-6 w-6 text-muted-foreground" /></div>}
                <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
                <button type="button" onClick={() => fileRef.current?.click()} className="neu-flat-sm rounded-xl px-4 py-2 text-sm font-cairo hover:scale-105 transition-transform">
                  {photoPreview ? t.changePhoto : t.selectPhoto}
                </button>
              </div>
            </div>

            {/* Name + Entry Date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-cairo font-medium">{t.name}</label>
                <div className="neu-pressed rounded-xl"><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" required /></div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-cairo font-medium">{t.entryDate} <span className="text-destructive">*</span></label>
                <div className="neu-pressed rounded-xl"><input type="date" value={form.entry_date} onChange={e => setForm(f => ({ ...f, entry_date: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" required /></div>
              </div>
            </div>

            {/* Birth Date + Auto Age + Diagnosis */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-cairo font-medium">{t.birthDate || "تاريخ الميلاد"} <span className="text-destructive">*</span></label>
                <div className="neu-pressed rounded-xl"><input type="date" value={form.birth_date} onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" required /></div>
                {form.birth_date && (
                  <p className="text-xs font-cairo text-primary font-medium px-1">
                    {t.age || "العمر"}: {calculateAge(form.birth_date)} {t.years || "سنة"}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-cairo font-medium">{t.diagnosis}</label>
                <div className="neu-pressed rounded-xl">
                  <select value={form.diagnosis_type} onChange={e => setForm(f => ({ ...f, diagnosis_type: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl">
                    <option value="">{t.select}</option>
                    {diagnosisKeys.map(d => <option key={d.value} value={d.value}>{(t as any)[d.key] || d.value}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Status (visible in edit mode) */}
            {editItem && (
              <div className="space-y-2">
                <label className="text-sm font-cairo font-medium">{t.status}</label>
                <div className="neu-pressed rounded-xl">
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl">
                    <option value="تحسن">{t.improvement}</option>
                    <option value="استقرار">{t.stable}</option>
                    <option value="تدهور">{t.deterioration}</option>
                  </select>
                </div>
              </div>
            )}

            {/* Parent Section */}
            <div className="border border-primary/20 rounded-2xl p-3 space-y-3 bg-primary/5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-cairo font-bold text-primary flex items-center gap-1">
                  <Heart className="h-4 w-4" /> {t.parentGuardian} <span className="text-destructive">*</span>
                </label>
                {!editItem && (
                  <button type="button" onClick={() => setCreateParentMode(!createParentMode)} className="text-xs font-cairo text-primary underline flex items-center gap-1">
                    <UserPlus className="h-3 w-3" />
                    {createParentMode ? t.selectFromList : t.createNewParent}
                  </button>
                )}
              </div>
              {createParentMode && !editItem ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-sm font-cairo font-medium">{t.parentName}</label>
                    <div className="neu-pressed rounded-xl"><input value={newParent.full_name} onChange={e => setNewParent(f => ({ ...f, full_name: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" required /></div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-cairo font-medium">{t.parentPhone}</label>
                    <div className="neu-pressed rounded-xl"><input value={newParent.phone} onChange={e => setNewParent(f => ({ ...f, phone: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" /></div>
                  </div>
                  <div className="border-t border-border/50 pt-2">
                    <p className="text-xs text-muted-foreground font-cairo mb-2">{t.parentAccount}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-cairo">{t.emailField}</label>
                        <div className="neu-pressed rounded-xl"><input type="email" value={newParent.email} onChange={e => setNewParent(f => ({ ...f, email: e.target.value }))} className="w-full bg-transparent px-3 py-2 text-sm outline-none font-cairo rounded-xl" /></div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-cairo">{t.passwordField}</label>
                        <div className="neu-pressed rounded-xl"><input type="password" value={newParent.password} onChange={e => setNewParent(f => ({ ...f, password: e.target.value }))} className="w-full bg-transparent px-3 py-2 text-sm outline-none font-cairo rounded-xl" /></div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="neu-pressed rounded-xl">
                  <select value={form.parent_id} onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" required>
                    <option value="">{t.selectParent}</option>
                    {myParents.map((p: any) => <option key={p.id} value={p.id}>{p.full_name} {p.phone ? `(${p.phone})` : ""}</option>)}
                  </select>
                </div>
              )}
            </div>

            {/* Doctor - Multi-select for admin, single for others */}
            {(role === "admin" || role === "super_admin") ? (
              <div className="space-y-2">
                <label className="text-sm font-cairo font-medium">{t.assignedDoctors}</label>
                {form.selectedDoctorIds.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {form.selectedDoctorIds.map((did: string) => (
                      <span key={did} className="inline-flex items-center gap-1 rounded-xl bg-primary/10 text-primary px-3 py-1 text-xs font-cairo">
                        <Stethoscope className="h-3 w-3" />
                        {getDoctorName(did)}
                        <button type="button" onClick={() => setForm(f => ({ ...f, selectedDoctorIds: f.selectedDoctorIds.filter(id => id !== did) }))}
                          className="hover:text-destructive ml-1"><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="neu-pressed rounded-xl">
                  <select
                    value=""
                    onChange={e => {
                      const val = e.target.value;
                      if (val && !form.selectedDoctorIds.includes(val)) {
                        setForm(f => ({ ...f, selectedDoctorIds: [...f.selectedDoctorIds, val], doctor_id: f.selectedDoctorIds.length === 0 ? val : f.doctor_id }));
                      }
                    }}
                    className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl"
                  >
                    <option value="">{t.selectMultipleDoctors}</option>
                    {doctorProfiles.filter((p: any) => !form.selectedDoctorIds.includes(p.id)).map((p: any) => (
                      <option key={p.id} value={p.id}>{p.full_name} {p.specialty ? `(${p.specialty})` : ""}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : role === "user" ? null : (
              <div className="space-y-2">
                <label className="text-sm font-cairo font-medium">{t.responsibleDoctor}</label>
                <div className="neu-pressed rounded-xl">
                  <select value={form.doctor_id} onChange={e => setForm(f => ({ ...f, doctor_id: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" required>
                    <option value="">{t.selectDoctor}</option>
                    {doctorProfiles.map((p: any) => <option key={p.id} value={p.id}>{p.full_name} {p.specialty ? `(${p.specialty})` : ""}</option>)}
                  </select>
                </div>
              </div>
            )}

            {/* Birth Info */}
            <div className="border-t border-border pt-3 mt-3">
              <h3 className="text-sm font-bold font-cairo text-primary mb-3">{t.birthInfo}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-cairo font-medium">{t.birthType}</label>
                  <div className="neu-pressed rounded-xl">
                    <select value={form.birth_type} onChange={e => setForm(f => ({ ...f, birth_type: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl">
                      {birthTypeKeys.map(b => <option key={b.value} value={b.value}>{(t as any)[b.key] || b.value}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-cairo font-medium">{t.pregnancyMonths}</label>
                  <div className="neu-pressed rounded-xl">
                    <select value={form.pregnancy_months} onChange={e => setForm(f => ({ ...f, pregnancy_months: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl">
                      {[5, 6, 7, 8, 9].map(m => <option key={m} value={String(m)}>{m} {t.months}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="space-y-2 mt-3">
                <label className="text-sm font-cairo font-medium">{t.complications}</label>
                <div className="neu-pressed rounded-xl"><input value={form.birth_complications} onChange={e => setForm(f => ({ ...f, birth_complications: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" placeholder={t.complicationsPlaceholder} /></div>
              </div>
              <div className="space-y-2 mt-3">
                <label className="text-sm font-cairo font-medium">{t.motherHealth}</label>
                <div className="neu-pressed rounded-xl"><textarea value={form.mother_health_notes} onChange={e => setForm(f => ({ ...f, mother_health_notes: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" rows={2} /></div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <label className="text-sm font-cairo font-medium">{t.notes}</label>
              <div className="neu-pressed rounded-xl"><textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" rows={2} /></div>
            </div>

            <button type="submit" disabled={insertMut.isPending || uploading} className="w-full gradient-primary rounded-xl px-4 py-2.5 text-primary-foreground font-cairo font-medium hover:opacity-90 disabled:opacity-50">
              {uploading ? t.uploading : editItem ? t.update : t.add}
            </button>
          </form>
        </CrudDialog>

        <DeleteConfirm open={!!deleteId} onOpenChange={() => setDeleteId(null)} onConfirm={handleArchive} title={t.archivePatient} />
      </div>
    </DashboardLayout>
  );
};

export default Patients;
