import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { motion } from "framer-motion";
import { Search, ArchiveRestore, Archive, Calendar, Stethoscope, Baby, Clock, CheckCircle, Trash2 } from "lucide-react";
import { useState, useMemo } from "react";
import { crudApi } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/shared/PaginationControls";
import { CardSkeleton } from "@/components/shared/ListSkeleton";
import { useRole } from "@/hooks/usePermissions";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTableQuery } from "@/hooks/useSupabaseQuery";
import { useAdminScope } from "@/hooks/useAdminScope";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DeleteConfirm } from "@/components/shared/DeleteConfirm";
import { appointmentTypeMap, translateValue } from "@/lib/translationMaps";

const ArchivedPatients = () => {
  const [search, setSearch] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();
  const role = useRole();
  const { t, dir, lang } = useLanguage();
  const locale = lang === "fr" ? "fr-FR" : "ar-DZ";
  const { filterAppointments } = useAdminScope();

  // Archived patients
  const { data: archivedRaw = [], isLoading, isError } = useQuery({
    queryKey: ["patients-archived"],
    queryFn: async () => {
      const data = await crudApi.getAll("patients", { archived: true });
      return data as any[];
    },
    retry: 1,
  });

  // Completed appointments
  const { data: appointmentsRaw = [] } = useTableQuery("appointments");
  const allAppointments = filterAppointments(appointmentsRaw);
  const completedAppts = useMemo(() =>
    allAppointments.filter((a: any) => a.status === "مكتمل")
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [allAppointments]
  );

  const { data: patients = [] } = useTableQuery("patients");
  const { data: profiles = [] } = useTableQuery("profiles");

  const getPatientName = (id: string) => patients.find((p: any) => p.id === id)?.name || "-";
  const getDoctorName = (id: string) => profiles.find((p: any) => p.id === id)?.full_name || "-";

  const filteredArchived = archivedRaw.filter((p: any) => p.name?.includes(search));
  const archivedPag = usePagination(filteredArchived);

  const filteredCompleted = completedAppts.filter((a: any) =>
    !search || getPatientName(a.patient_id).includes(search) || getDoctorName(a.doctor_id).includes(search)
  );
  const completedPag = usePagination(filteredCompleted);

  // Group completed appointments by doctor then patient
  const groupedByDoctor = useMemo(() => {
    const map: Record<string, Record<string, any[]>> = {};
    completedPag.paginatedItems.forEach((a: any) => {
      const did = a.doctor_id || "unassigned";
      const pid = a.patient_id;
      if (!map[did]) map[did] = {};
      if (!map[did][pid]) map[did][pid] = [];
      map[did][pid].push(a);
    });
    return map;
  }, [completedPag.paginatedItems]);

  const handleRestore = async (id: string) => {
    try {
      // Get patient's parent_id before restoring
      const patient = await crudApi.getOne("patients", id);
      await crudApi.update("patients", id, { archived: false });
      // Auto-restore parent
      if (patient?.parent_id) {
        await crudApi.update("parents", patient.parent_id, { archived: false });
      }
      toast.success(t.restoreSuccess);
      queryClient.invalidateQueries({ queryKey: ["patients-archived"] });
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      queryClient.invalidateQueries({ queryKey: ["parents"] });
    } catch {
      toast.error(t.restoreError);
    }
  };

  const handlePermanentDelete = async () => {
    if (!selectedPatientId) return;
    setIsDeleting(true);
    try {
      await crudApi.delete("patients", selectedPatientId);
      toast.success(t.permanentDeleteSuccess);
      queryClient.invalidateQueries({ queryKey: ["patients-archived"] });
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      setDeleteDialogOpen(false);
      setSelectedPatientId(null);
    } catch {
      toast.error(t.permanentDeleteError);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <DashboardLayout>
      <DeleteConfirm
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handlePermanentDelete}
        title={t.permanentDeleteTitle}
      />
      <div dir={dir} className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-2xl font-bold font-cairo flex items-center gap-2">
            <Archive className="h-6 w-6 text-muted-foreground" />
            {t.archiveTitle}
          </h2>
          <p className="text-muted-foreground font-cairo mt-1">{t.archiveSubtitle}</p>
        </motion.div>

        <div className="flex flex-wrap gap-3 items-center">
          <div className="neu-flat-sm rounded-2xl bg-background px-4 py-2.5 flex items-center gap-2 flex-1 max-w-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.search} className="bg-transparent outline-none text-sm flex-1 font-cairo" />
          </div>
        </div>

        <Tabs defaultValue="patients" dir={dir}>
          <TabsList className="w-full justify-start bg-muted/50 rounded-2xl p-1">
            <TabsTrigger value="patients" className="font-cairo rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Archive className="h-4 w-4 ml-2" />{t.archivedPatientsTab} ({filteredArchived.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="font-cairo rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <CheckCircle className="h-4 w-4 ml-2" />{t.completedAppointmentsTab} ({filteredCompleted.length})
            </TabsTrigger>
          </TabsList>

          {/* Archived Patients Tab */}
          <TabsContent value="patients" className="mt-4">
            {isLoading && !isError ? (
              <CardSkeleton count={3} />
            ) : filteredArchived.length === 0 ? (
              <div className="text-center py-12 font-cairo text-muted-foreground">{isError ? t.restoreError : t.noArchived}</div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {archivedPag.paginatedItems.map((patient: any, i: number) => (
                    <motion.div key={patient.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                      className="neu-flat rounded-3xl bg-background p-5 opacity-75">
                      <div className="flex items-center gap-3 mb-3">
                        {patient.photo_url ? (
                          <img src={patient.photo_url} alt={patient.name} className="h-12 w-12 rounded-2xl object-cover grayscale" />
                        ) : (
                          <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground font-bold">
                            {patient.name?.charAt(0)}
                          </div>
                        )}
                        <div className="flex-1">
                          <h4 className="font-semibold font-cairo">{patient.name}</h4>
                          <p className="text-xs text-muted-foreground">{patient.age} {t.years} • {patient.diagnosis_type || "—"}</p>
                        </div>
                      </div>
                      {role !== "super_admin" && (
                        <div className="flex items-center justify-center gap-3 pt-3 border-t border-border">
                          <button
                            onClick={() => {
                              setSelectedPatientId(patient.id);
                              setDeleteDialogOpen(true);
                            }}
                            disabled={isDeleting}
                            className="neu-flat rounded-full p-3 flex items-center justify-center hover:shadow-md transition-shadow disabled:opacity-50"
                            title={t.permanentDelete}
                          >
                            <Trash2 className="h-5 w-5 text-destructive" />
                          </button>
                          <button
                            onClick={() => handleRestore(patient.id)}
                            className="neu-flat rounded-full p-3 flex items-center justify-center hover:shadow-md transition-shadow"
                            title={t.restore}
                          >
                            <ArchiveRestore className="h-5 w-5 text-primary" />
                          </button>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
                <PaginationControls page={archivedPag.page} totalPages={archivedPag.totalPages} pageSize={archivedPag.pageSize} totalItems={archivedPag.totalItems} onPageChange={archivedPag.setPage} onPageSizeChange={archivedPag.setPageSize} />
              </>
            )}
          </TabsContent>

          {/* Completed Appointments Tab - Grouped by Doctor then Patient */}
          <TabsContent value="completed" className="mt-4 space-y-6">
            {filteredCompleted.length === 0 ? (
              <div className="text-center py-12 font-cairo text-muted-foreground">{t.noCompletedAppointments}</div>
            ) : (
              <>
                {/* Summary */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="neu-flat rounded-2xl bg-background p-4 text-center">
                    <div className="gradient-success rounded-xl p-2 w-10 h-10 mx-auto flex items-center justify-center mb-2">
                      <Stethoscope className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <p className="text-2xl font-bold font-cairo">{Object.keys(groupedByDoctor).length}</p>
                    <p className="text-xs text-muted-foreground font-cairo">{t.byDoctors}</p>
                  </div>
                  <div className="neu-flat rounded-2xl bg-background p-4 text-center">
                    <div className="gradient-accent rounded-xl p-2 w-10 h-10 mx-auto flex items-center justify-center mb-2">
                      <CheckCircle className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <p className="text-2xl font-bold font-cairo">{filteredCompleted.length}</p>
                    <p className="text-xs text-muted-foreground font-cairo">{t.completedAppointmentsTab}</p>
                  </div>
                </div>

                {/* Grouped by doctor */}
                {Object.entries(groupedByDoctor).map(([doctorId, patientMap]) => (
                  <div key={doctorId} className="neu-flat rounded-3xl bg-background overflow-hidden">
                    <div className="flex items-center gap-3 p-4 border-b border-border/30">
                      <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground">
                        <Stethoscope className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-bold font-cairo">{getDoctorName(doctorId)}</h4>
                        <p className="text-xs text-muted-foreground font-cairo">
                          {Object.values(patientMap).flat().length} {t.completedAppointmentsTab}
                        </p>
                      </div>
                    </div>

                    {Object.entries(patientMap).map(([patientId, appts]) => (
                      <div key={patientId} className="border-b border-border/10 last:border-0">
                        <div className="flex items-center gap-2 px-4 py-2 bg-muted/30">
                          <Baby className="h-4 w-4 text-primary" />
                          <span className="font-cairo font-medium text-sm">{getPatientName(patientId)}</span>
                          <span className="text-xs text-muted-foreground font-cairo">({appts.length})</span>
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-right font-cairo">{t.dateTime}</TableHead>
                              <TableHead className="text-right font-cairo">{t.type}</TableHead>
                              <TableHead className="text-right font-cairo">{t.notes}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {appts.map((apt: any) => (
                              <TableRow key={apt.id}>
                                <TableCell className="font-cairo text-sm">
                                  <div className="flex items-center gap-1.5">
                                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                    {new Date(apt.date).toLocaleString(locale, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                  </div>
                                </TableCell>
                                <TableCell className="font-cairo text-sm">{translateValue(apt.type, appointmentTypeMap, t)}</TableCell>
                                <TableCell className="font-cairo text-sm text-muted-foreground max-w-[200px] truncate">{apt.notes || "-"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ))}
                  </div>
                ))}

                <PaginationControls page={completedPag.page} totalPages={completedPag.totalPages} pageSize={completedPag.pageSize} totalItems={completedPag.totalItems} onPageChange={completedPag.setPage} onPageSizeChange={completedPag.setPageSize} />
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default ArchivedPatients;
