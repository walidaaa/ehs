import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { motion } from "framer-motion";
import { Search, Plus, Edit, Trash2, Building2 } from "lucide-react";
import { useState } from "react";
import { useTableQuery, useInsertMutation, useUpdateMutation, useDeleteMutation } from "@/hooks/useSupabaseQuery";
import { CrudDialog } from "@/components/shared/CrudDialog";
import { DeleteConfirm } from "@/components/shared/DeleteConfirm";
import { usePermissions } from "@/hooks/usePermissions";

const Centers = () => {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });

  const perms = usePermissions("centers");

  const { data: centersList = [], isLoading } = useTableQuery("centers");
  const { data: patients = [] } = useTableQuery("patients");
  const insertMut = useInsertMutation("centers");
  const updateMut = useUpdateMutation("centers");
  const deleteMut = useDeleteMutation("centers");

  const filtered = centersList.filter((c: any) => c.name?.includes(search));

  const openAdd = () => { setEditItem(null); setForm({ name: "", description: "" }); setDialogOpen(true); };
  const openEdit = (c: any) => { setEditItem(c); setForm({ name: c.name, description: c.description || "" }); setDialogOpen(true); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editItem) {
      updateMut.mutate({ id: editItem.id, ...form }, { onSuccess: () => setDialogOpen(false) });
    } else {
      insertMut.mutate(form, { onSuccess: () => setDialogOpen(false) });
    }
  };

  return (
    <DashboardLayout>
      <div dir="rtl" className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-2xl font-bold font-cairo">إدارة المراكز</h2>
          <p className="text-muted-foreground font-cairo mt-1">عرض وإدارة مراكز المستشفى</p>
        </motion.div>

        <div className="flex flex-wrap gap-3 items-center">
          <div className="neu-flat-sm rounded-2xl bg-background px-4 py-2.5 flex items-center gap-2 flex-1 max-w-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم..." className="bg-transparent outline-none text-sm flex-1 font-cairo" />
          </div>
          {perms.canCreate && (
            <button onClick={openAdd} className="gradient-primary rounded-2xl px-5 py-2.5 flex items-center gap-2 text-sm font-cairo text-primary-foreground hover:scale-105 transition-transform">
              <Plus className="h-4 w-4" />
              مركز جديد
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-12 font-cairo text-muted-foreground">جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 font-cairo text-muted-foreground">لا توجد مراكز</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((center: any, i: number) => {
              const patientCount = patients.filter((p: any) => p.center_id === center.id).length;
              return (
                <motion.div key={center.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="neu-flat rounded-3xl bg-background p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-11 w-11 rounded-2xl gradient-primary flex items-center justify-center text-primary-foreground"><Building2 className="h-5 w-5" /></div>
                    <div>
                      <h4 className="font-semibold font-cairo">{center.name}</h4>
                      <p className="text-xs text-muted-foreground font-cairo">{patientCount} مريض</p>
                    </div>
                  </div>
                  {center.description && <p className="text-sm text-muted-foreground font-cairo mb-3">{center.description}</p>}
                  {(perms.canEdit || perms.canDelete) && (
                    <div className="flex gap-2 justify-end">
                      {perms.canEdit && <button onClick={() => openEdit(center)} className="neu-flat-sm rounded-xl p-2 hover:scale-110 transition-transform"><Edit className="h-4 w-4 text-primary" /></button>}
                      {perms.canDelete && <button onClick={() => setDeleteId(center.id)} className="neu-flat-sm rounded-xl p-2 hover:scale-110 transition-transform"><Trash2 className="h-4 w-4 text-destructive" /></button>}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

        <CrudDialog open={dialogOpen} onOpenChange={setDialogOpen} title={editItem ? "تعديل مركز" : "إضافة مركز جديد"}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-cairo font-medium">اسم المركز</label>
              <div className="neu-pressed rounded-xl"><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" required /></div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-cairo font-medium">الوصف</label>
              <div className="neu-pressed rounded-xl"><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" rows={3} /></div>
            </div>
            <button type="submit" disabled={insertMut.isPending || updateMut.isPending} className="w-full gradient-primary rounded-xl px-4 py-2.5 text-primary-foreground font-cairo font-medium hover:opacity-90 disabled:opacity-50">
              {editItem ? "تحديث" : "إضافة"}
            </button>
          </form>
        </CrudDialog>
        <DeleteConfirm open={!!deleteId} onOpenChange={() => setDeleteId(null)} onConfirm={() => { if (deleteId) { deleteMut.mutate(deleteId); setDeleteId(null); } }} />
      </div>
    </DashboardLayout>
  );
};

export default Centers;
