"use client";

import { useEffect } from "react";

/** Default poll cadence, matching the notifications bell. */
export const POLL_MS = 30000;

/**
 * Keep a view fresh without realtime infra: refetch when the tab regains focus
 * or becomes visible, and poll on an interval while the tab is visible. Used so
 * a booking changed by the other participant surfaces on the open tab.
 *
 * `refetch` should be stable (wrap it in useCallback).
 */
export function useRefreshOnFocus(refetch: () => void, intervalMs: number = POLL_MS) {
  useEffect(() => {
    const onFocus = () => {
      if (!document.hidden) refetch();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    const timer = setInterval(() => {
      if (!document.hidden) refetch();
    }, intervalMs);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      clearInterval(timer);
    };
  }, [refetch, intervalMs]);
}
