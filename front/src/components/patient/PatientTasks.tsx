import { useState } from "react";
import { Plus, Send, CheckCircle, Clock, AlertCircle, MessageSquare, Star, Edit } from "lucide-react";
import { useTableQuery, useInsertMutation, useUpdateMutation } from "@/hooks/useSupabaseQuery";
import { CrudDialog } from "@/components/shared/CrudDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/usePermissions";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion } from "framer-motion";
import { taskTypeKeys, taskStatusMap, translateValue } from "@/lib/translationMaps";

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

const PatientTasks = ({ patientId, parentId, doctorId }: Props) => {
  const { user } = useAuth();
  const role = useRole();
  const { t, dir, lang } = useLanguage();
  const locale = lang === "fr" ? "fr-FR" : "ar-DZ";
  const isDoctorRole = role === "user";
  const isDoctor = role === "user" || role === "super_admin";
  const isParent = role === "parent";

  const { data: allTasks = [] } = useTableQuery("patient_tasks", { filters: { patient_id: patientId } });
  const tasks = isDoctorRole ? allTasks.filter((t: any) => t.doctor_id === user?.id) : allTasks;
  const { data: reports = [] } = useTableQuery("task_reports");
  const { data: parents = [] } = useTableQuery("parents");

  const insertTask = useInsertMutation("patient_tasks", { success: t.addedSuccess, error: t.errorPrefix });
  const updateTask = useUpdateMutation("patient_tasks", { success: t.updatedSuccess, error: t.errorPrefix });
  const insertReport = useInsertMutation("task_reports", { success: t.addedSuccess, error: t.errorPrefix });

  const [taskOpen, setTaskOpen] = useState(false);
  const [taskEditItem, setTaskEditItem] = useState<any>(null);
  const [taskForm, setTaskForm] = useState({ title: "", description: "", type: "تمرين", due_date: "" });
  const [reportOpen, setReportOpen] = useState(false);
  const [reportTaskId, setReportTaskId] = useState<string | null>(null);
  const [reportText, setReportText] = useState("");
  const [evalOpen, setEvalOpen] = useState(false);
  const [evalTaskId, setEvalTaskId] = useState<string | null>(null);
  const [evalForm, setEvalForm] = useState({ evaluation: "", evaluation_notes: "" });

  const parentRecord = parents.find((p: any) => p.user_id === user?.id);

  const getTaskTypeLabel = (dbValue: string) => {
    const found = taskTypeKeys.find(tk => tk.value === dbValue);
    return found ? ((t as any)[found.key] || dbValue) : dbValue;
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (taskEditItem) {
      updateTask.mutate({
        id: taskEditItem.id,
        ...taskForm,
        due_date: taskForm.due_date || null,
      }, { onSuccess: () => { setTaskOpen(false); setTaskEditItem(null); setTaskForm({ title: "", description: "", type: "تمرين", due_date: "" }); } });
    } else {
      insertTask.mutate({
        patient_id: patientId,
        doctor_id: user?.id,
        parent_id: parentId || null,
        ...taskForm,
        due_date: taskForm.due_date || null,
      }, { onSuccess: () => { setTaskOpen(false); setTaskForm({ title: "", description: "", type: "تمرين", due_date: "" }); } });
    }
  };

  const handleReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTaskId) return;
    insertReport.mutate({
      task_id: reportTaskId,
      parent_id: parentRecord?.id || null,
      report_text: reportText,
    }, {
      onSuccess: () => {
        // Mark as "executed" only on first report; subsequent reports keep the thread open
        const existing = reports.filter((r: any) => r.task_id === reportTaskId);
        if (existing.length === 0) {
          updateTask.mutate({ id: reportTaskId, status: "منفذة" });
        }
        setReportOpen(false);
        setReportText("");
      }
    });
  };

  const handleEval = (e: React.FormEvent) => {
    e.preventDefault();
    if (!evalTaskId) return;
    updateTask.mutate({
      id: evalTaskId,
      evaluation: evalForm.evaluation,
      evaluation_notes: evalForm.evaluation_notes,
      status: "مقيّمة",
    }, { onSuccess: () => { setEvalOpen(false); } });
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "منفذة": return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "مقيّمة": return <Star className="h-4 w-4 text-yellow-500" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const taskReports = (taskId: string) => reports.filter((r: any) => r.task_id === taskId);

  return (
    <div className="space-y-4">
      {isDoctor && (
        <button
          onClick={() => { setTaskEditItem(null); setTaskForm({ title: "", description: "", type: "تمرين", due_date: "" }); setTaskOpen(true); }}
          className="gradient-primary rounded-2xl px-4 py-2 flex items-center gap-2 text-sm font-cairo text-primary-foreground hover:scale-105 transition-transform"
        >
          <Plus className="h-4 w-4" />{t.newTask}
        </button>
      )}

      {tasks.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground font-cairo">{t.noTasks}</p>
      ) : (
        <div className="space-y-3">
          {tasks.map((task: any, i: number) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="neu-flat-sm rounded-2xl bg-background p-4 space-y-3"
            >
              <div className="flex items-start gap-3">
                <div className={`rounded-xl p-2 shrink-0 ${task.type === "دواء" ? "gradient-warning" : task.type === "سلوك" ? "gradient-accent" : "gradient-primary"}`}>
                  <Send className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-cairo font-semibold text-sm">{task.title}</h4>
                    {statusIcon(task.status)}
                    <span className="text-xs rounded-lg px-2 py-0.5 bg-muted font-cairo">{getTaskTypeLabel(task.type)}</span>
                  </div>
                  {task.description && <p className="text-sm text-muted-foreground mt-1 font-cairo">{task.description}</p>}
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground font-cairo">
                    <span>{t.statusLabel}: {translateValue(task.status, taskStatusMap, t)}</span>
                    {task.due_date && <span>• {t.deadline}: {task.due_date}</span>}
                    <span>• {new Date(task.created_at).toLocaleDateString(locale)}</span>
                  </div>
                </div>
              </div>

              {taskReports(task.id).length > 0 && (
                <div className="mr-10 space-y-2">
                  {taskReports(task.id).map((r: any) => (
                    <div key={r.id} className="bg-muted/50 rounded-xl p-3 text-sm font-cairo">
                      <div className="flex items-center gap-2 mb-1">
                        <MessageSquare className="h-3 w-3 text-primary" />
                        <span className="text-xs text-muted-foreground">{t.parentReport} • {new Date(r.created_at).toLocaleDateString(locale)}</span>
                      </div>
                      <p>{r.report_text}</p>
                    </div>
                  ))}
                </div>
              )}

              {task.evaluation && (
                <div className="mr-10 bg-primary/5 rounded-xl p-3 text-sm font-cairo">
                  <div className="flex items-center gap-2 mb-1">
                    <Star className="h-3 w-3 text-yellow-500" />
                    <span className="font-medium">{t.doctorEvaluation}: {task.evaluation}</span>
                  </div>
                  {task.evaluation_notes && <p className="text-muted-foreground">{task.evaluation_notes}</p>}
                </div>
              )}

              <div className="flex gap-2 mr-10">
                {isDoctor && (task.status === "جديدة" || task.status === "منفذة") && (
                  <button
                    onClick={() => {
                      setTaskEditItem(task);
                      setTaskForm({ title: task.title, description: task.description || "", type: task.type || "تمرين", due_date: task.due_date || "" });
                      setTaskOpen(true);
                    }}
                    className="text-xs font-cairo bg-primary/10 text-primary rounded-xl px-3 py-1.5 hover:scale-105 transition-transform flex items-center gap-1"
                  >
                    <Edit className="h-3 w-3" />{t.edit}
                  </button>
                )}
                {isParent && task.status !== "مقيّمة" && (
                  <button
                    onClick={() => { setReportTaskId(task.id); setReportText(""); setReportOpen(true); }}
                    className="text-xs font-cairo gradient-success text-primary-foreground rounded-xl px-3 py-1.5 hover:scale-105 transition-transform flex items-center gap-1"
                  >
                    <CheckCircle className="h-3 w-3" />
                    {taskReports(task.id).length > 0 ? ((t as any).addActivity || t.sendReportBtn) : t.sendReportBtn}
                  </button>
                )}
                {isDoctor && taskReports(task.id).length > 0 && task.status !== "مقيّمة" && (
                  <button
                    onClick={() => { setEvalTaskId(task.id); setEvalForm({ evaluation: task.evaluation || "", evaluation_notes: task.evaluation_notes || "" }); setEvalOpen(true); }}
                    className="text-xs font-cairo gradient-accent text-primary-foreground rounded-xl px-3 py-1.5 hover:scale-105 transition-transform flex items-center gap-1"
                  >
                    <Edit className="h-3 w-3" />{t.evaluate}
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <CrudDialog open={taskOpen} onOpenChange={o => { setTaskOpen(o); if (!o) setTaskEditItem(null); }} title={taskEditItem ? t.editTask : t.newTaskForParent}>
        <form onSubmit={handleAddTask} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-cairo font-medium">{t.taskTitle}</label>
            <div className="neu-pressed rounded-xl">
              <input value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
                className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" required placeholder={t.taskTitlePlaceholder} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-cairo font-medium">{t.taskDescription}</label>
            <div className="neu-pressed rounded-xl">
              <textarea value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))}
                className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" rows={3} placeholder={t.taskDescPlaceholder} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-cairo font-medium">{t.taskType}</label>
              <div className="neu-pressed rounded-xl">
                <select value={taskForm.type} onChange={e => setTaskForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl">
                  {taskTypeKeys.map(tp => <option key={tp.value} value={tp.value}>{(t as any)[tp.key] || tp.value}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-cairo font-medium">{t.taskDeadline}</label>
              <div className="neu-pressed rounded-xl">
                <input type="date" value={taskForm.due_date} onChange={e => setTaskForm(f => ({ ...f, due_date: e.target.value }))}
                  className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" />
              </div>
            </div>
          </div>
          <button type="submit" disabled={insertTask.isPending || updateTask.isPending}
            className="w-full gradient-primary rounded-xl px-4 py-2.5 text-primary-foreground font-cairo font-medium hover:opacity-90 disabled:opacity-50">
            {taskEditItem ? t.update : t.sendTask}
          </button>
        </form>
      </CrudDialog>

      <CrudDialog open={reportOpen} onOpenChange={setReportOpen} title={t.taskReportTitle}>
        <form onSubmit={handleReport} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-cairo font-medium">{t.whatDidYouDo}</label>
            <div className="neu-pressed rounded-xl">
              <textarea value={reportText} onChange={e => setReportText(e.target.value)}
                className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" rows={4}
                required placeholder={t.reportPlaceholder} />
            </div>
          </div>
          <button type="submit" disabled={insertReport.isPending}
            className="w-full gradient-success rounded-xl px-4 py-2.5 text-primary-foreground font-cairo font-medium hover:opacity-90 disabled:opacity-50">
            {t.sendReport}
          </button>
        </form>
      </CrudDialog>

      <CrudDialog open={evalOpen} onOpenChange={setEvalOpen} title={t.evaluatePatient}>
        <form onSubmit={handleEval} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-cairo font-medium">{t.evaluation}</label>
            <div className="flex gap-2">
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
          <button type="submit" disabled={!evalForm.evaluation || updateTask.isPending}
            className="w-full gradient-primary rounded-xl px-4 py-2.5 text-primary-foreground font-cairo font-medium hover:opacity-90 disabled:opacity-50">
            {t.saveEvaluation}
          </button>
        </form>
      </CrudDialog>
    </div>
  );
};

export default PatientTasks;
