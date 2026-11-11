"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { List, Map as MapIcon } from "lucide-react";
import { useIsDesktop } from "@/components/shared/use-media-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getRoomPlan } from "../api";
import { roomCenter, shapeArea } from "../plan-geometry";
import type { PlanRoom, RoomPlan } from "../types";
import { hasWebGL } from "./dashboard/dashboard-ui";

// CR-038: S03 picks the room on the floor plan (#36) instead of by name. Desktop with WebGL and a building
// shape → the S29 3D engine's plan view; phones / no WebGL / no shape → a flat SVG plan from the same room
// outlines (D-124: no 3D on phones). The name list stays behind "เลือกจากรายชื่อ" for rooms without an
// outline, floors without a plan, keyboard and screen-reader users.

const RoomPlan3D = dynamic(() => import("./room-plan-3d"), { ssr: false, loading: () => <Skeleton className="size-full rounded-none" /> });

type Load = { floorId: string; plan: RoomPlan | null };

export function RoomPlanPicker({ floorId, value, onPick, list }: {
  floorId: string; value: string; onPick: (roomId: string) => void; list: ReactNode;
}) {
  const desktop = useIsDesktop();
  const [webgl] = useState(() => typeof window !== "undefined" && hasWebGL());
  const [load, setLoad] = useState<Load | null>(null);
  const [showList, setShowList] = useState(false);

  useEffect(() => {
    let alive = true;
    getRoomPlan(floorId)
      .then((plan) => { if (alive) setLoad({ floorId, plan }); })
      .catch(() => { if (alive) setLoad({ floorId, plan: null }); }); // no plan → the list, the form still works
    return () => { alive = false; };
  }, [floorId]);

  const plan = load?.floorId === floorId ? load.plan : undefined;
  const shaped = useMemo(() => plan?.rooms.filter((r) => r.shape && r.shape.length >= 3) ?? [], [plan]);
  if (plan === undefined) return <Skeleton className="h-72 w-full rounded-lg" />;
  const usable = !!plan && plan.widthM != null && plan.depthM != null && shaped.length > 0;
  if (!usable) return <>{list}</>;

  const picked = plan.rooms.find((r) => r.id === value);
  const unshaped = plan.rooms.length - shaped.length;
  const in3D = desktop && webgl && !!plan.model;
  return <div className="space-y-2.5">
    {!showList && <div className={cn("relative overflow-hidden rounded-lg border bg-muted/40", in3D ? "h-105" : "")}>
      {in3D
        ? <RoomPlan3D plan={plan} value={value} onPick={onPick} />
        : <FlatPlan plan={plan} rooms={shaped} value={value} onPick={onPick} />}
    </div>}
    {showList && list}
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <p aria-live="polite" className={picked ? "font-semibold" : "text-muted-foreground"}>
        {picked ? `ห้องที่เลือก: ${picked.name}` : showList ? "เลือกห้องจากรายชื่อ" : "กดที่ห้องในแปลนเพื่อเลือก"}
        {!showList && unshaped > 0 && <span className="block text-[13px] font-normal text-muted-foreground">ไม่พบห้องในแปลน? เลือกจากรายชื่อได้</span>}
      </p>
      <Button type="button" variant="link" className="h-11 px-0" onClick={() => setShowList((v) => !v)}>
        {showList ? <><MapIcon aria-hidden />เลือกจากแปลน</> : <><List aria-hidden />เลือกจากรายชื่อ</>}
      </Button>
    </div>
  </div>;
}

/** Top-down plan in metres (phones, no WebGL, no 3D shape). Bigger rooms first, so a small room drawn inside a common area wins the tap. */
function FlatPlan({ plan, rooms, value, onPick }: { plan: RoomPlan; rooms: PlanRoom[]; value: string; onPick: (id: string) => void }) {
  const W = plan.widthM!, D = plan.depthM!;
  const ordered = useMemo(() => [...rooms].sort((a, b) => shapeArea(b.shape!) - shapeArea(a.shape!)), [rooms]);
  const centers = useMemo(() => new Map(rooms.map((r) => [r.id, roomCenter(r, rooms)])), [rooms]);
  const pad = 0.6;
  const font = Math.max(0.55, Math.min(1.1, Math.max(W, D) / 34));
  return <svg viewBox={`${-pad} ${-pad} ${W + pad * 2} ${D + pad * 2}`} role="radiogroup" aria-label={`แปลนชั้น ${plan.floor.name}`}
    className="block h-auto max-h-[60svh] w-full touch-manipulation select-none">
    {ordered.map((r) => {
      const on = r.id === value;
      const pick = () => onPick(r.id);
      return <g key={r.id} role="radio" aria-checked={on} aria-label={r.name} tabIndex={0} onClick={pick}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } }}
        className="group cursor-pointer outline-none">
        <polygon points={r.shape!.map(([x, z]) => `${x},${z}`).join(" ")} vectorEffect="non-scaling-stroke"
          className={cn("stroke-[1.5] transition-colors motion-reduce:transition-none",
            on ? "fill-primary/25 stroke-primary" : r.areaType === "common_area" ? "fill-card stroke-border group-hover:fill-secondary" : "fill-background stroke-muted-foreground/50 group-hover:fill-secondary",
            "group-focus-visible:stroke-ring group-focus-visible:stroke-[3]")} />
      </g>;
    })}
    {ordered.map((r) => {
      const c = centers.get(r.id);
      if (!c) return null;
      return <text key={r.id} x={c[0]} y={c[1]} textAnchor="middle" dominantBaseline="central" fontSize={font} aria-hidden
        className={cn("pointer-events-none", r.id === value ? "fill-primary font-semibold" : "fill-foreground")}>{r.name}</text>;
    })}
  </svg>;
}
