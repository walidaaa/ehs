import { useState } from "react";
import { Plus, Send, CheckCircle, Clock, Star, Edit } from "lucide-react";
import { useTableQuery, useInsertMutation, useUpdateMutation } from "@/hooks/useSupabaseQuery";
import { CrudDialog } from "@/components/shared/CrudDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/usePermissions";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion } from "framer-motion";
import { taskTypeKeys } from "@/lib/translationMaps";

const evaluationOptions = [
  { value: "تحسن", labelKey: "improvement", color: "gradient-success" },
  { value: "استمرار", labelKey: "continuity", color: "gradient-accent" },
  { value: "تعديل", labelKey: "needsAdjustment", color: "gradient-warning" },
];

interface Props {
  patientId: string;
  parentId?: string | null;
  doctorId?: string | null;
}

/**
 * ParentActivities - parent-initiated activities sent to the doctor.
 * Parents can create activities; doctors can view and evaluate them.
 */
const ParentActivities = ({ patientId, parentId, doctorId }: Props) => {
  const { user } = useAuth();
  const role = useRole();
  const { t, lang } = useLanguage();
  const locale = lang === "fr" ? "fr-FR" : "ar-DZ";
  const isDoctor = role === "user" || role === "super_admin";
  const isParent = role === "parent";

  const { data: activities = [] } = useTableQuery("parent_activities", { filters: { patient_id: patientId } });
  const { data: parents = [] } = useTableQuery("parents");

  const insertActivity = useInsertMutation("parent_activities", { success: t.addedSuccess, error: t.errorPrefix });
  const updateActivity = useUpdateMutation("parent_activities", { success: t.updatedSuccess, error: t.errorPrefix });

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", type: "تمرين", activity_date: "" });
  const [evalOpen, setEvalOpen] = useState(false);
  const [evalActivityId, setEvalActivityId] = useState<string | null>(null);
  const [evalForm, setEvalForm] = useState({ evaluation: "", evaluation_notes: "" });

  const parentRecord = parents.find((p: any) => p.user_id === user?.id);

  const getTypeLabel = (dbValue: string) => {
    const found = taskTypeKeys.find(tk => tk.value === dbValue);
    return found ? ((t as any)[found.key] || dbValue) : dbValue;
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    insertActivity.mutate({
      patient_id: patientId,
      parent_id: parentRecord?.id || parentId || null,
      doctor_id: doctorId || null,
      ...form,
      activity_date: form.activity_date || null,
    }, {
      onSuccess: () => {
        setAddOpen(false);
        setForm({ title: "", description: "", type: "تمرين", activity_date: "" });
      }
    });
  };

  const handleEval = (e: React.FormEvent) => {
    e.preventDefault();
    if (!evalActivityId) return;
    updateActivity.mutate({
      id: evalActivityId,
      evaluation: evalForm.evaluation,
      evaluation_notes: evalForm.evaluation_notes,
      status: "evaluated",
      evaluated_at: new Date().toISOString(),
    }, { onSuccess: () => { setEvalOpen(false); } });
  };

  const statusIcon = (activity: any) => {
    if (activity.evaluation) return <Star className="h-4 w-4 text-yellow-500" />;
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  const statusLabel = (activity: any) =>
    activity.evaluation ? (t as any).evaluated : (t as any).awaitingEvaluation;

  return (
    <div className="space-y-4">
      {isParent && (
        <button
          onClick={() => { setForm({ title: "", description: "", type: "تمرين", activity_date: "" }); setAddOpen(true); }}
          className="gradient-success rounded-2xl px-4 py-2 flex items-center gap-2 text-sm font-cairo text-primary-foreground hover:scale-105 transition-transform"
        >
          <Plus className="h-4 w-4" />{(t as any).sendActivityToDoctor}
        </button>
      )}

      {activities.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground font-cairo">{(t as any).noActivities}</p>
      ) : (
        <div className="space-y-3">
          {activities.map((activity: any, i: number) => (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="neu-flat-sm rounded-2xl bg-background p-4 space-y-3"
            >
              <div className="flex items-start gap-3">
                <div className={`rounded-xl p-2 shrink-0 ${activity.type === "دواء" ? "gradient-warning" : activity.type === "سلوك" ? "gradient-accent" : "gradient-success"}`}>
                  <Send className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-cairo font-semibold text-sm">{activity.title}</h4>
                    {statusIcon(activity)}
                    <span className="text-xs rounded-lg px-2 py-0.5 bg-muted font-cairo">{getTypeLabel(activity.type)}</span>
                    <span className="text-xs rounded-lg px-2 py-0.5 bg-primary/10 text-primary font-cairo">{(t as any).activityFromParent}</span>
                  </div>
                  {activity.description && <p className="text-sm text-muted-foreground mt-1 font-cairo">{activity.description}</p>}
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground font-cairo flex-wrap">
                    <span>{t.statusLabel}: {statusLabel(activity)}</span>
                    {activity.activity_date && <span>• {(t as any).activityDate}: {activity.activity_date}</span>}
                    <span>• {new Date(activity.created_at).toLocaleDateString(locale)}</span>
                  </div>
                </div>
              </div>

              {activity.evaluation && (
                <div className="mr-10 bg-primary/5 rounded-xl p-3 text-sm font-cairo">
                  <div className="flex items-center gap-2 mb-1">
                    <Star className="h-3 w-3 text-yellow-500" />
                    <span className="font-medium">{(t as any).activityEvaluation}: {activity.evaluation}</span>
                  </div>
                  {activity.evaluation_notes && <p className="text-muted-foreground">{activity.evaluation_notes}</p>}
                </div>
              )}

              <div className="flex gap-2 mr-10">
                {isDoctor && !activity.evaluation && (
                  <button
                    onClick={() => { setEvalActivityId(activity.id); setEvalForm({ evaluation: "", evaluation_notes: "" }); setEvalOpen(true); }}
                    className="text-xs font-cairo gradient-accent text-primary-foreground rounded-xl px-3 py-1.5 hover:scale-105 transition-transform flex items-center gap-1"
                  >
                    <Edit className="h-3 w-3" />{(t as any).evaluateActivity}
                  </button>
                )}
                {isDoctor && activity.evaluation && (
                  <span className="text-xs font-cairo bg-green-100 text-green-700 rounded-xl px-3 py-1.5 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />{(t as any).evaluated}
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <CrudDialog open={addOpen} onOpenChange={setAddOpen} title={(t as any).newActivity}>
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-cairo font-medium">{(t as any).activityTitle}</label>
            <div className="neu-pressed rounded-xl">
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" required placeholder={(t as any).activityTitlePlaceholder} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-cairo font-medium">{(t as any).activityDescription}</label>
            <div className="neu-pressed rounded-xl">
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" rows={4} required placeholder={(t as any).activityDescPlaceholder} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-cairo font-medium">{(t as any).activityType}</label>
              <div className="neu-pressed rounded-xl">
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl">
                  {taskTypeKeys.map(tp => <option key={tp.value} value={tp.value}>{(t as any)[tp.key] || tp.value}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-cairo font-medium">{(t as any).activityDate}</label>
              <div className="neu-pressed rounded-xl">
                <input type="date" value={form.activity_date} onChange={e => setForm(f => ({ ...f, activity_date: e.target.value }))}
                  className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" />
              </div>
            </div>
          </div>
          <button type="submit" disabled={insertActivity.isPending}
            className="w-full gradient-success rounded-xl px-4 py-2.5 text-primary-foreground font-cairo font-medium hover:opacity-90 disabled:opacity-50">
            {(t as any).sendActivity}
          </button>
        </form>
      </CrudDialog>

      <CrudDialog open={evalOpen} onOpenChange={setEvalOpen} title={(t as any).evaluateActivity}>
        <form onSubmit={handleEval} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-cairo font-medium">{t.evaluation}</label>
            <div className="flex gap-2 flex-wrap">
              {evaluationOptions.map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => setEvalForm(f => ({ ...f, evaluation: opt.value }))}
                  className={`rounded-xl px-4 py-2 text-sm font-cairo transition-all ${
                    evalForm.evaluation === opt.value ? `${opt.color} text-primary-foreground scale-105` : "bg-muted hover:bg-muted/80"
                  }`}>
                  {(t as any)[opt.labelKey] || opt.value}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-cairo font-medium">{t.evaluationNotes}</label>
            <div className="neu-pressed rounded-xl">
              <textarea value={evalForm.evaluation_notes} onChange={e => setEvalForm(f => ({ ...f, evaluation_notes: e.target.value }))}
                className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" rows={3} placeholder={t.evalPlaceholder} />
            </div>
          </div>
          <button type="submit" disabled={!evalForm.evaluation || updateActivity.isPending}
            className="w-full gradient-primary rounded-xl px-4 py-2.5 text-primary-foreground font-cairo font-medium hover:opacity-90 disabled:opacity-50">
            {t.saveEvaluation}
          </button>
        </form>
      </CrudDialog>
    </div>
  );
};

export default ParentActivities;