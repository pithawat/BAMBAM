"use client";

import Link from "next/link";
import { Copy, Star } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, ForbiddenState } from "@/components/shared/states";
import { cn } from "@/lib/utils";
import { errorCode, GENERIC_ERROR } from "../errors";
import type { TicketStep } from "../types";
import { RATING_LABELS, STEP } from "./ticket-presentation";

export function TicketStatusBadge({ step }: { step: TicketStep }) {
  return <Badge className={cn("max-w-full gap-1.5 whitespace-normal border-0 px-2.5 py-1 text-xs", STEP[step].color)}><span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden />{STEP[step].label}</Badge>;
}

export function CopyTicketNumber({ value, large = false }: { value: string; large?: boolean }) {
  async function copy() {
    try { await navigator.clipboard.writeText(value); toast.success("คัดลอกเลขงานแล้ว"); }
    catch { toast.error(GENERIC_ERROR); }
  }
  return <span className="inline-flex min-w-0 items-center gap-1"><span className={cn("font-heading font-semibold tracking-wide", large ? "text-xl lg:text-2xl" : "text-xs text-muted-foreground")}>{value}</span><Button type="button" variant="ghost" size="icon" onClick={copy} aria-label="คัดลอกเลขงาน"><Copy className="size-4" /></Button></span>;
}

export function TicketSkeleton({ success = false }: { success?: boolean }) {
  return <div className={cn("space-y-3 px-4 py-4 lg:px-0", success && "mx-auto max-w-140")} aria-busy="true" aria-label="กำลังโหลด">
    <Card className="gap-3 p-5 shadow-card"><Skeleton className="h-5 w-40" /><Skeleton className="h-7 w-3/4" /><Skeleton className="h-4 w-2/3" />
      <div className="flex gap-2 pt-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="size-22 rounded-xl" />)}</div>
    </Card>
    <Card className="gap-4 p-5 shadow-card">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}</Card>
  </div>;
}

export function TicketFailure({ error, onRetry, success = false }: { error: unknown; onRetry: () => void; success?: boolean }) {
  if (errorCode(error) === "TICKET_NOT_FOUND") return <ForbiddenState title="ไม่พบงานนี้" reason="ตรวจสอบเลขงานอีกครั้ง" />;
  if (errorCode(error) === "FORBIDDEN") return <ForbiddenState reason={success ? "หน้านี้แสดงเฉพาะงานที่คุณแจ้ง" : "งานนี้ไม่ได้อยู่ในรายการที่คุณแจ้ง ติดตาม หรือรับผิดชอบ"} />;
  return <><ErrorState onRetry={onRetry} />{success && <div className="flex justify-center pb-8"><Button asChild variant="outline"><Link href="/repair/my">ไปที่ติดตามงานซ่อม</Link></Button></div>}</>;
}

export function Stars({ value, label = true }: { value: number; label?: boolean }) {
  return <p className="flex flex-wrap items-center gap-1 text-sm text-warning" aria-label={`${value} ดาว`}>
    {[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`size-4 ${n <= value ? "fill-current" : "opacity-30"}`} aria-hidden />)}
    {label && <span className="ml-1">{RATING_LABELS[value]}</span>}</p>;
}
