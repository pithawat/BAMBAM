"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Building2, Check, ChevronRight, Clock, FileText, Move, Wrench, type LucideIcon } from "lucide-react";
import { Mascot } from "@/components/shared/mascot";
import { useCurrentUser } from "@/components/shared/me-provider";
import { Picker } from "@/components/shared/picker";
import { PriorityIndicator } from "@/components/shared/priority-indicator";
import { SERVICES, type Service } from "@/components/shared/service-icon";
import { ErrorState, ForbiddenState } from "@/components/shared/states";
import { useIsDesktop } from "@/components/shared/use-media-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatLongDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getOverview } from "../../api";
import { errorCode } from "../../errors";
import type { Overview } from "../../types";
import { placeLine, ticketHref, ticketTitle } from "../ticket-presentation";
import { attentionReason, autoCloseSoonest, greeting, hasWebGL, oldestText, REASON_CHIP } from "./dashboard-ui";
import { FloorList } from "./floor-list";

// S29 หน้าแรก Admin / ผู้บริหาร (CR-016, layout = ui/mockups/S29-admin-dashboard-modern.html, D-082):
// ภาพรวมวันนี้ band · 3D อาคาร 1 (desktop + WebGL) or the floor list · แจ้งซ่อม counts · งานที่ควรติดตาม ·
// car / room services shown as "not open yet" without numbers (CR-017: every number comes from the API).
// Admin toggles จัดวางอุปกรณ์; the executive reads only (BR-F23-2). CR-019 polish: welcome mascot heading, tiles with an
// icon, card headers with a sub-line and count chip, soft card shadows.

const BuildingCard = dynamic(() => import("./building-card"), {
  ssr: false,
  loading: () => <Skeleton className="h-full min-h-140 rounded-xl" />,
});

const QUEUE = "/repair/admin/queue";
const noop = () => () => {};

export function AdminDashboard() {
  const me = useCurrentUser();
  const desktop = useIsDesktop();
  const webgl = useSyncExternalStore(noop, hasWebGL, () => false);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error" | "forbidden">("loading");
  const [buildingId, setBuildingId] = useState("");
  const [editing, setEditing] = useState(false);

  const [rev, setRev] = useState(0);
  useEffect(() => {
    let alive = true;
    getOverview()
      .then((o) => { if (alive) { setOverview(o); setState("ready"); } })
      .catch((err) => { if (alive) setState(errorCode(err) === "FORBIDDEN" ? "forbidden" : "error"); });
    return () => { alive = false; };
  }, [rev]);
  const load = () => { setState("loading"); setRev((n) => n + 1); };

  const isAdmin = me.role === "admin";
  const buildings = overview?.buildings.filter((b) => b.floors.length > 0) ?? [];
  const building = buildings.find((b) => b.id === buildingId) ?? buildings.find((b) => b.hasModel) ?? buildings[0];
  const show3D = desktop && webgl && !!building?.hasModel && building.widthM !== null && building.depthM !== null;
  const firstName = me.name.split(/\s+/)[0];

  if (state === "forbidden") return <ForbiddenState />;

  return <div className="px-4 pb-8 lg:px-0">
    <div className="mt-2 mb-6 flex flex-wrap items-center gap-x-4 gap-y-3">
      <div className="flex min-w-60 flex-1 items-center gap-4">
        <Mascot pose="welcome" size={104} className="hidden shrink-0 sm:block" priority />
        <Mascot pose="welcome" size={76} className="shrink-0 sm:hidden" priority />
        <div className="min-w-0">
          <p className="text-[11px] leading-5 font-semibold tracking-[0.16em] text-primary uppercase">Workplace overview</p>
          <h1 className="font-heading text-2xl leading-normal font-semibold tracking-tight">{greeting()} คุณ{firstName}</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{formatLongDate(new Date())} · ภาพรวมวันนี้</p>
        </div>
      </div>
      {buildings.length > 0 && <div className="w-full sm:w-60">
        <Picker title="อาคาร" placeholder="เลือกอาคาร" icon={Building2} value={building?.id ?? ""} onValueChange={(v) => { setBuildingId(v); setEditing(false); }}
          options={buildings.map((b) => ({ value: b.id, label: b.name, description: b.hasModel ? undefined : "ยังไม่มีโมเดล" }))} />
      </div>}
      {isAdmin && show3D && <Button aria-pressed={editing} onClick={() => setEditing((e) => !e)} variant={editing ? "secondary" : "default"} className="h-13">
        {editing ? <Check aria-hidden /> : <Move aria-hidden />}{editing ? "เสร็จสิ้น" : "จัดวางอุปกรณ์"}
      </Button>}
    </div>

    {state === "error" && <ErrorState variant="inline" title="โหลดภาพรวมไม่สำเร็จ" onRetry={load} className="mb-6" />}

    <section aria-labelledby="band-title" className="mb-5.5">
      <h2 id="band-title" className="mb-3 text-sm font-medium text-muted-foreground">ภาพรวมวันนี้</h2>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:gap-3">
        {!overview ? [...Array(3)].map((_, i) => <Skeleton key={i} className={cn("h-29 rounded-xl", i === 0 && "col-span-2 sm:col-span-1")} />) : <>
          <Tile href={`${QUEUE}?tab=assess`} value={overview.counts.reportedToday} label="แจ้งซ่อมวันนี้" icon={FileText} className="col-span-2 sm:col-span-1" />
          <Tile href={QUEUE} value={overview.counts.open} label="งานค้างทั้งหมด" icon={Wrench} tone="primary" />
          <Tile href={`${QUEUE}?tab=repair`} value={overview.counts.overdue} label="เลยกำหนดเสร็จ" icon={Clock} tone={overview.counts.overdue > 0 ? "attention" : undefined} />
        </>}
      </div>
    </section>

    <div className="grid gap-4.5 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_330px] lg:grid-rows-[auto_1fr]">
      {/* 3D card: fits the viewport below the navbar and stays in view while the right column scrolls,
          so the palette and the whole plan are on screen together on laptop heights. */}
      <div className="md:col-span-2 lg:sticky lg:top-26 lg:col-span-1 lg:row-span-2 lg:h-[calc(100dvh-7.5rem)] lg:min-h-140 lg:self-start">
        {!overview ? <Skeleton className="h-60 rounded-xl lg:h-full" />
          : !building ? null
          : show3D ? <BuildingCard key={building.id} building={building} canEdit={isAdmin} editing={editing} />
          : <FloorList building={building} note={desktop
              ? (webgl ? "อาคารนี้ยังไม่มีโมเดล 3 มิติ" : "เบราว์เซอร์นี้แสดงภาพ 3 มิติไม่ได้")
              : isAdmin ? "จัดวางอุปกรณ์ได้บนคอมพิวเตอร์" : "ภาพ 3 มิติใช้ได้บนคอมพิวเตอร์"} />}
      </div>
      <RepairPanel overview={overview} />
      <AttentionPanel overview={overview} />
      <ServicesPanel className="md:col-span-2" />
    </div>
  </div>;
}

/** Label + icon tile on top, the number below (prototype KPI tile); the tone colours the number and the icon. */
function Tile({ href, value, label, icon: Icon, tone, className }: {
  href: string; value: number; label: string; icon: LucideIcon; tone?: "primary" | "attention"; className?: string;
}) {
  const tint = tone === "attention" ? "bg-attention/10 text-attention" : "bg-secondary text-primary";
  return <Link href={href} className={cn("flex min-h-29 flex-col justify-between gap-3 rounded-xl border bg-card p-5 shadow-card outline-none transition-colors hover:border-primary/30 focus-visible:ring-3 focus-visible:ring-ring/40", className)}>
    <span className="flex items-start justify-between gap-3">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span aria-hidden className={cn("grid size-8 shrink-0 place-items-center rounded-lg", tint)}><Icon className="size-4" /></span>
    </span>
    <span className="flex items-baseline gap-1.5">
      <span className={cn("text-[32px] leading-tight font-semibold tracking-tight tabular-nums", tone === "primary" && "text-primary", tone === "attention" && "text-attention")}>{value}</span>
      <span className="text-[13px] text-muted-foreground">งาน</span>
    </span>
  </Link>;
}

function Panel({ title, sub, count, icon, children, className, labelledBy }: {
  title: string; sub?: string; count?: number; icon?: ReactNode; children: ReactNode; className?: string; labelledBy: string;
}) {
  return <section aria-labelledby={labelledBy} className={cn("overflow-hidden rounded-xl border bg-card shadow-card", className)}>
    <div className="flex items-start gap-2.5 px-5 pt-4.5 pb-3.5">
      {icon}
      <div className="min-w-0 flex-1">
        <h2 id={labelledBy} className="font-heading text-[15px] leading-7 font-semibold">{title}</h2>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
      {count !== undefined && <span className="mt-1 inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-muted px-1.5 text-xs font-semibold text-muted-foreground tabular-nums">{count}</span>}
    </div>
    {children}
  </section>;
}

function ServiceBadge({ service }: { service: Service }) {
  const Icon = SERVICES[service].icon;
  const tint = { repair: "bg-svc-repair/10 text-svc-repair", car: "bg-svc-car/10 text-svc-car", room: "bg-svc-room/10 text-svc-room" }[service];
  return <span aria-hidden className={cn("grid size-7 place-items-center rounded-sm", tint)}><Icon className="size-4" /></span>;
}

function RepairPanel({ overview }: { overview: Overview | null }) {
  const c = overview?.counts;
  const rows = c ? [
    { href: `${QUEUE}?tab=assess`, n: c.awaitingAssessment, label: "รับเรื่อง", sub: oldestText(c), dot: "bg-status-new" },
    { href: `${QUEUE}?tab=repair`, n: c.inRepair, label: "กำลังดำเนินการ", sub: `เลยกำหนด ${c.overdue} · ส่งกลับ ${c.reworking}`, dot: "bg-status-in-progress" },
    { href: `${QUEUE}?tab=rating`, n: c.awaitingRating, label: "รอประเมินตรวจงาน", sub: autoCloseSoonest(c), dot: "bg-status-resolved" },
    { href: `${QUEUE}?tab=closed`, n: c.closedLast7Days, label: "ปิดแล้ว 7 วัน", sub: c.ratingAvgLast7Days !== null ? `คะแนนเฉลี่ย ${c.ratingAvgLast7Days.toFixed(1)}` : "ยังไม่มีคะแนน", dot: "bg-status-closed" },
  ] : [];
  return <Panel title="แจ้งซ่อม" sub="งานตามขั้นตอน กดเพื่อดูรายการ" count={c?.open} icon={<ServiceBadge service="repair" />} labelledBy="repair-title">
    {!c ? <div className="space-y-2 px-5 pb-5">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      : rows.map((r) => <Link key={r.label} href={r.href} className="flex items-center gap-2.5 border-t px-5 py-3.25 outline-none hover:bg-muted/50 focus-visible:bg-muted">
          <span aria-hidden className={cn("size-2 shrink-0 rounded-full", r.dot)} />
          <span className="min-w-8 text-[23px] font-semibold tabular-nums">{r.n}</span>
          <span className="min-w-0 flex-1 text-sm">{r.label}{r.sub && <small className="mt-0.5 block text-xs text-muted-foreground">{r.sub}</small>}</span>
          <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
        </Link>)}
  </Panel>;
}

function AttentionPanel({ overview }: { overview: Overview | null }) {
  const list = overview?.attention.slice(0, 4);
  return <Panel title="งานที่ควรติดตาม" sub="เลยกำหนด ส่งกลับ หรือเร่งด่วน" count={overview?.attention.length} labelledBy="attention-title" className="flex flex-col">
    {!list ? <div className="space-y-2 px-5 pb-5">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      : list.length === 0 ? <div className="flex flex-col items-center gap-2 border-t px-5 py-6 text-center">
          <Mascot pose="review" size={72} />
          <p className="text-sm text-muted-foreground">ไม่มีงานที่ต้องติดตาม</p>
        </div>
      : list.map((t) => {
          const reason = attentionReason(t);
          return <Link key={t.id} href={ticketHref(t.id)} className="block border-t px-5 py-3.25 outline-none hover:bg-muted/50 focus-visible:bg-muted">
            <b className="mb-1 block truncate text-sm font-semibold">{ticketTitle(t)}</b>
            <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {reason ? <span className={cn("inline-flex h-5 items-center rounded-sm px-1.5 font-medium", REASON_CHIP[reason].className)}>{REASON_CHIP[reason].label}</span>
                : <PriorityIndicator priority={t.priority} className="text-xs" />}
              {t.building.name} {placeLine(t)}
            </span>
          </Link>;
        })}
    <Link href={QUEUE} className="mt-auto flex justify-center border-t p-3 text-[13px] font-semibold text-primary outline-none hover:bg-muted/50 focus-visible:bg-muted">ดูทั้งหมด</Link>
  </Panel>;
}

/** CR-017: no numbers until the car / room modules exist (every number on S29 comes from the API). */
function ServicesPanel({ className }: { className?: string }) {
  const block = (service: Service, title: string, note: string) =>
    <div className="flex items-center gap-3 p-5 sm:px-6">
      <ServiceBadge service={service} />
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] font-semibold">{title}</b>
        <span className="text-[13px] text-muted-foreground">{note}</span>
      </span>
      <span className="inline-flex h-6 items-center rounded-full bg-muted px-2.5 text-xs font-medium whitespace-nowrap text-muted-foreground">ยังไม่เปิดใช้งาน</span>
    </div>;
  return <section aria-label="บริการอื่น" className={cn("grid divide-y overflow-hidden rounded-xl border bg-card shadow-card sm:grid-cols-2 sm:divide-x sm:divide-y-0", className)}>
    {block("car", "จองรถ", "ระบบจองรถยังไม่เปิดใช้งาน")}
    {block("room", "จองห้องประชุม", "ระบบจองห้องประชุมยังไม่เปิดใช้งาน")}
  </section>;
}
