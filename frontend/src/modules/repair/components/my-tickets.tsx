"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Bell, ChevronDown, ChevronRight, CircleCheck, Clock, FolderCheck, Info, List, ListFilter, Loader2, Plus, RotateCcw, Search, Star, UserRound, Wrench,
  type LucideIcon,
} from "lucide-react";
import { Mascot } from "@/components/shared/mascot";
import { EmptyState, ErrorState, ForbiddenState } from "@/components/shared/states";
import { FilterPill } from "@/components/shared/filter-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getTicketCounts, getTickets } from "../api";
import { errorCode } from "../errors";
import type { TicketCounts, TicketCountsQuery, TicketSort, TicketStatus, TicketSummary } from "../types";
import { autoCloseText } from "./ticket-progress";
import { CLOSED_LABELS, dayLabel, listDate, placeLine, STEP, stepLabel, ticketHref, ticketTitle } from "./ticket-presentation";
import { TicketLink } from "./ticket-navigation";

// S06 ติดตามงานซ่อม (CR-011): heading with the white leopard, a review banner when the reporter has work to check,
// relation tabs, date / sort / search, then the tickets grouped by status (รอประเมินตรวจงาน · กำลังดำเนินการ ·
// ปิดงานแล้ว), each group collapsible and paged on its own. No status filter (owner, 2026-10-18). Priority,
// contractor and other staff-side fields are left out on purpose.

const RANGES = [
  { value: "all", label: "ทั้งหมด" },
  { value: "7", label: "7 วันล่าสุด" },
  { value: "30", label: "30 วันล่าสุด" },
  { value: "90", label: "90 วันล่าสุด" },
];
const SORTS: { value: string; label: string; sort?: TicketSort }[] = [
  { value: "updated", label: "อัปเดตล่าสุดก่อน" },
  { value: "newest", label: "แจ้งล่าสุดก่อน", sort: "createdAt:desc" },
  { value: "oldest", label: "แจ้งเก่าสุดก่อน", sort: "createdAt:asc" },
];
const RELATIONS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "all", label: "ทั้งหมด", icon: List },
  { value: "reported", label: "ที่ฉันแจ้ง", icon: UserRound },
  { value: "following", label: "ที่ฉันติดตาม", icon: Bell },
];
const PAGE_SIZE = 20;

type Group = { status: TicketStatus; title: string; hint: string; icon: LucideIcon; tone: string; count: (c: TicketCounts) => number };
const GROUPS: Group[] = [
  { status: "resolved", title: "รอประเมินตรวจงาน", hint: "ผู้แจ้งตรวจผลซ่อมก่อนปิดงาน", icon: Star, tone: "bg-attention/10 text-attention", count: (c) => c.resolved },
  { status: "in_progress", title: "กำลังดำเนินการ", hint: "งานที่รับเรื่องแล้วและอยู่ระหว่างซ่อม", icon: Wrench, tone: "bg-secondary text-secondary-foreground", count: (c) => c.inProgress },
  { status: "closed", title: "ปิดงานแล้ว", hint: "เก็บไว้ดูประวัติการซ่อม", icon: FolderCheck, tone: "bg-success/10 text-success", count: (c) => c.closed },
];

type Change = (values: Record<string, string | null>, replace?: boolean) => void;
type Filters = { q: string; range: string; scope: string; sort: string };

const pick = (list: { value: string }[], value: string | null) => (list.some((o) => o.value === value) ? value! : list[0].value);
function uniqueById(tickets: TicketSummary[]) { const seen = new Set<string>(); return tickets.filter((t) => !seen.has(t.id) && seen.add(t.id)); }
function baseQuery({ q, range, scope }: Filters): TicketCountsQuery {
  // createdFrom per request so a page kept open (or kept alive by cacheComponents) does not drift.
  return { scope: "mine", q: q || undefined, relation: scope as "all" | "reported" | "following", createdFrom: range === "all" ? undefined : new Date(Date.now() - Number(range) * 86_400_000).toISOString() };
}
const sortOf = (filters: Filters) => SORTS.find((s) => s.value === filters.sort)?.sort;

export function MyTicketsScreen() {
  const params = useSearchParams();
  const q = (params.get("q") ?? "").slice(0, 50);
  const range = pick(RANGES, params.get("range"));
  const scope = pick(RELATIONS, params.get("scope"));
  const sort = pick(SORTS, params.get("sort"));
  const [draft, setDraft] = useState({ query: q, value: q });
  if (draft.query !== q) setDraft({ query: q, value: q });
  const text = draft.query === q ? draft.value : q;
  // Collapsed groups survive filter changes (the board below remounts per filter set).
  const [collapsed, setCollapsed] = useState<ReadonlySet<TicketStatus>>(new Set());
  const change: Change = useCallback((values, replace = false) => {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(values)) { if (value === null || value === "") url.searchParams.delete(key); else url.searchParams.set(key, value); }
    const href = url.pathname + url.search;
    if (replace) window.history.replaceState(null, "", href);
    else window.history.pushState(null, "", href);
  }, []);
  useEffect(() => {
    if (text === q) return;
    const timer = window.setTimeout(() => change({ q: text }, true), 300);
    return () => window.clearTimeout(timer);
  }, [text, q, change]);
  const filters = { q, range, scope, sort };
  const filtered = q !== "" || range !== "all" || scope !== "all" || sort !== "updated";
  const reset = () => { setDraft({ query: q, value: "" }); change({ q: null, range: null, scope: null, sort: null }); };

  const toolbar = <>
    <div className="flex items-end justify-between gap-3 border-b px-4 lg:px-6">
      <div role="group" aria-label="งานที่แสดง" className="-mb-px flex min-w-0 gap-1 overflow-x-auto">
        {RELATIONS.map((r) => <button key={r.value} type="button" aria-pressed={scope === r.value} onClick={() => change({ scope: r.value === "all" ? null : r.value })}
          className={cn("flex min-h-12 shrink-0 items-center gap-1.5 border-b-2 px-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/30 sm:px-3",
            scope === r.value ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
          <r.icon className="size-4" aria-hidden />{r.label}
        </button>)}
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-2 px-4 pt-4 lg:px-6">
      <div className="relative min-w-0 basis-full sm:flex-1 sm:basis-64">
        <Search className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-muted-foreground" aria-hidden />
        <Input type="search" aria-label="ค้นหาเลขงาน หรือสถานที่" placeholder="ค้นหาเลขงาน หรือสถานที่" maxLength={50} value={text}
          onChange={(e) => setDraft({ query: q, value: e.target.value })} className="h-11 rounded-lg bg-card pr-3 pl-10 text-sm" />
      </div>
      <FilterPill label="วันที่แจ้ง" icon={Clock} value={range} defaultValue="all" options={RANGES} onValueChange={(v) => change({ range: v === "all" ? null : v })} />
      <FilterPill label="เรียง" icon={ListFilter} value={sort} defaultValue="updated" options={SORTS} onValueChange={(v) => change({ sort: v === "updated" ? null : v })} />
      {filtered && <Button type="button" variant="ghost" className="h-11 px-3 text-muted-foreground" onClick={reset}><RotateCcw aria-hidden />ล้างตัวกรอง</Button>}
    </div>
    <p className="flex items-start gap-1.5 px-4 pt-3 text-[13px] leading-5 text-muted-foreground lg:px-6"><Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />งานที่รอคุณประเมินแสดงก่อน · กดชื่อเรื่องหรือปุ่มท้ายแถวเพื่อดูรายละเอียด</p>
  </>;

  return <div className="px-4 pt-4 pb-8 lg:px-0 lg:pt-2">
    <header className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <div className="flex min-w-0 flex-1 basis-72 items-center gap-3">
        <Mascot pose="leopard" size={56} className="shrink-0" priority />
        <div className="min-w-0">
          <h1 className="text-2xl leading-9 font-semibold lg:text-[28px] lg:leading-10">ติดตามงานซ่อม</h1>
          <p className="text-sm text-muted-foreground">งานที่คุณแจ้งและติดตาม · ดูความคืบหน้าและตรวจงานเมื่อซ่อมเสร็จ</p>
        </div>
      </div>
      <Button asChild className="h-11 max-sm:w-full"><Link href="/repair/new"><Plus aria-hidden />แจ้งซ่อมใหม่</Link></Button>
    </header>
    <Board key={`${q}|${range}|${scope}|${sort}`} filters={filters} filtered={filtered} onReset={reset} toolbar={toolbar}
      collapsed={collapsed} onToggle={(s) => setCollapsed((old) => { const next = new Set(old); if (!next.delete(s)) next.add(s); return next; })} />
  </div>;
}

// ---- data: counts + one paged list per group ----

type GroupData = { items: TicketSummary[]; total: number; pages: number; more: "idle" | "busy" | "error" };
type Data = { revision: number; counts?: TicketCounts; groups?: Record<TicketStatus, GroupData>; error?: unknown };

function useBoard(filters: Filters) {
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<Data>();
  const pages = useRef<Record<TicketStatus, number>>({ resolved: 1, in_progress: 1, closed: 1 });
  const generation = useRef(0);
  const reload = useCallback(() => setRevision((r) => r + 1), []);
  const { q, range, scope, sort } = filters;
  // Also re-runs when a hidden route is shown again (cacheComponents), which refreshes the lists.
  useEffect(() => {
    let active = true;
    const current = ++generation.current;
    const f = { q, range, scope, sort };
    const base = baseQuery(f);
    (async () => {
      try {
        // A refresh refetches every loaded page of a group in one request (the API caps pageSize at 100).
        const [counts, ...lists] = await Promise.all([
          getTicketCounts(base),
          ...GROUPS.map((g) => getTickets({ ...base, status: [g.status], sort: sortOf(f), page: 1, pageSize: Math.min(PAGE_SIZE * pages.current[g.status], 100) })),
        ]);
        if (!active || current !== generation.current) return;
        const groups = Object.fromEntries(GROUPS.map((g, i) => [g.status, { items: uniqueById(lists[i].items), total: lists[i].meta.total, pages: pages.current[g.status], more: "idle" }])) as Record<TicketStatus, GroupData>;
        setData({ revision, counts, groups });
      } catch (error: unknown) { if (active) setData({ revision, error }); }
    })();
    return () => { active = false; };
  }, [q, range, scope, sort, revision]);
  useEffect(() => { window.addEventListener("focus", reload); return () => window.removeEventListener("focus", reload); }, [reload]);

  const setGroup = (status: TicketStatus, patch: (g: GroupData) => GroupData) =>
    setData((old) => old?.groups ? { ...old, groups: { ...old.groups, [status]: patch(old.groups[status]) } } : old);
  async function loadMore(status: TicketStatus) {
    const group = data?.groups?.[status];
    if (!group || group.more === "busy") return;
    setGroup(status, (g) => ({ ...g, more: "busy" }));
    const current = generation.current;
    try {
      const next = await getTickets({ ...baseQuery(filters), status: [status], sort: sortOf(filters), page: pages.current[status] + 1, pageSize: PAGE_SIZE });
      if (current !== generation.current) return;
      pages.current[status] += 1;
      setGroup(status, (g) => ({ items: uniqueById([...g.items, ...next.items]), total: next.meta.total, pages: pages.current[status], more: "idle" }));
    } catch { setGroup(status, (g) => ({ ...g, more: "error" })); }
  }
  // Skeleton on the first load and on retry after an error; focus refreshes keep the lists on screen.
  const loading = !data || (data.revision !== revision && !!data.error);
  return { data, loading, reload, loadMore };
}

type BoardProps = {
  filters: Filters; filtered: boolean; onReset: () => void; toolbar: ReactNode;
  collapsed: ReadonlySet<TicketStatus>; onToggle: (s: TicketStatus) => void;
};

function Board({ filters, filtered, onReset, toolbar, collapsed, onToggle }: BoardProps) {
  const { data, loading, reload, loadMore } = useBoard(filters);
  const counts = data?.counts;
  const groups = data?.groups;
  const total = counts ? counts.inProgress + counts.resolved + counts.closed : 0;
  const failure = !loading && data?.error !== undefined
    && (errorCode(data.error) === "FORBIDDEN" ? <ForbiddenState /> : <ErrorState variant="inline" title="โหลดงานของคุณไม่สำเร็จ" onRetry={reload} />);
  const ready = !loading && !failure && counts && groups;

  if (ready && total === 0 && !filtered) {
    return <div className="mt-5"><EmptyState title="ยังไม่มีงานที่คุณแจ้ง" hint="เจออะไรเสีย ถ่ายรูปแล้วแจ้ง BAMBAM ได้เลย หรือสแกน QR ที่ติดบนอุปกรณ์"
      action={<Button asChild><Link href="/repair/new">แจ้งซ่อม</Link></Button>} /></div>;
  }

  // The reporter's own tickets awaiting the rating come first in the resolved group (BR-F06-2).
  const review = ready ? groups.resolved.items.find((t) => t.awaitingMyConfirmation) : undefined;
  const awaiting = counts?.awaitingMyConfirmation ?? 0;
  const shown = GROUPS.filter((g) => counts && g.count(counts) > 0);

  return <>
    {review && awaiting > 0 && <TicketLink href={ticketHref(review.id)}
      className="group mt-5 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-attention/30 bg-card px-4 py-3.5 shadow-card outline-none hover:border-attention/50 focus-visible:ring-3 focus-visible:ring-ring/30 sm:px-5">
      <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-lg bg-attention/10 text-attention"><CircleCheck className="size-5" /></span>
      <span className="min-w-0 flex-1 basis-56">
        <b className="block text-[15px] leading-6 font-semibold">ซ่อมเสร็จแล้ว · มี {awaiting} งานรอคุณตรวจ</b>
        <span className="block text-sm text-muted-foreground">ตรวจผลการซ่อมและให้คะแนน เพื่อปิดงานที่คุณแจ้ง</span>
      </span>
      <span className="inline-flex h-10 items-center gap-1 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">ไปตรวจงาน<ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden /></span>
    </TicketLink>}

    <section aria-label="รายการงานซ่อม" className="mt-5 overflow-hidden rounded-xl border bg-card shadow-card">
      {toolbar}
      <div className="space-y-4 px-4 pt-4 pb-5 lg:px-6" aria-busy={loading}>
        <p role="status" className="sr-only">{ready ? `พบ ${total} งาน` : ""}</p>
        {loading ? <ListSkeleton /> : failure ? failure : ready && total === 0
          ? <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-base font-semibold">{filters.q ? `ไม่พบงานที่ตรงกับ "${filters.q}"` : "ไม่พบงานตามตัวกรองนี้"}</p>
            <p className="text-sm text-muted-foreground">ลองเปลี่ยนคำค้นหรือช่วงวันที่</p>
            <Button variant="outline" onClick={onReset}>ล้างตัวกรอง</Button>
          </div>
          : ready && <>
            {shown.map((g) => <TicketGroup key={g.status} group={g} count={g.count(counts)} data={groups[g.status]}
              open={!collapsed.has(g.status)} onToggle={() => onToggle(g.status)} onMore={() => loadMore(g.status)} />)}
            <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
              <span>ทั้งหมด {total} งาน ใน {shown.length} กลุ่ม</span>
              {counts.resolved > 0 && <span>งานรอคุณประเมินแสดงก่อนในกลุ่ม</span>}
            </div>
          </>}
      </div>
    </section>
  </>;
}

function TicketGroup({ group: g, count, data, open, onToggle, onMore }: { group: Group; count: number; data: GroupData; open: boolean; onToggle: () => void; onMore: () => void }) {
  const id = `group-${g.status}`;
  return <section aria-labelledby={`${id}-title`} className="overflow-hidden rounded-lg border">
    <h2 id={`${id}-title`} className="bg-muted/40">
      <button type="button" aria-expanded={open} aria-controls={id} onClick={onToggle}
        className="flex min-h-14 w-full items-center gap-2.5 px-3 py-2 text-left outline-none hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:ring-inset sm:px-4">
        <ChevronDown aria-hidden className={cn("size-4 shrink-0 text-muted-foreground transition-transform", !open && "-rotate-90")} />
        <span aria-hidden className={cn("grid size-8 shrink-0 place-items-center rounded-lg", g.tone)}><g.icon className="size-4" /></span>
        <span className="text-base font-semibold">{g.title}</span>
        <span className="rounded-full border bg-card px-2 text-xs leading-5 font-medium text-muted-foreground">{count} งาน</span>
        <span className="ml-auto hidden text-[13px] font-normal text-muted-foreground md:block">{g.hint}</span>
      </button>
    </h2>
    <div id={id} hidden={!open} className="border-t">
      {/* Desktop: table · phone / tablet: one card per ticket. */}
      <table className="hidden w-full table-fixed border-collapse text-left lg:table">
        <caption className="sr-only">{g.title}</caption>
        <thead className="text-[13px] text-muted-foreground">
          <tr className="border-b">
            <th scope="col" className="w-7/25 px-4 py-2.5 font-medium">เรื่องที่แจ้ง</th>
            <th scope="col" className="w-1/5 px-3 py-2.5 font-medium">สถานที่</th>
            <th scope="col" className="w-11/50 px-3 py-2.5 font-medium">สถานะล่าสุด</th>
            <th scope="col" className="w-3/20 px-3 py-2.5 font-medium">กำหนด / อัปเดต</th>
            <th scope="col" className="w-3/20 px-4 py-2.5 text-right font-medium">รายละเอียด</th>
          </tr>
        </thead>
        <tbody className="divide-y">{data.items.map((t) => <Row key={t.id} ticket={t} />)}</tbody>
      </table>
      <ul className="divide-y lg:hidden">{data.items.map((t) => <Card key={t.id} ticket={t} />)}</ul>
      {(data.items.length < data.total || data.more === "error") && <div className="space-y-2 border-t px-4 py-3 text-center">
        {data.more === "error" && <ErrorState variant="inline" title="โหลดงานเพิ่มไม่สำเร็จ" onRetry={onMore} />}
        {data.items.length < data.total && <Button variant="outline" className="h-11 w-full sm:w-auto sm:px-8" disabled={data.more === "busy"} onClick={onMore}>
          {data.more === "busy" && <Loader2 className="animate-spin" aria-hidden />}โหลดเพิ่ม</Button>}
        <p className="text-xs text-muted-foreground">แสดง {data.items.length} จาก {data.total} งาน</p>
      </div>}
    </div>
  </section>;
}

// ---- one ticket ----

/** Second line under the status: what the viewer is waiting for at this step. */
function statusCaption(ticket: TicketSummary): ReactNode {
  switch (ticket.step) {
    case "awaiting_assessment": return "รอช่างกำหนดวันเสร็จ";
    case "in_repair": return "ช่างกำลังดำเนินการ";
    case "reworking": return "ช่างแก้ไขตามที่ส่งกลับ";
    case "awaiting_rating": return ticket.awaitingMyConfirmation ? (ticket.autoCloseAt ? autoCloseText(ticket.autoCloseAt) : "ตรวจผลซ่อมและให้คะแนน") : "รอผู้แจ้งประเมินตรวจงาน";
    default:
      // How it closed; the score itself lives on S07 (owner, 2026-10-19).
      if (ticket.closedReason === "confirmed" && ticket.rating) {
        return <>{CLOSED_LABELS.confirmed} · <span className="font-medium text-foreground tabular-nums">{ticket.rating}/5</span></>;
      }
      return ticket.closedReason ? CLOSED_LABELS[ticket.closedReason] : "";
  }
}

/** The date the viewer cares about at this step. A send back keeps the old date on the ticket, so it is not shown here. */
function dueText(ticket: TicketSummary): { label: string; value: string; muted: boolean } {
  switch (ticket.step) {
    case "awaiting_assessment": return { label: "คาดว่าจะเสร็จ", value: "รอช่างกำหนด", muted: true };
    case "in_repair": return ticket.expectedDoneOn ? { label: "คาดว่าจะเสร็จ", value: dayLabel(ticket.expectedDoneOn, true), muted: false } : { label: "คาดว่าจะเสร็จ", value: "—", muted: true };
    case "reworking": return { label: "คาดว่าจะเสร็จ", value: "ดูวันใหม่ในรายละเอียด", muted: true };
    default: return ticket.resolvedAt ? { label: "ผลซ่อม", value: "ซ่อมเสร็จแล้ว", muted: false } : { label: "สถานะ", value: "ปิดงานแล้ว", muted: false };
  }
}

function Badge({ ticket }: { ticket: TicketSummary }) {
  const mine = ticket.awaitingMyConfirmation;
  return <span className={cn("inline-flex max-w-full items-center gap-1.5 rounded-[5px] px-2 py-px text-xs leading-5 font-semibold", mine ? "bg-attention/10 text-attention" : STEP[ticket.step].color)}>
    <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" /><span className="truncate">{stepLabel(ticket)}</span>
  </span>;
}

function Place({ ticket }: { ticket: TicketSummary }) {
  return <>
    <span className="block truncate text-sm">{ticket.building.name}</span>
    <span className="block truncate text-[13px] text-muted-foreground">{placeLine(ticket)}</span>
  </>;
}

/** `dense`: desktop table rows (pointer input), so the row is not held open by a 44px touch target. */
function OpenLink({ ticket, className, dense }: { ticket: TicketSummary; className?: string; dense?: boolean }) {
  const href = ticketHref(ticket.id);
  if (ticket.awaitingMyConfirmation) {
    return <Button asChild className={cn(dense ? "h-9" : "h-10", className)}>
      <TicketLink href={href} aria-label={`ตรวจงาน ${ticket.ticketNo}`}>ตรวจงาน<ChevronRight aria-hidden /></TicketLink>
    </Button>;
  }
  return <TicketLink href={href} aria-label={`ดูงาน ${ticket.ticketNo}`}
    className={cn("inline-flex items-center gap-1 rounded-sm px-2 text-sm font-semibold text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/30", dense ? "min-h-9" : "min-h-11", className)}>
    ดูงาน<ChevronRight className="size-4" aria-hidden />
  </TicketLink>;
}

/** Desktop rows keep the title to one line (full text on hover) so every row is two lines tall. */
function Title({ ticket, compact }: { ticket: TicketSummary; compact?: boolean }) {
  const title = ticketTitle(ticket);
  return <>
    <TicketLink href={ticketHref(ticket.id)} title={compact ? title : undefined}
      className={cn("block text-[15px] leading-6 font-semibold outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/30", compact ? "truncate" : "line-clamp-2")}>{title}</TicketLink>
    <span className="block truncate text-xs leading-5 text-muted-foreground"><span className="tracking-wide">{ticket.ticketNo}</span>{ticket.viewerRelation === "subscriber" && " · คุณติดตามงานนี้"}</span>
  </>;
}

function Row({ ticket }: { ticket: TicketSummary }) {
  const due = dueText(ticket);
  const caption = ticket.step === "awaiting_rating" && ticket.awaitingMyConfirmation && ticket.autoCloseAt ? autoCloseText(ticket.autoCloseAt) : undefined;
  return <tr className={cn("align-middle transition-colors hover:bg-muted/40", ticket.awaitingMyConfirmation && "bg-attention/4")}>
    <td className={cn("px-4 py-2.5", ticket.awaitingMyConfirmation && "border-l-3 border-l-attention")}><Title ticket={ticket} compact /></td>
    <td className="px-3 py-2.5"><Place ticket={ticket} /></td>
    <td className="px-3 py-2.5"><Badge ticket={ticket} /><span title={caption} className="mt-0.5 block truncate text-xs leading-5 text-muted-foreground">{statusCaption(ticket)}</span></td>
    <td className="px-3 py-2.5">
      <span className={cn("block truncate text-sm leading-5", due.muted ? "text-muted-foreground" : "font-medium")}>{due.value}</span>
      <time dateTime={ticket.updatedAt} className="block text-xs leading-5 text-muted-foreground">อัปเดต {listDate(ticket.updatedAt)}</time>
    </td>
    <td className="px-4 py-2 text-right"><OpenLink ticket={ticket} dense /></td>
  </tr>;
}

function Card({ ticket }: { ticket: TicketSummary }) {
  const due = dueText(ticket);
  return <li className={cn("space-y-2.5 px-4 py-4", ticket.awaitingMyConfirmation && "border-l-3 border-l-attention bg-attention/4")}>
    <div><Title ticket={ticket} /></div>
    <div><Place ticket={ticket} /></div>
    <div><Badge ticket={ticket} /><span className="mt-1 block text-xs leading-5 text-muted-foreground">{statusCaption(ticket)}</span></div>
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        <span className="block text-xs text-muted-foreground">{due.label}</span>
        <span className={cn("block text-sm", due.muted ? "text-muted-foreground" : "font-semibold")}>{due.value}</span>
        <time dateTime={ticket.updatedAt} className="block text-xs leading-5 text-muted-foreground">อัปเดต {listDate(ticket.updatedAt)}</time>
      </div>
      <OpenLink ticket={ticket} className="shrink-0" />
    </div>
  </li>;
}

function ListSkeleton() {
  return <div aria-label="กำลังโหลดงานซ่อม" className="space-y-4">
    {[0, 1].map((g) => <div key={g} className="overflow-hidden rounded-lg border">
      <div className="flex items-center gap-2.5 bg-muted/40 px-4 py-3"><Skeleton className="size-8 rounded-lg" /><Skeleton className="h-4 w-36" /></div>
      {[0, 1, 2].map((i) => <div key={i} className="flex items-center gap-4 border-t px-4 py-3"><div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-1/3" /></div><Skeleton className="hidden h-5 w-28 rounded-[5px] sm:block" /></div>)}
    </div>)}
  </div>;
}
