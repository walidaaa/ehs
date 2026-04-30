import { useAuth } from "@/contexts/AuthContext";
import { getPermission, canAccessRoute, type AppRole } from "@/lib/permissions";

export function usePermissions(resource: string) {
  const { userRole } = useAuth();
  return getPermission(userRole as AppRole | null, resource);
}

export function useCanAccessRoute(path: string) {
  const { userRole } = useAuth();
  return canAccessRoute(userRole as AppRole | null, path);
}

export function useRole() {
  const { userRole } = useAuth();
  return userRole as AppRole | null;
}
