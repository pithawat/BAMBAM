"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useRef, useState, type ReactNode, type RefObject } from "react";
import { X } from "lucide-react";
import { useCurrentUser } from "@/components/shared/me-provider";
import { RoleSwitcher } from "@/components/shared/role-switcher";
import { ForbiddenState } from "@/components/shared/states";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { canAnySettings } from "@/lib/platform/permissions";
import { cn } from "@/lib/utils";
import { settingsAccess, settingsHeading, settingsNav, settingsPageOf, type SettingsNavItem } from "../nav";
import { SettingsHeading } from "./settings-heading";

// Administration shell (settings _common.md §1–§2, CR-001 / CR-002 / CR-004; design mockups/CR-001-admin-settings.html):
// fixed 232px sidebar ≥ 1024px, the same content in a left drawer below. No top bar, no bottom nav. Access per page
// comes from `settingsAccess` (nav.ts); without it the page content is never rendered.

type ShellNav = { openNav: () => void; menuButton: RefObject<HTMLButtonElement | null> };

const ShellNavContext = createContext<ShellNav | null>(null);

/** For the page heading's menu button (< 1024px). */
export function useShellNav(): ShellNav {
  const ctx = useContext(ShellNavContext);
  if (!ctx) throw new Error("useShellNav must be used inside <SettingsShell>");
  return ctx;
}

export function SettingsShell({ children }: { children: ReactNode }) {
  const me = useCurrentUser();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  // Navigating closes the drawer.
  const [shownPath, setShownPath] = useState(pathname);
  if (shownPath !== pathname) {
    setShownPath(pathname);
    setOpen(false);
  }

  if (!canAnySettings(me)) {
    // No settings permission at all: Forbidden on its own, no sidebar (BR-ALL-1).
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
    <ShellNavContext.Provider value={{ openNav: () => setOpen(true), menuButton }}>
      <aside aria-label="เมนูหลัก" className="fixed inset-y-0 left-0 z-30 hidden w-58 flex-col overflow-y-auto border-r bg-sidebar px-4 pb-4 lg:flex">
        <SidebarContent />
      </aside>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-66 gap-0 overflow-y-auto bg-sidebar px-4 pb-4 lg:hidden"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            menuButton.current?.focus();
          }}
        >
          <SheetTitle className="sr-only">เมนูหลัก</SheetTitle>
          <SheetDescription className="sr-only">เมนูตั้งค่าระบบและบริการ</SheetDescription>
          {/* Radix moves focus into the drawer, traps Tab and closes on Escape / overlay; the rest is inert. */}
          <SidebarContent onClose={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="min-h-svh lg:pl-58">
        <main className="mx-auto w-full max-w-7xl px-4 pt-6 pb-10 lg:px-10 lg:pt-10 lg:pb-12">
          {/* `/settings` itself (no page) renders its redirect to อาคารและอุปกรณ์. */}
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
      </div>
    </ShellNavContext.Provider>
  );
}

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const me = useCurrentUser();
  const pathname = usePathname();
  const current = settingsPageOf(pathname);
  const groups = settingsNav(me);

  return (
    <>
      <div className="flex min-h-23 items-start justify-between gap-2 px-2 pt-7 pb-6 lg:min-h-26">
        <div className="flex flex-col gap-2">
          <Image src="/brand/bam-logo.webp" alt="BAMBAM" width={104} height={34} className="h-auto w-26" priority />
          <span className="text-sm font-medium text-muted-foreground">ตั้งค่าระบบ</span>
        </div>
        {onClose && (
          <button
            type="button"
            aria-label="ปิดเมนู"
            onClick={onClose}
            className="-mt-2 -mr-2 grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            <X className="size-5" aria-hidden />
          </button>
        )}
      </div>

      {groups.map((g, gi) => (
        <div key={g.label} className="mb-5">
          <p id={`settings-nav-${gi}`} className="mb-1.5 px-2 text-xs text-muted-foreground">
            {g.label}
          </p>
          <nav aria-labelledby={`settings-nav-${gi}`}>
            <ul className="space-y-0.5">
              {g.items.map((item) => (
                <li key={item.label}>
                  <NavItem item={item} active={!!item.page && item.page === current} onNavigate={onClose} />
                </li>
              ))}
            </ul>
          </nav>
        </div>
      ))}

      <div className="min-h-6 flex-1" />
      <div className="border-t pt-3">
        <RoleSwitcher variant="sidebar" />
      </div>
    </>
  );
}

const itemClass = "flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30";

function NavItem({ item, active, onNavigate }: { item: SettingsNavItem; active: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  if (item.soon) {
    return (
      <div className={cn(itemClass, "cursor-default text-muted-foreground")}>
        <Icon className="size-4.5 shrink-0" aria-hidden />
        <span className="flex-1">{item.label}</span>
        <span className="rounded-sm bg-muted px-1.5 py-0.5 text-xs">เร็ว ๆ นี้</span>
      </div>
    );
  }
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(itemClass, active ? "bg-secondary font-semibold text-primary" : "text-foreground hover:bg-muted")}
    >
      <Icon className={cn("size-4.5 shrink-0", active ? "text-primary" : "text-muted-foreground")} aria-hidden />
      <span className="flex-1">{item.label}</span>
    </Link>
  );
}
