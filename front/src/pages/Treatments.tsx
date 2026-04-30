import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { motion } from "framer-motion";
import { Search, Plus, Edit, Trash2, Pill } from "lucide-react";
import { useState } from "react";
import { useTableQuery, useInsertMutation, useUpdateMutation, useDeleteMutation } from "@/hooks/useSupabaseQuery";
import { CrudDialog } from "@/components/shared/CrudDialog";
import { DeleteConfirm } from "@/components/shared/DeleteConfirm";
import { usePermissions, useRole } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";

const Treatments = () => {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ patient_id: "", medication: "", dosage: "", frequency: "يومي", start_date: "", end_date: "", notes: "" });

  const { user } = useAuth();
  const role = useRole();
  const perms = usePermissions("treatments");

  const { data: treatments = [], isLoading } = useTableQuery("treatments");
  const { data: patients = [] } = useTableQuery("patients");
  const insertMut = useInsertMutation("treatments");
  const updateMut = useUpdateMutation("treatments");
  const deleteMut = useDeleteMutation("treatments");

  const getPatientName = (id: string) => patients.find((p: any) => p.id === id)?.name || "-";

  const openAdd = () => { setEditItem(null); setForm({ patient_id: "", medication: "", dosage: "", frequency: "يومي", start_date: "", end_date: "", notes: "" }); setDialogOpen(true); };
  const openEdit = (t: any) => {
    setEditItem(t);
    setForm({ patient_id: t.patient_id, medication: t.medication, dosage: t.dosage, frequency: t.frequency, start_date: t.start_date || "", end_date: t.end_date || "", notes: t.notes || "" });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form, start_date: form.start_date || null, end_date: form.end_date || null, created_by: user?.id };
    if (editItem) {
      updateMut.mutate({ id: editItem.id, ...payload }, { onSuccess: () => setDialogOpen(false) });
    } else {
      insertMut.mutate(payload, { onSuccess: () => setDialogOpen(false) });
    }
  };

  // Only show patients belonging to this user (doctor)
  const myPatients = role === "user" ? patients.filter((p: any) => p.doctor_id === user?.id) : patients;

  return (
    <DashboardLayout>
      <div dir="rtl" className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-2xl font-bold font-cairo">إدارة العلاجات</h2>
          <p className="text-muted-foreground font-cairo mt-1">
            {role === "user" ? "علاجات مرضاك" : "عرض جميع العلاجات"}
          </p>
        </motion.div>

        <div className="flex flex-wrap gap-3 items-center">
          <div className="neu-flat-sm rounded-2xl bg-background px-4 py-2.5 flex items-center gap-2 flex-1 max-w-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالدواء..." className="bg-transparent outline-none text-sm flex-1 font-cairo" />
          </div>
          {perms.canCreate && (
            <button onClick={openAdd} className="gradient-primary rounded-2xl px-5 py-2.5 flex items-center gap-2 text-sm font-cairo text-primary-foreground hover:scale-105 transition-transform">
              <Plus className="h-4 w-4" />
              علاج جديد
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-12 font-cairo text-muted-foreground">جاري التحميل...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {treatments.filter((t: any) => t.medication?.includes(search)).map((t: any, i: number) => (
              <motion.div key={t.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="neu-flat rounded-3xl bg-background p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-11 w-11 rounded-2xl gradient-warning flex items-center justify-center text-primary-foreground"><Pill className="h-5 w-5" /></div>
                  <div>
                    <h4 className="font-semibold font-cairo">{t.medication}</h4>
                    <p className="text-xs text-muted-foreground font-cairo">{getPatientName(t.patient_id)}</p>
                  </div>
                </div>
                <div className="space-y-1 text-sm text-muted-foreground font-cairo">
                  <div className="flex justify-between"><span>الجرعة</span><span className="text-foreground">{t.dosage}</span></div>
                  <div className="flex justify-between"><span>التكرار</span><span className="text-foreground">{t.frequency}</span></div>
                  {t.start_date && <div className="flex justify-between"><span>البداية</span><span className="text-foreground">{t.start_date}</span></div>}
                </div>
                {(perms.canEdit || perms.canDelete) && (
                  <div className="flex gap-2 mt-3 justify-end">
                    {perms.canEdit && <button onClick={() => openEdit(t)} className="neu-flat-sm rounded-xl p-2 hover:scale-110 transition-transform"><Edit className="h-4 w-4 text-primary" /></button>}
                    {perms.canDelete && <button onClick={() => setDeleteId(t.id)} className="neu-flat-sm rounded-xl p-2 hover:scale-110 transition-transform"><Trash2 className="h-4 w-4 text-destructive" /></button>}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}

        <CrudDialog open={dialogOpen} onOpenChange={setDialogOpen} title={editItem ? "تعديل علاج" : "إضافة علاج جديد"}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-cairo font-medium">المريض</label>
              <div className="neu-pressed rounded-xl">
                <select value={form.patient_id} onChange={e => setForm(f => ({ ...f, patient_id: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" required>
                  <option value="">اختر المريض</option>
                  {myPatients.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-cairo font-medium">الدواء</label>
              <div className="neu-pressed rounded-xl"><input value={form.medication} onChange={e => setForm(f => ({ ...f, medication: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" required /></div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-cairo font-medium">الجرعة</label>
              <div className="neu-pressed rounded-xl"><input value={form.dosage} onChange={e => setForm(f => ({ ...f, dosage: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" required /></div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-cairo font-medium">التكرار</label>
              <div className="neu-pressed rounded-xl">
                <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl">
                  <option value="يومي">يومي</option>
                  <option value="أسبوعي">أسبوعي</option>
                  <option value="شهري">شهري</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-cairo font-medium">بداية</label>
                <div className="neu-pressed rounded-xl"><input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" /></div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-cairo font-medium">نهاية</label>
                <div className="neu-pressed rounded-xl"><input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" /></div>
              </div>
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

export default Treatments;
