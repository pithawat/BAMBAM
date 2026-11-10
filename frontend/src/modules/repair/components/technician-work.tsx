"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { Building2, CalendarClock, ChevronRight, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PriorityIndicator } from "@/components/shared/priority-indicator";
import { EmptyState, ErrorState, ForbiddenState } from "@/components/shared/states";
import { FilterPill } from "@/components/shared/filter-pill";
import { Pager, pageRange } from "@/components/shared/pager";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { useCurrentUser } from "@/components/shared/me-provider";
import { can, PERM } from "@/lib/platform/permissions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getBuildings, getTicketCounts, getTickets } from "../api";
import type { Building, TicketCounts, TicketStep, TicketSummary } from "../types";
import { categoryName, dayLabel, listDate, ticketHref, ticketLocation, ticketTitle, todayBangkok } from "./ticket-presentation";
import { TicketProgressMini, TicketThumb } from "./ticket-progress";
import { TicketLink } from "./ticket-navigation";

// S09 งานซ่อม — the one in-house technician sees every open ticket (CR-005, BR-F21-1):
// oldest report first (CR-015: no priority ordering); tabs by step; building filter. CR-041: phones pick the step from
// three tiles (count over a wrapping label); no ช่างภายนอก header button (the repair section nav links to S18).
// CR-042: 5 tickets per page — the page number (?page=) and filters go to #6 (`page`, `pageSize`), the API pages.

type Tab = "assess" | "repair" | "rating";
const TABS: Record<Tab, { label: string; steps: TicketStep[]; count: (c: TicketCounts) => number; empty: string; dot: string }> = {
  assess: { label: "รับเรื่อง", steps: ["awaiting_assessment"], count: (c) => c.awaitingAssessment, empty: "ไม่มีงานที่รอเริ่มดำเนินการ", dot: "bg-status-new" },
  repair: { label: "กำลังดำเนินการ", steps: ["in_repair", "reworking"], count: (c) => c.inRepair, empty: "ไม่มีงานที่กำลังดำเนินการ", dot: "bg-status-in-progress" },
  rating: { label: "รอประเมินตรวจงาน", steps: ["awaiting_rating"], count: (c) => c.resolved, empty: "ไม่มีงานที่รอผู้แจ้งประเมินตรวจงาน", dot: "bg-status-resolved" },
};
const TAB_KEYS = Object.keys(TABS) as Tab[];
const PAGE_SIZE = 5;

export function TechnicianWorkScreen() {
  const me = useCurrentUser();
  const params = useSearchParams();
  const tab: Tab = params.get("tab") === "repair" || params.get("tab") === "rating" ? (params.get("tab") as Tab) : "assess";
  const buildingId = params.get("building") ?? "all";
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const [buildings, setBuildings] = useState<Building[]>([]);
  useEffect(() => { getBuildings().then(setBuildings, () => setBuildings([])); }, []);
  const change = useCallback((values: Record<string, string | null>) => {
    const url = new URL(window.location.href);
    for (const [k, v] of Object.entries(values)) { if (v === null) url.searchParams.delete(k); else url.searchParams.set(k, v); }
    window.history.replaceState(null, "", url.pathname + url.search);
  }, []);
  if (!can(me, PERM.ticketWork)) return <><PageHeader title="งานซ่อม" variant="bar" /><ForbiddenState reason="หน้านี้สำหรับช่างเท่านั้น" /></>;
  return <>
    <PageHeader title="งานซ่อม" variant="service" service="repair" subtitle="ทุกงานที่ยังไม่ปิด เรียงตามเวลาแจ้ง (เก่าก่อน)" />
    <WorkBoard key={`${tab}|${buildingId}|${page}`} tab={tab} buildingId={buildingId} page={page} buildings={buildings} change={change} />
  </>;
}

function WorkBoard({ tab, buildingId, page, buildings, change }: { tab: Tab; buildingId: string; page: number; buildings: Building[]; change: (v: Record<string, string | null>) => void }) {
  const [counts, setCounts] = useState<TicketCounts>();
  const [items, setItems] = useState<TicketSummary[]>();
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<unknown>();
  const [revision, setRevision] = useState(0);
  const building = buildingId === "all" ? undefined : buildingId;
  useEffect(() => {
    let active = true;
    Promise.all([
      getTicketCounts({ scope: "all", buildingId: building }),
      getTickets({ scope: "all", step: TABS[tab].steps, buildingId: building, sort: "createdAt:asc", page, pageSize: PAGE_SIZE }),
    ]).then(([c, list]) => { if (active) { setCounts(c); setItems(list.items); setTotal(list.meta.total); setError(undefined); } },
      (err: unknown) => { if (active) setError(err); });
    return () => { active = false; };
  }, [tab, building, page, revision]);
  useEffect(() => {
    const reload = () => setRevision((r) => r + 1);
    window.addEventListener("focus", reload);
    return () => window.removeEventListener("focus", reload);
  }, []);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const goTo = (p: number) => { change({ page: p > 1 ? String(p) : null }); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const tabs = TAB_KEYS.map((t) => ({ value: t, label: counts ? `${TABS[t].label} ${TABS[t].count(counts)}` : TABS[t].label }));
  const pickTab = (v: string) => change({ tab: v === "assess" ? null : v, page: null });
  // Phones: tiles + the building filter on the page; desktop: one toolbar card (segmented tabs + filter).
  return <div className="space-y-3 px-4 py-4 lg:px-0 lg:py-0">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:rounded-xl lg:bg-card lg:p-3 lg:shadow-card lg:ring-1 lg:ring-foreground/10">
      <StepTiles value={tab} counts={counts} onValueChange={pickTab} />
      <SegmentedControl label="ขั้นของงาน" value={tab} options={tabs} onValueChange={pickTab} className="hidden lg:flex lg:flex-1" />
      <FilterPill size="sm" label="อาคาร" icon={Building2} value={buildingId} defaultValue="all" className="self-start lg:self-auto"
        options={[{ value: "all", label: "ทุกอาคาร" }, ...buildings.map((b) => ({ value: b.id, label: b.name }))]} onValueChange={(v) => change({ building: v === "all" ? null : v, page: null })} />
    </div>
    {error !== undefined ? <ErrorState variant="inline" title="โหลดงานซ่อมไม่สำเร็จ" onRetry={() => setRevision((r) => r + 1)} />
      : !items ? <div className="space-y-2" aria-busy="true" aria-label="กำลังโหลดงานซ่อม">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}</div>
      : items.length === 0 && page > 1 ? <EmptyState title="ไม่มีงานในหน้านี้" action={<Button variant="outline" onClick={() => goTo(1)}><RotateCcw aria-hidden />กลับหน้าแรก</Button>} />
      : items.length === 0 ? <EmptyState title={building ? "ไม่มีงานในอาคารนี้" : TABS[tab].empty} action={building ? <Button variant="outline" onClick={() => change({ building: null, page: null })}>ดูทุกอาคาร</Button> : undefined} />
      : <Card className="gap-0 py-0 shadow-card">
        <div className="divide-y">{items.map((t) => <WorkRow key={t.id} ticket={t} />)}</div>
        <footer className="flex flex-col items-center gap-2 border-t px-3.5 py-3 sm:flex-row sm:justify-between">
          <p className="text-[13px] text-muted-foreground">{pageRange(page, PAGE_SIZE, total, "งาน")}</p>
          <Pager page={page} pages={pages} onPage={goTo} />
        </footer>
      </Card>}
  </div>;
}

/** Phones / tablets (below `lg`, CR-041): the three steps as equal tiles — count on top, label below (may wrap). */
function StepTiles({ value, counts, onValueChange }: { value: Tab; counts?: TicketCounts; onValueChange: (v: string) => void }) {
  return <RadioGroupPrimitive.Root value={value} onValueChange={onValueChange} aria-label="ขั้นของงาน" orientation="horizontal" className="grid grid-cols-3 gap-2 lg:hidden">
    {TAB_KEYS.map((t) => {
      const n = counts ? TABS[t].count(counts) : undefined;
      return <RadioGroupPrimitive.Item key={t} value={t} aria-label={n === undefined ? TABS[t].label : `${TABS[t].label} ${n}`}
        className="group flex min-h-21 min-w-0 flex-col items-start justify-between gap-2 rounded-xl border bg-card p-3 text-left shadow-card outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/30 data-[state=checked]:border-foreground data-[state=checked]:bg-foreground data-[state=checked]:text-white">
        <span className="flex w-full items-center justify-between gap-1">
          <span className="font-heading text-2xl leading-none font-bold tabular-nums">{n ?? <Skeleton className="h-6 w-6 rounded-sm group-data-[state=checked]:bg-white/25" />}</span>
          <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full ring-2 ring-card group-data-[state=checked]:ring-foreground", TABS[t].dot)} />
        </span>
        <span className="text-[13px] leading-4.5 font-semibold text-balance text-muted-foreground group-data-[state=checked]:text-white/85">{TABS[t].label}</span>
      </RadioGroupPrimitive.Item>;
    })}
  </RadioGroupPrimitive.Root>;
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
