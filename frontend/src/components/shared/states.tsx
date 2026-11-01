"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MascotPanel } from "./mascot";

// Shared state patterns — design-system.md "Patterns" and _common.md §6 copy.

type EmptyStateProps = {
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
};

/** CR-035: compact primary panel — mascot `guide` + H3 title + one-line hint + one small button. */
export function EmptyState({ title, hint, action, className }: EmptyStateProps) {
  return (
    <MascotPanel as="div" pose="guide" size={[72, 96]} className={cn("py-4 sm:py-5", className)}>
      <h3 className="font-heading text-base leading-7 font-semibold">{title}</h3>
      {hint && <p className="text-[13.5px] text-primary-foreground/85">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </MascotPanel>
  );
}

type ErrorStateProps = {
  title?: string;
  hint?: string;
  onRetry?: () => void;
  /** `page` = whole page failed (mascot + retry); `inline` = part of the page (Alert + outline retry). */
  variant?: "page" | "inline";
  className?: string;
};

export function ErrorState({
  title = "โหลดข้อมูลไม่สำเร็จ",
  hint = "ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง",
  onRetry,
  variant = "page",
  className,
}: ErrorStateProps) {
  if (variant === "inline") {
    return (
      <div className={cn("space-y-3", className)}>
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <AlertTitle className="font-semibold">{title}</AlertTitle>
          <AlertDescription>{hint}</AlertDescription>
        </Alert>
        {onRetry && (
          <Button variant="outline" className="w-full" onClick={onRetry}>
            ลองอีกครั้ง
          </Button>
        )}
      </div>
    );
  }
  return (
    <div role="alert" className={cn("px-4 py-10 lg:px-0", className)}>
      <MascotPanel as="div" pose="loading" size={[96, 140]} className="mx-auto max-w-2xl">
        <h2 className="font-heading text-xl leading-8 font-semibold">{title}</h2>
        <p className="mt-0.5 text-sm text-primary-foreground/85">{hint}</p>
        {onRetry && (
          <Button className="mt-4" onClick={onRetry}>
            ลองอีกครั้ง
          </Button>
        )}
      </MascotPanel>
    </div>
  );
}

type ForbiddenStateProps = {
  /** Short reason, per screen spec. */
  reason?: string;
  title?: string;
  /** The button; default "กลับหน้าแรก" → `/` (settings pages may point to another page, settings _common.md §1). */
  action?: { label: string; href: string };
  className?: string;
};

/** Primary panel: mascot `review` + "คุณไม่มีสิทธิ์เข้าหน้านี้" + reason + "กลับหน้าแรก". Never show partial data. */
export function ForbiddenState({
  reason,
  title = "คุณไม่มีสิทธิ์เข้าหน้านี้",
  action = { label: "กลับหน้าแรก", href: "/" },
  className,
}: ForbiddenStateProps) {
  return (
    <div className={cn("px-4 py-10 lg:px-0", className)}>
      <MascotPanel as="div" pose="review" size={[96, 140]} className="mx-auto max-w-2xl">
        <h2 className="font-heading text-xl leading-8 font-semibold">{title}</h2>
        {reason && <p className="mt-0.5 text-sm text-primary-foreground/85">{reason}</p>}
        <Button asChild className="mt-4">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      </MascotPanel>
    </div>
  );
}
