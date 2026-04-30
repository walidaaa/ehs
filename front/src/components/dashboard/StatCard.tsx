import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

interface NeuCardProps {
  icon: LucideIcon;
  title: string;
  value: string | number;
  subtitle?: string;
  gradient?: string;
  trend?: { value: number; positive: boolean; label?: string };
}

export const StatCard = ({ icon: Icon, title, value, subtitle, gradient = "gradient-primary", trend }: NeuCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="neu-flat rounded-3xl bg-background p-6 flex items-start gap-4"
    >
      <div className={`${gradient} rounded-2xl p-3 shrink-0`}>
        <Icon className="h-6 w-6 text-primary-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-muted-foreground font-cairo">{title}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1 font-cairo">{subtitle}</p>
        )}
        {trend && (
          <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend.positive ? 'text-emerald-600' : 'text-red-500'}`}>
            <span>{trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}%</span>
            {trend.label && <span className="text-muted-foreground font-cairo">{trend.label}</span>}
          </div>
        )}
      </div>
    </motion.div>
  );
};
