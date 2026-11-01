"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getMyTickets } from "../api";
import type { MyTicket } from "../types";
import { CategoryTile } from "./category-icon";
import { placeLine, STEP, stepLabel, ticketHref } from "./ticket-presentation";
import { TicketLink } from "./ticket-navigation";

// Home "รายการของฉัน" (CR-035, layout from output/home-user-redesign/index.html): the newest three rows of #35 —
// the API puts the reporter's tickets awaiting the rating first (BR-F06-2) — and how many still wait for the viewer.
// Only rendered for `repair.ticket.report` (tracking follows the report key, CR-034).

const SHOWN = 3;

type Data = { items: MyTicket[]; total: number; awaiting: number } | "error";

export function HomeTickets() {
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<{ revision: number; value: Data }>();
  const retry = useCallback(() => setRevision((r) => r + 1), []);
  useEffect(() => {
    let active = true;
    Promise.all([
      getMyTickets({ relation: "all", page: 1, pageSize: SHOWN }),
      getMyTickets({ relation: "reported", status: ["resolved"], page: 1, pageSize: 1 }),
    ]).then(
      ([list, awaiting]) => { if (active) setData({ revision, value: { items: list.items, total: list.meta.total, awaiting: awaiting.meta.total } }); },
      () => { if (active) setData({ revision, value: "error" }); },
    );
    return () => { active = false; };
  }, [revision]);
  const loading = !data || data.revision !== revision;
  const value = data?.value;

  return <section aria-labelledby="personal-title" className="pb-10">
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 id="personal-title" className="text-lg leading-7 font-semibold tracking-tight lg:text-[19px]">รายการของฉัน</h2>
        <p className="text-[13px] text-muted-foreground">ติดตามเรื่องที่แจ้งไว้ และงานที่รอคุณตรวจ</p>
      </div>
      <Link href="/repair/my" className="hidden shrink-0 items-center gap-1.5 rounded-sm text-[13px] font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex">
        ดูงานซ่อมทั้งหมด<ArrowRight className="size-4" aria-hidden />
      </Link>
    </div>
    <div aria-busy={loading} className="overflow-hidden rounded-2xl border bg-card">
      {loading ? <div aria-label="กำลังโหลดรายการของฉัน" className="divide-y">
        {[0, 1].map((i) => <div key={i} className="flex items-center gap-4 px-4 py-4.5 sm:px-5.5">
          <Skeleton className="size-10 rounded-lg" />
          <div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-1/3" /></div>
          <Skeleton className="hidden h-6 w-32 rounded-md sm:block" />
        </div>)}
      </div>
        : value === "error" ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-5.5">
          <div>
            <p className="font-semibold">โหลดรายการของคุณไม่สำเร็จ</p>
            <p className="text-[13px] text-muted-foreground">ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง ยังแจ้งซ่อมใหม่ได้ตามปกติ</p>
          </div>
          <Button variant="outline" onClick={retry}><RotateCcw aria-hidden />ลองอีกครั้ง</Button>
        </div>
        : value && value.items.length === 0 ? <div className="px-4 py-6 sm:px-5.5">
          <p className="font-semibold">ยังไม่มีงานที่คุณแจ้งหรือติดตาม</p>
          <p className="text-[13px] text-muted-foreground">เจออะไรเสีย กดแจ้งซ่อมใหม่ที่การ์ดด้านบนได้เลย</p>
        </div>
        : value && <>
          <ul className="divide-y">{value.items.map((t) => <Row key={t.id} ticket={t} />)}</ul>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t px-4 py-2.5 text-[13px] text-muted-foreground sm:px-5.5">
            <span>{value.awaiting > 0 ? `มี ${value.awaiting} งานรอคุณประเมินตรวจงาน` : `ทั้งหมด ${value.total} งาน`}</span>
            <Link href="/repair/my" className="inline-flex min-h-11 items-center gap-1.5 rounded-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring sm:hidden">
              ดูงานซ่อมทั้งหมด<ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </>}
    </div>
  </section>;
}

function Row({ ticket }: { ticket: MyTicket }) {
  const mine = ticket.awaitingMyConfirmation;
  return <li className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-4 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto_auto] sm:gap-x-4 sm:px-5.5">
    <CategoryTile icon={ticket.category?.icon} className="size-9 sm:size-10" />
    <div className="col-span-2 min-w-0 sm:col-span-1">
      <TicketLink href={ticketHref(ticket.id)} className="block truncate text-[15px] leading-6 font-medium outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring">{ticket.title}</TicketLink>
      <p className="truncate text-xs leading-5 text-muted-foreground">
        <span className="tracking-wide">{ticket.ticketNo}</span> · {ticket.building.name} {placeLine(ticket)}{ticket.viewerRelation === "subscriber" && " · คุณติดตามเคสนี้"}
      </p>
    </div>
    <span className={cn("col-start-2 inline-flex max-w-full items-center gap-1.5 justify-self-start rounded-md px-2 py-0.5 text-xs leading-5 font-semibold sm:col-start-auto", mine ? "bg-attention/10 text-attention" : STEP[ticket.step].color)}>
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" /><span className="truncate">{stepLabel(ticket)}</span>
    </span>
    <TicketLink href={ticketHref(ticket.id)} aria-label={`${mine ? "ตรวจงาน" : "ดูงาน"} ${ticket.ticketNo}`}
      className={cn("inline-flex min-h-11 items-center justify-end gap-0.5 rounded-md text-[13px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
        mine ? "bg-attention/10 px-3 text-attention hover:bg-attention/15" : "min-w-11 text-primary hover:underline")}>
      {mine ? "ตรวจงาน" : "ดูงาน"}<ChevronRight className="size-4" aria-hidden />
    </TicketLink>
  </li>;
}
