"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Mascot } from "./mascot";

// Shared state patterns — design-system.md "Patterns" and _common.md §6 copy.

type EmptyStateProps = {
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
};

/** Soft card + mascot `guide` ~120px + H3 title + one-line hint + one small button. */
export function EmptyState({ title, hint, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-xl bg-linear-to-b from-secondary to-status-resolved/5 px-6 py-8 text-center",
        className,
      )}
    >
      <Mascot pose="guide" size={120} />
      <h3 className="mt-3 font-heading text-base font-semibold">{title}</h3>
      {hint && <p className="mt-1 text-[13.5px] text-muted-foreground">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
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
    <div role="alert" className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      <Mascot pose="loading" size={140} />
      <h2 className="mt-4 font-heading text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-[13.5px] text-muted-foreground">{hint}</p>
      {onRetry && (
        <Button className="mt-5" onClick={onRetry}>
          ลองอีกครั้ง
        </Button>
      )}
    </div>
  );
}

type ForbiddenStateProps = {
  /** Short reason, per screen spec. */
  reason?: string;
  title?: string;
  className?: string;
};

/** Mascot `review` + "คุณไม่มีสิทธิ์เข้าหน้านี้" + reason + "กลับหน้าแรก". Never show partial data. */
export function ForbiddenState({ reason, title = "คุณไม่มีสิทธิ์เข้าหน้านี้", className }: ForbiddenStateProps) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      <Mascot pose="review" size={140} />
      <h2 className="mt-4 font-heading text-lg font-semibold">{title}</h2>
      {reason && <p className="mt-1 text-[13.5px] text-muted-foreground">{reason}</p>}
      <Button asChild className="mt-5">
        <Link href="/">กลับหน้าแรก</Link>
      </Button>
    </div>
  );
}
