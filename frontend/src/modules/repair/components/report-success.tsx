"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Info } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Mascot } from "@/components/shared/mascot";
import { PriorityIndicator } from "@/components/shared/priority-indicator";
import { ForbiddenState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyTicketNumber, TicketFailure, TicketSkeleton } from "./ticket-ui";
import { ticketHref, ticketLocation, ticketTitle } from "./ticket-presentation";
import { useTicket } from "./use-ticket";

export function ReportSuccessScreen() {
  const router = useRouter();
  const heading = useRef<HTMLHeadingElement>(null);
  const id = useSearchParams().get("id") ?? "";
  const { ticket, loading, error, reload } = useTicket(id);
  useEffect(() => { if (ticket && !loading) heading.current?.focus(); }, [ticket, loading]);
  useEffect(() => {
    function back(event: PopStateEvent) { event.stopImmediatePropagation(); router.replace("/"); }
    window.addEventListener("popstate", back, true);
    return () => window.removeEventListener("popstate", back, true);
  }, [router]);
  return <><PageHeader title="แจ้งซ่อม" variant="none" />
    {loading ? <TicketSkeleton success /> : error ? <TicketFailure error={error} onRetry={reload} success /> : ticket && (ticket.viewerRelation !== "reporter" ? <ForbiddenState reason="หน้านี้แสดงเฉพาะงานที่คุณแจ้ง" /> : <div className="relative isolate pb-6 lg:pt-3">
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-80 overflow-hidden rounded-b-2xl bg-brand lg:hidden"><span className="absolute -top-20 -right-20 size-80 rounded-full bg-white/15" /><span className="absolute -bottom-20 -left-20 size-52 rounded-full bg-white/10" /></div>
      <div className="flex justify-center pt-4 pb-4 lg:pt-0"><Mascot pose="full" size={180} className="lg:h-40 lg:w-auto" priority /></div>
      <Card className="mx-4 max-w-140 gap-4 p-4 shadow-float lg:mx-auto lg:p-6">
        <div className="flex flex-col items-center text-center"><span className="mb-3 grid size-14 place-items-center rounded-full bg-success/10 text-success"><Check className="size-7" aria-hidden /></span><h1 ref={heading} className="font-heading text-xl font-semibold outline-none" tabIndex={-1}>แจ้งซ่อมเรียบร้อย</h1><p className="mt-1 text-sm text-muted-foreground">เลขงานของคุณ</p><CopyTicketNumber value={ticket.ticketNo} large /></div>
        <dl className="space-y-3 border-y py-4 text-sm">{[["หมวดงาน", ticket.category.name], ["อาการ", ticketTitle(ticket)], ["สถานที่", ticketLocation(ticket)], ["ความเร่งด่วน", <PriorityIndicator key="priority" priority={ticket.priority} />]].map(([label, value]) => <div key={String(label)} className="flex gap-3"><dt className="w-23 shrink-0 text-muted-foreground">{label}</dt><dd className="min-w-0 break-words">{value}</dd></div>)}</dl>
        <p className="flex items-start gap-2 rounded-sm bg-secondary p-3 text-sm leading-6 text-secondary-foreground"><Info className="mt-1 size-5 shrink-0" aria-hidden /><span>ส่งเรื่องถึงช่างแล้ว ช่างจะประเมินงานและแจ้งวันที่คาดว่าจะเสร็จ ติดตามได้ที่หน้าติดตามงานซ่อม</span></p>
        <div className="space-y-2"><Button asChild className="w-full"><Link href={ticketHref(ticket.id)} replace>ดูงานนี้</Link></Button><Button asChild variant="outline" className="w-full"><Link href="/" replace>กลับหน้าแรก</Link></Button></div>
      </Card>
    </div>)}
  </>;
}
