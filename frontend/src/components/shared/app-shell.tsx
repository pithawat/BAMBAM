"use client";

import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AppNavbar } from "./app-navbar";
import { MeProvider, useMe } from "./me-provider";
import { RoleSwitcher, RoleSwitchToast } from "./role-switcher";
import { ErrorState } from "./states";

/**
 * App shell for every (app) route (_common.md §1, CR-010): role switcher strip (dev/UAT only) · top navbar ·
 * content (phone / tablet max 560px, desktop max 1280px). No sidebar and no bottom nav.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <MeProvider>
      <RoleSwitchToast />
      <ShellFrame>{children}</ShellFrame>
    </MeProvider>
  );
}

function ShellFrame({ children }: { children: ReactNode }) {
  const state = useMe();

  if (state.status === "loading") return <ShellSkeleton />;
  if (state.status === "error") {
    return (
      <main className="mx-auto max-w-140 pt-16">
        <ErrorState onRetry={state.reload} />
      </main>
    );
  }

  return (
    <div className="min-h-svh bg-background">
      <RoleSwitcher />
      <AppNavbar me={state.me} />
      <main className="min-w-0 pb-6 lg:px-8 lg:pt-2 lg:pb-8 print:p-0">
        <div className="mx-auto w-full max-w-140 lg:max-w-7xl print:max-w-none">{children}</div>
      </main>
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="min-h-svh" aria-busy="true" aria-label="กำลังโหลด">
      <div className="lg:mt-3 lg:px-8">
        <div className="mx-auto border-b bg-card lg:max-w-7xl lg:rounded-2xl lg:border">
          <div className="flex h-15 items-center gap-3 px-4 lg:h-19 lg:px-5">
            <Skeleton className="h-7 w-24" />
            <div className="hidden flex-1 gap-2 lg:flex">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-28 rounded-lg" />
              ))}
            </div>
            <Skeleton className="ml-auto size-10 rounded-full" />
          </div>
          <div className="grid h-12 grid-cols-3 gap-3 border-t px-4 py-3 lg:hidden">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-full" />
            ))}
          </div>
        </div>
      </div>
      <div className="mx-auto w-full max-w-140 space-y-3 px-4 pt-5 lg:max-w-7xl lg:px-8">
        <Skeleton className="h-10 w-60" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    </div>
  );
}
