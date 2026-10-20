"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Building2, ChevronLeft, ChevronRight, CircleX, Eye, Flag, FolderOpen, ListFilter, RotateCcw, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PriorityIndicator } from "@/components/shared/priority-indicator";
import { EmptyState, ErrorState, ForbiddenState } from "@/components/shared/states";
import { FilterPill } from "@/components/shared/filter-pill";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { useCurrentUser } from "@/components/shared/me-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { getBuildings, getCategories, getTicketCounts, getTickets } from "../api";
import { CLOSED_REASONS, PRIORITIES, type Building, type Category, type ClosedReason, type Priority, type TicketCounts, type TicketCountsQuery, type TicketStep, type TicketSummary } from "../types";
import { CloseTicketDialog, CLOSED_TOAST } from "./ticket-actions";
import { TicketLink } from "./ticket-navigation";
import { autoCloseText, TicketThumb } from "./ticket-progress";
import { categoryName, CLOSED_LABELS, dayLabel, listDate, PRIORITY_LABELS, ticketHref, ticketLocation, ticketTitle, todayBangkok } from "./ticket-presentation";

// S11 งานทั้งหมด (Stage 3 re-spec, CR-005 + CR-015): admin and executive see every ticket by step, filter by
// category / building / priority (information only) / closed reason, search by ticket no or place. Open tabs list
// the oldest report first (BR-F22-1); closed lists the newest closed first. Admin closes an open ticket (F08-B);
// the executive gets the same page read-only (BR-F22-6). Table from 1024px, card rows below.

type Tab = "assess" | "repair" | "rating" | "closed";
const TABS: Record<Tab, { label: string; steps: TicketStep[]; count: (c: TicketCounts) => number; empty: string }> = {
  assess: { label: "รับเรื่อง", steps: ["awaiting_assessment"], count: (c) => c.awaitingAssessment, empty: "ไม่มีงานที่รอช่างเริ่มดำเนินการ" },
  repair: { label: "กำลังดำเนินการ", steps: ["in_repair", "reworking"], count: (c) => c.inRepair, empty: "ไม่มีงานที่ช่างกำลังดำเนินการ" },
  rating: { label: "รอประเมินตรวจงาน", steps: ["awaiting_rating"], count: (c) => c.resolved, empty: "ไม่มีงานที่รอผู้แจ้งประเมินตรวจงาน" },
  closed: { label: "ปิดแล้ว", steps: ["closed"], count: (c) => c.closed, empty: "ยังไม่มีงานที่ปิดแล้ว" },
};
const TAB_KEYS = Object.keys(TABS) as Tab[];
const PAGE_SIZE = 20;

type Filters = { tab: Tab; category: string; building: string; priority: string; reason: string; q: string; page: number };
type Change = (values: Record<string, string | null>) => void;

const oneOf = <T extends string>(list: readonly T[], value: string | null, fallback: T): T => (list.includes(value as T) ? (value as T) : fallback);

export function AdminTicketsScreen() {
  const me = useCurrentUser();
  const params = useSearchParams();
  const q = (params.get("q") ?? "").slice(0, 50);
  const filters: Filters = {
    tab: oneOf(TAB_KEYS, params.get("tab"), "assess"),
    category: params.get("category") ?? "all",
    building: params.get("building") ?? "all",
    priority: oneOf(["all", ...PRIORITIES], params.get("priority"), "all"),
    reason: oneOf(["all", ...CLOSED_REASONS], params.get("reason"), "all"),
    q,
    page: Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1),
  };
  const [draft, setDraft] = useState({ query: q, value: q });
  if (draft.query !== q) setDraft({ query: q, value: q });
  const text = draft.query === q ? draft.value : q;
  const [categories, setCategories] = useState<Category[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  useEffect(() => {
    getCategories().then(setCategories, () => setCategories([]));
    getBuildings().then(setBuildings, () => setBuildings([]));
  }, []);
  // Every filter change starts again at page 1; tab / filters / search / page live in the URL.
  const change: Change = useCallback((values) => {
    const url = new URL(window.location.href);
    if (!("page" in values)) url.searchParams.delete("page");
    for (const [k, v] of Object.entries(values)) { if (v === null || v === "") url.searchParams.delete(k); else url.searchParams.set(k, v); }
    window.history.replaceState(null, "", url.pathname + url.search);
  }, []);
  useEffect(() => {
    if (text === q) return;
    const timer = window.setTimeout(() => change({ q: text }), 300);
    return () => window.clearTimeout(timer);
  }, [text, q, change]);

  if (me.role !== "admin" && me.role !== "executive") {
    return <><PageHeader title="งานทั้งหมด" variant="bar" /><ForbiddenState reason="หน้านี้สำหรับ Admin และผู้บริหาร" /></>;
  }
  const readOnly = me.role === "executive";
  const filtered = filters.category !== "all" || filters.building !== "all" || filters.priority !== "all" || filters.reason !== "all" || q !== "";
  const reset = () => { setDraft({ query: q, value: "" }); change({ category: null, building: null, priority: null, reason: null, q: null }); };
  const key = [filters.tab, filters.category, filters.building, filters.priority, filters.reason, q, filters.page].join("|");

  return <>
    <PageHeader title="งานทั้งหมด" variant="service" service="repair" subtitle="ทุกงานแจ้งซ่อม เรียงตามเวลาแจ้ง (เก่าก่อน)" />
    <div className="space-y-3 px-4 py-4 lg:px-0 lg:py-0">
      {readOnly && <p role="note" className="flex items-center gap-2 rounded-lg border bg-muted px-3.5 py-2.5 text-sm text-muted-foreground">
        <Eye className="size-4 shrink-0" aria-hidden />โหมดดูอย่างเดียว — ผู้บริหารดูงานได้ แต่ปิดงานหรือแก้ไขไม่ได้</p>}
      <Card className="gap-3 p-3 shadow-card">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 lg:w-80">
            <Search className="pointer-events-none absolute top-3 left-3.5 size-4 text-muted-foreground" aria-hidden />
            <Input type="search" aria-label="ค้นหาเลขงาน หรือสถานที่" placeholder="ค้นหาเลขงาน หรือสถานที่" maxLength={50} value={text}
              onChange={(e) => setDraft({ query: q, value: e.target.value })} className="h-10 rounded-lg bg-card pr-3 pl-10 text-sm" />
          </div>
          <div className="-mx-3 flex items-center gap-2 overflow-x-auto px-3 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
            <FilterPill size="sm" label="หมวดงาน" icon={FolderOpen} value={filters.category} defaultValue="all"
              options={[{ value: "all", label: "ทุกหมวด" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} onValueChange={(v) => change({ category: v === "all" ? null : v })} />
            <FilterPill size="sm" label="อาคาร" icon={Building2} value={filters.building} defaultValue="all"
              options={[{ value: "all", label: "ทุกอาคาร" }, ...buildings.map((b) => ({ value: b.id, label: b.name }))]} onValueChange={(v) => change({ building: v === "all" ? null : v })} />
            <FilterPill size="sm" label="ความเร่งด่วน" icon={Flag} value={filters.priority} defaultValue="all"
              options={[{ value: "all", label: "ทุกระดับ" }, ...PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))]} onValueChange={(v) => change({ priority: v === "all" ? null : v })} />
            {filters.tab === "closed" && <FilterPill size="sm" label="เหตุผลที่ปิด" icon={ListFilter} value={filters.reason} defaultValue="all"
              options={[{ value: "all", label: "ทุกเหตุผล" }, ...CLOSED_REASONS.map((r) => ({ value: r, label: CLOSED_LABELS[r] }))]} onValueChange={(v) => change({ reason: v === "all" ? null : v })} />}
            {filtered && <Button type="button" variant="ghost" className="h-10 px-3 text-muted-foreground" onClick={reset}><RotateCcw aria-hidden />ล้างตัวกรอง</Button>}
          </div>
        </div>
      </Card>
      <Board key={key} filters={filters} readOnly={readOnly} filtered={filtered} change={change} reset={reset} />
    </div>
  </>;
}

function Board({ filters, readOnly, filtered, change, reset }: { filters: Filters; readOnly: boolean; filtered: boolean; change: Change; reset: () => void }) {
  const [counts, setCounts] = useState<TicketCounts>();
  const [items, setItems] = useState<TicketSummary[]>();
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<unknown>();
  const [revision, setRevision] = useState(0);
  const [closing, setClosing] = useState<TicketSummary | null>(null);
  const { tab, page } = filters;
  useEffect(() => {
    let active = true;
    const base: TicketCountsQuery = {
      scope: "all",
      q: filters.q || undefined,
      categoryId: filters.category === "all" ? undefined : filters.category,
      buildingId: filters.building === "all" ? undefined : filters.building,
      priority: filters.priority === "all" ? undefined : (filters.priority as Priority),
    };
    Promise.all([
      getTicketCounts(base),
      getTickets({
        ...base, step: TABS[tab].steps, page, pageSize: PAGE_SIZE,
        closedReason: tab === "closed" && filters.reason !== "all" ? (filters.reason as ClosedReason) : undefined,
        sort: tab === "closed" ? "closedAt:desc" : "createdAt:asc",
      }),
    ]).then(([c, list]) => { if (active) { setCounts(c); setItems(list.items); setTotal(list.meta.total); setError(undefined); } },
      (err: unknown) => { if (active) setError(err); });
    return () => { active = false; };
  }, [filters.q, filters.category, filters.building, filters.priority, filters.reason, tab, page, revision]);
  useEffect(() => {
    const reload = () => setRevision((r) => r + 1);
    window.addEventListener("focus", reload);
    return () => window.removeEventListener("focus", reload);
  }, []);

  const tabs = TAB_KEYS.map((t) => ({ value: t, label: counts && t !== "closed" ? `${TABS[t].label} ${TABS[t].count(counts)}` : TABS[t].label }));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canClose = !readOnly && tab !== "closed";
  const from = (page - 1) * PAGE_SIZE + 1;

  return <>
    {/* 4 tabs do not fit a phone: the control keeps its natural width and scrolls sideways. */}
    <div className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <SegmentedControl label="ขั้นของงาน" value={tab} options={tabs} onValueChange={(v) => change({ tab: v === "assess" ? null : v, reason: null })} className="w-max min-w-full [&>*]:flex-auto" />
    </div>
    {error !== undefined ? <ErrorState variant="inline" title="โหลดงานทั้งหมดไม่สำเร็จ" onRetry={() => setRevision((r) => r + 1)} />
      : !items ? <div className="space-y-2" aria-busy="true" aria-label="กำลังโหลดงาน">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
      : items.length === 0 ? (filtered
        ? <EmptyState title="ไม่พบงานตามตัวกรองนี้" action={<Button variant="outline" onClick={reset}>ล้างตัวกรอง</Button>} />
        : page > 1 ? <EmptyState title="ไม่มีงานในหน้านี้" action={<Button variant="outline" onClick={() => change({ page: null })}>กลับหน้าแรก</Button>} />
        : <EmptyState title={TABS[tab].empty} />)
      : <>
        <Card className="hidden gap-0 overflow-hidden py-0 shadow-card lg:flex">
          <Table>
            <TableHeader><TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-36 pl-4">เลขงาน</TableHead>
              <TableHead>เรื่อง / สถานที่</TableHead>
              <TableHead>หมวดงาน</TableHead>
              {tab !== "closed" && tab !== "rating" && <TableHead>ความเร่งด่วน</TableHead>}
              {COLUMNS[tab].map((c) => <TableHead key={c}>{c}</TableHead>)}
              {canClose && <TableHead className="w-24 pr-4"><span className="sr-only">ปิดงาน</span></TableHead>}
            </TableRow></TableHeader>
            <TableBody>{items.map((t) => <TableRow key={t.id} className="group">
              <TableCell className="pl-4 align-top font-mono text-xs text-muted-foreground">{t.ticketNo}</TableCell>
              <TableCell className="max-w-80 align-top whitespace-normal">
                <TicketLink href={ticketHref(t.id)} className="font-semibold outline-none hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring">{ticketTitle(t)}</TicketLink>
                <p className="truncate text-xs text-muted-foreground">{ticketLocation(t)}</p>
              </TableCell>
              <TableCell className="max-w-44 truncate align-top text-sm">{categoryName(t)}</TableCell>
              {tab !== "closed" && tab !== "rating" && <TableCell className="align-top"><PriorityIndicator priority={t.priority} /></TableCell>}
              {cells(tab, t).map((c, i) => <TableCell key={i} className="align-top text-sm">{c}</TableCell>)}
              {canClose && <TableCell className="pr-4 text-right align-top">
                <Button type="button" variant="ghost" size="sm" onClick={() => setClosing(t)} aria-label={`ปิดงาน ${t.ticketNo}`}
                  className="text-destructive hover:bg-destructive/5 hover:text-destructive"><CircleX aria-hidden />ปิดงาน</Button>
              </TableCell>}
            </TableRow>)}</TableBody>
          </Table>
        </Card>
        <Card className="gap-0 divide-y py-0 shadow-card lg:hidden">{items.map((t) => <MobileRow key={t.id} ticket={t} tab={tab} onClose={canClose ? () => setClosing(t) : undefined} />)}</Card>
        <nav aria-label="เลื่อนหน้า" className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">แสดง {from}–{from + items.length - 1} จาก {total} งาน</p>
          {pages > 1 && <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => change({ page: page - 1 <= 1 ? null : String(page - 1) })}><ChevronLeft aria-hidden />ก่อนหน้า</Button>
            <span className="text-sm text-muted-foreground">หน้า {page} / {pages}</span>
            <Button type="button" variant="outline" size="sm" disabled={page >= pages} onClick={() => change({ page: String(page + 1) })}>ถัดไป<ChevronRight aria-hidden /></Button>
          </div>}
        </nav>
      </>}
    {closing && <CloseTicketDialog ticket={closing} open onOpenChange={(o) => { if (!o) setClosing(null); }}
      onDone={() => { setClosing(null); toast.success(CLOSED_TOAST); setRevision((r) => r + 1); }} />}
  </>;
}

const COLUMNS: Record<Tab, string[]> = {
  assess: ["ผู้แจ้ง", "แจ้งเมื่อ"],
  repair: ["ผู้ซ่อม", "แจ้งเมื่อ", "คาดว่าจะเสร็จ", "ส่งกลับ"],
  rating: ["ผู้ซ่อม", "ซ่อมเสร็จเมื่อ", "ปิดอัตโนมัติ"],
  closed: ["เหตุผลที่ปิด", "คะแนน", "ปิดเมื่อ"],
};

function cells(tab: Tab, t: TicketSummary): React.ReactNode[] {
  const fixer = t.technician?.name ?? "–";
  switch (tab) {
    case "assess": return [t.reporter.name, listDate(t.createdAt)];
    case "repair": return [fixer, listDate(t.createdAt), <Expected key="e" ticket={t} />, t.sendBackCount > 0 ? `${t.sendBackCount} ครั้ง` : ""];
    case "rating": return [fixer, t.resolvedAt ? listDate(t.resolvedAt) : "–", t.autoCloseAt ? autoCloseText(t.autoCloseAt) : "–"];
    case "closed": return [t.closedReason ? CLOSED_LABELS[t.closedReason] : "–", t.rating ? `★ ${t.rating}` : "–", t.closedAt ? listDate(t.closedAt) : "–"];
  }
}

function Expected({ ticket }: { ticket: TicketSummary }) {
  if (!ticket.expectedDoneOn) return <>–</>;
  const late = ticket.expectedDoneOn < todayBangkok();
  return <span className={cn(late && "font-medium text-destructive")}>{late ? "เลยกำหนด " : ""}{dayLabel(ticket.expectedDoneOn)}</span>;
}

function MobileRow({ ticket: t, tab, onClose }: { ticket: TicketSummary; tab: Tab; onClose?: () => void }) {
  const meta = COLUMNS[tab].map((label, i) => ({ label, value: cells(tab, t)[i] })).filter((m) => m.value !== "" && m.value !== "–");
  return <div className="flex items-start gap-3 px-3.5 py-3.5">
    <TicketThumb ticket={t} size="sm" />
    <div className="min-w-0 flex-1 space-y-1">
      <div className="flex items-center gap-2">
        <TicketLink href={ticketHref(t.id)} className="min-w-0 flex-1 truncate font-semibold outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">{ticketTitle(t)}</TicketLink>
        {tab !== "closed" && <PriorityIndicator priority={t.priority} />}
      </div>
      <p className="truncate text-xs text-muted-foreground">{categoryName(t)} · {ticketLocation(t)}</p>
      <p className="text-xs text-muted-foreground">{t.ticketNo}{meta.map((m, i) => <span key={i}> · {m.label} {m.value}</span>)}</p>
      {onClose && <Button type="button" variant="ghost" size="sm" onClick={onClose} className="-ml-2 text-destructive hover:bg-destructive/5 hover:text-destructive"><CircleX aria-hidden />ปิดงาน</Button>}
    </div>
  </div>;
}
