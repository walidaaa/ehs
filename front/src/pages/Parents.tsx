import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { motion } from "framer-motion";
import { Search, Heart, Phone, Stethoscope } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useState } from "react";
import { useTableQuery } from "@/hooks/useSupabaseQuery";
import { useRole } from "@/hooks/usePermissions";
import { useDataFiltering } from "@/hooks/useDataFiltering";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/shared/PaginationControls";
import { CardSkeleton } from "@/components/shared/ListSkeleton";

const Parents = () => {
  const { t, dir } = useLanguage();
  const [search, setSearch] = useState("");
  const role = useRole();
  const { filterParents } = useDataFiltering();

  const { data: parentsRaw = [], isLoading } = useTableQuery("parents");
  const { data: patientsAll = [] } = useTableQuery("patients");
  const { data: patientDoctors = [] } = useTableQuery("patient_doctors");
  const { data: profiles = [] } = useTableQuery("profiles");
  const parentsList = filterParents(parentsRaw).filter((p: any) => !p.archived);

  const filtered = parentsList.filter((p: any) => p.full_name?.includes(search));
  const { paginatedItems, page, setPage, pageSize, setPageSize, totalPages, totalItems } = usePagination(filtered);

  const getChildrenNames = (parentId: string) =>
    patientsAll.filter((p: any) => p.parent_id === parentId && !p.archived).map((p: any) => p.name);

  const getDoctorName = (id: string) => profiles.find((p: any) => p.id === id)?.full_name || "";
  const getDoctorsForParent = (parentId: string) => {
    const children = patientsAll.filter((p: any) => p.parent_id === parentId && !p.archived);
    const doctorIds = new Set<string>();
    children.forEach((c: any) => {
      const pds = patientDoctors.filter((pd: any) => pd.patient_id === c.id);
      pds.forEach((pd: any) => doctorIds.add(pd.doctor_id));
      if (pds.length === 0 && c.doctor_id) doctorIds.add(c.doctor_id);
    });
    return [...doctorIds].map(getDoctorName).filter(Boolean);
  };

  return (
    <DashboardLayout>
      <div dir={dir} className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-2xl font-bold font-cairo">{t.parentsTitle}</h2>
          <p className="text-muted-foreground font-cairo mt-1">{role === "user" ? t.parentsSubtitleDoctor : t.parentsSubtitleAll}</p>
        </motion.div>

        <div className="flex flex-wrap gap-3 items-center">
          <div className="neu-flat-sm rounded-2xl bg-background px-4 py-2.5 flex items-center gap-2 flex-1 max-w-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.searchByName} className="bg-transparent outline-none text-sm flex-1 font-cairo" />
          </div>
        </div>

        {isLoading ? (
          <CardSkeleton />
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 font-cairo text-muted-foreground">{t.noData}</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {paginatedItems.map((parent: any, i: number) => {
                const children = getChildrenNames(parent.id);
                return (
                  <motion.div key={parent.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    className="neu-flat rounded-3xl bg-background p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-11 w-11 rounded-2xl gradient-success flex items-center justify-center text-primary-foreground"><Heart className="h-5 w-5" /></div>
                      <div>
                        <h4 className="font-semibold font-cairo">{parent.full_name}</h4>
                        {parent.phone && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {parent.phone}
                          </p>
                        )}
                      </div>
                    </div>
                    {children.length > 0 && (
                      <div className="text-xs text-muted-foreground font-cairo mt-2">
                        <span className="font-medium text-foreground">{t.children}: </span>
                        {children.join("، ")}
                      </div>
                    )}
                    {(() => { const docs = getDoctorsForParent(parent.id); return docs.length > 0 ? (
                      <div className="text-xs text-muted-foreground font-cairo mt-1 flex items-center gap-1">
                        <Stethoscope className="h-3 w-3 text-primary flex-shrink-0" />
                        <span className="font-medium text-primary">{docs.join("، ")}</span>
                      </div>
                    ) : null; })()}
                  </motion.div>
                );
              })}
            </div>
            <PaginationControls page={page} totalPages={totalPages} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} onPageSizeChange={setPageSize} />
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Parents;
