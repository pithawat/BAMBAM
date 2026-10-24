"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, Loader2, Minus, Move, Pencil, Plus, Power, RotateCcw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { getAssetTypes, getFloorPlan, getTickets, updateAsset } from "../../api";
import { errorMessage } from "../../errors";
import { pointInShape, roomAt, roomCenter } from "../../plan-geometry";
import type { Asset, AssetType, FloorPlan, OverviewBuilding, OverviewFloor, PlanRoom, TicketSummary } from "../../types";
import { floorLabel, listDate, ticketHref, ticketTitle } from "../ticket-presentation";
import { AssetDialog, DeactivateAssetDialog, type AssetDraft } from "./asset-dialog";
import { ASSET_SHORT, AssetIcon, assetLabel, floorStepCounts, floorTopStep, MODEL_STEP, MODEL_STEPS, modelStep, MOUNT_Y, spreadInRoom, type ModelStepKey } from "./dashboard-ui";
import { BuildingEngine, type TicketPin } from "./scene/engine";

// S29 3D card (F23 + F31, CR-016, CR-017): อาคาร 1 model → floor plan with one pin per open ticket (colour =
// step, from #6) and equipment chips. Floors / footprint / step counts come from #27; opening a floor plays
// the repair-map lift transition.
// Admin edit mode: drag a type from the palette into a room (dialog), drag a chip to move it (toast with
// undo), chip popover → แก้ไข / ปิดใช้งาน. Executive: the same views without edit controls.
// Loaded with next/dynamic only on desktop with WebGL (three.js stays out of every other chunk).

type Props = { building: OverviewBuilding; canEdit: boolean; editing: boolean };

type DragSource = { kind: "new"; type: AssetType } | { kind: "move"; asset: Asset };
type DragState = { source: DragSource; x: number; y: number; room: PlanRoom | null; point: [number, number] | null; moved: boolean };

const round = (v: number) => Math.round(v * 100) / 100;

export default function BuildingCard({ building, canEdit, editing }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [engine, setEngine] = useState<BuildingEngine | null>(null);
  const [floorId, setFloorId] = useState<string | null>(null);
  // #30 result tagged with its request key, so nothing is reset inside effects.
  const [planResult, setPlanResult] = useState<{ key: string; floorId: string; plan?: FloorPlan; failed?: boolean } | null>(null);
  const [planRev, setPlanRev] = useState(0);
  const [types, setTypes] = useState<AssetType[]>([]);
  const [tip, setTip] = useState<{ level: number; x: number; y: number } | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [draft, setDraft] = useState<AssetDraft | null>(null);
  const [deactivating, setDeactivating] = useState<Asset | null>(null);
  const [openAsset, setOpenAsset] = useState<string | null>(null);
  // open tickets of the floor (#6) and the floor whose 3D plan is on screen (pins wait for it)
  const [ticketResult, setTicketResult] = useState<{ key: string; items: TicketSummary[] } | null>(null);
  const [readyFloor, setReadyFloor] = useState<string | null>(null);

  const floors = useMemo(() => [...building.floors].sort((a, b) => b.level - a.level), [building.floors]);
  const byLevel = useRef(new Map<number, string>());
  useEffect(() => { byLevel.current = new Map(building.floors.map((f) => [f.level, f.id])); }, [building.floors]);
  const planKey = `${floorId}:${planRev}`;
  const sameFloor = planResult && planResult.floorId === floorId ? planResult : null;
  const [plan, setPlanLocal] = useOptimisticPlan(sameFloor?.plan ?? null);
  const planState: "idle" | "loading" | "error" = !floorId ? "idle" : planResult?.key === planKey ? (planResult.failed ? "error" : "idle") : "loading";
  const current = building.floors.find((f) => f.id === floorId) ?? null;
  const totalOpen = building.floors.reduce((n, f) => n + f.openCount, 0);
  const edit = canEdit && editing;
  const tickets = ticketResult?.key === planKey ? ticketResult.items : null;

  // engine lifecycle
  const spec = useRef({ floors: Math.max(...building.floors.map((f) => f.level)), widthM: building.widthM ?? 0, depthM: building.depthM ?? 0 });
  useEffect(() => {
    const e = new BuildingEngine(hostRef.current!, overlayRef.current!, spec.current, {
      onFloorHover: (level, x, y) => {
        const r = hostRef.current?.getBoundingClientRect();
        setTip(level && r ? { level, x: x - r.left, y: y - r.top } : null);
      },
      onFloorClick: (level) => setFloorId(byLevel.current.get(level) ?? null),
    });
    setEngine(e);
    return () => {
      e.dispose();
      setEngine(null);
    };
  }, []);

  useEffect(() => {
    engine?.setFloorSteps(building.floors.map((f) => ({ level: f.level, step: floorTopStep(f) })));
  }, [engine, building.floors]);

  useEffect(() => {
    let alive = true;
    getAssetTypes().then((t) => { if (alive) setTypes(t); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // building ↔ floor view
  // The 3D plan is rebuilt only when the floor changes; a reload after an equipment write only refreshes
  // the HTML overlays (chips, pins), which keeps edits instant (room outlines never change here).
  const shownFloor = useRef<string | null>(null);
  useEffect(() => {
    if (!engine) return;
    if (!floorId) {
      shownFloor.current = null;
      void engine.showBuilding();
      return;
    }
    // the lift starts on click; the plan swaps in when #30 has answered
    const level = byLevel.current.size ? [...byLevel.current].find(([, id]) => id === floorId)?.[0] : undefined;
    if (level && shownFloor.current !== floorId) engine.enterFloor(level);
    let alive = true;
    getFloorPlan(floorId)
      .then((p) => {
        if (!alive) return;
        setPlanResult({ key: planKey, floorId, plan: p });
        if (shownFloor.current !== floorId) {
          shownFloor.current = floorId;
          void engine.showPlan(p, (room) => roomCenter(room, p.rooms)).then(() => { if (alive) setReadyFloor(floorId); });
        }
      })
      .catch(() => { if (alive) setPlanResult({ key: planKey, floorId, failed: true }); });
    getTickets({ scope: "all", floorId, status: ["in_progress", "resolved"], pageSize: 100, sort: "createdAt:asc" })
      .then((page) => { if (alive) setTicketResult({ key: planKey, items: page.items }); })
      .catch(() => { if (alive) setTicketResult({ key: planKey, items: [] }); });
    return () => { alive = false; };
  }, [engine, floorId, planKey]);

  // one 3D pin per open ticket, spread around the centre of its room (no room → the common area)
  const pins = useMemo(() => {
    if (!plan || !tickets) return [];
    const common = plan.rooms.find((r) => r.areaType === "common_area");
    const byRoom = new Map<string, TicketSummary[]>();
    for (const t of tickets) {
      if (!modelStep(t.step)) continue;
      const room = plan.rooms.find((r) => r.id === t.room?.id && r.shape) ?? common;
      if (!room) continue;
      byRoom.set(room.id, [...(byRoom.get(room.id) ?? []), t]);
    }
    const out: (TicketPin & { ticket: TicketSummary })[] = [];
    for (const [roomId, list] of byRoom) {
      const room = plan.rooms.find((r) => r.id === roomId)!;
      const c = roomCenter(room, plan.rooms);
      if (!c) continue;
      // keep the pins clear of the room label (at the centre): 1.6 m towards the back wall when the room allows
      const up: [number, number] = [c[0], c[1] - 1.6];
      const origin = room.shape && pointInShape(up[0], up[1], room.shape) ? up : c;
      spreadInRoom(origin, room.shape, list.length).forEach(([x, z], i) =>
        out.push({ id: list[i].id, x, z, step: modelStep(list[i].step)!, critical: list[i].priority === "critical", ticket: list[i] }));
    }
    return out;
  }, [plan, tickets]);
  const pinsShown = !!engine && !!floorId && readyFloor === floorId;
  useEffect(() => {
    if (pinsShown) engine!.setTicketPins(pins);
  }, [engine, pins, pinsShown]);

  const reloadPlan = () => setPlanRev((n) => n + 1);
  const back = () => setFloorId(null);

  // ---- drag and drop (F31) ----

  const suppressClick = useRef(false);
  const startDrag = (ev: ReactPointerEvent, source: DragSource) => {
    if (!edit || !engine || !plan || ev.button !== 0) return;
    ev.preventDefault();
    const rooms = plan.rooms;
    const sx = ev.clientX, sy = ev.clientY;
    let last: DragState = { source, x: sx, y: sy, room: null, point: null, moved: false };
    engine.setOrbit(false);
    const move = (e: PointerEvent) => {
      const point = engine.planPointAt(e.clientX, e.clientY);
      const room = point ? roomAt(point[0], point[1], rooms) : null;
      const moved = last.moved || Math.hypot(e.clientX - sx, e.clientY - sy) > 4;
      last = { source, x: e.clientX, y: e.clientY, room, point, moved };
      if (moved) engine.highlightRoom(room?.id ?? null, !room);
      setDrag(moved ? last : null);
    };
    const end = (e: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      engine.setOrbit(true);
      engine.highlightRoom(null);
      setDrag(null);
      if (e.type === "pointercancel" || !last.moved) return;
      // The click that follows a chip drag must not open its popover; it fires right after pointerup.
      if (source.kind === "move") {
        suppressClick.current = true;
        setTimeout(() => { suppressClick.current = false; }, 0);
      }
      const point = last.point;
      if (!last.room || !point) {
        toast.error("วางในห้องเท่านั้น");
        return;
      }
      if (source.kind === "new") {
        setDraft({ mode: "add", typeId: source.type.id, roomId: last.room.id, x: point[0], z: point[1], fromDrop: true });
      } else {
        void moveAsset(source.asset, last.room, [round(point[0]), round(point[1])]);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  async function moveAsset(asset: Asset, room: PlanRoom, point: [number, number] | null, undo = false) {
    const before = { roomId: asset.room.id, x: asset.x, z: asset.z };
    setPlanLocal((p) => p && { ...p, assets: p.assets.map((a) => (a.id === asset.id ? { ...a, room: { id: room.id, name: room.name }, x: point?.[0] ?? null, z: point?.[1] ?? null } : a)) });
    try {
      const saved = await updateAsset(asset.id, { code: asset.code, name: asset.name, roomId: room.id, x: point?.[0] ?? null, z: point?.[1] ?? null, rotationDeg: asset.rotationDeg });
      if (undo) toast.success("บันทึกแล้ว");
      else {
        toast.success(`ย้าย ${asset.code} ไป${room.name}แล้ว`, {
          duration: 8000,
          action: {
            label: "เลิกทำ",
            onClick: () => {
              const prev = plan?.rooms.find((r) => r.id === before.roomId);
              if (prev) void moveAsset(saved, prev, before.x !== null && before.z !== null ? [before.x, before.z] : null, true);
            },
          },
        });
      }
      reloadPlan();
    } catch (err) {
      toast.error(errorMessage(err));
      reloadPlan();
    }
  }

  // ---- floor picker keyboard (↑ ↓) ----

  const pickerRef = useRef<HTMLDivElement>(null);
  const onPickerKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const buttons = [...(pickerRef.current?.querySelectorAll<HTMLButtonElement>("button[data-floor]") ?? [])];
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = buttons[Math.max(0, Math.min(buttons.length - 1, (i < 0 ? 0 : i) + (e.key === "ArrowUp" ? -1 : 1)))];
    next?.focus();
    next?.click();
  };

  const tipFloor = tip ? building.floors.find((f) => f.level === tip.level) : null;
  const mountOf = (key: string) => MOUNT_Y[types.find((t) => t.key === key)?.mount ?? "wall"] ?? 1.6;

  return <section aria-label={`${building.name} แบบ 3 มิติ`} className="relative h-full min-h-140 overflow-hidden rounded-xl border bg-muted shadow-card">
    <div ref={hostRef} className="absolute inset-0" />
    <div ref={overlayRef} className="pointer-events-none absolute inset-0 z-10">
      {engine && !floorId && floors.filter((f) => f.openCount > 0).map((f) =>
        <Anchor key={f.id} engine={engine} at={engine.floorAnchor(f.level)} className="-translate-y-1/2">
          <FloorBadge floor={f} onOpen={() => setFloorId(f.id)} />
        </Anchor>)}
      {engine && pinsShown && pins.map((p) =>
        <Anchor key={p.id} engine={engine} at={engine.planAnchor(p.x, p.z, 3.6)} className="-translate-x-1/2 -translate-y-full">
          <TicketPinLabel ticket={p.ticket} step={p.step} />
        </Anchor>)}
      {engine && plan && planState !== "error" && <PlanOverlays engine={engine} plan={plan} edit={edit} canEdit={canEdit} mountOf={mountOf}
        openAsset={openAsset} setOpenAsset={setOpenAsset} suppressClick={suppressClick}
        onDragStart={startDrag} onEdit={(a) => setDraft({ mode: "edit", asset: a })} onDeactivate={setDeactivating} />}
    </div>

    {/* header */}
    <div className="pointer-events-none absolute inset-x-4.5 top-4.5 z-20 flex items-center gap-1.5">
      {floorId && <Button size="sm" variant="outline" className="pointer-events-auto" onClick={back}><ChevronLeft aria-hidden />ภาพอาคาร</Button>}
      <p className="pointer-events-auto rounded-md bg-card px-3 py-2 text-[15px] font-semibold shadow-card">
        {building.name}
        <small className="ml-1.5 text-xs font-normal text-muted-foreground">
          {current ? `${floorLabel(current.name)} · งานค้าง ${current.openCount}` : `${building.floors.length} ชั้น · งานค้าง ${totalOpen}`}
        </small>
      </p>
      {planState === "loading" && <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="กำลังโหลดผังชั้น" />}
      <span className="pointer-events-auto ml-auto flex gap-1.5">
        <IconButton label="ซูมเข้า" onClick={() => engine?.zoomBy(0.8)}><Plus /></IconButton>
        <IconButton label="ซูมออก" onClick={() => engine?.zoomBy(1.25)}><Minus /></IconButton>
        <IconButton label="รีเซ็ตมุมมอง" onClick={() => engine?.resetView()}><RotateCcw /></IconButton>
      </span>
    </div>

    {/* floor picker */}
    <div ref={pickerRef} role="group" aria-label="เลือกชั้น" onKeyDown={onPickerKey} className="absolute top-20.5 left-4.5 z-20 flex flex-col gap-2">
      {floors.map((f) => {
        const on = f.id === floorId;
        return <button key={f.id} type="button" data-floor={f.level} aria-current={on || undefined} tabIndex={on || (!floorId && f === floors[0]) ? 0 : -1}
          onClick={() => setFloorId(on ? null : f.id)} aria-label={`${floorLabel(f.name)} งานค้าง ${f.openCount}`}
          className={cn("flex h-10 min-w-19 items-center justify-between gap-2 rounded-md border px-2.5 text-sm font-semibold shadow-card outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
            on ? "border-primary bg-primary text-primary-foreground" : "bg-card")}>
          {floorLabel(f.name)}
          {f.openCount > 0 && <span className={cn("grid h-5 min-w-5 place-items-center rounded-full px-1 text-xs text-white", MODEL_STEP[floorTopStep(f)!].dot)}>{f.openCount}</span>}
        </button>;
      })}
    </div>

    {edit && <p className="absolute top-18.5 right-4.5 z-20 rounded-md bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground">โหมดจัดวางอุปกรณ์</p>}

    {planState === "error" && <div className="absolute inset-x-0 top-1/2 z-20 mx-auto w-80 -translate-y-1/2 rounded-xl bg-card p-4 shadow-raised">
      <ErrorState variant="inline" title="โหลดผังชั้นไม่สำเร็จ" onRetry={reloadPlan} />
    </div>}

    {/* legend / palette */}
    {!edit && <div className="absolute bottom-4.5 left-4.5 z-20 flex max-w-[calc(100%-2.25rem)] flex-wrap items-center gap-x-3 gap-y-2 rounded-md bg-card px-3 py-2.5 text-xs text-muted-foreground shadow-card">
      {MODEL_STEPS.map((st) => <span key={st.key} className="inline-flex items-center gap-1.5"><i className={cn("size-2.5 rounded-full", st.dot)} />{st.label}</span>)}
      <span className="inline-flex items-center gap-1 font-medium text-priority-critical"><TriangleAlert className="size-3.5" aria-hidden />ฉุกเฉิน</span>
      <span>· 1 หมุด = 1 งาน</span>
      {(types.length ? types : []).map((t) => {
        return <span key={t.id} className="inline-flex items-center gap-1.5"><AssetIcon typeKey={t.key} className="size-3.5" />{ASSET_SHORT[t.key] ?? t.name}</span>;
      })}
    </div>}
    {edit && (floorId && plan
      ? <div aria-label="อุปกรณ์" className="absolute bottom-4.5 left-1/2 z-20 flex max-w-[calc(100%-1.75rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-1 rounded-xl border bg-card p-2.5 shadow-raised">
          <span className="hidden max-w-25 px-2 text-xs leading-tight text-muted-foreground xl:block">ลากอุปกรณ์ไปวางในห้อง</span>
          {types.map((t) => {
            return <button key={t.id} type="button" onPointerDown={(e) => startDrag(e, { kind: "new", type: t })}
              onClick={() => setDraft({ mode: "add", typeId: t.id, roomId: "", x: null, z: null, fromDrop: false })}
              aria-label={`เพิ่ม${t.name}`} title="ลากไปวางในห้อง หรือกดเพื่อเลือกห้อง"
              className="flex w-16 cursor-grab touch-none flex-col items-center gap-0.5 rounded-md border bg-card px-1 py-1.5 text-xs font-semibold outline-none select-none hover:border-primary hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/40">
              <AssetIcon typeKey={t.key} className="size-5 text-primary" />{ASSET_SHORT[t.key] ?? t.name}
            </button>;
          })}
          <Button size="sm" variant="outline" onClick={() => setDraft({ mode: "add", typeId: null, roomId: "", x: null, z: null, fromDrop: false })}><Plus aria-hidden />เพิ่มอุปกรณ์</Button>
        </div>
      : <p className="absolute bottom-4.5 left-1/2 z-20 -translate-x-1/2 rounded-xl border bg-card px-4 py-2.5 text-sm font-medium shadow-raised">เลือกชั้นก่อนจัดวางอุปกรณ์</p>)}

    {tip && tipFloor && !floorId && <p role="tooltip" style={{ left: tip.x + 14, top: tip.y + 14 }}
      className="pointer-events-none absolute z-30 rounded-sm bg-foreground px-2.5 py-1.5 text-xs whitespace-nowrap text-background">
      <b>{floorLabel(tipFloor.name)}</b> · {tipFloor.openCount ? floorStepCounts(tipFloor).filter(([, n]) => n).map(([k, n]) => `${MODEL_STEP[k].label} ${n}`).join(" · ") : "ไม่มีงานค้าง"}
      {tipFloor.criticalCount > 0 && ` · ฉุกเฉิน ${tipFloor.criticalCount}`}
    </p>}

    {drag && <DragGhost drag={drag} />}

    {plan && <AssetDialog draft={draft} plan={plan} types={types} onClose={() => setDraft(null)} onSaved={(a, mode) => {
      setDraft(null);
      toast.success(mode === "add" ? `เพิ่ม ${a.code} แล้ว` : "บันทึกแล้ว");
      reloadPlan();
    }} />}
    <DeactivateAssetDialog asset={deactivating} onClose={() => setDeactivating(null)} onDone={(a) => {
      setDeactivating(null);
      toast.success(`ปิดใช้งาน ${a.code} แล้ว`);
      reloadPlan();
    }} />
  </section>;
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return <Button type="button" size="icon" variant="outline" aria-label={label} title={label} onClick={onClick} className="size-10 [&_svg]:size-4.5">{children}</Button>;
}

/** An overlay element kept over a world point by the engine (it sets left / top / visibility). */
function Anchor({ engine, at: [x, y, z], className, children }: { engine: BuildingEngine; at: [number, number, number]; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => (ref.current ? engine.track(ref.current, x, y, z) : undefined), [engine, x, y, z]);
  return <div ref={ref} className="invisible absolute">
    <div className={cn("pointer-events-auto", className)}>{children}</div>
  </div>;
}

function PlanOverlays({ engine, plan, edit, canEdit, mountOf, openAsset, setOpenAsset, suppressClick, onDragStart, onEdit, onDeactivate }: {
  engine: BuildingEngine;
  plan: FloorPlan;
  edit: boolean;
  canEdit: boolean;
  mountOf: (key: string) => number;
  openAsset: string | null;
  setOpenAsset: (id: string | null) => void;
  suppressClick: React.RefObject<boolean>;
  onDragStart: (e: ReactPointerEvent, source: DragSource) => void;
  onEdit: (a: Asset) => void;
  onDeactivate: (a: Asset) => void;
}) {
  const centers = useMemo(() => new Map(plan.rooms.map((r) => [r.id, roomCenter(r, plan.rooms)])), [plan.rooms]);
  return <>
    {plan.assets.map((a) => {
      const p = a.x !== null && a.z !== null ? [a.x, a.z] : centers.get(a.room.id);
      if (!p) return null;
      const unplaced = a.x === null;
      return <Anchor key={a.id} engine={engine} at={engine.planAnchor(p[0], p[1], mountOf(a.type.key))} className="-translate-x-1/2 -translate-y-1/2">
        <Popover open={openAsset === a.id} onOpenChange={(o) => setOpenAsset(o ? a.id : null)}>
          <PopoverTrigger asChild>
            <button type="button" aria-label={assetLabel(a)} title={unplaced ? "ยังไม่ได้วางจุด" : undefined}
              onPointerDown={(e) => onDragStart(e, { kind: "move", asset: a })}
              onClickCapture={(e) => { if (suppressClick.current) { suppressClick.current = false; e.preventDefault(); e.stopPropagation(); } }}
              className={cn("relative grid size-8 touch-none place-items-center rounded-full border-2 bg-card text-primary shadow-raised outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                unplaced ? "border-dashed border-primary/60" : "border-primary", edit && "cursor-grab")}>
              <AssetIcon typeKey={a.type.key} className="size-4" />
              {a.openTickets > 0 && <span className="absolute -top-1.5 -right-2 grid h-4.5 min-w-4.5 place-items-center rounded-full border-2 border-card bg-priority-high px-1 text-[11px] font-bold text-white">{a.openTickets}</span>}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3 text-sm" side="top">
            <p className="font-semibold">{a.name}</p>
            <p className="text-muted-foreground">{a.code} · {a.type.name}</p>
            <p className="mt-1 text-muted-foreground">{a.room.name}{unplaced && " · ยังไม่ได้วางจุด"}</p>
            {a.openTickets > 0 && <p className="mt-1 font-medium text-priority-high">งานค้าง {a.openTickets}</p>}
            {canEdit && <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { setOpenAsset(null); onEdit(a); }}><Pencil aria-hidden />แก้ไข</Button>
              <Button size="sm" variant="destructive" onClick={() => { setOpenAsset(null); onDeactivate(a); }}><Power aria-hidden />ปิดใช้งาน</Button>
            </div>}
          </PopoverContent>
        </Popover>
      </Anchor>;
    })}
  </>;
}

/** Building view: floor name + open tickets per step (only the steps that have tickets). */
function FloorBadge({ floor, onOpen }: { floor: OverviewFloor; onOpen: () => void }) {
  const counts = floorStepCounts(floor).filter(([, n]) => n > 0);
  const top = floorTopStep(floor)!;
  return <button type="button" onClick={onOpen}
    aria-label={`${floorLabel(floor.name)} งานค้าง ${floor.openCount}: ${counts.map(([k, n]) => `${MODEL_STEP[k].label} ${n}`).join(", ")}${floor.criticalCount ? `, ฉุกเฉิน ${floor.criticalCount}` : ""}`}
    className="group flex items-center gap-2 rounded-full border bg-card/95 py-1 pr-1.5 pl-2.5 text-xs shadow-raised backdrop-blur-sm outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring/40 motion-reduce:transition-none">
    <span className="relative flex size-2.5" aria-hidden>
      <span className={cn("absolute inline-flex size-full rounded-full opacity-60 motion-safe:animate-ping", MODEL_STEP[top].dot)} />
      <span className={cn("relative inline-flex size-2.5 rounded-full", MODEL_STEP[top].dot)} />
    </span>
    <b className="font-semibold">{floorLabel(floor.name)}</b>
    <span className="flex gap-1" aria-hidden>
      {counts.map(([k, n]) => <span key={k} className={cn("inline-flex h-5 min-w-5 items-center justify-center gap-1 rounded-full px-1.5 font-semibold", MODEL_STEP[k].soft, MODEL_STEP[k].text)}>
        <i className={cn("size-1.5 rounded-full", MODEL_STEP[k].dot)} />{n}
      </span>)}
      {floor.criticalCount > 0 && <span className="inline-flex h-5 items-center gap-1 rounded-full bg-priority-critical px-1.5 font-semibold text-white">
        <TriangleAlert className="size-3" />{floor.criticalCount}
      </span>}
    </span>
  </button>;
}

/** Floor view: the label over a ticket's 3D pin (last digits of its number) → details popover → S07. */
function TicketPinLabel({ ticket, step }: { ticket: TicketSummary; step: ModelStepKey }) {
  const st = MODEL_STEP[step];
  const critical = ticket.priority === "critical";
  return <Popover>
    <PopoverTrigger asChild>
      <button type="button" aria-label={`${ticket.ticketNo} ${ticketTitle(ticket)} · ${st.label}${critical ? " · ฉุกเฉิน" : ""}`}
        className={cn("inline-flex items-center gap-0.5 rounded-md border-2 px-1.5 py-0.5 text-xs leading-none font-bold text-white tabular-nums shadow-raised outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
          st.dot, critical ? "border-priority-critical ring-2 ring-priority-critical/30" : "border-card")}>
        {critical && <TriangleAlert className="size-3" aria-hidden />}{ticket.ticketNo.slice(-3)}
      </button>
    </PopoverTrigger>
    <PopoverContent className="w-72 p-0" side="top">
      <div className="space-y-1.5 p-3">
        <span className="flex flex-wrap gap-1.5">
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold", st.soft, st.text)}><i className={cn("size-1.5 rounded-full", st.dot)} />{st.label}</span>
          {critical && <span className="inline-flex items-center gap-1 rounded-full bg-priority-critical/10 px-2 py-0.5 text-xs font-semibold text-priority-critical"><TriangleAlert className="size-3" aria-hidden />ฉุกเฉิน</span>}
        </span>
        <p className="font-semibold leading-snug">{ticketTitle(ticket)}</p>
        <p className="text-xs text-muted-foreground">{ticket.ticketNo} · {ticket.room?.name ?? "—"}{ticket.locationDetail ? ` · ${ticket.locationDetail}` : ""}</p>
        <p className="text-xs text-muted-foreground">แจ้ง {listDate(ticket.createdAt)} · {ticket.reporter.name}</p>
      </div>
      <Link href={ticketHref(ticket.id)} className="flex items-center justify-between border-t px-3 py-2 text-sm font-semibold text-primary hover:bg-muted">
        ดูรายละเอียดงาน<ArrowRight className="size-4" aria-hidden />
      </Link>
    </PopoverContent>
  </Popover>;
}

function DragGhost({ drag }: { drag: DragState }) {
  const key = drag.source.kind === "new" ? drag.source.type.key : drag.source.asset.type.key;
  const bad = !drag.room;
  return <div aria-hidden style={{ left: drag.x, top: drag.y }}
    className={cn("pointer-events-none fixed z-50 grid size-9.5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 bg-card shadow-raised",
      bad ? "border-destructive text-destructive" : "border-primary text-primary")}>
    {drag.source.kind === "move" ? <Move className="size-4" /> : <AssetIcon typeKey={key} className="size-4" />}
    <em className={cn("absolute top-11 left-1/2 -translate-x-1/2 rounded-sm px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-white not-italic", bad ? "bg-destructive" : "bg-foreground")}>
      {bad ? "วางในห้องเท่านั้น" : drag.room!.name}
    </em>
  </div>;
}

/** The fetched plan plus local optimistic edits (a moved chip shows at its new place at once); a new fetch wins. */
function useOptimisticPlan(fetched: FloorPlan | null) {
  const [local, setLocal] = useState<{ base: FloorPlan | null; plan: FloorPlan | null } | null>(null);
  const plan = local && local.base === fetched ? local.plan : fetched;
  const update = (fn: (p: FloorPlan | null) => FloorPlan | null) => setLocal({ base: fetched, plan: fn(plan) });
  return [plan, update] as const;
}
