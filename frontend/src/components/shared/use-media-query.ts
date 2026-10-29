"use client";

import { useCallback, useSyncExternalStore } from "react";

/** `lg` — the adaptive layout switch (D-008). */
export const DESKTOP_QUERY = "(min-width: 1024px)";

/** Live media-query match. Server render and first paint assume `false` (mobile). */
export function useMediaQuery(query: string) {
  const subscribe = useCallback((callback: () => void) => {
    const media = window.matchMedia(query);
    media.addEventListener("change", callback);
    return () => media.removeEventListener("change", callback);
  }, [query]);
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}

export function useIsDesktop() {
  return useMediaQuery(DESKTOP_QUERY);
}
