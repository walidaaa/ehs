import { useState } from "react";
import { Plus, Send, CheckCircle, Clock, AlertCircle, MessageSquare, Star, Edit, Stethoscope, Heart, Eye } from "lucide-react";
import { useTableQuery, useInsertMutation, useUpdateMutation } from "@/hooks/useSupabaseQuery";
import { CrudDialog } from "@/components/shared/CrudDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/usePermissions";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion } from "framer-motion";
import { taskTypeKeys, taskStatusMap, specialtyMap, translateValue } from "@/lib/translationMaps";

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
  const { data: profiles = [] } = useTableQuery("profiles");

  const [viewProfileOpen, setViewProfileOpen] = useState(false);
  const [viewProfileData, setViewProfileData] = useState<{ type: "doctor" | "parent" | "task"; data: any } | null>(null);

  const openViewDoctor = (taskDoctorId?: string) => {
    const docId = taskDoctorId || doctorId;
    if (!docId) return;
    const doc = profiles.find((p: any) => p.id === docId);
    if (doc) {
      setViewProfileData({ type: "doctor", data: doc });
      setViewProfileOpen(true);
    }
  };

  const openViewTask = (task: any) => {
    setViewProfileData({ type: "task", data: task });
    setViewProfileOpen(true);
  };

  // Normalize a DB date value (which may be an ISO timestamp like "2025-01-15T00:00:00+00:00")
  // into the YYYY-MM-DD format that <input type="date"> requires, otherwise the input shows empty
  // and the existing due_date is lost when the user submits the edit form.
  const toDateInputValue = (value: any): string => {
    if (!value) return "";
    if (typeof value === "string") {
      // already in YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
      // ISO-ish timestamp -> take the date portion
      const idx = value.indexOf("T");
      if (idx > 0) return value.slice(0, 10);
    }
    const d = new Date(value);
    if (isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

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

              <div className="flex flex-wrap items-center gap-2 mr-10">
                {(isDoctor || isParent) && (
                  <button
                    onClick={() => {
                      setTaskEditItem(task);
                      setTaskForm({
                        title: task.title,
                        description: task.description || "",
                        type: task.type || "تمرين",
                        due_date: toDateInputValue(task.due_date),
                      });
                      setTaskOpen(true);
                    }}
                    title={t.edit}
                    aria-label={t.edit}
                    className="h-9 w-9 rounded-full neu-flat-sm bg-background text-primary hover:scale-110 transition-transform flex items-center justify-center"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => openViewTask(task)}
                  title={t.viewTask}
                  aria-label={t.viewTask}
                  className="h-9 w-9 rounded-full neu-flat-sm bg-background text-primary hover:scale-110 transition-transform flex items-center justify-center"
                >
                  <Eye className="h-4 w-4" />
                </button>
                {isParent && (task.doctor_id || doctorId) && (
                  <button
                    onClick={() => openViewDoctor(task.doctor_id)}
                    title={t.viewDoctor}
                    aria-label={t.viewDoctor}
                    className="h-9 w-9 rounded-full neu-flat-sm bg-background text-primary hover:scale-110 transition-transform flex items-center justify-center"
                  >
                    <Stethoscope className="h-4 w-4" />
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

      <CrudDialog
        open={viewProfileOpen}
        onOpenChange={(o) => { setViewProfileOpen(o); if (!o) setViewProfileData(null); }}
        title={
          viewProfileData?.type === "doctor"
            ? t.viewDoctor
            : viewProfileData?.type === "task"
              ? t.viewTask
              : t.viewParent
        }
      >
        {viewProfileData && viewProfileData.type === "task" && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-muted/30">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-primary-foreground ${viewProfileData.data.type === "دواء" ? "gradient-warning" : viewProfileData.data.type === "سلوك" ? "gradient-accent" : "gradient-primary"}`}>
                <Send className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground font-cairo">{t.taskTitle}</p>
                <p className="text-sm font-semibold font-cairo">{viewProfileData.data.title || "—"}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 p-3 rounded-2xl bg-muted/20">
              <div>
                <p className="text-xs text-muted-foreground font-cairo">{t.taskType}</p>
                <p className="text-sm font-medium font-cairo">{getTaskTypeLabel(viewProfileData.data.type)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-cairo">{t.statusLabel}</p>
                <p className="text-sm font-medium font-cairo">{translateValue(viewProfileData.data.status, taskStatusMap, t)}</p>
              </div>
              {viewProfileData.data.description && (
                <div>
                  <p className="text-xs text-muted-foreground font-cairo">{t.taskDescription}</p>
                  <p className="text-sm font-medium font-cairo whitespace-pre-wrap">{viewProfileData.data.description}</p>
                </div>
              )}
              {viewProfileData.data.due_date && (
                <div>
                  <p className="text-xs text-muted-foreground font-cairo">{t.deadline}</p>
                  <p className="text-sm font-medium font-cairo">{toDateInputValue(viewProfileData.data.due_date)}</p>
                </div>
              )}
              {viewProfileData.data.created_at && (
                <div>
                  <p className="text-xs text-muted-foreground font-cairo">{t.createdAt || t.deadline}</p>
                  <p className="text-sm font-medium font-cairo">{new Date(viewProfileData.data.created_at).toLocaleDateString(locale)}</p>
                </div>
              )}
              {viewProfileData.data.evaluation && (
                <div>
                  <p className="text-xs text-muted-foreground font-cairo">{t.doctorEvaluation}</p>
                  <p className="text-sm font-medium font-cairo">{viewProfileData.data.evaluation}</p>
                  {viewProfileData.data.evaluation_notes && (
                    <p className="text-xs text-muted-foreground font-cairo mt-1">{viewProfileData.data.evaluation_notes}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        {viewProfileData && viewProfileData.type !== "task" && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-muted/30">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-primary-foreground ${viewProfileData.type === "doctor" ? "gradient-primary" : "gradient-success"}`}>
                {viewProfileData.type === "doctor" ? <Stethoscope className="h-5 w-5" /> : <Heart className="h-5 w-5" />}
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-cairo">{t.fullName}</p>
                <p className="text-sm font-semibold font-cairo">{viewProfileData.data.full_name || "—"}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 p-3 rounded-2xl bg-muted/20">
              <div>
                <p className="text-xs text-muted-foreground font-cairo">{t.phone}</p>
                <p className="text-sm font-medium font-cairo">{viewProfileData.data.phone || "—"}</p>
              </div>
              {viewProfileData.type === "doctor" && (
                <>
                  <div>
                    <p className="text-xs text-muted-foreground font-cairo">{t.specialty}</p>
                    <p className="text-sm font-medium font-cairo">
                      {viewProfileData.data.specialty ? translateValue(viewProfileData.data.specialty, specialtyMap, t) : "—"}
                    </p>
                  </div>
                  {viewProfileData.data.email && (
                    <div>
                      <p className="text-xs text-muted-foreground font-cairo">{t.email}</p>
                      <p className="text-sm font-medium font-cairo">{viewProfileData.data.email}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
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
