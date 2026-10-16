"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Bookmark, CalendarClock, ChevronLeft, Clock, HardHat, MapPin, Tag } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PriorityIndicator } from "@/components/shared/priority-indicator";
import { useCurrentUser } from "@/components/shared/me-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import type { TicketDetail } from "../types";
import { PhotoGallery } from "./photo-gallery";
import { Timeline } from "./timeline";
import { CLOSED_LABELS, dayLabel, ticketLocation, ticketTitle, workByText } from "./ticket-presentation";
import { CopyTicketNumber, Stars, TicketFailure, TicketSkeleton, TicketStatusBadge } from "./ticket-ui";
import { useTicket } from "./use-ticket";
import { autoCloseText, TicketProgress } from "./ticket-progress";
import { useTicketActions } from "./ticket-actions";
import { ticketReturnHref } from "./ticket-navigation";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <Card className="gap-3 p-4 shadow-card ring-0 lg:p-5"><h2 className="font-heading text-base font-semibold">{title}</h2>{children}</Card>;
}

export function TicketDetailScreen({ id }: { id: string }) {
  const [backHref] = useState(() => ticketReturnHref(id));
  const { ticket, loading, error, reload, replace } = useTicket(id);
  return <>
    <div className="lg:flex lg:items-start lg:gap-3"><Button asChild variant="ghost" className="hidden lg:inline-flex"><Link href={backHref}><ChevronLeft />กลับ</Link></Button><div className="min-w-0 flex-1"><PageHeader title="รายละเอียดงาน" variant="bar" backHref={backHref} /></div></div>
    {loading ? <TicketSkeleton /> : error ? <TicketFailure error={error} onRetry={reload} /> : ticket && <TicketBody ticket={ticket} onChanged={replace} />}
  </>;
}

function TicketBody({ ticket, onChanged }: { ticket: TicketDetail; onChanged: (t: TicketDetail) => void }) {
  const me = useCurrentUser();
  const actions = useTicketActions(ticket, onChanged);
  const staff = me.role === "admin" || me.role === "executive" || me.role === "technician";
  // The server sends the contractor's name to staff only; others see "ช่างภายนอก · {types}".
  const workBy = workByText(ticket);
  return <>
    <div className={`flex flex-col gap-4.5 px-4 py-4 lg:flex-row lg:px-0 lg:py-0 ${actions.hasActions ? "pb-28 lg:pb-0" : ""}`}>
      <div className="min-w-0 flex-1 space-y-3 lg:space-y-4.5">
        {/* Header + progress tracker (CR-003, CR-005: forward-only tracker). */}
        <Card className="gap-3 p-4 shadow-card ring-0 lg:p-5">
          <div className="flex flex-wrap items-center gap-2"><CopyTicketNumber value={ticket.ticketNo} /><span className="flex-1" />
            {ticket.awaitingMyConfirmation ? <Badge className="border-0 bg-status-resolved text-white">รอคุณประเมิน</Badge> : <TicketStatusBadge step={ticket.step} />}</div>
          {(ticket.viewerRelation === "subscriber" || ticket.closedReason) && <div className="flex flex-wrap items-center gap-2">
            {ticket.viewerRelation === "subscriber" && <Badge variant="secondary"><Bookmark aria-hidden className="size-3.5" />คุณติดตามเคสนี้</Badge>}
            {ticket.closedReason && <span className="text-xs text-muted-foreground">{CLOSED_LABELS[ticket.closedReason]}</span>}</div>}
          <div><h2 className="break-words font-heading text-lg font-semibold lg:text-xl">{ticketTitle(ticket)}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground"><span>{ticket.category.name}</span><PriorityIndicator priority={ticket.priority} />
              <span className="inline-flex items-start gap-1.5"><MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />{ticketLocation(ticket)}</span></div>
            {ticket.asset && <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground"><Tag className="mt-0.5 size-4 shrink-0" aria-hidden />{ticket.asset.code} {ticket.asset.name}</p>}</div>
          <div className="mt-1 border-t pt-4"><TicketProgress ticket={ticket} /></div>
          {ticket.status === "in_progress" && ticket.expectedDoneOn && <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-status-in-progress/10 px-3 py-1.5 text-xs font-semibold text-status-in-progress"><CalendarClock className="size-3.5 shrink-0" aria-hidden />คาดว่าจะเสร็จ {dayLabel(ticket.expectedDoneOn, true)}</p>}
          {ticket.awaitingMyConfirmation && ticket.autoCloseAt && <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-warning/10 px-3 py-1.5 text-xs font-semibold text-warning"><Clock className="size-3.5 shrink-0" aria-hidden />{autoCloseText(ticket.autoCloseAt)}</p>}
        </Card>
        <div className="grid gap-3 lg:gap-4.5 2xl:grid-cols-2">
          <Section title="รายละเอียดจากผู้แจ้ง"><p className="whitespace-pre-wrap break-words text-sm leading-6">{ticket.details || "ไม่มีรายละเอียดเพิ่มเติม"}</p><PhotoGallery photos={ticket.photos} /><p className="text-xs leading-5 text-muted-foreground">แจ้งโดย {ticket.reporter.name}{ticket.reporter.department && ` · ${ticket.reporter.department}`}<br />{formatDateTime(ticket.createdAt)} · ผู้ติดตาม {ticket.subscriberCount} คน</p></Section>
          {ticket.result && (ticket.status === "resolved" || ticket.status === "closed") && <Section title="ผลการซ่อม">
            <p className="whitespace-pre-wrap break-words text-sm leading-6">{ticket.result.note}</p><PhotoGallery photos={ticket.result.photos} label="รูปหลังซ่อม" />
            {workBy && <p className="flex items-start gap-1.5 text-sm"><HardHat className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />{workBy}</p>}
            {staff && ticket.result.contractorRating && <div className="rounded-sm bg-muted/60 p-3"><p className="text-xs text-muted-foreground">คะแนนช่างภายนอก (ช่างในระบบให้)</p><Stars value={ticket.result.contractorRating} />{ticket.result.contractorRatingComment && <p className="mt-1 whitespace-pre-wrap text-sm">{ticket.result.contractorRatingComment}</p>}</div>}
            <p className="text-xs text-muted-foreground">{[ticket.result.photos.length > 0 && "รูปหลังซ่อม", ticket.result.by && `ช่าง${ticket.result.by.name}`, ticket.result.at && formatDateTime(ticket.result.at)].filter(Boolean).join(" · ")}</p>
            {ticket.rating && <div className="rounded-sm bg-warning/5 p-3"><p className="text-xs text-muted-foreground">คะแนนจากผู้แจ้ง</p><Stars value={ticket.rating} />{ticket.ratingComment && <p className="mt-2 whitespace-pre-wrap text-sm">{ticket.ratingComment}</p>}</div>}
          </Section>}
        </div>
        <Section title="ความคืบหน้า"><Timeline events={ticket.timeline} /></Section>
      </div>
      <aside className="hidden w-85 shrink-0 lg:block"><div className="sticky top-5 space-y-4.5">
        {actions.bar()}
        {me.role === "executive" && <Card className="p-4 text-sm text-muted-foreground">ผู้บริหารดูได้อย่างเดียว</Card>}
        <Section title="ข้อมูลงาน"><dl className="divide-y text-sm">{[
          ["สถานะ", <TicketStatusBadge key="status" step={ticket.step} />], ["ความเร่งด่วน", <PriorityIndicator key="priority" priority={ticket.priority} />],
          ["หมวดงาน", ticket.category.name], ["สถานที่", ticketLocation(ticket)], ["อุปกรณ์", ticket.asset ? `${ticket.asset.code} ${ticket.asset.name}` : "—"],
          ["ผู้แจ้ง", ticket.reporter.name], ["ช่างผู้รับผิดชอบ", ticket.technician?.name ?? "รอช่างประเมิน"],
          ["คาดว่าจะเสร็จ", ticket.expectedDoneOn ? dayLabel(ticket.expectedDoneOn, true) : "—"],
          ...(workBy ? [["ผู้ดำเนินการ", workBy]] : []),
          ["ผู้ติดตาม", `${ticket.subscriberCount} คน`],
          ...(ticket.sendBackCount > 0 ? [["ส่งกลับให้แก้", `${ticket.sendBackCount} ครั้ง`]] : []), ["อัปเดตล่าสุด", formatDateTime(ticket.updatedAt)],
        ].map(([label, value]) => <div key={String(label)} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"><dt className="w-28 shrink-0 text-xs text-muted-foreground">{label}</dt><dd className="min-w-0 flex-1 break-words">{value}</dd></div>)}</dl></Section>
      </div></aside>
    </div>
    {actions.bar("fixed inset-x-0 bottom-0 z-20 rounded-b-none lg:hidden")}
    {actions.dialogs}
  </>;
}
