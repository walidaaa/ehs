import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/usePermissions";
import { useTableQuery } from "@/hooks/useSupabaseQuery";

/**
 * For Admin (Service) role: scopes data to only doctors created by this admin,
 * and patients/appointments/parents linked to those doctors.
 */
export function useAdminScope() {
  const { user } = useAuth();
  const role = useRole();
  const isAdmin = role === "admin";

  const { data: profiles = [] } = useTableQuery("profiles");
  const { data: userRoles = [] } = useTableQuery("user_roles");
  const { data: patientDoctors = [] } = useTableQuery("patient_doctors");

  // Doctors created by this admin
  const myDoctorIds = useMemo(() => {
    if (!isAdmin || !user?.id) return [];
    return profiles
      .filter((p: any) => p.created_by === user.id)
      .map((p: any) => p.id);
  }, [isAdmin, user?.id, profiles]);

  // All user IDs in scope (admin + their doctors)
  const allScopeUserIds = useMemo(() => {
    if (!isAdmin || !user?.id) return [];
    return [user.id, ...myDoctorIds];
  }, [isAdmin, user?.id, myDoctorIds]);

  // Patient IDs linked to this admin's doctors (via doctor_id or patient_doctors)
  const scopedPatientIds = useMemo(() => {
    if (!isAdmin || !user?.id) return null; // null = no filtering
    const ids = new Set<string>();
    return ids;
  }, [isAdmin, user?.id]);

  // Admin sees only patients belonging to their doctors
  const filterPatients = (patients: any[]) => {
    if (!isAdmin || !user?.id) return patients;
    return patients.filter((p: any) => {
      // Patient's primary doctor is one of admin's doctors
      if (p.doctor_id && myDoctorIds.includes(p.doctor_id)) return true;
      // Patient linked via patient_doctors table
      const linked = patientDoctors.some(
        (pd: any) => pd.patient_id === p.id && myDoctorIds.includes(pd.doctor_id)
      );
      return linked;
    });
  };

  const filterAppointments = (appointments: any[]) => {
    if (!isAdmin || !user?.id) return appointments;
    // Get scoped patient IDs first
    return appointments.filter((a: any) => {
      // Doctor is in scope
      if (a.doctor_id && (myDoctorIds.includes(a.doctor_id) || a.doctor_id === user?.id)) return true;
      // Created by admin or their doctors
      if (a.created_by && allScopeUserIds.includes(a.created_by)) return true;
      return false;
    });
  };

  const filterParents = (parents: any[]) => {
    if (!isAdmin || !user?.id) return parents;
    // Only show parents created by admin or their doctors
    return parents.filter((p: any) => {
      if (p.created_by && allScopeUserIds.includes(p.created_by)) return true;
      return false;
    });
  };

  const filterNotifications = (notifications: any[]) => {
    if (!isAdmin) return notifications;
    return notifications.filter((n: any) => allScopeUserIds.includes(n.user_id));
  };

  return {
    isAdmin,
    myDoctorIds,
    allScopeUserIds,
    filterPatients,
    filterAppointments,
    filterParents,
    filterNotifications,
  };
}
