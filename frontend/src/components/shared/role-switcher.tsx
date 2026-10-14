"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { env } from "@/lib/env";
import { getDemoUsers, switchRole } from "@/lib/platform/api";
import { ROLE_LABELS } from "@/lib/platform/roles";
import { ROLES, type DemoUser, type Role } from "@/lib/platform/types";
import { cn } from "@/lib/utils";
import { useMe } from "./me-provider";

// S15 — dev/UAT role switcher (D-005). Not rendered unless NEXT_PUBLIC_ROLE_SWITCHER=true,
// and the backend route does not exist in production.

const TOAST_KEY = "bambam.roleSwitchToast";
const PICKER_HINT = "โหมดทดสอบ ใช้ผู้ใช้ตัวอย่าง ไม่เปลี่ยนสิทธิ์ของบัญชีจริง";

type Variant = "pill" | "strip" | "desktop";

export function RoleSwitcher({ variant, className }: { variant: Variant; className?: string }) {
  const meState = useMe();
  const [open, setOpen] = useState(false);
  if (!env.roleSwitcher || meState.status !== "ready") return null;

  const me = meState.me;
  const envLabel = me.environment ?? (env.useMocks ? "DEV" : null);
  if (!envLabel) return null; // production API → never show

  const roleLabel = ROLE_LABELS[me.role];
  const picker = (inSheet: boolean) => <RolePicker current={me.role} inSheet={inSheet} onDone={() => setOpen(false)} />;

  if (variant === "desktop") {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex h-11 items-center gap-1.5 rounded-full border border-dashed border-warning/50 bg-warning/10 pr-3.5 pl-2.5 text-xs font-medium text-warning",
              className,
            )}
          >
            <EnvChip label={envLabel} />
            <Eye className="size-3.5" aria-hidden />
            ดูในบทบาท: {roleLabel}
            <ChevronDown className="size-3.5" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-90 rounded-xl p-4">
          {picker(false)}
        </PopoverContent>
      </Popover>
    );
  }

  const trigger =
    variant === "pill" ? (
      <button
        type="button"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-white/20 py-1.5 pr-2.5 pl-2 text-xs font-medium text-white backdrop-blur-sm",
          className,
        )}
      >
        <EnvChip label={envLabel} />
        <Eye className="size-3.5" aria-hidden />
        ดูในบทบาท: {roleLabel}
        <ChevronDown className="size-3.5" aria-hidden />
      </button>
    ) : (
      <button
        type="button"
        className={cn(
          "flex h-7 w-full items-center justify-center gap-1 bg-warning/10 text-xs font-medium text-warning",
          className,
        )}
      >
        <span className="font-bold tracking-wide">{envLabel}</span> · กำลังดูในบทบาท: {roleLabel} ·{" "}
        <span className="underline underline-offset-2">เปลี่ยน</span>
      </button>
    );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-[26px] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {picker(true)}
      </SheetContent>
    </Sheet>
  );
}

function EnvChip({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[10.5px] font-bold tracking-wider text-warning">
      {label}
    </span>
  );
}

function RolePicker({ current, inSheet, onDone }: { current: Role; inSheet: boolean; onDone: () => void }) {
  const [demoUsers, setDemoUsers] = useState<DemoUser[] | null>(null);
  const [picked, setPicked] = useState<Role>(current);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getDemoUsers()
      .then(setDemoUsers)
      .catch(() => setDemoUsers([]));
  }, []);

  const nameOf = (r: Role) => demoUsers?.find((d) => d.role === r)?.name;

  async function submit() {
    setBusy(true);
    try {
      await switchRole(picked);
      try {
        window.sessionStorage.setItem(TOAST_KEY, `กำลังดูในบทบาท ${ROLE_LABELS[picked]}`);
      } catch {
        // ignore
      }
      onDone();
      // Hard navigation drops every cached piece of data from the previous user (S15).
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- hard navigation on purpose: drop all client state
      window.location.assign("/");
    } catch {
      toast.error("สลับบทบาทไม่สำเร็จ ลองอีกครั้ง");
      setBusy(false);
    }
  }

  return (
    <div>
      {inSheet ? (
        <SheetHeader className="p-0 text-left">
          <SheetTitle className="font-heading text-base font-semibold">ดูในบทบาท</SheetTitle>
          <SheetDescription className="text-[12.5px]">{PICKER_HINT}</SheetDescription>
        </SheetHeader>
      ) : (
        <div>
          <h3 className="font-heading text-base font-semibold">ดูในบทบาท</h3>
          <p className="text-[12.5px] text-muted-foreground">{PICKER_HINT}</p>
        </div>
      )}
      <RadioGroup
        value={picked}
        onValueChange={(v) => setPicked(v as Role)}
        className="mt-3 gap-1"
        aria-label="เลือกบทบาท"
      >
        {ROLES.map((r) => (
          <label
            key={r}
            htmlFor={`role-${r}`}
            className={cn(
              "flex min-h-13 cursor-pointer items-center gap-3 rounded-sm px-3 py-2",
              picked === r ? "bg-secondary" : "hover:bg-muted",
            )}
          >
            <RadioGroupItem id={`role-${r}`} value={r} />
            <span className="min-w-0">
              <span className="block font-heading text-[15px] leading-6 font-semibold">{ROLE_LABELS[r]}</span>
              <span className="block text-[13.5px] text-muted-foreground">
                {nameOf(r) ? `${nameOf(r)} (ตัวอย่าง)` : " "}
              </span>
            </span>
          </label>
        ))}
      </RadioGroup>
      <Button className="mt-4 w-full" disabled={picked === current || busy} onClick={submit}>
        {busy && <Loader2 className="animate-spin" aria-hidden />}
        สลับบทบาท
      </Button>
    </div>
  );
}

/** Shows the success toast after the reload that follows a role switch. */
export function RoleSwitchToast() {
  useEffect(() => {
    try {
      const msg = window.sessionStorage.getItem(TOAST_KEY);
      if (msg) {
        window.sessionStorage.removeItem(TOAST_KEY);
        toast.success(msg);
      }
    } catch {
      // ignore
    }
  }, []);
  return null;
}
