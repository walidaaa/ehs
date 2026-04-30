import { motion } from "framer-motion";
import { Building2, Users, UserCheck } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTableQuery } from "@/hooks/useSupabaseQuery";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/usePermissions";
import { useMemo } from "react";

interface CenterOverviewProps {
  doctorCount?: number;
  patientCount?: number;
}

export const CenterOverview = ({ doctorCount = 0, patientCount = 0 }: CenterOverviewProps) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const role = useRole();
  const { data: profiles = [] } = useTableQuery("profiles");
  const { data: userRoles = [] } = useTableQuery("user_roles");
  const { data: patients = [] } = useTableQuery("patients");

  // Calculate actual doctor count for admin (use user.id, not profile.id)
  const actualDoctorCount = useMemo(() => {
    if (role === "admin" && user?.id) {
      return profiles.filter((p: any) => 
        p.created_by === user.id && 
        userRoles.some((r: any) => r.user_id === p.id && r.role === "user")
      ).length;
    }
    return doctorCount;
  }, [role, user?.id, profiles, userRoles, doctorCount]);

  // Calculate actual patient count for admin (use user.id, not profile.id)
  const actualPatientCount = useMemo(() => {
    if (role === "admin" && user?.id) {
      const adminDoctorIds = profiles
        .filter((p: any) => 
          p.created_by === user.id && 
          userRoles.some((r: any) => r.user_id === p.id && r.role === "user")
        )
        .map((p: any) => p.id);
      return patients.filter((p: any) => adminDoctorIds.includes(p.doctor_id)).length;
    }
    return patientCount;
  }, [role, user?.id, profiles, userRoles, patients, patientCount]);

  const centers = [
    { 
      nameKey: "servicePediatrics", 
      patients: actualPatientCount, 
      doctors: actualDoctorCount, 
      color: "gradient-accent" 
    },
  ];
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="neu-flat rounded-3xl bg-background p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold font-cairo">{t.centers}</h3>
        <button className="text-sm text-primary font-medium font-cairo hover:underline">{t.manage}</button>
      </div>

      <div className="space-y-4">
        {centers.map((center) => (
          <div key={center.nameKey} className="neu-flat-sm rounded-2xl bg-background p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className={`${center.color} rounded-xl p-2`}>
                <Building2 className="h-4 w-4 text-primary-foreground" />
              </div>
              <h4 className="font-semibold font-cairo text-sm">{(t as any)[center.nameKey] || center.nameKey}</h4>
            </div>
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-cairo">{center.patients} {t.patientUnit}</span>
              </div>
              <div className="flex items-center gap-2">
                <UserCheck className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-cairo">{center.doctors} {t.doctorUnit}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};
