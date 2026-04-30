import { motion } from "framer-motion";
import { AlertTriangle, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export const AlertsPanel = () => {
  const { t } = useLanguage();
  
  const alerts = [
    { patient: "يوسف كريم", message: t.statusDeterioration, type: "danger", icon: TrendingDown },
    { patient: "أحمد بن علي", message: t.statusImprovement, type: "success", icon: TrendingUp },
    { patient: "عبد الرحمن", message: t.noAttendance, type: "warning", icon: AlertTriangle },
    { patient: "مريم حسني", message: t.statusStable, type: "info", icon: Minus },
  ];

  const typeStyles: Record<string, string> = {
    danger: "bg-destructive/10 border-destructive/20",
    success: "bg-emerald-500/10 border-emerald-500/20",
    warning: "bg-amber-500/10 border-amber-500/20",
    info: "bg-primary/10 border-primary/20",
  };

  const iconStyles: Record<string, string> = {
    danger: "text-destructive",
    success: "text-emerald-600",
    warning: "text-amber-600",
    info: "text-primary",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="neu-flat rounded-3xl bg-background p-6"
    >
      <h3 className="text-lg font-bold font-cairo mb-6">{t.alerts}</h3>
      <div className="space-y-3">
        {alerts.map((alert, i) => (
          <div key={i} className={`rounded-2xl border p-4 ${typeStyles[alert.type]}`}>
            <div className="flex items-start gap-3">
              <alert.icon className={`h-5 w-5 mt-0.5 shrink-0 ${iconStyles[alert.type]}`} />
              <div>
                <p className="font-medium text-sm font-cairo">{alert.patient}</p>
                <p className="text-xs text-muted-foreground mt-1 font-cairo">{alert.message}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};
