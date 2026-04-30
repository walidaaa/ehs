import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { motion } from "framer-motion";
import { Search, Plus, Trash2, Edit, Eye, X, Building2, Heart, Stethoscope, UserCog } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useState } from "react";
import { useTableQuery } from "@/hooks/useSupabaseQuery";
import { useQueryClient } from "@tanstack/react-query";
import { DeleteConfirm } from "@/components/shared/DeleteConfirm";
import { crudApi, authApi } from "@/lib/api";
import { CrudDialog } from "@/components/shared/CrudDialog";
import { toast } from "sonner";
import { usePermissions, useRole } from "@/hooks/usePermissions";
import { roleLabels, serviceOptions, type AppRole } from "@/lib/permissions";
import { serviceMap, serviceKeys, specialtyMap, translateValue } from "@/lib/translationMaps";
import { useAuth } from "@/contexts/AuthContext";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/shared/PaginationControls";

const specialtyOptions = [
  "الطب النفسي العام",
  "طب نفس الأطفال والمراهقين",
  "الطب النفسي العصبي",
  "طب الإدمان",
  "الطب النفسي الشرعي",
  "طب نفس المسنين",
  "العلاج النفسي السلوكي المعرفي",
  "العلاج الوظيفي",
  "علم النفس العيادي",
  "التأهيل النفسي",
  "علاج النطق والتخاطب",
  "الإرشاد النفسي",
];

// Paginated table helpers
function AdminDoctorTable({ filteredDoctors, t, perms, openView, openEdit, attemptDelete }: any) {
  const { paginatedItems, page, setPage, pageSize, setPageSize, totalPages, totalItems } = usePagination(filteredDoctors);
  return (
    <>
      <div className="neu-flat rounded-3xl bg-background overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right font-cairo">{t.name}</TableHead>
              <TableHead className="text-right font-cairo">{t.specialty}</TableHead>
              <TableHead className="text-right font-cairo">{t.phone}</TableHead>
              <TableHead className="text-right font-cairo w-28">{t.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDoctors.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center font-cairo text-muted-foreground py-8">{t.noDoctors}</TableCell></TableRow>
            ) : paginatedItems.map((doc: any) => (
              <TableRow key={doc.id}>
                <TableCell className="font-cairo font-medium">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground">
                      <Stethoscope className="h-4 w-4" />
                    </div>
                    {doc.full_name}
                  </div>
                </TableCell>
                <TableCell className="font-cairo text-sm text-primary">{doc.specialty ? translateValue(doc.specialty, specialtyMap, t) : "—"}</TableCell>
                <TableCell className="font-cairo text-sm text-muted-foreground">{doc.phone || "—"}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openView(doc, "doctor")} className="neu-flat-sm rounded-xl p-2 hover:scale-110 transition-transform"><Eye className="h-4 w-4 text-primary" /></button>
                    {perms.canEdit && <button onClick={() => openEdit(doc, "doctor")} className="neu-flat-sm rounded-xl p-2 hover:scale-110 transition-transform"><Edit className="h-4 w-4 text-accent-foreground" /></button>}
                    {perms.canDelete && <button onClick={() => attemptDelete(doc.id)} className="neu-flat-sm rounded-xl p-2 hover:scale-110 transition-transform"><Trash2 className="h-4 w-4 text-destructive" /></button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <PaginationControls page={page} totalPages={totalPages} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} onPageSizeChange={setPageSize} />
    </>
  );
}

function PaginatedServicesTable({ items, t, perms, openView, openEdit, attemptDelete, getDoctorsForService }: any) {
  const { paginatedItems, page, setPage, pageSize, setPageSize, totalPages, totalItems } = usePagination(items);
  return (
    <>
      <div className="neu-flat rounded-3xl bg-background overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right font-cairo">{t.departmentName}</TableHead>
              <TableHead className="text-right font-cairo">{t.responsible}</TableHead>
              <TableHead className="text-right font-cairo">{t.phone}</TableHead>
              <TableHead className="text-right font-cairo">{t.doctorCount}</TableHead>
              <TableHead className="text-right font-cairo w-28">{t.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center font-cairo text-muted-foreground py-8">{t.noDepartments}</TableCell></TableRow>
            ) : paginatedItems.map((svc: any) => {
              const svcDoctors = getDoctorsForService(svc);
              return (
                <TableRow key={svc.id}>
                  <TableCell className="font-cairo font-medium">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-xl gradient-accent flex items-center justify-center text-primary-foreground"><Building2 className="h-4 w-4" /></div>
                      <span>{svc.service_name ? translateValue(svc.service_name, serviceMap, t) : t.noName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-cairo text-sm">{svc.full_name}</TableCell>
                  <TableCell className="font-cairo text-sm text-muted-foreground">{svc.phone || "—"}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-xs font-cairo text-primary">
                      <Stethoscope className="h-3 w-3" />{svcDoctors.length}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openView(svc, "service")} className="neu-flat-sm rounded-xl p-2 hover:scale-110 transition-transform"><Eye className="h-4 w-4 text-primary" /></button>
                      {perms.canEdit && <button onClick={() => openEdit(svc, "service")} className="neu-flat-sm rounded-xl p-2 hover:scale-110 transition-transform"><Edit className="h-4 w-4 text-accent-foreground" /></button>}
                      {perms.canDelete && <button onClick={() => attemptDelete(svc.id)} className="neu-flat-sm rounded-xl p-2 hover:scale-110 transition-transform"><Trash2 className="h-4 w-4 text-destructive" /></button>}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <PaginationControls page={page} totalPages={totalPages} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} onPageSizeChange={setPageSize} />
    </>
  );
}

function PaginatedDoctorsTable({ items, t, perms, openView, openEdit, attemptDelete }: any) {
  const { paginatedItems, page, setPage, pageSize, setPageSize, totalPages, totalItems } = usePagination(items);
  return (
    <>
      <div className="neu-flat rounded-3xl bg-background overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right font-cairo">{t.name}</TableHead>
              <TableHead className="text-right font-cairo">{t.specialty}</TableHead>
              <TableHead className="text-right font-cairo">{t.departmentService}</TableHead>
              <TableHead className="text-right font-cairo">{t.phone}</TableHead>
              <TableHead className="text-right font-cairo w-28">{t.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center font-cairo text-muted-foreground py-8">{t.noDoctors}</TableCell></TableRow>
            ) : paginatedItems.map((doc: any) => (
              <TableRow key={doc.id}>
                <TableCell className="font-cairo font-medium">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground"><Stethoscope className="h-4 w-4" /></div>
                    {doc.full_name}
                  </div>
                </TableCell>
                <TableCell className="font-cairo text-sm text-primary">{doc.specialty ? translateValue(doc.specialty, specialtyMap, t) : "—"}</TableCell>
                <TableCell className="font-cairo text-sm">
                  {doc.service_name ? (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-accent/10 px-2 py-1 text-xs"><Building2 className="h-3 w-3" />{translateValue(doc.service_name, serviceMap, t)}</span>
                  ) : "—"}
                </TableCell>
                <TableCell className="font-cairo text-sm text-muted-foreground">{doc.phone || "—"}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openView(doc, "doctor")} className="neu-flat-sm rounded-xl p-2 hover:scale-110 transition-transform"><Eye className="h-4 w-4 text-primary" /></button>
                    {perms.canEdit && <button onClick={() => openEdit(doc, "doctor")} className="neu-flat-sm rounded-xl p-2 hover:scale-110 transition-transform"><Edit className="h-4 w-4 text-accent-foreground" /></button>}
                    {perms.canDelete && <button onClick={() => attemptDelete(doc.id)} className="neu-flat-sm rounded-xl p-2 hover:scale-110 transition-transform"><Trash2 className="h-4 w-4 text-destructive" /></button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <PaginationControls page={page} totalPages={totalPages} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} onPageSizeChange={setPageSize} />
    </>
  );
}

function PaginatedReceptionistsTable({ items, t, perms, openView, openEdit, attemptDelete, profiles, role }: any) {
  const { paginatedItems, page, setPage, pageSize, setPageSize, totalPages, totalItems } = usePagination(items);
  const getServiceName = (createdBy: string) => {
    const svc = (profiles || []).find((p: any) => p.id === createdBy);
    return svc?.service_name ? svc.service_name : svc?.full_name || "—";
  };
  return (
    <>
      <div className="neu-flat rounded-3xl bg-background overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right font-cairo">{t.name}</TableHead>
              <TableHead className="text-right font-cairo">{t.phone}</TableHead>
              {role === "super_admin" && (
                <TableHead className="text-right font-cairo">{t.departmentService || "المصلحة"}</TableHead>
              )}
              <TableHead className="text-right font-cairo w-28">{t.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={role === "super_admin" ? 4 : 3} className="text-center font-cairo text-muted-foreground py-8">
                  {t.noReceptionists || "لا يوجد موظفو استقبال"}
                </TableCell>
              </TableRow>
            ) : paginatedItems.map((r: any) => {
              const svcName = getServiceName(r.created_by);
              const translatedSvc = svcName && svcName !== "—" ? translateValue(svcName, serviceMap, t) : "—";
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-cairo font-medium">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-xl gradient-accent flex items-center justify-center text-primary-foreground">
                        <UserCog className="h-4 w-4" />
                      </div>
                      {r.full_name}
                    </div>
                  </TableCell>
                  <TableCell className="font-cairo text-sm text-muted-foreground">{r.phone || "—"}</TableCell>
                  {role === "super_admin" && (
                    <TableCell className="font-cairo text-sm">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-accent/10 px-2 py-1 text-xs">
                        <Building2 className="h-3 w-3" />
                        {translatedSvc}
                      </span>
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openView(r, "receptionist")} className="neu-flat-sm rounded-xl p-2 hover:scale-110 transition-transform"><Eye className="h-4 w-4 text-primary" /></button>
                      {perms.canEdit && <button onClick={() => openEdit(r, "receptionist")} className="neu-flat-sm rounded-xl p-2 hover:scale-110 transition-transform"><Edit className="h-4 w-4 text-accent-foreground" /></button>}
                      {perms.canDelete && <button onClick={() => attemptDelete(r.id)} className="neu-flat-sm rounded-xl p-2 hover:scale-110 transition-transform"><Trash2 className="h-4 w-4 text-destructive" /></button>}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <PaginationControls page={page} totalPages={totalPages} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} onPageSizeChange={setPageSize} />
    </>
  );
}

function PaginatedParentsTable({ items, t, perms, openView, openEdit, attemptDeleteParent, patients, patientDoctors, profiles }: any) {
  const { paginatedItems, page, setPage, pageSize, setPageSize, totalPages, totalItems } = usePagination(items);
  const getChildrenForParent = (parentId: string) =>
    (patients || []).filter((p: any) => p.parent_id === parentId && !p.archived);
  const getDoctorName = (id: string) => (profiles || []).find((p: any) => p.id === id)?.full_name || "";
  const getDoctorsForPatient = (patientId: string) => {
    const pds = (patientDoctors || []).filter((pd: any) => pd.patient_id === patientId);
    const ids = pds.length > 0 ? pds.map((pd: any) => pd.doctor_id) : [];
    const pat = (patients || []).find((p: any) => p.id === patientId);
    if (ids.length === 0 && pat?.doctor_id) ids.push(pat.doctor_id);
    return [...new Set(ids)].map((id: string) => getDoctorName(id)).filter(Boolean);
  };
  return (
    <>
      <div className="neu-flat rounded-3xl bg-background overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right font-cairo">{t.name}</TableHead>
              <TableHead className="text-right font-cairo">{t.phone}</TableHead>
              <TableHead className="text-right font-cairo">{t.children || "الأبناء"}</TableHead>
              <TableHead className="text-right font-cairo">{t.treatingDoctors || "الأطباء المعالجون"}</TableHead>
              <TableHead className="text-right font-cairo w-28">{t.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center font-cairo text-muted-foreground py-8">{t.noParents}</TableCell></TableRow>
            ) : paginatedItems.map((p: any) => {
              const children = getChildrenForParent(p.id);
              const allDoctors = [...new Set(children.flatMap((c: any) => getDoctorsForPatient(c.id)))];
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-cairo font-medium">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-xl gradient-success flex items-center justify-center text-primary-foreground"><Heart className="h-4 w-4" /></div>
                      {p.full_name}
                    </div>
                  </TableCell>
                  <TableCell className="font-cairo text-sm text-muted-foreground">{p.phone || "—"}</TableCell>
                  <TableCell className="font-cairo text-sm">
                    {children.length > 0 ? children.map((c: any) => c.name).join("، ") : "—"}
                  </TableCell>
                  <TableCell className="font-cairo text-sm text-primary">
                    {allDoctors.length > 0 ? allDoctors.join("، ") : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openView(p, "parent")} className="neu-flat-sm rounded-xl p-2 hover:scale-110 transition-transform"><Eye className="h-4 w-4 text-primary" /></button>
                      {perms.canEdit && <button onClick={() => openEdit(p, "parent")} className="neu-flat-sm rounded-xl p-2 hover:scale-110 transition-transform"><Edit className="h-4 w-4 text-accent-foreground" /></button>}
                      {perms.canDelete && <button onClick={() => attemptDeleteParent(p.id)} className="neu-flat-sm rounded-xl p-2 hover:scale-110 transition-transform"><Trash2 className="h-4 w-4 text-destructive" /></button>}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <PaginationControls page={page} totalPages={totalPages} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} onPageSizeChange={setPageSize} />
    </>
  );
}

const Users = () => {
  const { t, dir } = useLanguage();
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteWarning, setDeleteWarning] = useState<{ open: boolean; message: string; items: string[] }>({ open: false, message: "", items: [] });
  const [form, setForm] = useState({ email: "", password: "", full_name: "", phone: "", role: "user" as string, specialty: "", service_name: "" });

  // Edit state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>(null);
  const [editType, setEditType] = useState<"service" | "doctor" | "parent" | "receptionist">("service");

  // View state
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewItem, setViewItem] = useState<any>(null);
  const [viewType, setViewType] = useState<"service" | "doctor" | "parent" | "receptionist">("service");

  const { user } = useAuth();
  const role = useRole();
  const perms = usePermissions("users");

  const { data: profiles = [], isLoading } = useTableQuery("profiles");
  const { data: userRoles = [] } = useTableQuery("user_roles");
  const { data: parentsList = [] } = useTableQuery("parents");
  const { data: patients = [] } = useTableQuery("patients");
  const { data: patientDoctors = [] } = useTableQuery("patient_doctors");

  const getRoleForUser = (userId: string) => {
    const r = userRoles.find((ur: any) => ur.user_id === userId);
    return r?.role as AppRole | undefined;
  };

  const allProfiles = profiles.filter((p: any) => p.id !== user?.id);
  const services = allProfiles.filter((p: any) => getRoleForUser(p.id) === "admin");
  const doctors = allProfiles.filter((p: any) => getRoleForUser(p.id) === "user");
  const receptionists = allProfiles.filter((p: any) => getRoleForUser(p.id) === "receptionist");

  const adminDoctors = role === "admin"
    ? allProfiles.filter((p: any) => getRoleForUser(p.id) === "user" && p.created_by === user?.id)
    : doctors;
  const adminReceptionists = role === "admin"
    ? receptionists.filter((p: any) => p.created_by === user?.id)
    : receptionists;

  const filterBySearch = (list: any[]) => list.filter((d: any) => d.full_name?.includes(search));

  const canCreateRole = role === "super_admin" ? ["admin", "user", "receptionist"] : role === "admin" ? ["user", "receptionist"] : [];

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await authApi.createUser({
        email: form.email, password: form.password, full_name: form.full_name,
        phone: form.phone, role: form.role, specialty: form.specialty, service_name: form.service_name,
      });
      toast.success(t.userAddedSuccess);
      setDialogOpen(false);
      setForm({ email: "", password: "", full_name: "", phone: "", role: canCreateRole[0], specialty: "", service_name: "" });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      queryClient.invalidateQueries({ queryKey: ["user_roles"] });
    } catch (err: any) {
      const msg = err.message === 'EMAIL_ALREADY_REGISTERED' ? t.emailAlreadyRegistered : err.message;
      toast.error(t.error + ": " + (msg || t.errorGeneric));
    }
  };

  // Delete with protection checks
  const attemptDelete = (id: string) => {
    const userRole = getRoleForUser(id);

    // Admin (service): check if has doctors
    if (userRole === "admin") {
      const svcDoctors = doctors.filter((d: any) => d.created_by === id);
      if (svcDoctors.length > 0) {
        setDeleteWarning({
          open: true,
          message: t.cannotDeleteAdmin,
          items: svcDoctors.map((d: any) => d.full_name),
        });
        return;
      }
    }

    // Doctor (user): check if has active patients
    if (userRole === "user") {
      const docPatients = patients.filter((p: any) => p.doctor_id === id && !p.archived);
      if (docPatients.length > 0) {
        setDeleteWarning({
          open: true,
          message: t.cannotDeleteDoctor,
          items: docPatients.map((p: any) => p.name),
        });
        return;
      }
    }

    // Parent: check if has patients
    const parentRecord = parentsList.find((p: any) => p.id === id);
    if (parentRecord) {
      const parentChildren = patients.filter((p: any) => p.parent_id === id);
      if (parentChildren.length > 0) {
        setDeleteWarning({
          open: true,
          message: t.cannotDeleteParent,
          items: parentChildren.map((p: any) => p.name),
        });
        return;
      }
    }

    setDeleteId(id);
  };

  // Also check parent deletion from parents tab
  const attemptDeleteParent = (parentId: string) => {
    const parentChildren = patients.filter((p: any) => p.parent_id === parentId && !p.archived);
    if (parentChildren.length > 0) {
      setDeleteWarning({
        open: true,
        message: t.cannotDeleteParent,
        items: parentChildren.map((p: any) => p.name),
      });
      return;
    }
    setDeleteId(parentId);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      // Check if it's a parent deletion
      const isParent = parentsList.some((p: any) => p.id === deleteId);
      if (isParent) {
        await crudApi.delete("parents", deleteId);
        queryClient.invalidateQueries({ queryKey: ["parents"] });
      } else {
        await authApi.deleteUser(deleteId);
        queryClient.invalidateQueries({ queryKey: ["profiles"] });
        queryClient.invalidateQueries({ queryKey: ["user_roles"] });
      }
      toast.success(t.userDeletedSuccess);
      setDeleteId(null);
    } catch (err: any) {
      toast.error(t.error + ": " + (err.message || t.errorGeneric));
    }
  };

  // Edit handlers
  const openEdit = (item: any, type: "service" | "doctor" | "parent" | "receptionist") => {
    setEditType(type as any);
    if (type === "parent") {
      setEditForm({ id: item.id, full_name: item.full_name, phone: item.phone || "" });
    } else if (type === "receptionist") {
      setEditForm({
        id: item.id,
        full_name: item.full_name,
        phone: item.phone || "",
      });
    } else {
      setEditForm({
        id: item.id,
        full_name: item.full_name,
        phone: item.phone || "",
        specialty: item.specialty || "",
        service_name: item.service_name || "",
      });
    }
    setEditDialogOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm) return;
    try {
      if (editType === "parent") {
        await crudApi.update("parents", editForm.id, {
          full_name: editForm.full_name,
          phone: editForm.phone || null,
        });
        queryClient.invalidateQueries({ queryKey: ["parents"] });
      } else {
        const updateData: any = {
          full_name: editForm.full_name,
          phone: editForm.phone || null,
        };
        if (editType === "doctor") updateData.specialty = editForm.specialty || null;
        if (editType === "service") updateData.service_name = editForm.service_name || null;

        await crudApi.update("profiles", editForm.id, updateData);
        queryClient.invalidateQueries({ queryKey: ["profiles"] });
      }
      toast.success(t.saveSuccess);
      setEditDialogOpen(false);
      setEditForm(null);
    } catch (err: any) {
      toast.error(t.error + ": " + (err.message || t.errorGeneric));
    }
  };

  // View handler
  const openView = (item: any, type: "service" | "doctor" | "parent" | "receptionist") => {
    setViewType(type as any);
    setViewItem(item);
    setViewDialogOpen(true);
  };

  // Get related data for view
  const getDoctorsForService = (svc: any) =>
    doctors.filter((d: any) => d.created_by === svc.id || d.service_name === svc.service_name);

  const getPatientsForDoctor = (docId: string) =>
    patients.filter((p: any) => p.doctor_id === docId && !p.archived);

  const getChildrenForParent = (parentId: string) =>
    patients.filter((p: any) => p.parent_id === parentId);

  // Admin view
  if (role === "admin") {
    const filteredDoctors = filterBySearch(adminDoctors);
    const adminParents = parentsList.filter((p: any) => p.created_by === user?.id || adminDoctors.some((d: any) => d.id === p.created_by));
    const filteredAdminParents = filterBySearch(adminParents);
    return (
      <DashboardLayout>
        <div dir={dir} className="space-y-6">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <h2 className="text-2xl font-bold font-cairo">{t.departmentDoctors}</h2>
            <p className="text-muted-foreground font-cairo mt-1">{t.departmentDoctorsSubtitle}</p>
          </motion.div>

          <div className="flex flex-wrap gap-3 items-center">
            <div className="neu-flat-sm rounded-2xl bg-background px-4 py-2.5 flex items-center gap-2 flex-1 max-w-sm">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.searchByName} className="bg-transparent outline-none text-sm flex-1 font-cairo" />
            </div>
            {perms.canCreate && (
              <button onClick={() => { setForm({ email: "", password: "", full_name: "", phone: "", role: "user", specialty: "", service_name: "" }); setDialogOpen(true); }} className="gradient-primary rounded-2xl px-5 py-2.5 flex items-center gap-2 text-sm font-cairo text-primary-foreground hover:scale-105 transition-transform">
                <Plus className="h-4 w-4" />
                {t.addNew}
              </button>
            )}
          </div>

          <Tabs defaultValue="doctors" dir={dir} className="space-y-4">
            <TabsList className="neu-flat-sm rounded-2xl bg-background p-1 h-auto">
              <TabsTrigger value="doctors" className="font-cairo rounded-xl data-[state=active]:gradient-primary data-[state=active]:text-primary-foreground px-4 py-2">
                <Stethoscope className="h-4 w-4 ml-2" />
                {t.doctorsTab} ({adminDoctors.length})
              </TabsTrigger>
              <TabsTrigger value="receptionists" className="font-cairo rounded-xl data-[state=active]:gradient-primary data-[state=active]:text-primary-foreground px-4 py-2">
                <UserCog className="h-4 w-4 ml-2" />
                {t.receptionistsTab || "موظفو الاستقبال"} ({adminReceptionists.length})
              </TabsTrigger>
              <TabsTrigger value="parents" className="font-cairo rounded-xl data-[state=active]:gradient-primary data-[state=active]:text-primary-foreground px-4 py-2">
                <Heart className="h-4 w-4 ml-2" />
                {t.parentsTab} ({adminParents.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="doctors">
              <AdminDoctorTable filteredDoctors={filteredDoctors} t={t} perms={perms} openView={openView} openEdit={openEdit} attemptDelete={attemptDelete} />
            </TabsContent>

            <TabsContent value="receptionists">
              <PaginatedReceptionistsTable items={filterBySearch(adminReceptionists)} t={t} perms={perms} openView={openView} openEdit={openEdit} attemptDelete={attemptDelete} profiles={profiles} role={role} />
            </TabsContent>

            <TabsContent value="parents">
              <PaginatedParentsTable items={filteredAdminParents} t={t} perms={perms} openView={openView} openEdit={openEdit} attemptDeleteParent={attemptDeleteParent} patients={patients} patientDoctors={patientDoctors} profiles={profiles} />
            </TabsContent>
          </Tabs>

          <CrudDialog open={dialogOpen} onOpenChange={setDialogOpen} title={t.addNewUser}>
            <UserForm form={form} setForm={setForm} onSubmit={handleAdd} canCreateRole={["user", "receptionist"]} t={t} />
          </CrudDialog>
          <DeleteConfirm open={!!deleteId} onOpenChange={() => setDeleteId(null)} onConfirm={handleDelete} />
          <WarningDialog warning={deleteWarning} onClose={() => setDeleteWarning({ open: false, message: "", items: [] })} t={t} dir={dir} />

          {/* Edit Dialog */}
          <EditDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} editForm={editForm} setEditForm={setEditForm} editType={editType} onSubmit={handleEdit} t={t} dir={dir} />

          {/* View Dialog */}
          <ViewDialog open={viewDialogOpen} onOpenChange={setViewDialogOpen} item={viewItem} type={viewType} t={t} dir={dir}
            getDoctorsForService={getDoctorsForService} getPatientsForDoctor={getPatientsForDoctor} getChildrenForParent={getChildrenForParent} doctors={doctors} />
        </div>
      </DashboardLayout>
    );
  }

  // Super Admin view
  const filteredServices = filterBySearch(services);
  const filteredDoctors = filterBySearch(doctors);
  const filteredParents = filterBySearch(parentsList);

  return (
    <DashboardLayout>
      <div dir={dir} className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-2xl font-bold font-cairo">{t.usersTitle}</h2>
          <p className="text-muted-foreground font-cairo mt-1">{t.usersSubtitle}</p>
        </motion.div>

        <div className="flex flex-wrap gap-3 items-center">
          <div className="neu-flat-sm rounded-2xl bg-background px-4 py-2.5 flex items-center gap-2 flex-1 max-w-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.searchByName} className="bg-transparent outline-none text-sm flex-1 font-cairo" />
          </div>
          {perms.canCreate && canCreateRole.length > 0 && (
            <button onClick={() => { setForm({ email: "", password: "", full_name: "", phone: "", role: canCreateRole[0], specialty: "", service_name: "" }); setDialogOpen(true); }} className="gradient-primary rounded-2xl px-5 py-2.5 flex items-center gap-2 text-sm font-cairo text-primary-foreground hover:scale-105 transition-transform">
              <Plus className="h-4 w-4" />
              {t.addNew}
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-12 font-cairo text-muted-foreground">{t.loading}</div>
        ) : (
          <Tabs defaultValue="services" dir={dir} className="space-y-4">
            <TabsList className="neu-flat-sm rounded-2xl bg-background p-1 h-auto flex flex-wrap">
              <TabsTrigger value="services" className="font-cairo rounded-xl data-[state=active]:gradient-primary data-[state=active]:text-primary-foreground px-4 py-2">
                <Building2 className="h-4 w-4 ml-2" />
                {t.departmentsTab} ({services.length})
              </TabsTrigger>
              <TabsTrigger value="doctors" className="font-cairo rounded-xl data-[state=active]:gradient-primary data-[state=active]:text-primary-foreground px-4 py-2">
                <Stethoscope className="h-4 w-4 ml-2" />
                {t.doctorsTab} ({doctors.length})
              </TabsTrigger>
              <TabsTrigger value="receptionists" className="font-cairo rounded-xl data-[state=active]:gradient-primary data-[state=active]:text-primary-foreground px-4 py-2">
                <UserCog className="h-4 w-4 ml-2" />
                {t.receptionistsTab || "موظفو الاستقبال"} ({receptionists.length})
              </TabsTrigger>
              <TabsTrigger value="parents" className="font-cairo rounded-xl data-[state=active]:gradient-primary data-[state=active]:text-primary-foreground px-4 py-2">
                <Heart className="h-4 w-4 ml-2" />
                {t.parentsTab} ({parentsList.length})
              </TabsTrigger>
            </TabsList>

            {/* Services Tab */}
            <TabsContent value="services">
              <PaginatedServicesTable items={filteredServices} t={t} perms={perms} openView={openView} openEdit={openEdit} attemptDelete={attemptDelete} getDoctorsForService={getDoctorsForService} />
            </TabsContent>

            {/* Doctors Tab */}
            <TabsContent value="doctors">
              <PaginatedDoctorsTable items={filteredDoctors} t={t} perms={perms} openView={openView} openEdit={openEdit} attemptDelete={attemptDelete} />
            </TabsContent>

            {/* Receptionists Tab */}
            <TabsContent value="receptionists">
              <PaginatedReceptionistsTable items={filterBySearch(receptionists)} t={t} perms={perms} openView={openView} openEdit={openEdit} attemptDelete={attemptDelete} profiles={profiles} role={role} />
            </TabsContent>

            {/* Parents Tab */}
            <TabsContent value="parents">
              <PaginatedParentsTable items={filteredParents} t={t} perms={perms} openView={openView} openEdit={openEdit} attemptDeleteParent={attemptDeleteParent} patients={patients} patientDoctors={patientDoctors} profiles={profiles} />
            </TabsContent>
          </Tabs>
        )}

        <CrudDialog open={dialogOpen} onOpenChange={setDialogOpen} title={t.addNewUser}>
          <UserForm form={form} setForm={setForm} onSubmit={handleAdd} canCreateRole={canCreateRole} t={t} />
        </CrudDialog>
        <DeleteConfirm open={!!deleteId} onOpenChange={() => setDeleteId(null)} onConfirm={handleDelete} />
        <WarningDialog warning={deleteWarning} onClose={() => setDeleteWarning({ open: false, message: "", items: [] })} t={t} dir={dir} />

        {/* Edit Dialog */}
        <EditDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} editForm={editForm} setEditForm={setEditForm} editType={editType} onSubmit={handleEdit} t={t} dir={dir} />

        {/* View Dialog */}
        <ViewDialog open={viewDialogOpen} onOpenChange={setViewDialogOpen} item={viewItem} type={viewType} t={t} dir={dir}
          getDoctorsForService={getDoctorsForService} getPatientsForDoctor={getPatientsForDoctor} getChildrenForParent={getChildrenForParent} doctors={doctors} />
      </div>
    </DashboardLayout>
  );
};

// Edit Dialog Component
function EditDialog({ open, onOpenChange, editForm, setEditForm, editType, onSubmit, t, dir }: {
  open: boolean; onOpenChange: (v: boolean) => void; editForm: any; setEditForm: any;
  editType: "service" | "doctor" | "parent" | "receptionist"; onSubmit: (e: React.FormEvent) => void; t: any; dir: string;
}) {
  if (!editForm) return null;
  const title = editType === "service" ? t.editDepartment
    : editType === "doctor" ? t.editDoctor
    : editType === "receptionist" ? (t.editReceptionist || "تعديل موظف الاستقبال")
    : t.editParent;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="neu-flat rounded-3xl bg-background border-none max-w-lg" dir={dir}>
        <DialogHeader>
          <DialogTitle className="font-cairo text-lg">{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-cairo font-medium">{t.fullName}</label>
            <div className="neu-pressed rounded-xl">
              <input value={editForm.full_name} onChange={e => setEditForm((f: any) => ({ ...f, full_name: e.target.value }))}
                className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" required />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-cairo font-medium">{t.phone}</label>
            <div className="neu-pressed rounded-xl">
              <input value={editForm.phone} onChange={e => setEditForm((f: any) => ({ ...f, phone: e.target.value }))}
                className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" />
            </div>
          </div>
          {editType === "service" && (
            <div className="space-y-2">
              <label className="text-sm font-cairo font-medium">{t.departmentName}</label>
              <div className="neu-pressed rounded-xl">
                <select value={editForm.service_name} onChange={e => setEditForm((f: any) => ({ ...f, service_name: e.target.value }))}
                  className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" required>
                  <option value="">{t.selectDepartment}</option>
                  {serviceKeys.map(s => <option key={s.value} value={s.value}>{t[s.key as keyof typeof t]}</option>)}
                </select>
              </div>
            </div>
          )}
          {editType === "doctor" && (
            <div className="space-y-2">
              <label className="text-sm font-cairo font-medium">{t.specialty}</label>
              <div className="neu-pressed rounded-xl">
                <select value={editForm.specialty} onChange={e => setEditForm((f: any) => ({ ...f, specialty: e.target.value }))}
                  className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl">
                  <option value="">{t.selectSpecialty}</option>
                  {specialtyOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          )}
          <button type="submit" className="w-full gradient-primary rounded-xl px-4 py-2.5 text-primary-foreground font-cairo font-medium hover:opacity-90">
            {t.save}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// View Dialog Component
function ViewDialog({ open, onOpenChange, item, type, t, dir, getDoctorsForService, getPatientsForDoctor, getChildrenForParent, doctors }: {
  open: boolean; onOpenChange: (v: boolean) => void; item: any; type: "service" | "doctor" | "parent" | "receptionist"; t: any; dir: string;
  getDoctorsForService: (svc: any) => any[]; getPatientsForDoctor: (id: string) => any[];
  getChildrenForParent: (id: string) => any[]; doctors: any[];
}) {
  if (!item) return null;

  const title = type === "service" ? t.viewDepartment
    : type === "doctor" ? t.viewDoctor
    : type === "receptionist" ? (t.viewReceptionist || "عرض موظف الاستقبال")
    : t.viewParent;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="neu-flat rounded-3xl bg-background border-none max-w-2xl max-h-[80vh] overflow-y-auto" dir={dir}>
        <DialogHeader>
          <DialogTitle className="font-cairo text-lg flex items-center gap-2">
            {type === "service" ? <Building2 className="h-5 w-5 text-primary" /> :
             type === "doctor" ? <Stethoscope className="h-5 w-5 text-primary" /> :
             type === "receptionist" ? <UserCog className="h-5 w-5 text-primary" /> :
             <Heart className="h-5 w-5 text-primary" />}
            {title}
          </DialogTitle>
        </DialogHeader>

        {/* Basic Info */}
        <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-muted/30">
                  <InfoRow label={t.fullName} value={item.full_name} />
                  <InfoRow label={t.phone} value={item.phone || "—"} />
                  {type === "service" && <InfoRow label={t.departmentName} value={item.service_name ? translateValue(item.service_name, serviceMap, t) : "—"} />}
                  {type === "doctor" && (
                    <>
                      <InfoRow label={t.specialty} value={item.specialty || "—"} />
                      <InfoRow label={t.departmentService} value={item.service_name ? translateValue(item.service_name, serviceMap, t) : "—"} />
            </>
          )}
          {type === "receptionist" && (
            <InfoRow
              label={t.departmentService || "المصلحة"}
              value={(() => {
                const svc = (doctors || []).concat().find((d: any) => false);
                // find service profile from item.created_by — we get it from parent context via doctors list won't work,
                // so we fall back to service_name on item if present
                return item.service_name ? translateValue(item.service_name, serviceMap, t) : "—";
              })()}
            />
          )}
        </div>

        {/* Related Data */}
        {type === "service" && (
          <div className="space-y-3">
            <h4 className="font-cairo font-semibold text-sm">{t.doctorsTab} ({getDoctorsForService(item).length})</h4>
            {getDoctorsForService(item).length === 0 ? (
              <p className="text-sm text-muted-foreground font-cairo">{t.noDoctors}</p>
            ) : (
              <div className="rounded-2xl bg-muted/20 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right font-cairo text-xs">{t.name}</TableHead>
                      <TableHead className="text-right font-cairo text-xs">{t.specialty}</TableHead>
                      <TableHead className="text-right font-cairo text-xs">{t.patientCount}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getDoctorsForService(item).map((doc: any) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-cairo text-sm">{doc.full_name}</TableCell>
                        <TableCell className="font-cairo text-xs text-muted-foreground">{doc.specialty || "—"}</TableCell>
                        <TableCell className="font-cairo text-xs">
                          <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-lg">{getPatientsForDoctor(doc.id).length}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}

        {type === "doctor" && (
          <div className="space-y-3">
            <h4 className="font-cairo font-semibold text-sm">{t.patientsTitle} ({getPatientsForDoctor(item.id).length})</h4>
            {getPatientsForDoctor(item.id).length === 0 ? (
              <p className="text-sm text-muted-foreground font-cairo">{t.noData}</p>
            ) : (
              <div className="rounded-2xl bg-muted/20 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right font-cairo text-xs">{t.name}</TableHead>
                      <TableHead className="text-right font-cairo text-xs">{t.age}</TableHead>
                      <TableHead className="text-right font-cairo text-xs">{t.status}</TableHead>
                      <TableHead className="text-right font-cairo text-xs">{t.diagnosis}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getPatientsForDoctor(item.id).map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-cairo text-sm">{p.name}</TableCell>
                        <TableCell className="font-cairo text-xs">{p.age} {t.years}</TableCell>
                        <TableCell className="font-cairo text-xs">
                          <span className={`px-2 py-0.5 rounded-lg text-xs ${
                            p.status === "تحسن" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                            p.status === "تدهور" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                            "bg-primary/10 text-primary"
                          }`}>{p.status}</span>
                        </TableCell>
                        <TableCell className="font-cairo text-xs text-muted-foreground">{p.diagnosis_type || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}

        {type === "parent" && (
          <div className="space-y-3">
            <h4 className="font-cairo font-semibold text-sm">{t.myChildren} ({getChildrenForParent(item.id).length})</h4>
            {getChildrenForParent(item.id).length === 0 ? (
              <p className="text-sm text-muted-foreground font-cairo">{t.noData}</p>
            ) : (
              <div className="rounded-2xl bg-muted/20 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right font-cairo text-xs">{t.name}</TableHead>
                      <TableHead className="text-right font-cairo text-xs">{t.age}</TableHead>
                      <TableHead className="text-right font-cairo text-xs">{t.doctor}</TableHead>
                      <TableHead className="text-right font-cairo text-xs">{t.status}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getChildrenForParent(item.id).map((p: any) => {
                      const doc = doctors.find((d: any) => d.id === p.doctor_id);
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-cairo text-sm">{p.name}</TableCell>
                          <TableCell className="font-cairo text-xs">{p.age} {t.years}</TableCell>
                          <TableCell className="font-cairo text-xs text-muted-foreground">{doc?.full_name || "—"}</TableCell>
                          <TableCell className="font-cairo text-xs">
                            <span className={`px-2 py-0.5 rounded-lg text-xs ${
                              p.status === "تحسن" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                              p.status === "تدهور" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                              "bg-primary/10 text-primary"
                            }`}>{p.status}</span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground font-cairo">{label}</p>
      <p className="text-sm font-medium font-cairo">{value}</p>
    </div>
  );
}

// Warning Dialog for delete protection
function WarningDialog({ warning, onClose, t, dir }: {
  warning: { open: boolean; message: string; items: string[] }; onClose: () => void; t: any; dir: string;
}) {
  return (
    <Dialog open={warning.open} onOpenChange={onClose}>
      <DialogContent className="neu-flat rounded-3xl bg-background border-none max-w-md" dir={dir}>
        <DialogHeader>
          <DialogTitle className="font-cairo text-lg text-destructive">⚠️ {t.cannotDelete}</DialogTitle>
        </DialogHeader>
        <p className="text-sm font-cairo text-muted-foreground">{warning.message}</p>
        <ul className="list-disc list-inside space-y-1 rounded-2xl bg-destructive/5 p-4">
          {warning.items.map((item, i) => (
            <li key={i} className="text-sm font-cairo font-medium">{item}</li>
          ))}
        </ul>
        <button onClick={onClose} className="w-full gradient-primary rounded-xl px-4 py-2.5 text-primary-foreground font-cairo font-medium hover:opacity-90 mt-2">
          {t.close}
        </button>
      </DialogContent>
    </Dialog>
  );
}

function UserForm({ form, setForm, onSubmit, canCreateRole, t }: {
  form: any; setForm: any; onSubmit: (e: React.FormEvent) => void; canCreateRole: string[]; t: any;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-cairo font-medium">{t.fullName}</label>
        <div className="neu-pressed rounded-xl"><input value={form.full_name} onChange={e => setForm((f: any) => ({ ...f, full_name: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" required /></div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-cairo font-medium">{t.email}</label>
        <div className="neu-pressed rounded-xl"><input type="email" value={form.email} onChange={e => setForm((f: any) => ({ ...f, email: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" required /></div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-cairo font-medium">{t.password}</label>
        <div className="neu-pressed rounded-xl"><input type="password" value={form.password} onChange={e => setForm((f: any) => ({ ...f, password: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" required /></div>
      </div>
      {canCreateRole.length > 1 && (
        <div className="space-y-2">
          <label className="text-sm font-cairo font-medium">{t.userType}</label>
          <div className="neu-pressed rounded-xl">
            <select value={form.role} onChange={e => setForm((f: any) => ({ ...f, role: e.target.value, specialty: "", service_name: "" }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl">
              {canCreateRole.map(r => (
                <option key={r} value={r}>{roleLabels[r as AppRole]}</option>
              ))}
            </select>
          </div>
        </div>
      )}
      {form.role === "admin" && (
        <div className="space-y-2">
          <label className="text-sm font-cairo font-medium">{t.departmentName}</label>
          <div className="neu-pressed rounded-xl">
                <select value={form.service_name} onChange={e => setForm((f: any) => ({ ...f, service_name: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" required>
                  <option value="">{t.selectDepartment}</option>
                  {serviceKeys.map(s => <option key={s.value} value={s.value}>{t[s.key as keyof typeof t]}</option>)}
            </select>
          </div>
        </div>
      )}
      {form.role === "user" && (
        <div className="space-y-2">
          <label className="text-sm font-cairo font-medium">{t.specialty}</label>
          <div className="neu-pressed rounded-xl">
            <select value={form.specialty} onChange={e => setForm((f: any) => ({ ...f, specialty: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" required>
              <option value="">{t.selectSpecialty}</option>
              {specialtyOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      )}
      <div className="space-y-2">
        <label className="text-sm font-cairo font-medium">{t.phone}</label>
        <div className="neu-pressed rounded-xl"><input value={form.phone} onChange={e => setForm((f: any) => ({ ...f, phone: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" /></div>
      </div>
      <button type="submit" className="w-full gradient-primary rounded-xl px-4 py-2.5 text-primary-foreground font-cairo font-medium hover:opacity-90">{t.add}</button>
    </form>
  );
}

export default Users;
