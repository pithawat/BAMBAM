"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Info, Settings, type LucideIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import type { Me } from "@/lib/platform/types";
import { cn } from "@/lib/utils";
import { settingsMenu, settingsMenuCurrent, type SettingsMenuGroup, type SettingsMenuItem } from "../nav";

// The navbar "ตั้งค่าระบบ" menu (settings _common.md §2, CR-006; layout from mockups/CR-006-design/App.tsx, colours and
// fonts from the design system). Desktop: a dropdown — groups on the left (icon, name, one line, `>`), the hovered
// group's sub-menus on the right (no `>`, a check on the current page). Phones: a sheet — groups, then the tapped
// group's sub-menus. Groups and items without permission are left out (`settingsMenu`).

/** The current item, read when the menu opens (the S20 tab lives in `?tab=`). */
function useCurrent() {
  const pathname = usePathname();
  return () => settingsMenuCurrent(pathname, new URLSearchParams(window.location.search).get("tab"));
}

const groupOf = (groups: SettingsMenuGroup[], current: string | null) =>
  Math.max(0, groups.findIndex((g) => g.items.some((i) => i.href === current)));

function IconBadge({ icon: Icon, active }: { icon: LucideIcon; active: boolean }) {
  return (
    <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", active ? "bg-primary/12 text-primary" : "bg-muted text-muted-foreground")}>
      <Icon className="size-4.5" aria-hidden />
    </span>
  );
}

function SoonChip() {
  return <span className="rounded-sm bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">เร็ว ๆ นี้</span>;
}

function SubItem({ item, current, onNavigate }: { item: SettingsMenuItem; current: string | null; onNavigate: () => void }) {
  const cls = "flex min-h-11 items-center justify-between gap-2 rounded-lg px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30";
  if (item.soon) {
    return (
      <div className={cn(cls, "cursor-default text-muted-foreground")} aria-disabled>
        {item.label}
        <SoonChip />
      </div>
    );
  }
  const active = item.href === current;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(cls, active ? "bg-secondary font-semibold text-primary" : "text-foreground hover:bg-muted")}
    >
      {item.label}
      {active && <Check className="size-4 shrink-0" aria-hidden />}
    </Link>
  );
}

/** Desktop (≥ 1024px) trigger + dropdown. */
export function SettingsMenuDesktop({ me }: { me: Me }) {
  const groups = settingsMenu(me);
  const readCurrent = useCurrent();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const [hovered, setHovered] = useState(0);
  if (groups.length === 0) return null;
  const group = groups[Math.min(hovered, groups.length - 1)];

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (o) {
          const c = readCurrent();
          setCurrent(c);
          setHovered(groupOf(groups, c));
        }
        setOpen(o);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex min-h-11 items-center gap-2 rounded-lg px-3.5 text-sm font-medium whitespace-nowrap text-primary outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/30",
            open ? "bg-primary/15" : "bg-secondary hover:bg-primary/12",
          )}
        >
          <Settings className="size-4.5" aria-hidden />
          ตั้งค่าระบบ
          <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={14} className="w-141 overflow-hidden rounded-2xl p-0 shadow-float" aria-label="การตั้งค่าระบบ">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <span className="font-heading text-base font-semibold">การตั้งค่าระบบ</span>
          <span className="text-[10px] font-medium tracking-[0.17em] text-muted-foreground">SETTINGS</span>
        </div>
        <div className="grid grid-cols-2">
          <div role="group" aria-label="กลุ่มการตั้งค่า" className="space-y-0.5 border-r p-2.5">
            {groups.map((g, i) => (
              <button
                key={g.key}
                type="button"
                aria-pressed={group.key === g.key}
                onMouseEnter={() => setHovered(i)}
                onFocus={() => setHovered(i)}
                onClick={() => setHovered(i)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
                  group.key === g.key ? "bg-secondary text-primary" : "text-foreground hover:bg-muted",
                )}
              >
                <IconBadge icon={g.icon} active={group.key === g.key} />
                <span className="min-w-0 flex-1">
                  <b className="block text-sm font-semibold">{g.name}</b>
                  <span className="block text-xs text-muted-foreground">{g.description}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            ))}
          </div>
          <nav aria-label={group.name} className="flex flex-col gap-0.5 px-3 py-4">
            <span className="mx-3 mb-2 text-xs font-medium text-muted-foreground">{group.name}</span>
            {group.items.map((item) => (
              <SubItem key={item.label} item={item} current={current} onNavigate={() => setOpen(false)} />
            ))}
            <p className="mx-3 mt-auto flex items-center gap-1.5 pt-5 text-xs text-muted-foreground">
              <Info className="size-3.5 shrink-0" aria-hidden />
              จัดการทุกอย่างได้ในที่เดียว
            </p>
          </nav>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Phones / tablets (< 1024px): icon button + a sheet — groups, then the tapped group's sub-menus. */
export function SettingsMenuMobile({ me }: { me: Me }) {
  const groups = settingsMenu(me);
  const readCurrent = useCurrent();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  if (groups.length === 0) return null;
  const group = picked === null ? null : groups[Math.min(picked, groups.length - 1)];

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label="ตั้งค่าระบบ"
        aria-haspopup="dialog"
        onClick={() => {
          setCurrent(readCurrent());
          setPicked(null);
          setOpen(true);
        }}
        className="grid size-11 place-items-center rounded-lg text-primary outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/30"
      >
        <Settings className="size-5" aria-hidden />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-80 max-w-[85vw] gap-0 overflow-y-auto p-0"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            trigger.current?.focus();
          }}
        >
          <SheetTitle className="border-b px-5 py-4 font-heading text-base font-semibold">การตั้งค่าระบบ</SheetTitle>
          <SheetDescription className="sr-only">เลือกกลุ่ม แล้วเลือกหน้าที่ต้องการ</SheetDescription>
          {group ? (
            <nav aria-label={group.name} className="flex flex-col gap-0.5 p-3">
              <button
                type="button"
                onClick={() => setPicked(null)}
                className="mb-1 flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30"
              >
                <ChevronLeft className="size-4" aria-hidden />
                กลุ่มทั้งหมด
              </button>
              <span className="mx-3 mb-1 text-xs font-medium text-muted-foreground">{group.name}</span>
              {group.items.map((item) => (
                <SubItem key={item.label} item={item} current={current} onNavigate={() => setOpen(false)} />
              ))}
            </nav>
          ) : (
            <div role="group" aria-label="กลุ่มการตั้งค่า" className="space-y-0.5 p-3">
              {groups.map((g, i) => {
                const here = g.items.some((it) => it.href === current);
                return (
                  <button
                    key={g.key}
                    type="button"
                    onClick={() => setPicked(i)}
                    className="flex min-h-14 w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30"
                  >
                    <IconBadge icon={g.icon} active={here} />
                    <span className="min-w-0 flex-1">
                      <b className="block text-sm font-semibold">{g.name}</b>
                      <span className="block text-xs text-muted-foreground">{g.description}</span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </button>
                );
              })}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
