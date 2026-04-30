import { motion } from "framer-motion";
import { Calendar, Clock } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export const UpcomingAppointments = () => {
  const { t } = useLanguage();

  const appointments = [
    { id: 1, patient: "أحمد بن علي", doctor: "د. محمد", time: "09:00", date: t.today, type: t.examination },
    { id: 2, patient: "فاطمة الزهراء", doctor: "د. سارة", time: "10:30", date: t.today, type: t.tabTreatments },
    { id: 3, patient: "يوسف كريم", doctor: "د. خالد", time: "14:00", date: t.tomorrowAppointments, type: t.serviceEmergency },
    { id: 4, patient: "مريم حسني", doctor: "د. أمين", time: "16:00", date: t.tomorrowAppointments, type: t.taskTypeFollowUp },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="neu-flat rounded-3xl bg-background p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold font-cairo">{t.upcomingAppointments}</h3>
        <button className="text-sm text-primary font-medium font-cairo hover:underline">{t.viewAll}</button>
      </div>

      <div className="space-y-3">
        {appointments.map((apt) => (
          <div
            key={apt.id}
            className="neu-flat-sm rounded-2xl bg-background p-4 flex items-center gap-4 hover:scale-[1.01] transition-transform cursor-pointer"
          >
            <div className="gradient-accent rounded-xl p-2.5 shrink-0">
              <Calendar className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium font-cairo text-sm">{apt.patient}</p>
              <p className="text-xs text-muted-foreground font-cairo">{apt.doctor} • {apt.type}</p>
            </div>
            <div className="text-left shrink-0">
              <div className="flex items-center gap-1 text-sm font-medium">
                <Clock className="h-3.5 w-3.5" />
                <span>{apt.time}</span>
              </div>
              <p className="text-xs text-muted-foreground font-cairo">{apt.date}</p>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};
