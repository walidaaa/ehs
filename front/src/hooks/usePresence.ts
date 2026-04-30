import { useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { crudApi } from "@/lib/api";

const UPDATE_INTERVAL = 15_000; // 15 seconds for frequent presence updates

export const usePresence = () => {
  const { user } = useAuth();

  const updatePresence = useCallback(async () => {
    if (!user?.id) return;
    try {
      // Update user's last_seen timestamp via API
      // Use Date.now() as epoch ms to avoid timezone issues
      await crudApi.custom('/presence', {
        method: 'POST',
        body: JSON.stringify({
          user_id: user.id,
          last_seen: new Date().toISOString()
        })
      });
    } catch (error) {
      // Silently fail if presence update fails
      console.log('[v0] Presence update error (non-critical):', error instanceof Error ? error.message : 'Unknown error');
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    // Update immediately on mount - don't wait for interval
    updatePresence();

    // Update frequently on an interval
    const interval = setInterval(updatePresence, UPDATE_INTERVAL);

    // Update on visibility change
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        updatePresence();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    
    // Update on user activity (click, keypress, mouse move)
    let activityTimeout: NodeJS.Timeout;
    const handleActivity = () => {
      clearTimeout(activityTimeout);
      activityTimeout = setTimeout(updatePresence, 1000); // Debounce activity updates
    };
    
    window.addEventListener('click', handleActivity, { passive: true });
    window.addEventListener('keydown', handleActivity, { passive: true });
    window.addEventListener('mousemove', handleActivity, { passive: true });

    return () => {
      clearInterval(interval);
      clearTimeout(activityTimeout);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('mousemove', handleActivity);
    };
  }, [user?.id, updatePresence]);
};

export const isUserOnline = (lastSeen: string | null): boolean => {
  if (!lastSeen) return false;
  
  try {
    // Handle PostgreSQL TIMESTAMP (without timezone) - append 'Z' if no timezone info
    let normalizedLastSeen = lastSeen;
    
    // If the timestamp doesn't end with Z or have a timezone offset (+/-HH:MM), treat as UTC
    if (
      !normalizedLastSeen.endsWith('Z') && 
      !normalizedLastSeen.match(/[+-]\d{2}:\d{2}$/) &&
      !normalizedLastSeen.match(/[+-]\d{4}$/)
    ) {
      normalizedLastSeen = normalizedLastSeen + 'Z';
    }
    
    const lastSeenTime = new Date(normalizedLastSeen).getTime();
    if (isNaN(lastSeenTime)) return false;
    
    const diff = Date.now() - lastSeenTime;
    // User is considered online if last seen within 5 minutes
    // Also handle negative diff (clock skew) - consider online if within ±5 minutes
    return Math.abs(diff) < 5 * 60_000;
  } catch {
    return false;
  }
};