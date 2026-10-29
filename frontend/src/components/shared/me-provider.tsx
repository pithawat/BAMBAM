"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getMe } from "@/lib/platform/api";
import type { Me } from "@/lib/platform/types";

type MeState =
  | { status: "loading"; me: null; reload: () => void }
  | { status: "error"; me: null; reload: () => void }
  | { status: "ready"; me: Me; reload: () => void };

const MeContext = createContext<MeState | null>(null);

/**
 * Loads GET /api/v1/me once for the app shell. The FE builds menus from it but
 * never relies on it for security — the API checks every request.
 */
export function MeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ status: "loading" | "error" | "ready"; me: Me | null }>({
    status: "loading",
    me: null,
  });

  const fetchMe = useCallback(() => {
    getMe()
      .then((me) => setState({ status: "ready", me }))
      .catch(() => setState({ status: "error", me: null }));
  }, []);

  useEffect(fetchMe, [fetchMe]);

  const reload = useCallback(() => {
    setState({ status: "loading", me: null });
    fetchMe();
  }, [fetchMe]);

  return <MeContext.Provider value={{ ...state, reload } as MeState}>{children}</MeContext.Provider>;
}

export function useMe(): MeState {
  const ctx = useContext(MeContext);
  if (!ctx) throw new Error("useMe must be used inside <MeProvider>");
  return ctx;
}

/** For components that render only after the shell has loaded the user. */
export function useCurrentUser(): Me {
  const s = useMe();
  if (s.status !== "ready") throw new Error("useCurrentUser called before /me loaded");
  return s.me;
}
