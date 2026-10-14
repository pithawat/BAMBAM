"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarProvider } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { AppSidebar } from "./app-sidebar";
import { BOTTOM_NAV_PATHS, BottomNav } from "./bottom-nav";
import { MeProvider, useMe } from "./me-provider";
import { RoleSwitchToast } from "./role-switcher";
import { ErrorState } from "./states";

/**
 * App shell for every (app) route (_common.md §1, D-008 adaptive):
 * desktop (≥ lg) = 256px sidebar + content max 1280px; mobile = content max 560px + bottom nav.
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
  const showBottomNav = BOTTOM_NAV_PATHS.includes(pathname);

  if (state.status === "loading") return <ShellSkeleton />;
  if (state.status === "error") {
    return (
      <main className="mx-auto max-w-140 pt-16">
        <ErrorState onRetry={state.reload} />
      </main>
    );
  }

  return (
    <SidebarProvider className="min-h-svh bg-background">
      <div className="sticky top-0 hidden h-svh lg:block">
        <AppSidebar me={state.me} />
      </div>
      <main className={cn("min-w-0 flex-1 lg:px-8 lg:pt-4.5 lg:pb-7", showBottomNav && "pb-28")}>
        <div className="mx-auto w-full max-w-140 lg:max-w-7xl">{children}</div>
      </main>
      {showBottomNav && <BottomNav />}
    </SidebarProvider>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-svh" aria-busy="true" aria-label="กำลังโหลด">
      <div className="hidden w-64 flex-col gap-3 bg-card p-5 lg:flex">
        <Skeleton className="h-7 w-32" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-full rounded-sm" />
        ))}
      </div>
      <div className="mx-auto w-full max-w-140 flex-1 lg:max-w-7xl lg:px-8 lg:pt-5">
        <Skeleton className="h-40 w-full rounded-none rounded-b-[34px] lg:h-11 lg:w-60 lg:rounded-full" />
        <div className="space-y-3 px-4 pt-4 lg:px-0">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
