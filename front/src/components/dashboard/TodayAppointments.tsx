import { motion } from "framer-motion";
import { Calendar, Clock, ChevronRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTableQuery } from "@/hooks/useSupabaseQuery";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/usePermissions";
import { useDataFiltering } from "@/hooks/useDataFiltering";
import { useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const TodayAppointments = () => {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const role = useRole();
  const { data: appointments = [], isLoading } = useTableQuery("appointments");
  const { data: patients = [] } = useTableQuery("patients");
  const { data: profiles = [] } = useTableQuery("profiles");
  const { filterAppointments } = useDataFiltering();
  const [selectedDate, setSelectedDate] = useState<"today" | "tomorrow">("today");

  const getPatientName = (id: string) => patients.find((p: any) => p.id === id)?.name || "-";
  const getDoctorName = (id: string) => profiles.find((p: any) => p.id === id)?.full_name || "-";

  const locale = lang === "fr" ? "fr-FR" : lang === "ar" ? "ar-DZ" : "en-US";

  // Get today and tomorrow dates
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const formatDateKey = (date: Date) => date.toISOString().split("T")[0];

  const todayKey = formatDateKey(today);
  const tomorrowKey = formatDateKey(tomorrow);

  // Filter appointments by date
  const filteredAppointments = useMemo(() => {
    const roleFiltered = filterAppointments(appointments);
    
    const dateKey = selectedDate === "today" ? todayKey : tomorrowKey;
    
    return roleFiltered.filter((apt: any) => {
      if (!apt.date) return false;
      const aptDate = formatDateKey(new Date(apt.date));
      return aptDate === dateKey;
    }).sort((a: any, b: any) => {
      const timeA = a.time?.replace("ص", "").replace("م", "") || "00:00";
      const timeB = b.time?.replace("ص", "").replace("م", "") || "00:00";
      return timeA.localeCompare(timeB);
    });
  }, [appointments, selectedDate, todayKey, tomorrowKey, filterAppointments]);

  const displayDate = selectedDate === "today" ? today : tomorrow;
  const displayDateFormatted = displayDate.toLocaleDateString(locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="neu-flat rounded-3xl bg-background p-6"
      >
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="neu-flat rounded-3xl bg-background p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold font-cairo">{t.appointmentNotes || "المواعيد"}</h3>
        <a href="/appointments" className="text-sm text-primary font-medium font-cairo hover:underline flex items-center gap-1">
          {t.viewAll} <ChevronRight className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* Date Tabs */}
      <Tabs 
        value={selectedDate} 
        onValueChange={(value) => setSelectedDate(value as "today" | "tomorrow")}
        className="mb-4"
      >
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="today" className="font-cairo">
            {t.today || "اليوم"}
          </TabsTrigger>
          <TabsTrigger value="tomorrow" className="font-cairo">
            {t.tomorrowAppointments || "غداً"}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Date Display */}
      <div className="mb-4 p-3 rounded-xl bg-primary/10 border border-primary/20">
        <p className="text-sm font-medium font-cairo text-primary">
          {displayDateFormatted}
        </p>
      </div>

      {/* Appointments List */}
      <div className="space-y-3">
        {filteredAppointments.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground font-cairo">
              {selectedDate === "today" 
                ? (t.noAppointmentsToday || "لا توجد مواعيد اليوم")
                : (t.noAppointmentsTomorrow || "لا توجد مواعيد غداً")}
            </p>
          </div>
        ) : (
          filteredAppointments.map((apt: any) => (
            <motion.div
              key={apt.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="neu-flat-sm rounded-2xl bg-background p-4 flex items-center gap-4 hover:scale-[1.01] transition-transform cursor-pointer border border-border/50 hover:border-primary/30"
            >
              <div className="gradient-primary rounded-xl p-3 shrink-0">
                <Calendar className="h-5 w-5 text-primary-foreground" />
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="font-semibold font-cairo text-sm">{getPatientName(apt.patient_id)}</p>
                <p className="text-xs text-muted-foreground font-cairo mt-1">
                  {getDoctorName(apt.doctor_id)} • {apt.type || "-"}
                </p>
              </div>

              <div className="text-right shrink-0 flex flex-col items-end gap-1">
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  <Clock className="h-4 w-4 text-primary" />
                  <span>{apt.time}</span>
                </div>
                <span className={`inline-block text-xs px-2.5 py-1 rounded-lg font-medium font-cairo ${
                  apt.status === "مجدول" 
                    ? "bg-primary/20 text-primary"
                    : apt.status === "مكتمل"
                    ? "bg-green-500/20 text-green-600"
                    : "bg-red-500/20 text-red-600"
                }`}>
                  {apt.status || "مجدول"}
                </span>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Summary */}
      {filteredAppointments.length > 0 && (
        <div className="mt-6 pt-4 border-t border-border/50">
          <p className="text-xs text-muted-foreground font-cairo">
            {filteredAppointments.length} {t.appointmentNotes || "موعد"}
          </p>
        </div>
      )}
    </motion.div>
  );
};
