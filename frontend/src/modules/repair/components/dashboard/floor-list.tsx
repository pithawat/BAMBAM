"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Loader2, TriangleAlert } from "lucide-react";
import { ErrorState } from "@/components/shared/states";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { getFloorPlan, getTickets } from "../../api";
import type { FloorPlan, OverviewBuilding, OverviewFloor, TicketSummary } from "../../types";
import { floorLabel, ticketHref, ticketTitle } from "../ticket-presentation";
import { floorStepCounts, floorTopStep, MODEL_STEP, modelStep } from "./dashboard-ui";

// S29 floor list: phones / tablets (< 1024 px), no WebGL, and buildings without a model (BR-F23-4).
// A floor opens a bottom sheet with its rooms (#30: open count + equipment count) and open tickets.

export function FloorList({ building, note }: { building: OverviewBuilding; note?: string }) {
  const [open, setOpen] = useState<OverviewFloor | null>(null);
  const floors = [...building.floors].sort((a, b) => b.level - a.level);
  return <section aria-labelledby="floor-list-title" className="rounded-xl border bg-card">
    <div className="px-5 pt-4.5 pb-3.5">
      <h2 id="floor-list-title" className="font-heading text-[15px] font-semibold">{building.name} · งานค้างตามชั้น</h2>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
    <ul>
      {floors.map((f) => <li key={f.id} className="border-t">
        <button type="button" onClick={() => setOpen(f)} aria-label={`${floorLabel(f.name)} งานค้าง ${f.openCount}`}
          className="flex min-h-13 w-full items-center gap-3 px-5 py-2.5 text-left outline-none hover:bg-muted/60 focus-visible:bg-muted">
          <span className={cn("size-2.5 shrink-0 rounded-full", floorTopStep(f) ? MODEL_STEP[floorTopStep(f)!].dot : "bg-border")} aria-hidden />
          <b className="flex-1 font-semibold">{floorLabel(f.name)}</b>
          {f.openCount ? <span className="flex flex-wrap justify-end gap-1">
            {floorStepCounts(f).filter(([, n]) => n > 0).map(([k, n]) => <span key={k} className={cn("inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-semibold", MODEL_STEP[k].soft, MODEL_STEP[k].text)}>
              {MODEL_STEP[k].label} {n}
            </span>)}
            {f.criticalCount > 0 && <span className="inline-flex h-6 items-center gap-1 rounded-full bg-priority-critical px-2 text-xs font-semibold text-white">
              <TriangleAlert className="size-3" aria-hidden />ฉุกเฉิน {f.criticalCount}
            </span>}
          </span> : <span className="text-sm text-muted-foreground">ไม่มีงานค้าง</span>}
          <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
        </button>
      </li>)}
    </ul>
    <FloorSheet building={building} floor={open} onClose={() => setOpen(null)} />
  </section>;
}

function FloorSheet({ building, floor, onClose }: { building: OverviewBuilding; floor: OverviewFloor | null; onClose: () => void }) {
  const [result, setResult] = useState<{ key: string; data?: { plan: FloorPlan; tickets: TicketSummary[] }; failed?: boolean } | null>(null);
  const [rev, setRev] = useState(0);
  const floorId = floor?.id;
  const key = `${floorId}:${rev}`;
  useEffect(() => {
    if (!floorId) return;
    let alive = true;
    Promise.all([getFloorPlan(floorId), getTickets({ scope: "all", floorId, status: ["in_progress", "resolved"], pageSize: 100, sort: "createdAt:asc" })])
      .then(([plan, page]) => { if (alive) setResult({ key, data: { plan, tickets: page.items } }); })
      .catch(() => { if (alive) setResult({ key, failed: true }); });
    return () => { alive = false; };
  }, [floorId, key]);
  const data = result?.key === key ? result.data : undefined;
  const failed = result?.key === key && !!result.failed;

  const equipment = (roomId: string) => data?.plan.assets.filter((a) => a.room.id === roomId).length ?? 0;
  return <Sheet open={!!floor} onOpenChange={(o) => { if (!o) onClose(); }}>
    <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl">
      <SheetHeader>
        <SheetTitle>{building.name} {floor ? floorLabel(floor.name) : ""}</SheetTitle>
        <SheetDescription>{floor?.openCount ? `งานค้าง ${floor.openCount}` : "ไม่มีงานค้าง"}</SheetDescription>
      </SheetHeader>
      <div className="px-4 pb-6">
        {failed ? <ErrorState variant="inline" title="โหลดผังชั้นไม่สำเร็จ" onRetry={() => setRev((n) => n + 1)} />
          : !data ? <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden />กำลังโหลด</p>
          : <>
              <h3 className="mb-2 text-sm font-semibold">ห้อง</h3>
              <ul className="divide-y rounded-lg border">
                {data.plan.rooms.map((r) => <li key={r.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate">{r.name}</span>
                  {equipment(r.id) > 0 && <span className="text-xs text-muted-foreground">อุปกรณ์ {equipment(r.id)}</span>}
                  <span className={cn("text-xs", r.openCount ? "font-semibold" : "text-muted-foreground")}>{r.openCount ? `งานค้าง ${r.openCount}` : "—"}</span>
                </li>)}
              </ul>
              {data.tickets.length > 0 && <>
                <h3 className="mt-4 mb-2 text-sm font-semibold">งานค้าง</h3>
                <ul className="divide-y rounded-lg border">
                  {data.tickets.map((t) => <li key={t.id}>
                    <Link href={ticketHref(t.id)} className="block px-3 py-2.5 hover:bg-muted/60">
                      <b className="block truncate text-sm font-semibold">{ticketTitle(t)}</b>
                      <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        {modelStep(t.step) && <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 font-semibold", MODEL_STEP[modelStep(t.step)!].soft, MODEL_STEP[modelStep(t.step)!].text)}>
                          <i className={cn("size-1.5 rounded-full", MODEL_STEP[modelStep(t.step)!].dot)} />{MODEL_STEP[modelStep(t.step)!].label}
                        </span>}
                        {t.priority === "critical" && <span className="inline-flex items-center gap-1 rounded-full bg-priority-critical/10 px-1.5 font-semibold text-priority-critical">
                          <TriangleAlert className="size-3" aria-hidden />ฉุกเฉิน
                        </span>}
                        {t.ticketNo} · {t.room?.name ?? t.locationDetail ?? ""}
                      </span>
                    </Link>
                  </li>)}
                </ul>
              </>}
            </>}
      </div>
    </SheetContent>
  </Sheet>;
}
