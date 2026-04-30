import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { crudApi } from "@/lib/api";
import { toast } from "sonner";

export function useTableQuery(table: string, options?: { select?: string; orderBy?: string; filters?: Record<string, any>; noCache?: boolean }) {
  // Special handling for profiles table - auto-refetch every 2 seconds for real-time presence
  const isProfilesTable = table === 'profiles';
  // Tables that always need fresh data
  const alwaysFresh = table === 'notifications';
  
  return useQuery({
    queryKey: [table, options?.filters],
    queryFn: async () => {
      const data = await crudApi.getAll(table, options?.filters);
      return data as any[];
    },
    staleTime: alwaysFresh || isProfilesTable || options?.noCache ? 0 : 30_000,
    gcTime: isProfilesTable ? 30_000 : 5 * 60_000,
    refetchInterval: isProfilesTable ? 2000 : false, // Auto-refetch profiles every 2 seconds
    refetchIntervalInBackground: isProfilesTable ? true : false, // Refetch even when tab is unfocused
  });
}

export function useInsertMutation(table: string, messages?: { success?: string; error?: string }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: any) => {
      const data = await crudApi.insert(table, row);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      toast.success(messages?.success || "Created successfully");
    },
    onError: (e: any) => toast.error((messages?.error || "Error") + ": " + e.message),
  });
}

export function useUpdateMutation(table: string, messages?: { success?: string; error?: string }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...row }: any) => {
      const data = await crudApi.update(table, id, row);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      toast.success(messages?.success || "Updated successfully");
    },
    onError: (e: any) => toast.error((messages?.error || "Error") + ": " + e.message),
  });
}

export function useDeleteMutation(table: string, messages?: { success?: string; error?: string }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await crudApi.delete(table, id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      toast.success(messages?.success || "Deleted successfully");
    },
    onError: (e: any) => toast.error((messages?.error || "Error") + ": " + e.message),
  });
}
