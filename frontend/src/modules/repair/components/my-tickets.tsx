"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Bookmark, ChevronLeft, ChevronRight, CircleCheck, Clock, Loader2, MapPin, Search, SlidersHorizontal, Star } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PriorityIndicator } from "@/components/shared/priority-indicator";
import { EmptyState, ErrorState, ForbiddenState } from "@/components/shared/states";
import { FilterPill } from "@/components/shared/filter-pill";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { useIsDesktop } from "@/components/shared/use-media-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getTicketCounts, getTickets } from "../api";
import { errorCode } from "../errors";
import type { TicketCounts, TicketCountsQuery, TicketStatus, TicketSummary } from "../types";
import { PhotoGallery } from "./photo-gallery";
import { Timeline } from "./timeline";
import { autoCloseText, TicketProgress, TicketProgressMini, TicketThumb } from "./ticket-progress";
import { CLOSED_LABELS, listDate, shortDate, ticketHref, ticketLocation, ticketTitle } from "./ticket-presentation";
import { CopyTicketNumber, TicketFailure, TicketStatusBadge } from "./ticket-ui";
import { TicketLink } from "./ticket-navigation";
import { useTicket } from "./use-ticket";

// S06 ติดตามงานซ่อม (CR-003) — status groups + desktop list / preview panes (CR-002).

const RANGES = [
  { value: "all", label: "ทั้งหมด", short: "ทั้งหมด" },
  { value: "7", label: "7 วันล่าสุด", short: "7 วัน" },
  { value: "30", label: "30 วันล่าสุด", short: "30 วัน" },
  { value: "90", label: "90 วันล่าสุด", short: "90 วัน" },
];
const SCOPES = [{ value: "all", label: "ทั้งหมด" }, { value: "reported", label: "ที่ฉันแจ้ง" }, { value: "following", label: "ที่ฉันติดตาม" }];
const PAGE_SIZE = 20;
// A refresh refetches every "โหลดเพิ่ม" page in one request; the API caps pageSize at 100.
const MAX_REFRESH_PAGES = 5;
const CLOSED_PREVIEW = 3;

type Group = "resolved" | "open" | "closed";
const GROUPS: Record<Group, { title: string; status: TicketStatus[] }> = {
  resolved: { title: "รอประเมิน", status: ["resolved"] },
  open: { title: "กำลังดำเนินการ", status: ["in_progress"] },
  closed: { title: "ปิดแล้ว", status: ["closed"] },
};
type Change = (values: Record<string, string | null>, replace?: boolean) => void;
type Filters = { q: string; range: string; scope: string };
type GroupData = { items: TicketSummary[]; total: number };
type Board = { revision: number; counts?: TicketCounts; groups?: Partial<Record<Group, GroupData>>; error?: unknown };

const firstName = (name: string) => name.split(" ")[0];
function uniqueById(tickets: TicketSummary[]) { const seen = new Set<string>(); return tickets.filter((t) => !seen.has(t.id) && seen.add(t.id)); }
function buildQuery({ q, range, scope }: Filters): TicketCountsQuery {
  // createdFrom per request so a page kept open (or kept alive by cacheComponents) does not drift.
  return { scope: "mine", q: q || undefined, relation: scope as "all" | "reported" | "following", createdFrom: range === "all" ? undefined : new Date(Date.now() - Number(range) * 86_400_000).toISOString() };
}

export function MyTicketsScreen() {
  const params = useSearchParams();
  const q = (params.get("q") ?? "").slice(0, 50);
  const range = RANGES.some((r) => r.value === params.get("range")) ? params.get("range")! : "all";
  const scope = SCOPES.some((s) => s.value === params.get("scope")) ? params.get("scope")! : "all";
  const closedAll = params.get("closed") === "all";
  const selectedId = params.get("id");
  const desktop = useIsDesktop();
  const [draft, setDraft] = useState({ query: q, value: q });
  if (draft.query !== q) setDraft({ query: q, value: q });
  const text = draft.query === q ? draft.value : q;
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
  const search = (mobile: boolean) => <div className={cn("relative min-w-0 flex-1", !mobile && "w-64 flex-none")}><Search className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-muted-foreground" aria-hidden /><Input aria-label="ค้นหาเลขงาน หรือสถานที่" placeholder="ค้นหาเลขงาน หรือสถานที่" maxLength={50} value={text} onChange={(e) => setDraft({ query: q, value: e.target.value })} className={cn("h-11 rounded-full pr-3 pl-10 text-sm", mobile ? "border-0 bg-background" : "bg-card")} /></div>;
  const scopeControl = <SegmentedControl label="งานที่แสดง" value={scope} options={SCOPES} onValueChange={(v) => change({ scope: v === "all" ? null : v })} />;
  return <>
    <PageHeader title="ติดตามงานซ่อม" variant="service" service="repair" subtitle="งานที่คุณแจ้งและติดตาม" search={search(false)} />
    <div className="relative -mt-12 px-4 lg:hidden"><Card className="gap-2.5 p-3 shadow-float"><div className="flex gap-2">{search(true)}<FilterSheet range={range} change={change} /></div>{scopeControl}</Card></div>
    <TicketBoard key={`${q}|${range}|${scope}|${closedAll}`} filters={{ q, range, scope }} closedAll={closedAll} desktop={desktop} selectedId={selectedId} change={change}
      paneControls={<>{scopeControl}<div className="flex items-center gap-2"><FilterPill size="sm" label="ช่วงวันที่" icon={Clock} value={range} defaultValue="all" options={RANGES} onValueChange={(v) => change({ range: v === "all" ? null : v })} /></div></>} />
  </>;
}

function FilterSheet({ range, change }: { range: string; change: Change }) {
  const [open, setOpen] = useState(false);
  const [draftRange, setDraftRange] = useState(range);
  const active = range !== "all" ? 1 : 0;
  return <Sheet open={open} onOpenChange={(next) => { if (next) setDraftRange(range); setOpen(next); }}>
    <SheetTrigger asChild><Button variant="outline" className="h-11 shrink-0 gap-1.5 px-3.5" aria-label={active ? `ตัวกรอง ใช้อยู่ ${active}` : "ตัวกรอง"}><SlidersHorizontal />{active > 0 && <span className="grid size-5 place-items-center rounded-full bg-primary font-heading text-xs text-white">{active}</span>}</Button></SheetTrigger>
    <SheetContent side="bottom" className="rounded-t-3xl p-5 pb-8"><SheetHeader className="p-0"><SheetTitle>ตัวกรอง</SheetTitle><SheetDescription className="sr-only">ช่วงวันที่แจ้ง</SheetDescription></SheetHeader>
      <fieldset className="mt-2"><legend className="mb-2 text-sm font-medium">ช่วงวันที่แจ้ง</legend><SegmentedControl label="ช่วงวันที่แจ้ง" value={draftRange} options={RANGES.map((r) => ({ value: r.value, label: r.short }))} onValueChange={setDraftRange} /></fieldset>
      <SheetFooter className="mt-4 flex-row items-center gap-2 p-0"><Button variant="link" onClick={() => { change({ range: null }); setOpen(false); }}>ล้างตัวกรอง</Button><Button className="flex-1" onClick={() => { change({ range: draftRange === "all" ? null : draftRange }); setOpen(false); }}>ใช้ตัวกรอง</Button></SheetFooter>
    </SheetContent>
  </Sheet>;
}

function useMyTickets(filters: Filters, closedAll: boolean) {
  const { q, range, scope } = filters;
  const [revision, setRevision] = useState(0);
  const [board, setBoard] = useState<Board>();
  const [moreBusy, setMoreBusy] = useState<Group | null>(null);
  const [moreError, setMoreError] = useState<Group | null>(null);
  const alive = useRef(true);
  // Bumped by every load; a "โหลดเพิ่ม" response from an older load is dropped.
  const generation = useRef(0);
  const pages = useRef<Record<Group, number>>({ resolved: 1, open: 1, closed: 1 });
  const reload = useCallback(() => { setRevision((r) => r + 1); setMoreError(null); }, []);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  // Also re-runs when a hidden route is shown again (cacheComponents), which refreshes the board.
  useEffect(() => {
    let active = true;
    const current = ++generation.current;
    const keys: Group[] = closedAll ? ["closed"] : ["resolved", "open", "closed"];
    const size = (g: Group) => g === "closed" && !closedAll ? CLOSED_PREVIEW : PAGE_SIZE * Math.min(pages.current[g], MAX_REFRESH_PAGES);
    (async () => {
      try {
        const base = buildQuery({ q, range, scope });
        const [counts, ...lists] = await Promise.all([getTicketCounts(base), ...keys.map((g) => getTickets({ ...base, status: GROUPS[g].status, page: 1, pageSize: size(g) }))]);
        if (!active || current !== generation.current) return;
        const groups: Partial<Record<Group, GroupData>> = {};
        keys.forEach((g, i) => {
          if (g !== "closed" || closedAll) pages.current[g] = Math.min(pages.current[g], MAX_REFRESH_PAGES);
          groups[g] = { items: uniqueById(lists[i].items), total: lists[i].meta.total };
        });
        setBoard({ revision, counts, groups });
        setMoreError(null);
      } catch (error: unknown) { if (active) setBoard({ revision, error }); }
    })();
    return () => { active = false; };
  }, [q, range, scope, closedAll, revision]);
  useEffect(() => { window.addEventListener("focus", reload); return () => window.removeEventListener("focus", reload); }, [reload]);
  async function more(group: Group) {
    if (moreBusy || !board?.groups?.[group]) return;
    setMoreBusy(group); setMoreError(null);
    const current = generation.current;
    const page = pages.current[group] + 1;
    try {
      const next = await getTickets({ ...buildQuery({ q, range, scope }), status: GROUPS[group].status, page, pageSize: PAGE_SIZE });
      if (alive.current && current === generation.current) {
        pages.current[group] = page;
        setBoard((old) => old?.groups?.[group] ? { ...old, groups: { ...old.groups, [group]: { items: uniqueById([...old.groups[group]!.items, ...next.items]), total: next.meta.total } } } : old);
      }
    } catch { if (alive.current) setMoreError(group); }
    finally { if (alive.current) setMoreBusy(null); }
  }
  // Skeleton on the first load and on retry after an error; focus / revisit refreshes keep the list on screen.
  const loading = !board || (board.revision !== revision && !!board.error);
  return { board, loading, reload, more, moreBusy, moreError };
}

function TicketBoard({ filters, closedAll, desktop, selectedId, change, paneControls }: {
  filters: Filters; closedAll: boolean; desktop: boolean; selectedId: string | null; change: Change; paneControls: ReactNode;
}) {
  const { board, loading, reload, more, moreBusy, moreError } = useMyTickets(filters, closedAll);
  const filtered = filters.q !== "" || filters.range !== "all" || filters.scope !== "all";
  const counts = board?.counts;
  const total = counts ? counts.inProgress + counts.resolved + counts.closed : 0;
  const groups = board?.groups ?? {};
  const resolved = groups.resolved?.items ?? [];
  const awaiting = resolved.filter((t) => t.awaitingMyConfirmation);
  const visible = [...awaiting, ...resolved.filter((t) => !t.awaitingMyConfirmation), ...(groups.open?.items ?? []), ...(groups.closed?.items ?? [])];
  const previewId = selectedId ?? visible[0]?.id;
  const select = (id: string) => change({ id }, true);
  const moreButton = (group: Group) => {
    const data = groups[group];
    if (!data || data.items.length >= data.total) return null;
    return <div className="space-y-2 pt-2">{moreError === group && <ErrorState variant="inline" title="โหลดงานของคุณไม่สำเร็จ" onRetry={() => more(group)} />}
      <Button variant="outline" className="w-full" disabled={moreBusy === group} onClick={() => more(group)}>{moreBusy === group && <Loader2 className="animate-spin" aria-hidden />}โหลดเพิ่ม</Button></div>;
  };
  const noMatch = <Card className="items-center gap-3 px-4 py-8 text-center shadow-card"><h2 className="text-base font-semibold">{filters.q ? `ไม่พบงานที่ตรงกับ "${filters.q}"` : "ไม่พบงานตามตัวกรองนี้"}</h2>
    <Button variant="outline" onClick={() => change(filters.q ? { q: null } : { range: null, scope: null })}>{filters.q ? "ล้างการค้นหา" : "ล้างตัวกรอง"}</Button></Card>;
  const failure = board?.error !== undefined && (errorCode(board.error) === "FORBIDDEN" ? <ForbiddenState /> : <ErrorState variant="inline" title="โหลดงานของคุณไม่สำเร็จ" onRetry={reload} />);
  const empty = !loading && !board?.error && total === 0 && !filtered;
  const emptyState = <EmptyState title="ยังไม่มีงานที่คุณแจ้ง" hint="เจออะไรเสีย ถ่ายรูปแล้วแจ้ง BAMBAM ได้เลย หรือสแกน QR ที่ติดบนอุปกรณ์" action={<Button asChild><Link href="/repair/new">แจ้งซ่อม</Link></Button>} />;
  const closedAllHeader = <Button variant="ghost" className="-ml-2 h-11 px-2" onClick={() => change({ closed: null })}><ChevronLeft />ติดตามงานซ่อม</Button>;

  if (!desktop) {
    if (empty) return <div className="px-4 pt-4">{emptyState}</div>;
    return <div className="px-4 pt-2">
      {loading ? <MobileSkeleton /> : failure ? <div className="pt-3">{failure}</div> : total === 0 ? <div className="pt-3">{noMatch}</div> : closedAll ? <>
        <div className="pt-2">{closedAllHeader}</div>
        <GroupSection title={GROUPS.closed.title} count={groups.closed?.total ?? 0}>
          <Card className="gap-0 divide-y py-0 shadow-card">{groups.closed?.items.map((t) => <ClosedRow key={t.id} ticket={t} />)}</Card>
          {moreButton("closed")}
          <p className="pt-2 text-center text-xs text-muted-foreground">แสดง {groups.closed?.items.length ?? 0} จาก {groups.closed?.total ?? 0} งาน</p>
        </GroupSection>
      </> : <>
        {resolved.length > 0 && <GroupSection title={GROUPS.resolved.title} count={groups.resolved!.total} hot={awaiting.length > 0}>
          <div className="space-y-2.5">{awaiting.map((t) => <AwaitingCard key={t.id} ticket={t} />)}
            {resolved.length > awaiting.length && <Card className="gap-0 divide-y py-0 shadow-card">{resolved.filter((t) => !t.awaitingMyConfirmation).map((t) => <TicketRow key={t.id} ticket={t} />)}</Card>}</div>
          {moreButton("resolved")}
        </GroupSection>}
        {(groups.open?.items.length ?? 0) > 0 && <GroupSection title={GROUPS.open.title} count={groups.open!.total}>
          <Card className="gap-0 divide-y py-0 shadow-card">{groups.open!.items.map((t) => <TicketRow key={t.id} ticket={t} />)}</Card>
          {moreButton("open")}
        </GroupSection>}
        {(groups.closed?.items.length ?? 0) > 0 && <GroupSection title={GROUPS.closed.title} count={groups.closed!.total}
          action={groups.closed!.total > CLOSED_PREVIEW && <Button variant="link" className="ml-auto h-11 px-1" onClick={() => change({ closed: "all" })}>ดูทั้งหมด<ChevronRight /></Button>}>
          <Card className="gap-0 divide-y py-0 shadow-card">{groups.closed!.items.map((t) => <ClosedRow key={t.id} ticket={t} />)}</Card>
        </GroupSection>}
      </>}
    </div>;
  }

  if (empty) return emptyState;
  const row = (t: TicketSummary) => <PaneRow key={t.id} ticket={t} selected={t.id === previewId} onSelect={() => select(t.id)} />;
  return <div className="flex items-start gap-4.5">
    <section aria-label="รายการงาน" className="w-98 shrink-0 overflow-hidden rounded-xl bg-card shadow-card">
      <div className="space-y-2.5 border-b p-3.5">{paneControls}{!loading && !failure && <p className="text-right text-xs text-muted-foreground">{total} งาน</p>}</div>
      {loading ? <div className="space-y-2 p-3.5" aria-busy="true" aria-label="กำลังโหลดงานซ่อม">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-16 w-full rounded-sm" />)}</div>
        : failure ? <div className="p-3.5">{failure}</div> : total === 0 ? <div className="p-3.5">{noMatch}</div> : <div className="pb-2">
          {closedAll ? <>
            <div className="px-2 pt-2">{closedAllHeader}</div>
            <PaneGroup title={GROUPS.closed.title} count={groups.closed?.total ?? 0}>{groups.closed?.items.map(row)}</PaneGroup>
            <div className="px-3.5">{moreButton("closed")}<p className="pt-2 text-center text-xs text-muted-foreground">แสดง {groups.closed?.items.length ?? 0} จาก {groups.closed?.total ?? 0} งาน</p></div>
          </> : <>
            {resolved.length > 0 && <PaneGroup title={GROUPS.resolved.title} count={groups.resolved!.total} hot={awaiting.length > 0}>{[...awaiting, ...resolved.filter((t) => !t.awaitingMyConfirmation)].map(row)}</PaneGroup>}
            {resolved.length > 0 && <div className="px-3.5">{moreButton("resolved")}</div>}
            {(groups.open?.items.length ?? 0) > 0 && <><PaneGroup title={GROUPS.open.title} count={groups.open!.total}>{groups.open!.items.map(row)}</PaneGroup><div className="px-3.5">{moreButton("open")}</div></>}
            {(groups.closed?.items.length ?? 0) > 0 && <PaneGroup title={GROUPS.closed.title} count={groups.closed!.total}>{groups.closed!.items.map(row)}</PaneGroup>}
            {(groups.closed?.total ?? 0) > CLOSED_PREVIEW && <Button variant="link" className="h-11 w-full" onClick={() => change({ closed: "all" })}>ดูงานที่ปิดแล้วทั้งหมด</Button>}
          </>}
        </div>}
    </section>
    <div className="sticky top-5 max-h-dvh min-w-0 flex-1 overflow-y-auto pb-8">
      {loading ? <PreviewSkeleton /> : previewId ? <TicketPreview key={previewId} id={previewId} /> : !failure && total > 0 && <Card className="items-center p-10 text-sm text-muted-foreground shadow-card">เลือกงานทางซ้ายเพื่อดูรายละเอียด</Card>}
    </div>
  </div>;
}

function GroupSection({ title, count, hot = false, action, children }: { title: string; count: number; hot?: boolean; action?: ReactNode; children: ReactNode }) {
  const id = useId();
  return <section aria-labelledby={id} className="pt-3">
    <div className="flex min-h-11 items-center gap-2 px-0.5"><h2 id={id} className="font-heading text-base font-semibold">{title}</h2><CountChip count={count} hot={hot} />{action}</div>
    {children}
  </section>;
}

function CountChip({ count, hot }: { count: number; hot?: boolean }) {
  return <span className={cn("min-w-6 rounded-full px-1.5 text-center font-heading text-xs leading-6 font-semibold", hot ? "bg-status-resolved text-white" : "bg-card ring-1 ring-border")}>{count}</span>;
}

function AwaitingCard({ ticket }: { ticket: TicketSummary }) {
  const resolvedBy = [ticket.technician ? `ช่าง${firstName(ticket.technician.name)}บันทึกผล` : "ช่างบันทึกผล", ticket.resolvedAt && listDate(ticket.resolvedAt)].filter(Boolean).join(" ");
  return <Card className="gap-0 border border-status-resolved/20 bg-status-resolved/5 p-3.5 shadow-card ring-0">
    <div className="flex gap-3"><TicketThumb ticket={ticket} />
      <div className="min-w-0 flex-1"><TicketLink href={ticketHref(ticket.id)} className="rounded-sm text-base leading-snug font-semibold outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">{ticketTitle(ticket)}</TicketLink>
        <p className="truncate text-xs leading-5 text-muted-foreground">{ticketLocation(ticket)}</p>
        <p className="text-xs leading-5 text-muted-foreground">{ticket.ticketNo} · {resolvedBy}</p></div></div>
    {ticket.autoCloseAt && <p className="mt-2.5 inline-flex w-fit items-center gap-1.5 rounded-full bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning"><Clock className="size-3.5 shrink-0" aria-hidden />{autoCloseText(ticket.autoCloseAt)}</p>}
    <div className="mt-3 flex gap-2"><Button asChild variant="outline" className="h-11 flex-1 px-3"><TicketLink href={`${ticketHref(ticket.id)}?action=sendback`}>ส่งกลับให้แก้</TicketLink></Button>
      <Button asChild className="h-11 flex-1 px-3"><TicketLink href={`${ticketHref(ticket.id)}?action=confirm`}><Star aria-hidden />ประเมินงาน</TicketLink></Button></div>
  </Card>;
}

function FollowTag() {
  return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Bookmark className="size-3.5" aria-hidden />คุณติดตามเคสนี้</span>;
}

function TicketRow({ ticket }: { ticket: TicketSummary }) {
  return <TicketLink href={ticketHref(ticket.id)} aria-label={ticketTitle(ticket)} className="flex min-h-16 items-start gap-3 px-3.5 py-3.5 outline-none hover:bg-muted/50 focus-visible:bg-secondary focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
    <TicketThumb ticket={ticket} />
    <div className="min-w-0 flex-1"><h3 className="truncate font-sans text-base font-semibold">{ticketTitle(ticket)}</h3><p className="truncate text-xs leading-5 text-muted-foreground">{ticketLocation(ticket)}</p>
      <TicketProgressMini ticket={ticket} className="mt-2" />{ticket.viewerRelation === "subscriber" && <div className="mt-1.5"><FollowTag /></div>}</div>
    <ChevronRight className="mt-5 size-4 shrink-0 text-muted-foreground" aria-hidden />
  </TicketLink>;
}

function closedCaption(ticket: TicketSummary) {
  const date = listDate(ticket.closedAt ?? ticket.updatedAt);
  if (ticket.closedReason === "confirmed" && ticket.rating) return <span className="inline-flex items-center gap-1"><span className="inline-flex items-center gap-0.5 font-semibold text-warning" aria-label={`${ticket.rating} ดาว`}><Star className="size-3 fill-current" aria-hidden />{ticket.rating}</span>· {date}</span>;
  return `${ticket.closedReason ? CLOSED_LABELS[ticket.closedReason] : ""} · ${date}`;
}

function ClosedRow({ ticket }: { ticket: TicketSummary }) {
  return <TicketLink href={ticketHref(ticket.id)} aria-label={ticketTitle(ticket)} className="flex min-h-13 items-center gap-2.5 px-3.5 py-2.5 outline-none hover:bg-muted/50 focus-visible:bg-secondary focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
    <span className="grid size-7.5 shrink-0 place-items-center rounded-full bg-status-closed/10 text-status-closed"><CircleCheck className="size-4" aria-hidden /></span>
    <span className="min-w-0 flex-1 truncate text-sm font-medium">{ticketTitle(ticket)}</span>
    <span className="shrink-0 text-xs text-muted-foreground">{closedCaption(ticket)}</span>
  </TicketLink>;
}

function MobileSkeleton() {
  return <div className="space-y-3 pt-4" aria-busy="true" aria-label="กำลังโหลดงานซ่อม"><Skeleton className="h-6 w-32" /><Skeleton className="h-40 w-full rounded-xl" />{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}</div>;
}

function PaneGroup({ title, count, hot = false, children }: { title: string; count: number; hot?: boolean; children: ReactNode }) {
  const id = useId();
  return <section aria-labelledby={id}><div className="flex items-center gap-2 px-4 pt-3.5 pb-1.5"><h2 id={id} className="font-heading text-sm font-semibold">{title}</h2><CountChip count={count} hot={hot} /></div><div className="divide-y">{children}</div></section>;
}

function PaneRow({ ticket, selected, onSelect }: { ticket: TicketSummary; selected: boolean; onSelect: () => void }) {
  const awaiting = ticket.awaitingMyConfirmation;
  const closed = ticket.status === "closed";
  return <button type="button" onClick={onSelect} aria-current={selected || undefined} aria-label={ticketTitle(ticket)}
    className={cn("flex w-full items-start gap-3 border-l-3 px-3.5 py-3 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
      selected ? (awaiting ? "border-status-resolved bg-status-resolved/10" : "border-primary bg-secondary/70") : awaiting ? "border-transparent bg-status-resolved/5" : "border-transparent")}>
    {closed ? <span className="grid size-7.5 shrink-0 place-items-center rounded-full bg-status-closed/10 text-status-closed"><CircleCheck className="size-4" aria-hidden /></span> : <TicketThumb ticket={ticket} size="sm" />}
    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{ticketTitle(ticket)}</span>
      {closed ? <span className="block text-xs text-muted-foreground">{closedCaption(ticket)}</span> : <>
        <span className="block truncate text-xs leading-5 text-muted-foreground">{ticketLocation(ticket)}</span>
        <TicketProgressMini ticket={ticket} className="mt-1.5" />{ticket.viewerRelation === "subscriber" && <span className="mt-1 block"><FollowTag /></span>}</>}
    </span>
  </button>;
}

function PreviewSkeleton() {
  return <Card className="gap-4 p-5 shadow-card" aria-busy="true" aria-label="กำลังโหลด"><Skeleton className="h-5 w-40" /><Skeleton className="h-7 w-2/3" /><Skeleton className="h-24 w-full rounded-lg" /><div className="grid grid-cols-2 gap-3"><Skeleton className="h-40 rounded-lg" /><Skeleton className="h-40 rounded-lg" /></div></Card>;
}

function Box({ title, action, children, className }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <div className={cn("space-y-2 rounded-lg border p-4", className)}>{title && <div className="flex items-center gap-2"><h3 className="flex-1 font-heading text-sm font-semibold">{title}</h3>{action}</div>}{children}</div>;
}

function TicketPreview({ id }: { id: string }) {
  const { ticket, loading, error, reload } = useTicket(id);
  if (loading) return <PreviewSkeleton />;
  if (error || !ticket) return <Card className="shadow-card"><TicketFailure error={error} onRetry={reload} /></Card>;
  const href = ticketHref(ticket.id);
  return <Card className="gap-4 p-5 shadow-card ring-0">
    <div className="flex flex-wrap items-center gap-2"><CopyTicketNumber value={ticket.ticketNo} /><span className="flex-1" />
      {ticket.awaitingMyConfirmation ? <Badge className="border-0 bg-status-resolved text-white">รอคุณประเมิน</Badge> : <TicketStatusBadge step={ticket.step} />}
      {ticket.viewerRelation === "subscriber" && <Badge variant="secondary"><Bookmark aria-hidden className="size-3.5" />คุณติดตามเคสนี้</Badge>}
      <Button asChild variant="ghost" size="sm"><TicketLink href={href}>เปิดหน้าเต็ม<ChevronRight /></TicketLink></Button></div>
    <div><h2 className="break-words font-heading text-xl font-semibold">{ticketTitle(ticket)}</h2>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground"><span>{ticket.category.name}</span><PriorityIndicator priority={ticket.priority} />
        <span className="inline-flex items-start gap-1.5"><MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />{ticketLocation(ticket)}</span></div>
      {ticket.closedReason && <p className="mt-1 text-xs text-muted-foreground">{CLOSED_LABELS[ticket.closedReason]}</p>}</div>
    <Box><TicketProgress ticket={ticket} />
      {ticket.awaitingMyConfirmation && <div className="flex flex-wrap items-center gap-2.5 border-t pt-3.5">
        {ticket.autoCloseAt && <p className="inline-flex min-w-0 flex-1 items-center gap-1.5 rounded-sm bg-warning/10 px-3 py-2 text-xs font-semibold text-warning"><Clock className="size-3.5 shrink-0" aria-hidden />ประเมินภายใน {shortDate(ticket.autoCloseAt)} ไม่เช่นนั้นระบบปิดงานให้อัตโนมัติ</p>}
        <Button asChild variant="outline" size="sm"><TicketLink href={`${href}?action=sendback`}>ส่งกลับให้แก้</TicketLink></Button>
        <Button asChild size="sm"><TicketLink href={`${href}?action=confirm`}><Star aria-hidden />ประเมินงาน</TicketLink></Button></div>}
    </Box>
    <div className={cn("grid gap-4", ticket.result && "xl:grid-cols-2")}>
      <Box title="รายละเอียดจากผู้แจ้ง"><p className="whitespace-pre-wrap break-words text-sm leading-6">{ticket.details || "ไม่มีรายละเอียดเพิ่มเติม"}</p><PhotoGallery photos={ticket.photos} />
        <p className="text-xs text-muted-foreground">แจ้งโดย {ticket.reporter.name} · {formatDateTime(ticket.createdAt)}</p></Box>
      {ticket.result && <Box title="ผลการซ่อม"><p className="whitespace-pre-wrap break-words text-sm leading-6">{ticket.result.note}</p><PhotoGallery photos={ticket.result.photos} label="รูปหลังซ่อม" />
        <p className="text-xs text-muted-foreground">{[ticket.result.photos.length > 0 && "รูปหลังซ่อม", ticket.result.by && `ช่าง${ticket.result.by.name}`, ticket.result.at && formatDateTime(ticket.result.at)].filter(Boolean).join(" · ")}</p></Box>}
    </div>
    <Box title="ความคืบหน้าล่าสุด" action={<Button asChild variant="link" size="sm" className="h-auto px-0"><TicketLink href={href}>ดูทั้งหมด</TicketLink></Button>}><Timeline events={ticket.timeline.slice(0, 3)} /></Box>
  </Card>;
}
