"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Mascot } from "@/components/shared/mascot";
import { PriorityBadge } from "@/components/shared/priority-indicator";
import { ForbiddenState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CopyTicketNumber, TicketFailure, TicketSkeleton } from "./ticket-ui";
import { categoryName, ticketHref, ticketLocation, ticketTitle } from "./ticket-presentation";
import { usePriorityReason } from "./use-priority-reason";
import { useTicket } from "./use-ticket";

// S05 รับเรื่องแล้ว — CR-008 white success card, CR-009 wording (S05-report-success.md). Team / follow variants: Stage 4.

const MINI_STEPS = ["แจ้งงาน", "รับเรื่อง", "กำลังดำเนินการ", "เสร็จ", "ประเมินตรวจงาน"];

export function ReportSuccessScreen() {
  const router = useRouter();
  const heading = useRef<HTMLHeadingElement>(null);
  const id = useSearchParams().get("id") ?? "";
  const { ticket, loading, error, reload } = useTicket(id);
  const reason = usePriorityReason(ticket);
  useEffect(() => { if (ticket && !loading) heading.current?.focus(); }, [ticket, loading]);
  useEffect(() => {
    function back(event: PopStateEvent) { event.stopImmediatePropagation(); router.replace("/"); }
    window.addEventListener("popstate", back, true);
    return () => window.removeEventListener("popstate", back, true);
  }, [router]);
  return <><PageHeader title="แจ้งซ่อมใหม่" variant="none" />
    {loading ? <TicketSkeleton success /> : error ? <TicketFailure error={error} onRetry={reload} success /> : ticket && (ticket.viewerRelation !== "reporter" ? <ForbiddenState reason="หน้านี้แสดงเฉพาะงานที่คุณแจ้ง" /> :
      <section aria-live="polite" className="mx-3 my-4 max-w-150 rounded-xl border bg-card px-4 py-6 text-center shadow-raised sm:mx-auto sm:px-8">
        <div className="flex justify-center"><Mascot pose="welcome" size={120} priority /></div>
        <h1 ref={heading} tabIndex={-1} className="mt-2 text-2xl leading-9 font-semibold outline-none">รับเรื่องแล้ว</h1>
        <p className="mt-1 text-sm text-muted-foreground">เลขงานของคุณ</p>
        <CopyTicketNumber value={ticket.ticketNo} large />

        <ol aria-label="ความคืบหน้า" className="mx-auto mt-4 flex max-w-120 gap-1.5 text-left">{MINI_STEPS.map((s, i) => <li key={s} className={cn("min-w-0 flex-1 text-xs leading-5", i === 0 ? "text-foreground" : i === 1 ? "font-semibold text-primary" : "text-muted-foreground")}>
          <span aria-hidden className={cn("mb-1.5 block h-1 rounded-full", i === 0 ? "bg-primary/45" : i === 1 ? "bg-primary" : "bg-border")} />{s}{i === 1 && <span className="sr-only"> (ตอนนี้)</span>}
        </li>)}</ol>

        <div className="mt-5 rounded-lg bg-secondary px-4 py-3 text-left text-sm leading-6 text-secondary-foreground">
          <b className="font-semibold">ต่อไป</b> ช่างจะกำหนดวันที่คาดว่าจะเสร็จ แล้วเริ่มดำเนินการ เราจะแจ้งเตือนคุณที่กระดิ่งทันที
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-foreground">ความเร่งด่วนของงานนี้: <PriorityBadge priority={ticket.priority} /><span className="text-muted-foreground">{reason}</span></p>
        </div>

        <dl className="mt-4 divide-y border-y text-left text-sm">{[
          ["เรื่อง", `${ticketTitle(ticket)} · ${categoryName(ticket)}`],
          ["สถานที่", ticketLocation(ticket)],
          ["รูป", `${ticket.photos.length} รูป`],
        ].map(([k, v]) => <div key={k} className="flex gap-3 py-2.5"><dt className="w-16 shrink-0 text-muted-foreground">{k}</dt><dd className="min-w-0 wrap-break-word">{v}</dd></div>)}</dl>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Button asChild className="h-12"><Link href={ticketHref(ticket.id)} replace>ดูงานนี้<ArrowUpRight aria-hidden /></Link></Button>
          <Button asChild variant="outline" className="h-12"><Link href="/repair/new" replace>แจ้งเรื่องอื่น</Link></Button>
        </div>
      </section>)}
  </>;
}
