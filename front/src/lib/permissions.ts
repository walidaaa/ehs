// Role-based permissions configuration
export type AppRole = "super_admin" | "admin" | "user" | "parent" | "receptionist";

export interface Permission {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

// Navigation items visible per role
export const roleNavItems: Record<AppRole, string[]> = {
  super_admin: ["/", "/patients", "/patients/archived", "/users", "/parents", "/chat", "/notifications", "/settings"],
  admin: ["/", "/patients", "/users", "/parents", "/patients/archived", "/chat", "/notifications", "/settings"],
  user: ["/", "/patients", "/patients/archived", "/parents", "/chat", "/notifications", "/settings"],
  parent: ["/", "/patients", "/chat", "/notifications", "/settings"],
  receptionist: ["/reception", "/notifications", "/settings"],
};

// Page-level permissions per role
export const rolePermissions: Record<AppRole, Record<string, Permission>> = {
  super_admin: {
    patients: { canView: true, canCreate: false, canEdit: false, canDelete: true },
    users: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    parents: { canView: true, canCreate: false, canEdit: false, canDelete: true },
    appointments: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    treatments: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    attendance: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    notifications: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  },
  admin: {
    patients: { canView: true, canCreate: false, canEdit: true, canDelete: false },
    users: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    parents: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    appointments: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    treatments: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    attendance: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    notifications: { canView: true, canCreate: false, canEdit: true, canDelete: false },
  },
  user: {
    patients: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    users: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    parents: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    appointments: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    treatments: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    attendance: { canView: true, canCreate: true, canEdit: false, canDelete: false },
    notifications: { canView: true, canCreate: false, canEdit: true, canDelete: false },
  },
  parent: {
    patients: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    users: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    parents: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    appointments: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    treatments: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    attendance: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    notifications: { canView: true, canCreate: false, canEdit: true, canDelete: false },
  },
  receptionist: {
    patients: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    users: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    parents: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    appointments: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    treatments: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    attendance: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    notifications: { canView: true, canCreate: false, canEdit: true, canDelete: false },
  },
};

export function getPermission(role: AppRole | null, resource: string): Permission {
  if (!role) return { canView: false, canCreate: false, canEdit: false, canDelete: false };
  return rolePermissions[role]?.[resource] || { canView: false, canCreate: false, canEdit: false, canDelete: false };
}

export function canAccessRoute(role: AppRole | null, path: string): boolean {
  if (!role) return false;
  return roleNavItems[role]?.includes(path) ?? false;
}

// Use translation keys instead of hardcoded Arabic
export function getRoleLabel(role: AppRole, t: any): string {
  const map: Record<AppRole, string> = {
    super_admin: t.roleLabelSuperAdmin || t.roleSuperAdmin,
    admin: t.roleLabelAdmin || t.roleAdmin,
    user: t.roleLabelUser || t.roleUser,
    parent: t.roleLabelParent || t.roleParent,
    receptionist: t.roleLabelReceptionist || t.roleReceptionist,
  };
  return map[role] || role;
}

// Keep backward compat (Arabic labels)
export const roleLabels: Record<AppRole, string> = {
  super_admin: "مشرف عام",
  admin: "مصلحة / قسم",
  user: "طبيب",
  parent: "ولي أمر",
  receptionist: "موظف استقبال",
};

// Service options - DB values (Arabic). Use getTranslatedOptions from translationMaps for display.
import { serviceKeys } from "./translationMaps";
export { serviceKeys };
export const serviceOptions = serviceKeys.map(s => s.value);
