"use client";

/* eslint-disable @next/next/no-img-element -- Duplicate thumbnails are authenticated API URLs. */
import { useId, useState } from "react";
import { Info, Loader2, Wrench } from "lucide-react";
import { useIsDesktop } from "@/components/shared/use-media-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { DuplicateTicket } from "../types";
import { PhotoLightbox } from "./photo-gallery";
import { listDate, STEP, stepLabel, ticketLocation, ticketTitle } from "./ticket-presentation";

type CaseProps = {
  tickets: DuplicateTicket[];
  busyId: string | null;
  disabled?: boolean;
  onFollow: (ticket: DuplicateTicket) => void;
  onVisit: (ticket: DuplicateTicket) => void;
};

const SPOT_HINT = 'ถ้าเป็นคนละจุดในห้องนี้ ให้ระบุที่ "บอกจุดเพิ่มเติม" (เช่น แอร์ตัวหน้าห้อง) แล้วแจ้งได้ตามปกติ';

/**
 * Shared rows keep S03 and the submit-time S04 dialog on the same actions. CR-021 (maintenance-demo.html): one
 * horizontal row per case — photo, case facts, action on the right — once the container is wide enough; narrow
 * containers (phone sheet, the desktop summary column) stack the button under the facts.
 */
function DuplicateCases({ tickets, busyId, disabled, onFollow, onVisit }: CaseProps) {
  const [photo, setPhoto] = useState<DuplicateTicket | null>(null);
  return <div className="@container space-y-2.5">
    {[...tickets].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(ticket => {
      const own = ticket.viewerRelation === "reporter";
      const following = ticket.viewerRelation === "subscriber";
      const label = own ? ticket.status === "resolved" ? "ไปประเมินตรวจงาน" : "ดูงานของคุณ" : following ? "ดูเคสนี้" : "ติดตามเคสนี้";
      return <article key={ticket.id} className="flex min-w-0 flex-col gap-3 rounded-lg border bg-card p-3 @lg:flex-row @lg:items-center @lg:gap-4 @lg:p-4">
        <div className="flex min-w-0 flex-1 items-start gap-3 @lg:gap-4">
          {ticket.thumbUrl ? <button type="button" className="size-16 shrink-0 overflow-hidden rounded-lg border outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setPhoto(ticket)} aria-label={`ขยายรูป ${ticket.ticketNo}`}>
            <img src={ticket.thumbUrl} alt="" className="size-full object-cover" />
          </button> : <span className="grid size-16 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"><Wrench aria-hidden /></span>}
          <div className="min-w-0 flex-1">
            <p className="text-xs leading-5 tracking-wide text-muted-foreground">{ticket.ticketNo}</p>
            <h4 className="text-[15px] leading-6 font-semibold wrap-break-word">{ticketTitle(ticket)}</h4>
            <p className="text-xs leading-5 text-muted-foreground wrap-break-word">{ticketLocation(ticket)}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <Badge className={STEP[ticket.step].color}>{stepLabel(ticket)}</Badge>
              {following && <Badge variant="secondary" className="whitespace-normal">คุณติดตามเคสนี้อยู่แล้ว</Badge>}
              <span className="text-xs text-muted-foreground">แจ้งเมื่อ {listDate(ticket.createdAt)}{ticket.subscriberCount > 0 && ` · ผู้ติดตาม ${ticket.subscriberCount} คน`}</span>
            </div>
          </div>
        </div>
        <Button type="button" size="sm" variant={own || following ? "outline" : "default"} className="min-h-11 w-full shrink-0 whitespace-normal @lg:w-auto @lg:min-w-36" disabled={disabled || busyId !== null}
          onClick={() => own || following ? onVisit(ticket) : onFollow(ticket)}>
          {busyId === ticket.id && <Loader2 className="animate-spin" aria-hidden />}{label}
        </Button>
      </article>;
    })}
    <PhotoLightbox photos={photo?.thumbUrl ? [{ id: photo.id, url: photo.thumbUrl, thumbUrl: photo.thumbUrl }] : []} index={photo ? 0 : null} onIndexChange={() => setPhoto(null)} />
  </div>;
}

export function DuplicateCard(props: CaseProps & { category: string }) {
  const titleId = useId();
  const blocking = props.tickets.filter(ticket => ticket.blocksReport);
  const similar = blocking.length === 0;
  const tickets = similar ? props.tickets : blocking;
  if (!tickets.length) return null;
  const own = tickets.every(ticket => ticket.viewerRelation === "reporter");
  const awaiting = own && tickets.some(ticket => ticket.status === "resolved");
  const following = tickets.every(ticket => ticket.viewerRelation === "subscriber");
  const title = similar ? "มีงานคล้ายกันในห้องนี้" : awaiting ? "คุณแจ้งเรื่องนี้ไว้แล้ว และช่างซ่อมเสร็จแล้ว" : own ? "คุณแจ้งเรื่องนี้ไว้แล้ว" : following ? "คุณติดตามเคสนี้อยู่แล้ว" : "มีคนแจ้งเรื่องนี้ไว้แล้ว";
  const text = similar ? 'งานนี้อยู่คนละจุดกับที่คุณระบุ ส่งเป็นงานใหม่ได้ ถ้าเป็นเรื่องเดียวกัน กด "ติดตามเคสนี้" แทน'
    : awaiting ? "ถ้ายังไม่เรียบร้อย ส่งกลับให้ช่างแก้ในงานเดิมได้เลย ไม่ต้องแจ้งใหม่"
      : own ? "งานเดิมของคุณยังดำเนินการอยู่ ไม่ต้องแจ้งซ้ำ ดูความคืบหน้าได้ที่งานเดิม"
        : following ? "" : `ห้องนี้มีงาน${props.category}ที่ยังไม่เสร็จอยู่แล้ว จึงแจ้งซ้ำไม่ได้ กด "ติดตามเคสนี้" รายละเอียดและรูปที่คุณกรอกจะถูกเพิ่มในงานเดิม และคุณจะเห็นความคืบหน้าในงานซ่อมของฉัน`;
  return <section aria-labelledby={titleId} className="space-y-3.5 rounded-xl border border-primary/20 bg-secondary/40 p-3.5 sm:p-5">
    <div className="flex items-start gap-3">
      <Info className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <h3 id={titleId} className="text-[15px] leading-6 font-semibold text-primary">{title}</h3>
        {text && <p className="mt-0.5 text-sm leading-6 text-muted-foreground">{text}</p>}
      </div>
      <span className="shrink-0 rounded-md border border-primary/20 bg-card px-2 text-xs leading-6 font-semibold text-primary tabular-nums">พบ {tickets.length} งาน</span>
    </div>
    <DuplicateCases {...props} tickets={tickets} />
    {!similar && <p className="text-[13px] leading-6 text-muted-foreground">{SPOT_HINT}</p>}
  </section>;
}

export function DuplicateDialog({ open, onOpenChange, category, onCancel, onRetry, submitLabel, ...cases }: CaseProps & {
  open: boolean; onOpenChange: (open: boolean) => void; category: string; onCancel: () => void; onRetry: () => void; submitLabel: string;
}) {
  const desktop = useIsDesktop();
  const title = "มีคนแจ้งเรื่องนี้ไว้แล้ว";
  const description = `ห้องนี้มีงาน${category}ที่ยังไม่เสร็จ เลือกติดตามเคสเดิม หรือยกเลิกการแจ้ง · ถ้าเป็นคนละจุด ปิดหน้าต่างนี้แล้วระบุ "บอกจุดเพิ่มเติม"`;
  const content = <div className="space-y-4">
    {cases.tickets.length ? <DuplicateCases {...cases} /> : <p role="status" className="py-4 text-center text-muted-foreground">ไม่มีเคสที่ยังเปิดอยู่แล้ว</p>}
    <p className="text-sm leading-6 text-muted-foreground">ผู้ติดตามเห็นความคืบหน้าทุกขั้น แต่การประเมินตรวจงานเป็นของผู้แจ้งคนแรก</p>
    <div className="flex flex-col gap-2 lg:flex-row lg:justify-end">
      <Button type="button" variant="outline" disabled={cases.disabled || cases.busyId !== null} onClick={onCancel}>ยกเลิกการแจ้ง</Button>
      {!cases.tickets.length && <Button type="button" disabled={cases.disabled} onClick={onRetry}>{submitLabel}</Button>}
    </div>
  </div>;
  const change = (value: boolean) => { if (!cases.busyId && !cases.disabled) onOpenChange(value); };
  return desktop ? <Dialog open={open} onOpenChange={change}>
    <DialogContent className="max-h-11/12 overflow-y-auto sm:max-w-140">
      <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>{content}
    </DialogContent>
  </Dialog> : <Sheet open={open} onOpenChange={change}>
    <SheetContent side="bottom" className="max-h-11/12 overflow-y-auto rounded-t-xl p-4">
      <SheetHeader className="p-0 pr-8"><SheetTitle>{title}</SheetTitle><SheetDescription>{description}</SheetDescription></SheetHeader>{content}
    </SheetContent>
  </Sheet>;
}
