"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useCurrentUser } from "@/components/shared/me-provider";
import { ForbiddenState } from "@/components/shared/states";
import { canAnySettings } from "@/lib/platform/permissions";
import { settingsAccess, settingsHeading, settingsPageOf } from "../nav";
import { SettingsHeading } from "./settings-heading";

// Settings page frame (settings _common.md §2, CR-006): the app navbar (with its "ตั้งค่าระบบ" dropdown) stays on top —
// app-shell.tsx renders it — and this frame holds the page. Access per page comes from `settingsAccess` (nav.ts);
// without it the page content is never rendered.

export function SettingsShell({ children }: { children: ReactNode }) {
  const me = useCurrentUser();
  const pathname = usePathname();

  if (!canAnySettings(me)) {
    // No settings permission at all: Forbidden on its own (BR-ALL-1).
    const a = settingsAccess(me, pathname);
    return (
      <main className="mx-auto max-w-140 px-4 pt-16">
        {!a.allowed && <ForbiddenState title={a.title} reason={a.reason} action={a.action} />}
      </main>
    );
  }

  const access = settingsAccess(me, pathname);
  const page = settingsPageOf(pathname);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pt-6 pb-10 lg:px-10 lg:pt-8 lg:pb-12">
      {/* `/settings` itself (no page) renders its redirect to the first allowed page. */}
      {access.allowed || !page ? (
        children
      ) : (
        <>
          {page && <SettingsHeading {...settingsHeading(page)} />}
          <section className="rounded-xl border bg-card shadow-card">
            <ForbiddenState title={access.title} reason={access.reason} action={access.action} />
          </section>
        </>
      )}
    </main>
  );
}
