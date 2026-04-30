import { useMemo, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/usePermissions";
import { useTableQuery } from "@/hooks/useSupabaseQuery";

/**
 * Comprehensive data filtering hook for role-based access control.
 * Implements proper filtering for all roles:
 * - super_admin: sees all data
 * - admin (Service): sees data for doctors they created + those doctors' patients/parents
 * - user (Doctor): sees only their own patients and parents
 * - parent: sees only their own children and assigned doctors
 */
export function useDataFiltering() {
  const { user } = useAuth();
  const role = useRole();

  const { data: profiles = [] } = useTableQuery("profiles");
  const { data: userRoles = [] } = useTableQuery("user_roles");
  const { data: patientDoctors = [] } = useTableQuery("patient_doctors");
  const { data: patients = [] } = useTableQuery("patients");
  const { data: parents = [] } = useTableQuery("parents");

  // Get doctors created by this admin
  const adminDoctorIds = useMemo(() => {
    if (role !== "admin" || !user?.id) return [];
    return profiles
      .filter((p: any) => p.created_by === user.id)
      .map((p: any) => p.id);
  }, [role, user?.id, profiles]);

  // Doctor's patient IDs
  const doctorPatientIds = useMemo(() => {
    if (role !== "user" || !user?.id) return [];
    const ids = new Set<string>();
    // Patients where doctor_id matches
    patientDoctors.forEach((pd: any) => {
      if (pd.doctor_id === user.id) ids.add(pd.patient_id);
    });
    return Array.from(ids);
  }, [role, user?.id, patientDoctors]);

  // Get parent ID from parents table if parent role
  const userParentId = useMemo(() => {
    if (role !== "parent" || !user?.id) return null;
    const parent = parents.find((p: any) => p.user_id === user.id);
    return parent?.id || null;
  }, [role, user?.id, parents]);

  // Parent's patient IDs - filter by parent_id field
  const parentPatientIds = useMemo(() => {
    if (role !== "parent" || !userParentId) return [];
    return patients
      .filter((p: any) => p.parent_id === userParentId)
      .map((p: any) => p.id);
  }, [role, userParentId, patients]);

  // ============ PATIENTS FILTERING ============
  const filterPatients = useCallback((patients: any[]) => {
    if (role === "super_admin") return patients;

    if (role === "admin") {
      // Admin sees patients of their doctors
      return patients.filter((p: any) => {
        if (p.doctor_id && adminDoctorIds.includes(p.doctor_id)) return true;
        const linked = patientDoctors.some(
          (pd: any) => pd.patient_id === p.id && adminDoctorIds.includes(pd.doctor_id)
        );
        return linked;
      });
    }

    if (role === "user") {
      // Doctor sees ONLY their patients - CRITICAL for data isolation
      // Must check both patient_doctors table (many-to-many) and doctor_id field
      if (!user?.id) return [];
      return patients.filter((p: any) => {
        // Primary: Check if patient is linked in patient_doctors table
        if (doctorPatientIds.includes(p.id)) return true;
        // Secondary: Check if patient's doctor_id field matches this doctor
        if (p.doctor_id === user.id) return true;
        // Default: do NOT show this patient to prevent data leakage
        return false;
      });
    }

    if (role === "parent") {
      // Parent sees only their children
      return patients.filter((p: any) => parentPatientIds.includes(p.id));
    }

    return [];
  }, [role, user?.id, adminDoctorIds, doctorPatientIds, patientDoctors, parentPatientIds]);

  // ============ PARENTS FILTERING ============
  const filterParents = (parents: any[]) => {
    if (role === "super_admin") return parents;

    if (role === "admin") {
      // Admin sees parents created by them or their doctors
      const allAdminUserIds = [user?.id, ...adminDoctorIds];
      return parents.filter((p: any) => allAdminUserIds.includes(p.created_by));
    }

    if (role === "user") {
      // Doctor sees parents they created
      return parents.filter((p: any) => p.created_by === user?.id);
    }

    if (role === "parent") {
      // Parents don't see other parents list
      return [];
    }

    return [];
  };

  // ============ DOCTORS FILTERING ============
  const filterDoctors = (doctors: any[]) => {
    if (role === "super_admin") return doctors;

    if (role === "admin") {
      // Admin sees doctors they created
      return doctors.filter((d: any) => d.created_by === user?.id);
    }

    if (role === "user") {
      // Doctor sees only themselves
      return doctors.filter((d: any) => d.id === user?.id);
    }

    if (role === "parent") {
      // Parents don't see doctors list
      return [];
    }

    return [];
  };

  // Get the service scope for receptionist (same logic as Reception page)
  const receptionistServiceUserIds = useMemo(() => {
    if (role !== "receptionist" || !user?.id) return [];
    const myProfile = profiles.find((p: any) => p.id === user.id);
    const myCreatedBy = myProfile?.created_by;
    if (!myCreatedBy) return [user.id];
    // All users created by the same admin (doctors, receptionists, etc.) + the admin itself
    const serviceIds = profiles
      .filter((p: any) => p.created_by === myCreatedBy || p.id === myCreatedBy)
      .map((p: any) => p.id);
    // Include self if not already
    if (!serviceIds.includes(user.id)) serviceIds.push(user.id);
    return serviceIds;
  }, [role, user?.id, profiles]);

  // ============ NOTIFICATIONS FILTERING ============
  const filterNotifications = (notifications: any[]) => {
    if (role === "super_admin") {
      // Super admin sees all notifications
      return notifications;
    }

    if (role === "admin") {
      // Admin sees all notifications (both direct and for their doctors)
      // This includes notifications for the admin themselves and notifications assigned to their doctors
      const allAdminUserIds = [user?.id, ...adminDoctorIds];
      return notifications.filter((n: any) => allAdminUserIds.includes(n.user_id));
    }

    if (role === "receptionist") {
      // Receptionist sees notifications for all users in their service
      return notifications.filter((n: any) => receptionistServiceUserIds.includes(n.user_id));
    }

    if (role === "user") {
      // Doctor sees ONLY their own notifications - strict filtering
      // This ensures each doctor only sees notifications intended for them
      if (!user?.id) return [];
      return notifications.filter((n: any) => {
        // MUST match doctor's user ID exactly
        return n.user_id === user.id;
      });
    }

    if (role === "parent") {
      // Parent sees their notifications
      return notifications.filter((n: any) => n.user_id === user?.id);
    }

    return [];
  };

  // ============ APPOINTMENTS FILTERING ============
  const filterAppointments = useCallback((appointments: any[]) => {
    if (role === "super_admin") return appointments;

    if (role === "admin") {
      // Admin sees appointments for their doctors and their doctors' patients
      return appointments.filter((a: any) => {
        if (a.doctor_id && adminDoctorIds.includes(a.doctor_id)) return true;
        const linked = patientDoctors.some(
          (pd: any) => pd.patient_id === a.patient_id && adminDoctorIds.includes(pd.doctor_id)
        );
        return linked;
      });
    }

    if (role === "user") {
      // Doctor sees ONLY appointments for their assigned patients
      // CRITICAL: Strict filtering to prevent cross-doctor data leakage
      if (!user?.id) return [];
      return appointments.filter((a: any) => {
        // Primary check: appointment doctor_id MUST match this doctor's user ID
        if (a.doctor_id && a.doctor_id === user.id) return true;
        
        // Secondary check: patient MUST be assigned to this doctor
        if (doctorPatientIds.includes(a.patient_id)) return true;
        
        // Tertiary check: patient's doctor_id field matches this doctor
        const patient = patients.find((p: any) => p.id === a.patient_id);
        if (patient?.doctor_id === user.id) return true;
        
        // Default: do NOT show this appointment to prevent data leakage
        return false;
      });
    }

    if (role === "parent") {
      // Parent sees appointments for their children
      return appointments.filter((a: any) => parentPatientIds.includes(a.patient_id));
    }

    return [];
  }, [role, user?.id, doctorPatientIds, adminDoctorIds, patientDoctors, patients]);

  // ============ TREATMENTS FILTERING ============
  const filterTreatments = (treatments: any[]) => {
    if (role === "super_admin") return treatments;

    if (role === "admin") {
      // Admin sees treatments for their doctors' patients
      return treatments.filter((t: any) => {
        const linked = patientDoctors.some(
          (pd: any) => pd.patient_id === t.patient_id && adminDoctorIds.includes(pd.doctor_id)
        );
        return linked;
      });
    }

    if (role === "user") {
      // Doctor sees treatments for their patients
      return treatments.filter((t: any) => {
        if (doctorPatientIds.includes(t.patient_id)) return true;
        // Also check patient's doctor_id field
        const patient = patients.find((p: any) => p.id === t.patient_id);
        if (patient?.doctor_id === user?.id) return true;
        return false;
      });
    }

    if (role === "parent") {
      // Parent sees treatments for their children
      return treatments.filter((t: any) => parentPatientIds.includes(t.patient_id));
    }

    return [];
  };

  // ============ ATTENDANCE FILTERING ============
  const filterAttendance = (attendance: any[]) => {
    if (role === "super_admin") return attendance;

    if (role === "admin") {
      // Admin sees attendance for their doctors' patients
      return attendance.filter((a: any) => {
        const linked = patientDoctors.some(
          (pd: any) => pd.patient_id === a.patient_id && adminDoctorIds.includes(pd.doctor_id)
        );
        return linked;
      });
    }

    if (role === "user") {
      // Doctor sees attendance for their patients
      return attendance.filter((a: any) => {
        if (doctorPatientIds.includes(a.patient_id)) return true;
        // Also check patient's doctor_id field
        const patient = patients.find((p: any) => p.id === a.patient_id);
        if (patient?.doctor_id === user?.id) return true;
        return false;
      });
    }

    if (role === "parent") {
      // Parent sees attendance for their children
      return attendance.filter((a: any) => parentPatientIds.includes(a.patient_id));
    }

    return [];
  };

  // ============ USERS FILTERING ============
  const filterUsers = (users: any[]) => {
    if (role === "super_admin") return users;

    if (role === "admin") {
      // Admin sees doctors they created
      return users.filter((u: any) => u.created_by === user?.id);
    }

    if (role === "user" || role === "parent") {
      // Doctors and parents can't manage users
      return [];
    }

    return [];
  };

  // Memoize filter functions to ensure proper dependency tracking
  const memoizedFilterFunctions = useMemo(() => ({
    role,
    filterPatients,
    filterParents,
    filterDoctors,
    filterNotifications,
    filterAppointments,
    filterTreatments,
    filterAttendance,
    filterUsers,
  }), [
    role,
    filterPatients,
    filterParents,
    filterDoctors,
    filterNotifications,
    filterAppointments,
    filterTreatments,
    filterAttendance,
    filterUsers,
  ]);

  return memoizedFilterFunctions;
}
