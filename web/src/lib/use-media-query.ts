"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Subscribe to a CSS media query.
 *
 * `useSyncExternalStore` rather than an effect + setState: the value is
 * external state, so React reads it during render and there is no flash of the
 * wrong variant. On the server it answers `serverValue`.
 */
export function useMediaQuery(query: string, serverValue = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

/** Tailwind's `md` breakpoint — the line where dialogs stop being sheets. */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 48rem)", true);
}
