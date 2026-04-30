import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { motion } from "framer-motion";
import { Plus, Check, X } from "lucide-react";
import { useState } from "react";
import { useTableQuery, useInsertMutation } from "@/hooks/useSupabaseQuery";
import { CrudDialog } from "@/components/shared/CrudDialog";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions, useRole } from "@/hooks/usePermissions";

const Attendance = () => {
  const { user } = useAuth();
  const role = useRole();
  const perms = usePermissions("attendance");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ patient_id: "", date: new Date().toISOString().slice(0, 10), present: true, notes: "" });

  const { data: records = [], isLoading } = useTableQuery("attendance");
  const { data: patients = [] } = useTableQuery("patients");
  const insertMut = useInsertMutation("attendance");

  const getPatientName = (id: string) => patients.find((p: any) => p.id === id)?.name || "-";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    insertMut.mutate({ ...form, recorded_by: user?.id }, { onSuccess: () => setDialogOpen(false) });
  };

  // Only show patients belonging to this user (doctor)
  const myPatients = role === "user" ? patients.filter((p: any) => p.doctor_id === user?.id) : patients;

  return (
    <DashboardLayout>
      <div dir="rtl" className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-2xl font-bold font-cairo">سجل الحضور</h2>
          <p className="text-muted-foreground font-cairo mt-1">
            {role === "user" ? "تسجيل حضور مرضاك" : "عرض سجل الحضور"}
          </p>
        </motion.div>

        {perms.canCreate && (
          <div className="flex flex-wrap gap-3 items-center">
            <button onClick={() => { setForm({ patient_id: "", date: new Date().toISOString().slice(0, 10), present: true, notes: "" }); setDialogOpen(true); }} className="gradient-primary rounded-2xl px-5 py-2.5 flex items-center gap-2 text-sm font-cairo text-primary-foreground hover:scale-105 transition-transform">
              <Plus className="h-4 w-4" />
              تسجيل حضور
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12 font-cairo text-muted-foreground">جاري التحميل...</div>
        ) : (
          <div className="neu-flat rounded-3xl bg-background overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-3 px-4 text-right font-cairo font-semibold">المريض</th>
                  <th className="py-3 px-4 text-right font-cairo font-semibold">التاريخ</th>
                  <th className="py-3 px-4 text-right font-cairo font-semibold">الحالة</th>
                  <th className="py-3 px-4 text-right font-cairo font-semibold">ملاحظات</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r: any) => (
                  <tr key={r.id} className="border-b border-border/50">
                    <td className="py-3 px-4 font-cairo">{getPatientName(r.patient_id)}</td>
                    <td className="py-3 px-4">{r.date}</td>
                    <td className="py-3 px-4">
                      {r.present ? (
                        <span className="inline-flex items-center gap-1 text-green-600 font-cairo"><Check className="h-4 w-4" /> حاضر</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-destructive font-cairo"><X className="h-4 w-4" /> غائب</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-cairo text-muted-foreground">{r.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <CrudDialog open={dialogOpen} onOpenChange={setDialogOpen} title="تسجيل حضور">
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
              <label className="text-sm font-cairo font-medium">التاريخ</label>
              <div className="neu-pressed rounded-xl"><input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" required /></div>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-cairo font-medium">حاضر</label>
              <button type="button" onClick={() => setForm(f => ({ ...f, present: !f.present }))}
                className={`rounded-xl px-4 py-2 text-sm font-cairo ${form.present ? "gradient-success text-primary-foreground" : "bg-destructive/20 text-destructive"}`}>
                {form.present ? "حاضر ✓" : "غائب ✗"}
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-cairo font-medium">ملاحظات</label>
              <div className="neu-pressed rounded-xl"><textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" rows={2} /></div>
            </div>
            <button type="submit" disabled={insertMut.isPending} className="w-full gradient-primary rounded-xl px-4 py-2.5 text-primary-foreground font-cairo font-medium hover:opacity-90 disabled:opacity-50">تسجيل</button>
          </form>
        </CrudDialog>
      </div>
    </DashboardLayout>
  );
};

export default Attendance;
