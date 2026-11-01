"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, Home, LogOut, Settings, UserRound } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { canAnySettings, repairHome, usesService, type ServiceKey } from "@/lib/platform/permissions";
import { initials } from "@/lib/platform/roles";
import type { Me } from "@/lib/platform/types";
import { applyTheme, currentTheme, THEMES, type ThemeId } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { SettingsMenuDesktop, SettingsMenuMobile } from "@/modules/settings/components/settings-menu";
import { LogoutDialog } from "./logout-dialog";
import { SERVICES, type Service } from "./service-icon";

// Top navigation on every page, settings included (_common.md §1, CR-010; settings CR-006 layout from
// mockups/CR-006-design/App.tsx, flush with the top and side edges — owner 2026-11-01). repair CR-034 (D-138,
// `changes/CR-034/navbar.html`): stacked BAMBAM / WORKPLACE lock-up (option B) close to the left edge · หน้าแรก · the
// services the user may use (`usesService`; a technician sees only แจ้งซ่อม) · on the right the "ตั้งค่าระบบ" gear
// (option A, any `settings.*` permission) and the account menu (no bell, repair CR-024). Repair tracking and staff tools live in the repair
// section nav (modules/repair/components/repair-nav.tsx). Desktop: sticky full-width bar. Phone / tablet: brand row
// (+ settings sheet) and a row of the services; it scrolls away so route-local sticky bars keep the top edge.

type ServiceLink = { service: Service & ServiceKey; href: string; match: string };

function serviceLinks(me: Me): ServiceLink[] {
  const links: ServiceLink[] = [
    // Whoever works tickets starts at the work list (CR-005, `repair.ticket.work`); everyone else tracks their own.
    { service: "repair", href: repairHome(me), match: "/repair" },
    { service: "car", href: "/car-booking", match: "/car-booking" },
    { service: "room", href: "/room-booking", match: "/room-booking" },
  ];
  return links.filter((l) => usesService(me, l.service));
}

// phone service row: one column per visible service (static classes for Tailwind)
const SERVICE_COLS = ["hidden", "grid-cols-1", "grid-cols-2", "grid-cols-3"];

const within = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

export function AppNavbar({ me }: { me: Me }) {
  const pathname = usePathname();
  const links = serviceLinks(me);
  const home = pathname === "/";
  const settings = canAnySettings(me);

  return (
    <header className="border-b bg-card print:hidden lg:sticky lg:top-0 lg:z-30">
      <div className="flex h-15 items-center gap-2 pr-2 pl-3 lg:h-20 lg:gap-0 lg:pr-4 lg:pl-5">
        <Link
          href="/"
          aria-label="BAMBAM หน้าแรก"
          className="flex shrink-0 flex-col items-start gap-0.75 rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30 lg:mr-14"
        >
          <Image src="/brand/bam-logo.webp" alt="BAMBAM" width={96} height={31} className="h-7 w-auto lg:h-7.5" priority />
          <span className="pl-0.5 text-[9px] leading-none font-semibold tracking-[0.32em] text-muted-foreground">WORKPLACE</span>
        </Link>

        <nav aria-label="บริการหลัก" className="hidden h-full min-w-0 flex-1 items-center gap-1 lg:flex">
          <Link href="/" aria-current={home ? "page" : undefined} className={desktopItem(home)}>
            <Home className="size-4.5" aria-hidden />
            หน้าแรก
          </Link>
          {links.map(({ service, href, match }) => {
            const s = SERVICES[service];
            const active = within(pathname, match);
            return (
              <Link key={service} href={href} aria-current={active ? "page" : undefined} className={desktopItem(active)}>
                <s.icon className="size-4.5" aria-hidden />
                {s.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-0.5 lg:gap-1.5">
          {settings && (
            <>
              <div className="lg:hidden">
                <SettingsMenuMobile me={me} />
              </div>
              <div className="hidden lg:block">
                <SettingsMenuDesktop me={me} />
              </div>
            </>
          )}
          <AccountMenu me={me} />
        </div>
      </div>

      <nav aria-label="บริการหลัก" className={cn("grid border-t lg:hidden", SERVICE_COLS[links.length])}>
        {links.map(({ service, href, match }) => {
          const s = SERVICES[service];
          const active = within(pathname, match);
          return (
            <Link
              key={service}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-12 items-center justify-center gap-1.5 border-b-2 px-1 text-center text-[13.5px] leading-tight font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:ring-inset",
                active ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground",
              )}
            >
              <s.icon className="size-4 shrink-0" aria-hidden />
              {s.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

function desktopItem(active: boolean) {
  return cn(
    "flex min-h-11 items-center gap-2 rounded-lg px-3.5 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/30",
    active ? "bg-secondary font-semibold text-primary" : "text-muted-foreground hover:bg-muted hover:text-primary",
  );
}

/** Avatar → โปรไฟล์ · ธีมสี (D-069) · ออกจากระบบ (logout keeps the S14 confirm). Escape and outside click close it; focus returns to the trigger. */
function AccountMenu({ me }: { me: Me }) {
  const [open, setOpen] = useState(false);
  const [logout, setLogout] = useState(false);
  const [theme, setTheme] = useState<ThemeId>("default");
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  function onMenuKey(e: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const items = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? []);
    const at = items.indexOf(document.activeElement as HTMLElement);
    const next = e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : (at + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  }

  const item = "flex min-h-11 w-full items-center gap-2.5 rounded-sm px-3 text-sm font-medium outline-none hover:bg-muted focus-visible:bg-muted";
  return (
    <>
      <Popover open={open} onOpenChange={(o) => { if (o) setTheme(currentTheme()); setOpen(o); }}>
        <PopoverTrigger asChild>
          <button
            ref={trigger}
            type="button"
            aria-label={`เมนูบัญชี ${me.name}`}
            aria-haspopup="menu"
            className="flex min-h-11 items-center gap-2.5 rounded-full outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30 lg:rounded-xl lg:py-1 lg:pr-2 lg:pl-1"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-[13px] font-semibold text-primary ring-4 ring-secondary/50">{initials(me.name)}</span>
            <span className="hidden max-w-40 min-w-0 text-left leading-tight lg:block">
              <b className="block truncate text-sm font-semibold">{me.name}</b>
              <span className="block truncate text-xs text-muted-foreground">{me.roleName}</span>
            </span>
            <ChevronDown className="hidden size-4 text-muted-foreground lg:block" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-64 rounded-xl p-1.5"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
          }}
        >
          <div className="border-b px-3 pt-1.5 pb-2.5 lg:hidden">
            <b className="block truncate text-sm font-semibold">{me.name}</b>
            <span className="block truncate text-xs text-muted-foreground">{me.roleName}</span>
          </div>
          <div ref={menu} role="menu" aria-label="เมนูบัญชี" onKeyDown={onMenuKey} className="pt-1 lg:pt-0">
            <Link href="/profile" role="menuitem" className={item} onClick={() => setOpen(false)}>
              <UserRound className="size-4.5 text-muted-foreground" aria-hidden />
              โปรไฟล์
            </Link>
            {canAnySettings(me) && (
              <Link href="/settings" role="menuitem" className={item} onClick={() => setOpen(false)}>
                <Settings className="size-4.5 text-muted-foreground" aria-hidden />
                ตั้งค่าระบบ
              </Link>
            )}
            <div role="group" aria-labelledby="theme-label" className="my-1 border-y py-1">
              <span id="theme-label" className="block px-3 pt-1.5 pb-1 text-xs text-muted-foreground">ธีมสี</span>
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={theme === t.id}
                  className={cn(item, "font-normal")}
                  onClick={() => {
                    applyTheme(t.id);
                    setTheme(t.id);
                  }}
                >
                  <span aria-hidden className="flex shrink-0 -space-x-1">
                    {t.swatches.map((c) => <span key={c} className="size-3.5 rounded-full ring-2 ring-popover" style={{ backgroundColor: c }} />)}
                  </span>
                  <span className="min-w-0 flex-1 text-left leading-tight">
                    <b className="block font-medium">{t.label}</b>
                    <span className="block truncate text-xs text-muted-foreground">{t.hint}</span>
                  </span>
                  {theme === t.id && <Check className="size-4 shrink-0 text-primary" aria-hidden />}
                </button>
              ))}
            </div>
            <button
              type="button"
              role="menuitem"
              className={item}
              onClick={() => {
                setOpen(false);
                setLogout(true);
              }}
            >
              <LogOut className="size-4.5 text-muted-foreground" aria-hidden />
              ออกจากระบบ
            </button>
          </div>
        </PopoverContent>
      </Popover>
      <LogoutDialog
        open={logout}
        onOpenChange={setLogout}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          trigger.current?.focus();
        }}
      />
    </>
  );
}
