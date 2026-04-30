import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { motion } from "framer-motion";
import { Bell, Calendar, Pill, AlertTriangle, ListTodo, CheckCircle, Clock, Send, Stethoscope, Baby, Edit, Star, Eye, EyeOff } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { appointmentTypeMap, appointmentStatusMap, notificationMessageMap, translateValue } from "@/lib/translationMaps";
import { useTableQuery, useUpdateMutation, useInsertMutation } from "@/hooks/useSupabaseQuery";
import { crudApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/usePermissions";
import { useDataFiltering } from "@/hooks/useDataFiltering";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CrudDialog } from "@/components/shared/CrudDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/shared/PaginationControls";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";

const Notifications = () => {
  const { t, dir, lang } = useLanguage();
  const { user } = useAuth();
  const role = useRole();
  const isParent = role === "parent";
  const isAdmin = role === "admin";
  const isSuperAdmin = role === "super_admin";
  const isDoctor = role === "user";
  const { filterNotifications, filterAppointments } = useDataFiltering();
  const locale = lang === "fr" ? "fr-FR" : "ar-DZ";

  // Appointments - declared early because notifications filtering depends on it
  const { data: appointmentsRaw = [] } = useTableQuery("appointments");
  const appointments = isAdmin ? filterAppointments(appointmentsRaw) : appointmentsRaw;

  // Notifications - always fetch fresh data without caching
  // CRITICAL: Always filter notifications by current user to prevent data leakage
  const { data: notificationsRaw = [], isLoading, refetch } = useTableQuery(
    "notifications",
    { noCache: true }
  );
  // Helper: extract appointment ID from notification message
  const extractAptId = useCallback((message: string): string | null => {
    if (!message) return null;
    const match = message.match(/\[APT:([a-f0-9-]+)\]/) || message.match(/\(ID: ([a-f0-9-]+)\)/);
    return match ? match[1] : null;
  }, []);

  const queryClient = useQueryClient();
  const cleanupRunRef = useRef(false);

  // Auto-cleanup expired appointment notifications from DB
  useEffect(() => {
    if (cleanupRunRef.current || !appointmentsRaw.length || !notificationsRaw.length) return;
    
    const now = new Date().getTime();
    const expiredNotifIds: string[] = [];
    
    notificationsRaw.forEach((n: any) => {
      const aptId = extractAptId(n.message);
      if (!aptId) return;
      const apt = appointmentsRaw.find((a: any) => a.id === aptId);
      if (!apt) return;
      const aptTime = new Date(apt.date).getTime();
      // Delete if appointment date passed or appointment is cancelled/completed
      if (aptTime <= now || apt.status === "ملغي" || apt.status === "مكتمل") {
        expiredNotifIds.push(n.id);
      }
    });
    
    if (expiredNotifIds.length > 0) {
      cleanupRunRef.current = true;
      (async () => {
        for (const id of expiredNotifIds) {
          try {
            await crudApi.delete("notifications", id);
          } catch (e) { /* silent */ }
        }
        // Refresh notifications after cleanup
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
        // Allow cleanup to run again after some time
        setTimeout(() => { cleanupRunRef.current = false; }, 60000);
      })();
    }
  }, [notificationsRaw, appointmentsRaw, extractAptId, queryClient]);

  const notifications = useMemo(() => {
    // First apply role-based filtering
    const filtered = filterNotifications(notificationsRaw);
    
    // Additional safety check for doctors: ensure ALL notifications have correct user_id
    let result = filtered;
    if (isDoctor && user?.id) {
      result = filtered.filter((n: any) => n.user_id === user.id);
      if (result.length !== filtered.length) {
        console.warn(`[SECURITY] Filtered out ${filtered.length - result.length} unauthorized notifications for doctor ${user.id}`);
      }
    }
    
    // Filter out expired appointment notifications (client-side while DB cleanup happens)
    const now = new Date().getTime();
    result = result.filter((n: any) => {
      const aptId = extractAptId(n.message);
      if (!aptId) return true; // Keep non-appointment notifications
      const apt = appointmentsRaw.find((a: any) => a.id === aptId);
      if (!apt) return true; // Keep if appointment not found (might be deleted)
      // Hide if appointment date passed or status is cancelled/completed
      if (apt.status === "ملغي" || apt.status === "مكتمل") return false;
      return new Date(apt.date).getTime() > now; // Only keep future appointments
    });
    
    return result;
  }, [notificationsRaw, filterNotifications, isDoctor, user?.id, appointmentsRaw, extractAptId]);
  const updateMut = useUpdateMutation("notifications");

  // Tasks
  const { data: parents = [] } = useTableQuery("parents");
  const parentRecord = parents.find((p: any) => p.user_id === user?.id);
  const tasksQuery = (() => {
    if (isParent && parentRecord) return { filters: { parent_id: parentRecord.id } };
    if (isDoctor) return { filters: { doctor_id: user?.id } };
    return undefined;
  })();
  const { data: tasksRaw = [] } = useTableQuery("patient_tasks", tasksQuery);
  const { filterPatients } = useDataFiltering();
  const { data: patientDoctors = [] } = useTableQuery("patient_doctors");
  const { data: profiles = [] } = useTableQuery("profiles");
  const adminDoctorIds = isAdmin ? profiles.filter((p: any) => p.created_by === user?.id).map((p: any) => p.id) : [];
  const tasks = isAdmin ? tasksRaw.filter((tk: any) => adminDoctorIds.includes(tk.doctor_id)) : tasksRaw;

  const { data: patients = [] } = useTableQuery("patients");
  const { data: taskReports = [] } = useTableQuery("task_reports");

  const insertReport = useInsertMutation("task_reports");
  const insertNotification = useInsertMutation("notifications");
  const updateTask = useUpdateMutation("patient_tasks");

  const [reportOpen, setReportOpen] = useState(false);
  const [reportTaskId, setReportTaskId] = useState<string | null>(null);
  const [reportText, setReportText] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editTask, setEditTask] = useState<any>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", type: "تمرين", due_date: "" });
  const [evalOpen, setEvalOpen] = useState(false);
  const [evalTaskId, setEvalTaskId] = useState<string | null>(null);
  const [evalForm, setEvalForm] = useState({ evaluation: "", evaluation_notes: "" });
  const [viewTaskId, setViewTaskId] = useState<string | null>(null);

  // Tomorrow's appointments
  const tomorrowAppts = useMemo(() => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    return appointments.filter((a: any) => {
      const d = new Date(a.date);
      return d >= tomorrow && d < dayAfter;
    }).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [appointments]);

  const unreadCount = notifications.filter((n: any) => !n.read).length;
  const pendingTasks = tasks.filter((tk: any) => tk.status === "جديدة");

  const markAllRead = async () => {
    const unread = notifications.filter((n: any) => !n.read);
    for (const n of unread) {
      await crudApi.update("notifications", n.id, { read: true });
    }
    refetch();
  };

  const markRead = (id: string) => {
    updateMut.mutate({ id, read: true });
  };

  const handleReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTaskId || !parentRecord) return;
    const task = tasks.find((tk: any) => tk.id === reportTaskId);
    const patient = patients.find((p: any) => p.id === task?.patient_id);
    insertReport.mutate({ task_id: reportTaskId, parent_id: parentRecord.id, report_text: reportText }, {
      onSuccess: () => {
        updateTask.mutate({ id: reportTaskId, status: "منفذة" });
        if (task?.doctor_id) {
          insertNotification.mutate({
            user_id: task.doctor_id,
            title: t.newReportFromParent,
            message: `${parentRecord.full_name} - ${task.title} - ${patient?.name || ""}`,
            type: "success",
          });
        }
        setReportOpen(false);
        setReportText("");
      }
    });
  };

  const getPatientName = (id: string) => patients.find((p: any) => p.id === id)?.name || "-";
  const getDoctorName = (id: string) => profiles.find((p: any) => p.id === id)?.full_name || "-";

  return (
    <DashboardLayout>
      <div dir={dir} className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold font-cairo">{t.notificationsTitle}</h2>
            <p className="text-muted-foreground font-cairo mt-1">
              {unreadCount} {t.unreadNotifications}
              {pendingTasks.length > 0 && ` • ${pendingTasks.length} ${t.pendingTasksLabel}`}
            </p>
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-sm text-primary font-cairo hover:underline">{t.markAllRead}</button>
          )}
        </motion.div>

        <Tabs defaultValue="tomorrow" dir={dir}>
          <TabsList className="w-full justify-start bg-muted/50 rounded-2xl p-1">
            <TabsTrigger value="tomorrow" className="font-cairo rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Calendar className="h-4 w-4 ml-2" />{t.tomorrowAppointments} ({tomorrowAppts.length})
            </TabsTrigger>
            <TabsTrigger value="tasks" className="font-cairo rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <ListTodo className="h-4 w-4 ml-2" />{t.tasksTab} ({tasks.length})
            </TabsTrigger>
            <TabsTrigger value="notifications" className="font-cairo rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Bell className="h-4 w-4 ml-2" />{t.notificationsTab} ({notifications.length})
            </TabsTrigger>
          </TabsList>

          {/* Tomorrow's Appointments Tab */}
          <TabsContent value="tomorrow" className="mt-4 space-y-6">
            <TomorrowByDoctors appts={tomorrowAppts} profiles={profiles} patients={patients} t={t} locale={locale} getDoctorName={getDoctorName} getPatientName={getPatientName} />
          </TabsContent>

          {/* Tasks Tab */}
          <TabsContent value="tasks" className="mt-4 space-y-3">
            <TasksList tasks={tasks} patients={patients} profiles={profiles} parents={parents} taskReports={taskReports} isParent={isParent} isDoctor={isDoctor || isSuperAdmin} t={t} locale={locale}
              onReport={(taskId: string) => { setReportTaskId(taskId); setReportText(""); setReportOpen(true); }}
              onEdit={(task: any) => { setEditTask(task); setEditForm({ title: task.title, description: task.description || "", type: task.type || "تمرين", due_date: task.due_date || "" }); setEditOpen(true); }}
              onEvaluate={(taskId: string) => { setEvalTaskId(taskId); setEvalForm({ evaluation: "", evaluation_notes: "" }); setEvalOpen(true); }}
              viewTaskId={viewTaskId}
              onToggleView={(taskId: string) => setViewTaskId(viewTaskId === taskId ? null : taskId)}
            />
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="mt-4">
            <NotificationsList notifications={notifications} isLoading={isLoading} markRead={markRead} t={t} locale={locale} />
          </TabsContent>
        </Tabs>

        <CrudDialog open={reportOpen} onOpenChange={setReportOpen} title={t.reportTitle}>
          <form onSubmit={handleReport} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-cairo font-medium">{t.whatDidYouDo}</label>
              <div className="neu-pressed rounded-xl">
                <textarea value={reportText} onChange={e => setReportText(e.target.value)}
                  className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" rows={4}
                  required placeholder={t.writeReport} />
              </div>
            </div>
            <button type="submit" disabled={insertReport.isPending}
              className="w-full gradient-success rounded-xl px-4 py-2.5 text-primary-foreground font-cairo font-medium hover:opacity-90 disabled:opacity-50">
              {t.sendReport}
            </button>
          </form>
        </CrudDialog>

        {/* Edit Task Dialog - Doctor only */}
        <CrudDialog open={editOpen} onOpenChange={o => { setEditOpen(o); if (!o) setEditTask(null); }} title={t.editTask || "تعديل المهمة"}>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (!editTask) return;
            updateTask.mutate({ id: editTask.id, ...editForm, due_date: editForm.due_date || null }, {
              onSuccess: () => { setEditOpen(false); setEditTask(null); }
            });
          }} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-cairo font-medium">{t.taskTitle || "العنوان"}</label>
              <div className="neu-pressed rounded-xl">
                <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" required />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-cairo font-medium">{t.taskDescription || "الوصف"}</label>
              <div className="neu-pressed rounded-xl">
                <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" rows={3} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-cairo font-medium">{t.taskType || "النوع"}</label>
                <div className="neu-pressed rounded-xl">
                  <select value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl">
                    <option value="تمرين">{t.taskTypeExercise || "تمرين"}</option>
                    <option value="دواء">{t.taskTypeMedication || "دواء"}</option>
                    <option value="سلوك">{t.taskTypeBehavior || "سلوك"}</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-cairo font-medium">{t.taskDeadline || "الموعد النهائي"}</label>
                <div className="neu-pressed rounded-xl">
                  <input type="date" value={editForm.due_date} onChange={e => setEditForm(f => ({ ...f, due_date: e.target.value }))}
                    className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" />
                </div>
              </div>
            </div>
            <button type="submit" disabled={updateTask.isPending}
              className="w-full gradient-primary rounded-xl px-4 py-2.5 text-primary-foreground font-cairo font-medium hover:opacity-90 disabled:opacity-50">
              {t.update || "تحديث"}
            </button>
          </form>
        </CrudDialog>

        {/* Evaluate Task Dialog - Doctor only */}
        <CrudDialog open={evalOpen} onOpenChange={setEvalOpen} title={t.evaluatePatient || "تقييم"}>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (!evalTaskId) return;
            updateTask.mutate({ id: evalTaskId, evaluation: evalForm.evaluation, evaluation_notes: evalForm.evaluation_notes, status: "مقيّمة" }, {
              onSuccess: () => setEvalOpen(false)
            });
          }} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-cairo font-medium">{t.evaluation || "التقييم"}</label>
              <div className="flex gap-2">
                {[
                  { value: "تحسن", label: t.improvement || "تحسن", color: "gradient-success" },
                  { value: "استمرار", label: t.continuity || "استمرار", color: "gradient-accent" },
                  { value: "تعديل", label: t.needsAdjustment || "تعديل", color: "gradient-warning" },
                ].map(opt => (
                  <button key={opt.value} type="button" onClick={() => setEvalForm(f => ({ ...f, evaluation: opt.value }))}
                    className={`rounded-xl px-4 py-2 text-sm font-cairo transition-all ${evalForm.evaluation === opt.value ? `${opt.color} text-primary-foreground scale-105` : "bg-muted hover:bg-muted/80"}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-cairo font-medium">{t.evaluationNotes || "ملاحظات التقييم"}</label>
              <div className="neu-pressed rounded-xl">
                <textarea value={evalForm.evaluation_notes} onChange={e => setEvalForm(f => ({ ...f, evaluation_notes: e.target.value }))}
                  className="w-full bg-transparent px-4 py-2.5 text-sm outline-none font-cairo rounded-xl" rows={3} />
              </div>
            </div>
            <button type="submit" disabled={!evalForm.evaluation || updateTask.isPending}
              className="w-full gradient-primary rounded-xl px-4 py-2.5 text-primary-foreground font-cairo font-medium hover:opacity-90 disabled:opacity-50">
              {t.saveEvaluation || "حفظ التقييم"}
            </button>
          </form>
        </CrudDialog>
      </div>
    </DashboardLayout>
  );
};

// Tomorrow appointments grouped by doctors then by patients
const TomorrowByDoctors = ({ appts, profiles, patients, t, locale, getDoctorName, getPatientName }: any) => {
  const byDoctor = useMemo(() => {
    const map: Record<string, any[]> = {};
    appts.forEach((a: any) => {
      const did = a.doctor_id || "unassigned";
      if (!map[did]) map[did] = [];
      map[did].push(a);
    });
    return map;
  }, [appts]);

  if (appts.length === 0) {
    return <div className="text-center py-12 font-cairo text-muted-foreground">{t.noTomorrowNotifications}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="neu-flat rounded-2xl bg-background p-4 text-center">
          <div className="gradient-primary rounded-xl p-2 w-10 h-10 mx-auto flex items-center justify-center mb-2">
            <Stethoscope className="h-5 w-5 text-primary-foreground" />
          </div>
          <p className="text-2xl font-bold font-cairo">{Object.keys(byDoctor).length}</p>
          <p className="text-xs text-muted-foreground font-cairo">{t.byDoctors}</p>
        </div>
        <div className="neu-flat rounded-2xl bg-background p-4 text-center">
          <div className="gradient-accent rounded-xl p-2 w-10 h-10 mx-auto flex items-center justify-center mb-2">
            <Baby className="h-5 w-5 text-primary-foreground" />
          </div>
          <p className="text-2xl font-bold font-cairo">{appts.length}</p>
          <p className="text-xs text-muted-foreground font-cairo">{t.tomorrowAppointments}</p>
        </div>
      </div>

      {/* Table grouped by doctor */}
      {Object.entries(byDoctor).map(([doctorId, doctorAppts]: [string, any[]]) => (
        <div key={doctorId} className="neu-flat rounded-3xl bg-background overflow-hidden">
          <div className="flex items-center gap-3 p-4 border-b border-border/30">
            <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground">
              <Stethoscope className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold font-cairo">{getDoctorName(doctorId)}</h4>
              <p className="text-xs text-muted-foreground font-cairo">{doctorAppts.length} {t.appointments}</p>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right font-cairo">{t.patient}</TableHead>
                <TableHead className="text-right font-cairo">{t.appointmentTime}</TableHead>
                <TableHead className="text-right font-cairo">{t.type}</TableHead>
                <TableHead className="text-right font-cairo">{t.status}</TableHead>
                <TableHead className="text-right font-cairo">{t.notes}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {doctorAppts.map((apt: any) => (
                <TableRow key={apt.id}>
                  <TableCell className="font-cairo font-medium">
                    <div className="flex items-center gap-2">
                      <Baby className="h-4 w-4 text-primary" />
                      {getPatientName(apt.patient_id)}
                    </div>
                  </TableCell>
                  <TableCell className="font-cairo text-sm">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      {new Date(apt.date).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </TableCell>
                  <TableCell className="font-cairo text-sm">{translateValue(apt.type, appointmentTypeMap, t)}</TableCell>
                  <TableCell>
                    <span className={`rounded-lg px-2.5 py-1 text-xs font-medium font-cairo ${
                      apt.status === "مجدول" ? "gradient-primary text-primary-foreground" :
                      apt.status === "مكتمل" ? "gradient-success text-primary-foreground" :
                      "bg-destructive/20 text-destructive"
                    }`}>{translateValue(apt.status, appointmentStatusMap, t)}</span>
                  </TableCell>
                  <TableCell className="font-cairo text-sm text-muted-foreground max-w-[150px] truncate">{apt.notes || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}
    </div>
  );
};

// Tasks list component
const TasksList = ({ tasks, patients, profiles, parents, taskReports, isParent, isDoctor, t, locale, onReport, onEdit, onEvaluate, viewTaskId, onToggleView }: any) => {
  if (tasks.length === 0) return <p className="text-center py-12 font-cairo text-muted-foreground">{t.noTasks}</p>;
  return (
    <>
      {tasks.map((task: any, i: number) => {
        const patient = patients.find((p: any) => p.id === task.patient_id);
        const doctor = profiles.find((p: any) => p.id === task.doctor_id);
        const parent = parents.find((p: any) => p.id === task.parent_id);
        const reports = taskReports.filter((r: any) => r.task_id === task.id);
        const isExpanded = viewTaskId === task.id;
        return (
          <motion.div key={task.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
            className={`neu-flat rounded-3xl bg-background p-5 space-y-3 ${task.status === "جديدة" ? "border-r-4 border-primary" : ""}`}>
            <div className="flex items-start gap-4">
              <div className={`rounded-2xl p-3 shrink-0 ${task.type === "دواء" ? "gradient-warning" : task.type === "سلوك" ? "gradient-accent" : "gradient-primary"}`}>
                <Send className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold font-cairo text-sm">{task.title}</h4>
                  <span className="text-xs rounded-lg px-2 py-0.5 bg-muted font-cairo">{task.type}</span>
                  {task.status === "جديدة" ? <Clock className="h-4 w-4 text-muted-foreground" /> : task.status === "مقيّمة" ? <Star className="h-4 w-4 text-yellow-500" /> : <CheckCircle className="h-4 w-4 text-primary" />}
                </div>
                <div className="text-xs text-muted-foreground mt-2 font-cairo space-x-2 space-x-reverse">
                  {patient && <span>{t.patientLabel}: {patient.name}</span>}
                  {doctor && <span>• {t.doctorLabel}: {doctor.full_name}</span>}
                  {parent && <span>• {t.parentReportLabel}: {parent.full_name}</span>}
                  {task.due_date && <span>• {t.deadline}: {task.due_date}</span>}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 mr-14 flex-wrap">
              {/* View details toggle */}
              <button onClick={() => onToggleView(task.id)}
                className="text-xs font-cairo bg-muted hover:bg-muted/80 rounded-xl px-3 py-1.5 transition-all flex items-center gap-1">
                {isExpanded ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {isExpanded ? (t.hideDetails || "إخفاء") : (t.viewDetails || "عرض التفاصيل")}
              </button>

              {/* Doctor: Edit button */}
              {isDoctor && (task.status === "جد��دة" || task.status === "منفذة") && (
                <button onClick={() => onEdit(task)}
                  className="text-xs font-cairo bg-primary/10 text-primary rounded-xl px-3 py-1.5 hover:scale-105 transition-transform flex items-center gap-1">
                  <Edit className="h-3 w-3" />{t.edit}
                </button>
              )}

              {/* Doctor: Evaluate button */}
              {isDoctor && task.status === "منفذة" && !task.evaluation && (
                <button onClick={() => onEvaluate(task.id)}
                  className="text-xs font-cairo gradient-accent text-primary-foreground rounded-xl px-3 py-1.5 hover:scale-105 transition-transform flex items-center gap-1">
                  <Star className="h-3 w-3" />{t.evaluate || "تقييم"}
                </button>
              )}

              {/* Parent: Report button */}
              {isParent && task.status === "جديدة" && (
                <button onClick={() => onReport(task.id)}
                  className="text-xs font-cairo gradient-success text-primary-foreground rounded-xl px-3 py-1.5 hover:scale-105 transition-transform flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />{t.executeAndReport}
                </button>
              )}
            </div>

            {/* Expanded details */}
            {isExpanded && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mr-14 space-y-2">
                {task.description && (
                  <div className="bg-muted/30 rounded-xl p-3 text-sm font-cairo">
                    <span className="font-medium text-xs text-muted-foreground">{t.taskDescription || "الوصف"}:</span>
                    <p className="mt-1">{task.description}</p>
                  </div>
                )}
                {task.evaluation && (
                  <div className="bg-primary/5 rounded-xl p-3 text-sm font-cairo">
                    <div className="flex items-center gap-2 mb-1">
                      <Star className="h-3 w-3 text-yellow-500" />
                      <span className="font-medium text-xs">{t.doctorEvaluation}: {task.evaluation}</span>
                    </div>
                    {task.evaluation_notes && <p className="text-muted-foreground text-xs">{task.evaluation_notes}</p>}
                  </div>
                )}
                {reports.length > 0 && (
                  <div className="space-y-1">
                    {reports.map((r: any) => (
                      <div key={r.id} className="bg-accent/10 rounded-xl p-2.5 text-xs font-cairo">
                        <span className="font-medium">{t.parentReport}:</span> {r.report_text}
                        <span className="text-muted-foreground mr-2">({new Date(r.created_at).toLocaleDateString(locale)})</span>
                      </div>
                    ))}
                  </div>
                )}
                {!task.description && !task.evaluation && reports.length === 0 && (
                  <p className="text-xs text-muted-foreground font-cairo">{t.noData || "لا توجد تفاصيل إضافية"}</p>
                )}
              </motion.div>
            )}
          </motion.div>
        );
      })}
    </>
  );
};

// Notifications list with pagination
const NotificationsList = ({ notifications, isLoading, markRead, t, locale }: any) => {
  const iconMap: Record<string, any> = { danger: AlertTriangle, info: Calendar, warning: Pill, success: Bell };
  const typeStyles: Record<string, string> = { danger: "gradient-warning", info: "gradient-primary", warning: "gradient-accent", success: "gradient-success" };

  const { paginatedItems, page, setPage, pageSize, setPageSize, totalPages, totalItems } = usePagination(notifications);

  if (isLoading) return <div className="text-center py-12 font-cairo text-muted-foreground">{t.loading}</div>;
  if (notifications.length === 0) return <div className="text-center py-12 font-cairo text-muted-foreground">{t.noNotifications}</div>;

  return (
    <>
      <div className="space-y-3">
        {paginatedItems.map((notif: any, i: number) => {
          const Icon = iconMap[notif.type] || Bell;
          return (
            <motion.div key={notif.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
              onClick={() => !notif.read && markRead(notif.id)}
              className={`neu-flat rounded-3xl bg-background p-5 flex items-start gap-4 transition-all hover:scale-[1.005] cursor-pointer ${!notif.read ? 'border-r-4 border-primary' : 'opacity-70'}`}>
              <div className={`${typeStyles[notif.type] || "gradient-primary"} rounded-2xl p-3 shrink-0`}>
                <Icon className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold font-cairo text-sm">{translateValue(notif.title, notificationMessageMap, t)}</h4>
                <p className="text-sm text-muted-foreground mt-1 font-cairo">{notif.message}</p>
                <p className="text-xs text-muted-foreground mt-2 font-cairo">{new Date(notif.created_at).toLocaleString(locale)}</p>
              </div>
              {!notif.read && <div className="h-2.5 w-2.5 rounded-full gradient-primary shrink-0 mt-2" />}
            </motion.div>
          );
        })}
      </div>
      <PaginationControls page={page} totalPages={totalPages} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} onPageSizeChange={setPageSize} />
    </>
  );
};

export default Notifications;
