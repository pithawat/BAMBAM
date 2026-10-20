"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Building2, CalendarClock, ChevronRight, HardHat, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PriorityIndicator } from "@/components/shared/priority-indicator";
import { EmptyState, ErrorState, ForbiddenState } from "@/components/shared/states";
import { FilterPill } from "@/components/shared/filter-pill";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { useCurrentUser } from "@/components/shared/me-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getBuildings, getTicketCounts, getTickets } from "../api";
import type { Building, TicketCounts, TicketStep, TicketSummary } from "../types";
import { categoryName, dayLabel, listDate, ticketHref, ticketLocation, ticketTitle, todayBangkok } from "./ticket-presentation";
import { TicketProgressMini, TicketThumb } from "./ticket-progress";
import { TicketLink } from "./ticket-navigation";

// S09 งานซ่อม — the one in-house technician sees every open ticket (CR-005, BR-F21-1):
// oldest report first (CR-015: no priority ordering); tabs by step; building filter.

type Tab = "assess" | "repair" | "rating";
const TABS: Record<Tab, { label: string; steps: TicketStep[]; count: (c: TicketCounts) => number; empty: string }> = {
  assess: { label: "รับเรื่อง", steps: ["awaiting_assessment"], count: (c) => c.awaitingAssessment, empty: "ไม่มีงานที่รอเริ่มดำเนินการ" },
  repair: { label: "กำลังดำเนินการ", steps: ["in_repair", "reworking"], count: (c) => c.inRepair, empty: "ไม่มีงานที่กำลังดำเนินการ" },
  rating: { label: "รอประเมินตรวจงาน", steps: ["awaiting_rating"], count: (c) => c.resolved, empty: "ไม่มีงานที่รอผู้แจ้งประเมินตรวจงาน" },
};
const PAGE_SIZE = 20;

export function TechnicianWorkScreen() {
  const me = useCurrentUser();
  const params = useSearchParams();
  const tab: Tab = params.get("tab") === "repair" || params.get("tab") === "rating" ? (params.get("tab") as Tab) : "assess";
  const buildingId = params.get("building") ?? "all";
  const [buildings, setBuildings] = useState<Building[]>([]);
  useEffect(() => { getBuildings().then(setBuildings, () => setBuildings([])); }, []);
  const change = useCallback((values: Record<string, string | null>) => {
    const url = new URL(window.location.href);
    for (const [k, v] of Object.entries(values)) { if (v === null) url.searchParams.delete(k); else url.searchParams.set(k, v); }
    window.history.replaceState(null, "", url.pathname + url.search);
  }, []);
  if (me.role !== "technician") return <><PageHeader title="งานซ่อม" variant="bar" /><ForbiddenState reason="หน้านี้สำหรับช่างเท่านั้น" /></>;
  return <>
    <PageHeader title="งานซ่อม" variant="service" service="repair" subtitle="ทุกงานที่ยังไม่ปิด เรียงตามเวลาแจ้ง (เก่าก่อน)"
      action={<Button asChild variant="outline" size="sm"><Link href="/repair/contractors"><HardHat aria-hidden />ช่างภายนอก</Link></Button>} />
    <WorkBoard key={`${tab}|${buildingId}`} tab={tab} buildingId={buildingId} buildings={buildings} change={change} />
  </>;
}

function WorkBoard({ tab, buildingId, buildings, change }: { tab: Tab; buildingId: string; buildings: Building[]; change: (v: Record<string, string | null>) => void }) {
  const [counts, setCounts] = useState<TicketCounts>();
  const [items, setItems] = useState<TicketSummary[]>();
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<unknown>();
  const [revision, setRevision] = useState(0);
  const [moreBusy, setMoreBusy] = useState(false);
  const page = useRef(1);
  const building = buildingId === "all" ? undefined : buildingId;
  useEffect(() => {
    let active = true;
    page.current = 1;
    Promise.all([
      getTicketCounts({ scope: "all", buildingId: building }),
      getTickets({ scope: "all", step: TABS[tab].steps, buildingId: building, sort: "createdAt:asc", page: 1, pageSize: PAGE_SIZE }),
    ]).then(([c, list]) => { if (active) { setCounts(c); setItems(list.items); setTotal(list.meta.total); setError(undefined); } },
      (err: unknown) => { if (active) setError(err); });
    return () => { active = false; };
  }, [tab, building, revision]);
  useEffect(() => {
    const reload = () => setRevision((r) => r + 1);
    window.addEventListener("focus", reload);
    return () => window.removeEventListener("focus", reload);
  }, []);
  async function more() {
    setMoreBusy(true);
    try {
      const next = await getTickets({ scope: "all", step: TABS[tab].steps, buildingId: building, sort: "createdAt:asc", page: page.current + 1, pageSize: PAGE_SIZE });
      page.current += 1;
      setItems((old) => [...(old ?? []), ...next.items.filter((t) => !old?.some((o) => o.id === t.id))]);
      setTotal(next.meta.total);
    } catch { toast.error("โหลดงานเพิ่มไม่สำเร็จ ลองอีกครั้ง"); }
    finally { setMoreBusy(false); }
  }
  const tabs = (Object.keys(TABS) as Tab[]).map((t) => ({ value: t, label: counts ? `${TABS[t].label} ${TABS[t].count(counts)}` : TABS[t].label }));
  return <div className="space-y-3 px-4 py-4 lg:px-0 lg:py-0">
    <Card className="gap-3 p-3 shadow-card lg:flex-row lg:items-center">
      <SegmentedControl label="ขั้นของงาน" value={tab} options={tabs} onValueChange={(v) => change({ tab: v === "assess" ? null : v })} className="lg:flex-1" />
      <FilterPill size="sm" label="อาคาร" icon={Building2} value={buildingId} defaultValue="all"
        options={[{ value: "all", label: "ทุกอาคาร" }, ...buildings.map((b) => ({ value: b.id, label: b.name }))]} onValueChange={(v) => change({ building: v === "all" ? null : v })} />
    </Card>
    {error !== undefined ? <ErrorState variant="inline" title="โหลดงานซ่อมไม่สำเร็จ" onRetry={() => setRevision((r) => r + 1)} />
      : !items ? <div className="space-y-2" aria-busy="true" aria-label="กำลังโหลดงานซ่อม">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}</div>
      : items.length === 0 ? <EmptyState title={building ? "ไม่มีงานในอาคารนี้" : TABS[tab].empty} action={building ? <Button variant="outline" onClick={() => change({ building: null })}>ดูทุกอาคาร</Button> : undefined} />
      : <>
        <Card className="gap-0 divide-y py-0 shadow-card">{items.map((t) => <WorkRow key={t.id} ticket={t} />)}</Card>
        {items.length < total && <Button variant="outline" className="w-full" disabled={moreBusy} onClick={more}>{moreBusy && <Loader2 className="animate-spin" aria-hidden />}โหลดเพิ่ม</Button>}
        <p className="text-center text-xs text-muted-foreground">แสดง {items.length} จาก {total} งาน</p>
      </>}
  </div>;
}

function WorkRow({ ticket }: { ticket: TicketSummary }) {
  const late = ticket.expectedDoneOn && ticket.status === "in_progress" && ticket.expectedDoneOn < todayBangkok();
  return <TicketLink href={ticketHref(ticket.id)} aria-label={ticketTitle(ticket)} className="flex items-start gap-3 px-3.5 py-3.5 outline-none hover:bg-muted/50 focus-visible:bg-secondary focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
    <TicketThumb ticket={ticket} />
    <div className="min-w-0 flex-1 space-y-1">
      <div className="flex items-center gap-2"><h3 className="min-w-0 flex-1 truncate font-sans text-base font-semibold">{ticketTitle(ticket)}</h3><PriorityIndicator priority={ticket.priority} /></div>
      <p className="truncate text-xs leading-5 text-muted-foreground">{categoryName(ticket)} · {ticketLocation(ticket)}</p>
      <p className="text-xs text-muted-foreground">{ticket.ticketNo} · {ticket.reporter.name} · แจ้ง {listDate(ticket.createdAt)}</p>
      <TicketProgressMini ticket={ticket} />
      {ticket.expectedDoneOn && ticket.status === "in_progress" && <p className={cn("inline-flex items-center gap-1 text-xs font-medium", late ? "text-destructive" : "text-status-in-progress")}>
        <CalendarClock className="size-3.5" aria-hidden />{late ? "เลยกำหนด" : "คาดว่าเสร็จ"} {dayLabel(ticket.expectedDoneOn)}</p>}
    </div>
    <ChevronRight className="mt-5 size-4 shrink-0 text-muted-foreground" aria-hidden />
  </TicketLink>;
}
