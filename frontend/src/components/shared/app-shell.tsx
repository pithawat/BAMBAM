"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { AppBottomNav, AppNavbar, useTyping } from "./app-navbar";
import { MeProvider, useMe } from "./me-provider";
import { RoleSwitcher, RoleSwitchToast } from "./role-switcher";
import { ErrorState } from "./states";

/**
 * App shell for every (app) route (_common.md §1, CR-010): role switcher strip (dev/UAT only) · top navbar ·
 * content (phone / tablet max 560px, desktop max 1280px) · phone / tablet bottom tab bar (repair CR-040). No sidebar.
 * `/settings/**` (settings CR-006): same strip and navbar, no width frame — `app/(app)/settings/layout.tsx` renders
 * the settings page frame.
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
  const pathname = usePathname();
  const typing = useTyping();

  if (state.status === "loading") return <ShellSkeleton />;
  if (state.status === "error") {
    return (
      <main className="mx-auto max-w-140 pt-16">
        <ErrorState onRetry={state.reload} />
      </main>
    );
  }

  return (
    // repair CR-040: phones / tablets get a fixed bottom tab bar. `--app-bottom` = its height (0 on desktop and
    // while typing, when it steps aside); route-local sticky / fixed bottom bars sit on it. The padding keeps the
    // page end above the bar.
    <div
      data-typing={typing || undefined}
      className="group/shell min-h-svh bg-background pb-[calc(4rem+env(safe-area-inset-bottom))] [--app-bottom:calc(4rem+env(safe-area-inset-bottom))] data-typing:[--app-bottom:0px] lg:pb-0 lg:[--app-bottom:0px] print:pb-0"
    >
      <RoleSwitcher />
      <AppNavbar me={state.me} />
      {isSettingsPath(pathname) ? (
        children
      ) : (
        <main className="min-w-0 pb-6 lg:px-8 lg:pt-5 lg:pb-8 print:p-0">
          <div className="mx-auto w-full max-w-140 lg:max-w-7xl print:max-w-none">{children}</div>
        </main>
      )}
      <AppBottomNav me={state.me} />
    </div>
  );
}

const isSettingsPath = (p: string) => p === "/settings" || p.startsWith("/settings/");

function ShellSkeleton() {
  return (
    <div className="min-h-svh" aria-busy="true" aria-label="กำลังโหลด">
      <div>
        <div className="border-b bg-card">
          <div className="flex h-15 items-center gap-3 px-4 lg:h-20 lg:px-10 xl:px-12">
            <Skeleton className="h-7 w-24" />
            <div className="hidden flex-1 gap-2 lg:flex">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-28 rounded-lg" />
              ))}
            </div>
            <Skeleton className="ml-auto size-10 rounded-full" />
          </div>

        </div>
      </div>
      <div className="mx-auto w-full max-w-140 space-y-3 px-4 pt-5 lg:max-w-7xl lg:px-8">
        <Skeleton className="h-10 w-60" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
      <div className="fixed inset-x-0 bottom-0 grid h-[calc(4rem+env(safe-area-inset-bottom))] grid-cols-4 gap-6 border-t bg-card px-6 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:hidden">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-full rounded-full" />
        ))}
      </div>
    </div>
  );
}
