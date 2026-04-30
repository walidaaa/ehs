import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { motion } from "framer-motion";
import { Search, Plus, Edit, Trash2, UserCheck, Shield, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useTableQuery, useDeleteMutation } from "@/hooks/useSupabaseQuery";
import { DeleteConfirm } from "@/components/shared/DeleteConfirm";
import { authApi, crudApi } from "@/lib/api";
import { CrudDialog } from "@/components/shared/CrudDialog";
import { toast } from "sonner";
import { usePermissions, useRole } from "@/hooks/usePermissions";
import { roleLabels, type AppRole } from "@/lib/permissions";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/shared/PaginationControls";
import { CardSkeleton } from "@/components/shared/ListSkeleton";

const Doctors = () => {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ email: "", password: "", full_name: "", phone: "", role: "user" as string });

  const role = useRole();
  const perms = usePermissions("doctors");

  const { data: profiles = [], isLoading, refetch } = useTableQuery("profiles");
  const { data: userRoles = [] } = useTableQuery("user_roles");

  // Super admin sees all, admin sees users only
  const getRoleForUser = (userId: string) => {
    const r = userRoles.find((ur: any) => ur.user_id === userId);
    return r?.role as AppRole | undefined;
  };

  let visibleProfiles = profiles;
  if (role === "admin") {
    // Admin sees users (doctors) only, not other admins or super_admins
    const userIds = new Set(userRoles.filter((r: any) => r.role === "user").map((r: any) => r.user_id));
    visibleProfiles = profiles.filter((p: any) => userIds.has(p.id));
  }

  const filtered = visibleProfiles.filter((d: any) => d.full_name?.includes(search));
  const { paginatedItems, page, setPage, pageSize, setPageSize, totalPages, totalItems } = usePagination(filtered);

  const canCreateRole = role === "super_admin" ? ["admin", "user"] : role === "admin" ? ["user"] : [];

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const userData = await authApi.createUser({
        email: form.email,
        password: form.password,
        full_name: form.full_name,
        phone: form.phone,
        role: form.role
      });
      toast.success("تم إضافة المستخدم بنجاح");
      setDialogOpen(false);
      setForm({ email: "", password: "", full_name: "", phone: "", role: "user" });
      refetch();
    } catch (error: any) {
      console.error("[Doctors] Add user error:", error);
      toast.error(error.message || "خطأ في إضافة المستخدم");
    }
  };

  return (
    <DashboardLayout>
      <div dir="rtl" className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-2xl font-bold font-cairo">
            {role === "super_admin" ? "إدارة المستخدمين" : "إدارة الأطباء"}
          </h2>
          <p className="text-muted-foreground font-cairo mt-1">
            {role === "super_admin" ? "إدارة جميع المستخدمين والصلاحيات" : "عرض وإدارة الطاقم الطبي"}
          </p>
        </motion.div>

        <div className="flex flex-wrap gap-3 items-center">
          <div className="neu-flat-sm rounded-2xl bg-background px-4 py-2.5 flex items-center gap-2 flex-1 max-w-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم..." className="bg-transparent outline-none text-sm flex-1 font-cairo" />
          </div>
          {canCreateRole.length > 0 && (
            <button onClick={() => { setForm({ email: "", password: "", full_name: "", phone: "", role: "user" }); setDialogOpen(true); }} className="gradient-primary rounded-2xl px-5 py-2.5 flex items-center gap-2 text-sm font-cairo text-primary-foreground hover:scale-105 transition-transform">
              <Plus className="h-4 w-4" />
              مستخدم جديد
            </button>
          )}
        </div>

        {isLoading ? (
          <CardSkeleton />
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 font-cairo text-muted-foreground">لا يوجد مستخدمون</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {paginatedItems.map((doc: any, i: number) => {
                const userRole = getRoleForUser(doc.id);
                return (
                  <motion.div key={doc.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    className="neu-flat rounded-3xl bg-background p-5">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-2xl gradient-accent flex items-center justify-center text-primary-foreground font-bold text-sm">
                        {userRole === "super_admin" ? <ShieldCheck className="h-5 w-5" /> : userRole === "admin" ? <Shield className="h-5 w-5" /> : <UserCheck className="h-5 w-5" />}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold font-cairo">{doc.full_name}</h4>
                        <p className="text-xs text-muted-foreground">{doc.phone || "بدون رقم"}</p>
                      </div>
                      {userRole && (
                        <span className="rounded-xl px-3 py-1 text-xs font-medium font-cairo bg-primary/10 text-primary">
                          {roleLabels[userRole]}
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
            <PaginationControls page={page} totalPages={totalPages} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} onPageSizeChange={setPageSize} />
          </>
        )}

        <CrudDialog open={dialogOpen} onOpenChange={setDialogOpen} title="إضافة مستخدم جديد">
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-cairo font-medium">الاسم الكامل</label>
              <div className="neu-pressed rounded-xl"><input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" required /></div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-cairo font-medium">البريد الإلكتروني</label>
              <div className="neu-pressed rounded-xl"><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" required /></div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-cairo font-medium">كلمة المرور</label>
              <div className="neu-pressed rounded-xl"><input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" required /></div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-cairo font-medium">الصلاحية</label>
              <div className="neu-pressed rounded-xl">
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl">
                  {canCreateRole.map(r => (
                    <option key={r} value={r}>{roleLabels[r as AppRole]}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-cairo font-medium">الهاتف</label>
              <div className="neu-pressed rounded-xl"><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" /></div>
            </div>
            <button type="submit" className="w-full gradient-primary rounded-xl px-4 py-2.5 text-primary-foreground font-cairo font-medium hover:opacity-90">إضافة</button>
          </form>
        </CrudDialog>
      </div>
    </DashboardLayout>
  );
};

export default Doctors;
