"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Select as SelectPrimitive } from "radix-ui";
import { Bell, ChevronDown, ChevronLeft, ChevronRight, FileText, Plus, RotateCcw, Search, SlidersHorizontal, Wrench, type LucideIcon } from "lucide-react";
import { Mascot } from "@/components/shared/mascot";
import { MenuContent, MenuItem, type PickerOption } from "@/components/shared/picker";
import { EmptyState, ErrorState, ForbiddenState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getMyTickets } from "../api";
import { errorCode } from "../errors";
import type { MyTicket, MyTicketPage, MyTicketsQuery, TicketSort } from "../types";
import { CategoryTile } from "./category-icon";
import { autoCloseText } from "./ticket-progress";
import { categoryName, CLOSED_LABELS, dayLabel, listDate, placeLine, STEP, stepLabel, ticketHref } from "./ticket-presentation";
import { TicketLink } from "./ticket-navigation";

// S06 ติดตามงานซ่อม (CR-019, layout from bam-workplace-mascot-v4-refined.html): a hero card with the tracking
// mascot beside the แจ้งซ่อมใหม่ card, then one workspace card — relation tabs, search, status dropdown, sort,
// and one paged table with the category icon on every row. The API puts the reporter's own tickets awaiting the
// rating first (BR-F06-2); their row keeps the ตรวจงาน button. Priority, contractor and other staff-side
// fields are left out on purpose.

const STATUSES: (PickerOption & { query?: Pick<MyTicketsQuery, "status" | "step"> })[] = [
  { value: "all", label: "ทุกสถานะ" },
  { value: "new", label: "รับเรื่องแล้ว", query: { step: ["awaiting_assessment"] } },
  { value: "doing", label: "กำลังดำเนินการ", query: { step: ["in_repair", "reworking"] } },
  { value: "review", label: "รอประเมินตรวจงาน", query: { status: ["resolved"] } },
  { value: "closed", label: "ปิดงานแล้ว", query: { status: ["closed"] } },
];
const SORTS: (PickerOption & { sort?: TicketSort })[] = [
  { value: "updated", label: "อัปเดตล่าสุดก่อน" },
  { value: "newest", label: "แจ้งล่าสุดก่อน", sort: "createdAt:desc" },
  { value: "oldest", label: "แจ้งเก่าสุดก่อน", sort: "createdAt:asc" },
];
const RELATIONS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "all", label: "ทั้งหมด", icon: FileText },
  { value: "reported", label: "ที่ฉันแจ้ง", icon: Wrench },
  { value: "following", label: "ที่ฉันติดตาม", icon: Bell },
];
/** Server-side paging (#35 page / pageSize): one page of slim rows per request, never the whole list. */
const PAGE_SIZE = 10;
const FOCUS_REFRESH_MS = 30_000;

type Change = (values: Record<string, string | null>, replace?: boolean) => void;
type Filters = { q: string; scope: string; status: string; sort: string; page: number };

const pick = (list: { value: string }[], value: string | null) => (list.some((o) => o.value === value) ? value! : list[0].value);

export function MyTicketsScreen() {
  const params = useSearchParams();
  const q = (params.get("q") ?? "").slice(0, 50);
  const scope = pick(RELATIONS, params.get("scope"));
  const status = pick(STATUSES, params.get("status"));
  const sort = pick(SORTS, params.get("sort"));
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const [draft, setDraft] = useState({ query: q, value: q });
  if (draft.query !== q) setDraft({ query: q, value: q });
  const text = draft.query === q ? draft.value : q;
  // Every filter change starts again at page 1; filters and page live in the URL.
  const change: Change = useCallback((values, replace = false) => {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(values)) { if (value === null || value === "") url.searchParams.delete(key); else url.searchParams.set(key, value); }
    if (!("page" in values)) url.searchParams.delete("page");
    url.searchParams.delete("range"); // CR-019 dropped the date-range filter
    const href = url.pathname + url.search;
    if (replace) window.history.replaceState(null, "", href);
    else window.history.pushState(null, "", href);
  }, []);
  useEffect(() => {
    if (text === q) return;
    const timer = window.setTimeout(() => change({ q: text }, true), 300);
    return () => window.clearTimeout(timer);
  }, [text, q, change]);
  const filters = { q, scope, status, sort, page };
  const filtered = q !== "" || status !== "all";
  const reset = () => { setDraft({ query: q, value: "" }); change({ q: null, status: null }); };

  const toolbar = <>
    <div className="border-b px-4 lg:px-6">
      <div role="group" aria-label="งานที่แสดง" className="-mb-px flex min-w-0 gap-1 overflow-x-auto">
        {RELATIONS.map((r) => <button key={r.value} type="button" aria-pressed={scope === r.value} onClick={() => change({ scope: r.value === "all" ? null : r.value })}
          className={cn("flex min-h-12 shrink-0 items-center gap-1.5 border-b-2 px-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/30 sm:px-3",
            scope === r.value ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
          <r.icon className="size-4" aria-hidden />{r.label}
        </button>)}
      </div>
    </div>
    <div className="grid grid-cols-2 gap-2 px-4 pt-4 sm:grid-cols-[minmax(0,1fr)_11rem_auto] lg:gap-3 lg:px-6">
      <div className="relative col-span-2 min-w-0 sm:col-span-1">
        <Search className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-muted-foreground" aria-hidden />
        <Input type="search" aria-label="ค้นหาเลขงาน หรือสถานที่" placeholder="ค้นหาเลขงาน หรือสถานที่" maxLength={50} value={text}
          onChange={(e) => setDraft({ query: q, value: e.target.value })} className="h-11 rounded-lg bg-card pr-3 pl-10 text-sm" />
      </div>
      <BoxSelect label="กรองสถานะ" value={status} options={STATUSES} onValueChange={(v) => change({ status: v === "all" ? null : v })} />
      <BoxSelect label="เรียงลำดับ" value={sort} options={SORTS} icon={SlidersHorizontal} fixedText="เรียงลำดับ"
        onValueChange={(v) => change({ sort: v === "updated" ? null : v })} />
    </div>
  </>;

  return <div className="space-y-4 px-4 pt-4 pb-8 lg:space-y-5 lg:px-0 lg:pt-2">
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_23rem] lg:gap-5">
      <header className="flex items-center gap-4 rounded-xl border bg-card px-4 py-4 shadow-card sm:gap-6 sm:px-8 sm:py-5">
        <Mascot pose="tracking" size={120} className="hidden shrink-0 sm:block" priority />
        <Mascot pose="tracking" size={84} className="shrink-0 sm:hidden" priority />
        <div className="min-w-0">
          <p className="text-[11px] leading-5 font-semibold tracking-[0.16em] text-primary uppercase">Maintenance center</p>
          <h1 className="text-2xl leading-9 font-semibold lg:text-[28px] lg:leading-10">ติดตามงานซ่อม</h1>
          <p className="text-sm text-muted-foreground">งานที่คุณแจ้งและติดตาม · ดูความคืบหน้าและตรวจงานเมื่อซ่อมเสร็จ</p>
        </div>
      </header>
      <section aria-labelledby="request-title" className="flex flex-col justify-center gap-4 rounded-xl bg-primary px-5 py-5 text-primary-foreground shadow-card sm:px-7">
        <div>
          <h2 id="request-title" className="text-lg leading-7 font-semibold">พบปัญหาในที่ทำงาน?</h2>
          <p className="text-sm text-primary-foreground/85">แจ้งรายละเอียด เพื่อให้ทีมอาคารเข้าดูแล</p>
        </div>
        <Link href="/repair/new" className="group flex h-14 items-center gap-3 rounded-lg bg-card px-3 text-base font-semibold text-primary outline-none transition-shadow hover:shadow-float focus-visible:ring-3 focus-visible:ring-white/60">
          <span aria-hidden className="grid size-8 place-items-center rounded-md bg-secondary"><Plus className="size-4.5" /></span>
          <span className="flex-1">แจ้งซ่อมใหม่</span>
          <ChevronRight className="size-5 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </section>
    </div>
    <Board key={`${q}|${scope}|${status}|${sort}|${page}`} filters={filters} filtered={filtered} onReset={reset} toolbar={toolbar} onPage={(p) => change({ page: p > 1 ? String(p) : null })} />
  </div>;
}

/** Input-shaped dropdown (CR-019): the status filter shows its value; the sort button keeps its own text. */
function BoxSelect({ label, value, options, onValueChange, icon: Icon, fixedText }: {
  label: string; value: string; options: PickerOption[]; onValueChange: (v: string) => void; icon?: LucideIcon; fixedText?: string;
}) {
  const current = options.find((o) => o.value === value) ?? options[0];
  return <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
    <SelectPrimitive.Trigger aria-label={`${label}: ${current.label}`}
      className="group flex h-11 min-w-0 items-center gap-2 rounded-lg border border-input bg-card px-3.5 text-sm whitespace-nowrap outline-none transition-colors hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/30 aria-expanded:border-ring">
      {Icon && <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />}
      <span className={cn("min-w-0 flex-1 truncate text-left", fixedText && "font-medium")}>{fixedText ?? <SelectPrimitive.Value>{current.label}</SelectPrimitive.Value>}</span>
      {!fixedText && <ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform group-aria-expanded:rotate-180" />}
    </SelectPrimitive.Trigger>
    <MenuContent className="min-w-52">{options.map((o) => <MenuItem key={o.value} option={o} />)}</MenuContent>
  </SelectPrimitive.Root>;
}

// ---- data: one page of the viewer's tickets ----

type Data = { revision: number; page?: MyTicketPage; at?: string; error?: unknown };

function useTicketPage(filters: Filters) {
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<Data>();
  const reload = useCallback(() => setRevision((r) => r + 1), []);
  const { q, scope, status, sort, page } = filters;
  // Also re-runs when a hidden route is shown again (cacheComponents), which refreshes the list.
  useEffect(() => {
    let active = true;
    const query: MyTicketsQuery = {
      relation: scope as "all" | "reported" | "following", q: q || undefined, page, pageSize: PAGE_SIZE,
      sort: SORTS.find((s) => s.value === sort)?.sort, ...STATUSES.find((s) => s.value === status)?.query,
    };
    getMyTickets(query).then(
      (result) => { if (active) setData({ revision, page: result, at: new Date().toISOString() }); },
      (error: unknown) => { if (active) setData({ revision, error }); },
    );
    return () => { active = false; };
  }, [q, scope, status, sort, page, revision]);
  useEffect(() => {
    // Refresh when the tab comes back, at most once per FOCUS_REFRESH_MS (only the current page is refetched).
    let last = Date.now();
    const onFocus = () => { if (Date.now() - last >= FOCUS_REFRESH_MS) { last = Date.now(); reload(); } };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [reload]);
  // Skeleton on the first load and on retry after an error; focus refreshes keep the list on screen.
  const loading = !data || (data.revision !== revision && !!data.error);
  return { data, loading, reload };
}

type BoardProps = { filters: Filters; filtered: boolean; onReset: () => void; toolbar: ReactNode; onPage: (page: number) => void };

function Board({ filters, filtered, onReset, toolbar, onPage }: BoardProps) {
  const { data, loading, reload } = useTicketPage(filters);
  const result = data?.page;
  const failure = !loading && data?.error !== undefined
    && (errorCode(data.error) === "FORBIDDEN" ? <ForbiddenState /> : <div className="px-4 py-6 lg:px-6"><ErrorState variant="inline" title="โหลดงานของคุณไม่สำเร็จ" onRetry={reload} /></div>);
  const ready = !loading && !failure && result;
  const total = result?.meta.total ?? 0;

  if (ready && total === 0 && !filtered && filters.page === 1) {
    return <EmptyState title="ยังไม่มีงานที่คุณแจ้ง" hint="เจออะไรเสีย ถ่ายรูปแล้วแจ้ง BAMBAM ได้เลย หรือสแกน QR ที่ติดบนอุปกรณ์"
      action={<Button asChild><Link href="/repair/new">แจ้งซ่อม</Link></Button>} />;
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = (filters.page - 1) * PAGE_SIZE + 1;
  const to = Math.min(filters.page * PAGE_SIZE, total);
  return <section aria-label="รายการงานซ่อม" className="overflow-hidden rounded-xl border bg-card shadow-card">
    {toolbar}
    <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-3 text-[13px] text-muted-foreground lg:px-6">
      <p role="status">{ready ? `แสดง ${total} งาน` : " "}</p>
      {ready && data.at && <p className="flex items-center gap-1.5"><span aria-hidden className="size-1.5 rounded-full bg-success" />อัปเดตล่าสุด {listDate(data.at)}</p>}
    </div>
    <div aria-busy={loading}>
      {loading ? <ListSkeleton /> : failure ? failure : ready && result.items.length === 0
        ? <div className="flex flex-col items-center gap-3 border-t px-4 py-10 text-center">
          <p className="text-base font-semibold">{filters.q ? `ไม่พบงานที่ตรงกับ "${filters.q}"` : filters.page > 1 ? "ไม่มีงานในหน้านี้" : "ไม่พบงานตามตัวกรองนี้"}</p>
          <p className="text-sm text-muted-foreground">ลองเปลี่ยนคำค้นหรือสถานะ</p>
          <Button variant="outline" onClick={filters.page > 1 ? () => onPage(1) : onReset}><RotateCcw aria-hidden />{filters.page > 1 ? "กลับหน้าแรก" : "ล้างตัวกรอง"}</Button>
        </div>
        : ready && <>
          {/* Desktop: table · phone / tablet: one row block per ticket. */}
          <table className="hidden w-full table-fixed border-collapse text-left lg:table">
            <caption className="sr-only">งานซ่อมของคุณ</caption>
            <thead className="border-y bg-muted/40 text-[13px] text-muted-foreground">
              <tr>
                <th scope="col" className="w-[33%] py-3 pr-3 pl-6 font-medium">เรื่องที่แจ้ง</th>
                <th scope="col" className="w-[21%] px-3 py-3 font-medium">สถานที่</th>
                <th scope="col" className="w-[19%] px-3 py-3 font-medium">สถานะล่าสุด</th>
                <th scope="col" className="w-[15%] px-3 py-3 font-medium">กำหนด / อัปเดต</th>
                <th scope="col" className="w-[12%] py-3 pr-6 pl-3 text-right font-medium">รายละเอียด</th>
              </tr>
            </thead>
            <tbody className="divide-y">{result.items.map((t) => <Row key={t.id} ticket={t} />)}</tbody>
          </table>
          <ul className="divide-y border-t lg:hidden">{result.items.map((t) => <Card key={t.id} ticket={t} />)}</ul>
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3.5 lg:px-6">
            <p className="text-[13px] text-muted-foreground">แสดง {from}–{to} จาก {total} งาน</p>
            <Pager page={filters.page} pages={pages} onPage={onPage} />
          </footer>
        </>}
    </div>
  </section>;
}

/** Page numbers around the current page (first and last always), with previous / next. */
function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  const shown = [...new Set([1, page - 1, page, page + 1, pages])].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b);
  const cell = "grid h-9 min-w-9 place-items-center rounded-md px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30";
  return <nav aria-label="เลือกหน้า" className="flex items-center gap-1">
    {pages > 1 && <button type="button" aria-label="หน้าก่อนหน้า" disabled={page <= 1} onClick={() => onPage(page - 1)} className={cn(cell, "text-muted-foreground hover:bg-muted disabled:opacity-40")}><ChevronLeft className="size-4" aria-hidden /></button>}
    {shown.map((p, i) => <span key={p} className="flex items-center gap-1">
      {i > 0 && p - shown[i - 1] > 1 && <span aria-hidden className="px-1 text-muted-foreground">…</span>}
      <button type="button" aria-current={p === page ? "page" : undefined} aria-label={`หน้า ${p}`} onClick={() => onPage(p)}
        className={cn(cell, p === page ? "border border-primary/30 bg-secondary font-semibold text-secondary-foreground" : "hover:bg-muted")}>{p}</button>
    </span>)}
    {pages > 1 && <button type="button" aria-label="หน้าถัดไป" disabled={page >= pages} onClick={() => onPage(page + 1)} className={cn(cell, "text-muted-foreground hover:bg-muted disabled:opacity-40")}><ChevronRight className="size-4" aria-hidden /></button>}
  </nav>;
}

// ---- one ticket ----

/** Second line under the status: what the viewer is waiting for at this step. */
function statusCaption(ticket: MyTicket): ReactNode {
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
function dueText(ticket: MyTicket): { label: string; value: string; muted: boolean } {
  switch (ticket.step) {
    case "awaiting_assessment": return { label: "คาดว่าจะเสร็จ", value: "รอช่างกำหนด", muted: true };
    case "in_repair": return ticket.expectedDoneOn ? { label: "คาดว่าจะเสร็จ", value: dayLabel(ticket.expectedDoneOn, true), muted: false } : { label: "คาดว่าจะเสร็จ", value: "—", muted: true };
    case "reworking": return { label: "คาดว่าจะเสร็จ", value: "ดูวันใหม่ในรายละเอียด", muted: true };
    default: return ticket.resolvedAt ? { label: "ผลซ่อม", value: "ซ่อมเสร็จแล้ว", muted: false } : { label: "สถานะ", value: "ปิดงานแล้ว", muted: false };
  }
}

function Badge({ ticket }: { ticket: MyTicket }) {
  const mine = ticket.awaitingMyConfirmation;
  return <span className={cn("inline-flex max-w-full items-center gap-1.5 rounded-[5px] px-2 py-px text-xs leading-5 font-semibold", mine ? "bg-attention/10 text-attention" : STEP[ticket.step].color)}>
    <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" /><span className="truncate">{stepLabel(ticket)}</span>
  </span>;
}

function Place({ ticket }: { ticket: MyTicket }) {
  return <>
    <span className="block truncate text-sm">{ticket.building.name}</span>
    <span className="block truncate text-[13px] text-muted-foreground">{placeLine(ticket)}</span>
  </>;
}

/** `dense`: desktop table rows (pointer input), so the row is not held open by a 44px touch target. */
function OpenLink({ ticket, className, dense }: { ticket: MyTicket; className?: string; dense?: boolean }) {
  const href = ticketHref(ticket.id);
  if (ticket.awaitingMyConfirmation) {
    return <Button asChild className={cn(dense ? "h-9 px-3" : "h-10", className)}>
      <TicketLink href={href} aria-label={`ตรวจงาน ${ticket.ticketNo}`}>ตรวจงาน<ChevronRight aria-hidden /></TicketLink>
    </Button>;
  }
  return <TicketLink href={href} aria-label={`ดูงาน ${ticket.ticketNo}`}
    className={cn("inline-grid place-items-center rounded-md text-foreground outline-none hover:bg-muted hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/30", dense ? "size-9" : "size-11", className)}>
    <ChevronRight className="size-5" aria-hidden />
  </TicketLink>;
}

/** Title link (one line on desktop, full text on hover) over `{ticket no} · {category}`. */
function Title({ ticket, compact }: { ticket: MyTicket; compact?: boolean }) {
  const { title } = ticket;
  return <div className="min-w-0">
    <TicketLink href={ticketHref(ticket.id)} title={compact ? title : undefined}
      className={cn("block text-[15px] leading-6 font-semibold outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/30", compact ? "truncate" : "line-clamp-2")}>{title}</TicketLink>
    <span className="block truncate text-xs leading-5 text-muted-foreground">
      <span className="tracking-wide">{ticket.ticketNo}</span> · {categoryName(ticket)}{ticket.viewerRelation === "subscriber" && " · คุณติดตามงานนี้"}
    </span>
  </div>;
}

function Row({ ticket }: { ticket: MyTicket }) {
  const due = dueText(ticket);
  const caption = ticket.step === "awaiting_rating" && ticket.awaitingMyConfirmation && ticket.autoCloseAt ? autoCloseText(ticket.autoCloseAt) : undefined;
  return <tr className={cn("align-middle transition-colors hover:bg-muted/40", ticket.awaitingMyConfirmation && "bg-attention/4")}>
    <td className={cn("py-3 pr-3 pl-6", ticket.awaitingMyConfirmation && "border-l-3 border-l-attention pl-5.25")}>
      <div className="flex items-center gap-3.5"><CategoryTile icon={ticket.category?.icon} /><Title ticket={ticket} compact /></div>
    </td>
    <td className="px-3 py-3"><Place ticket={ticket} /></td>
    <td className="px-3 py-3"><Badge ticket={ticket} /><span title={caption} className="mt-0.5 block truncate text-xs leading-5 text-muted-foreground">{statusCaption(ticket)}</span></td>
    <td className="px-3 py-3">
      <span className={cn("block truncate text-sm leading-5", due.muted ? "text-muted-foreground" : "font-medium")}>{due.value}</span>
      <time dateTime={ticket.updatedAt} className="block text-xs leading-5 text-muted-foreground">อัปเดต {listDate(ticket.updatedAt)}</time>
    </td>
    <td className="py-2 pr-6 pl-3 text-right"><OpenLink ticket={ticket} dense /></td>
  </tr>;
}

/** Phone / tablet: title and place side by side (prototype), status and dates below. */
function Card({ ticket }: { ticket: MyTicket }) {
  const due = dueText(ticket);
  return <li className={cn("flex gap-3 px-4 py-3.5", ticket.awaitingMyConfirmation && "border-l-3 border-l-attention bg-attention/4")}>
    <CategoryTile icon={ticket.category?.icon} className="mt-0.5" />
    <div className="min-w-0 flex-1 space-y-2">
      <div className="grid gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Title ticket={ticket} />
        <div className="min-w-0"><Place ticket={ticket} /></div>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1 basis-48">
          <Badge ticket={ticket} />
          <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{statusCaption(ticket)}</span>
          <span className="block text-xs leading-5 text-muted-foreground">
            {due.label} <span className={due.muted ? "" : "font-semibold text-foreground"}>{due.value}</span> · อัปเดต <time dateTime={ticket.updatedAt}>{listDate(ticket.updatedAt)}</time>
          </span>
        </div>
        <OpenLink ticket={ticket} className="shrink-0" />
      </div>
    </div>
  </li>;
}

function ListSkeleton() {
  return <div aria-label="กำลังโหลดงานซ่อม" className="divide-y border-t">
    {[0, 1, 2, 3, 4].map((i) => <div key={i} className="flex items-center gap-3.5 px-4 py-3.5 lg:px-6">
      <Skeleton className="size-9 rounded-lg" />
      <div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-1/3" /></div>
      <Skeleton className="hidden h-5 w-28 rounded-[5px] sm:block" />
    </div>)}
  </div>;
}
