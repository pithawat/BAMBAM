"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { roomAt, roomCenter } from "../plan-geometry";
import type { RoomPlan } from "../types";
import { BuildingEngine } from "./dashboard/scene/engine";

// CR-038: the S29 engine (D-124 budget: render on demand, one building, disposed on unmount) showing only the
// picked floor's plan for the S03 room picker. A click (not a drag) on a room picks it; hover highlights.
// Lazy chunk: three.js loads only on desktop with WebGL, after a floor with a plan is picked.

const NOOP = () => {};

export default function RoomPlan3D({ plan, value, onPick }: { plan: RoomPlan; value: string; onPick: (roomId: string) => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [engine, setEngine] = useState<BuildingEngine | null>(null);
  const [shown, setShown] = useState<string | null>(null);
  const valueRef = useRef(value);
  const pickRef = useRef(onPick);
  useEffect(() => {
    valueRef.current = value;
    pickRef.current = onPick;
  });

  useEffect(() => {
    const e = new BuildingEngine(hostRef.current!, overlayRef.current!, { onFloorHover: NOOP, onFloorClick: NOOP, onBlockHover: NOOP, onBlockClick: NOOP });
    setEngine(e);
    return () => {
      e.dispose();
      setEngine(null);
    };
  }, []);

  // open the building (its own shape chunk), then go straight to this floor's plan
  const model = plan.model!;
  useEffect(() => {
    if (!engine) return;
    let alive = true;
    void (async () => {
      const ok = await engine.openBuilding(model.key, { floors: model.floors, width: model.widthM, depth: model.depthM });
      if (!alive || !ok) return;
      await engine.showPlan({ ...plan, assets: [] }, (room) => roomCenter(room, plan.rooms));
      if (alive) setShown(plan.floor.id);
    })();
    return () => { alive = false; };
  }, [engine, plan, model.key, model.floors, model.widthM, model.depthM]);

  const ready = shown === plan.floor.id;
  useEffect(() => {
    if (engine && ready) engine.highlightRoom(value || null);
  }, [engine, ready, value]);

  // click = pointer up near where it went down (orbiting the camera is a drag)
  useEffect(() => {
    const host = hostRef.current;
    if (!engine || !ready || !host) return;
    let down: [number, number] | null = null;
    const roomUnder = (e: PointerEvent) => {
      const p = engine.planPointAt(e.clientX, e.clientY);
      return p ? roomAt(p[0], p[1], plan.rooms) : null;
    };
    const onDown = (e: PointerEvent) => { down = [e.clientX, e.clientY]; };
    const onUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
      down = null;
      const r = roomUnder(e);
      if (r) pickRef.current(r.id);
    };
    const onMove = (e: PointerEvent) => {
      if (e.buttons) return;
      const r = roomUnder(e);
      host.style.cursor = r ? "pointer" : "";
      engine.highlightRoom(r?.id ?? (valueRef.current || null));
    };
    const onLeave = () => {
      host.style.cursor = "";
      engine.highlightRoom(valueRef.current || null);
    };
    host.addEventListener("pointerdown", onDown);
    host.addEventListener("pointerup", onUp);
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);
    return () => {
      host.removeEventListener("pointerdown", onDown);
      host.removeEventListener("pointerup", onUp);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
    };
  }, [engine, ready, plan.rooms]);

  return <>
    <div ref={hostRef} className="absolute inset-0" />
    <div ref={overlayRef} className="pointer-events-none absolute inset-0 z-10" aria-hidden />
    {!ready && <Loader2 className="absolute top-3 right-3 z-20 size-5 animate-spin text-muted-foreground" aria-label="กำลังโหลดแปลน" />}
  </>;
}
