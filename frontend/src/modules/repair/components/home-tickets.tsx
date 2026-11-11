"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChevronRight, RotateCcw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getMyTickets } from "../api";

// Home "รายการของฉัน" strip under the repair card (CR-040, layout from the owner's `App (1).tsx` reference; replaces
// the CR-035 three-row list). Totals from #35 (`pageSize=1`, read `meta.total`): everything the viewer reported or
// follows, how many are still being worked on, and the reporter's tickets waiting for their rating (BR-F06-2).
// The first non-empty state is named, the rest are counted. Rendered only for `repair.ticket.report`.

type Counts = { total: number; awaiting: number; inProgress: number };
type Data = Counts | "error";

const page = { page: 1, pageSize: 1 } as const;

export function HomeTicketsStrip({ className }: { className?: string }) {
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<{ revision: number; value: Data }>();
  const retry = useCallback(() => setRevision((r) => r + 1), []);
  useEffect(() => {
    let active = true;
    Promise.all([
      getMyTickets({ relation: "all", ...page }),
      getMyTickets({ relation: "reported", status: ["resolved"], ...page }),
      getMyTickets({ relation: "all", status: ["in_progress"], ...page }),
    ]).then(
      ([all, awaiting, inProgress]) => {
        if (active) setData({ revision, value: { total: all.meta.total, awaiting: awaiting.meta.total, inProgress: inProgress.meta.total } });
      },
      () => { if (active) setData({ revision, value: "error" }); },
    );
    return () => { active = false; };
  }, [revision]);

  const frame = cn("block w-full border-t border-primary-foreground/15 bg-primary-foreground/7 px-4 py-3 text-left sm:px-5.5 lg:px-6", className);
  if (!data || data.revision !== revision) {
    return <div aria-busy="true" aria-label="กำลังโหลดรายการของฉัน" className={frame}>
      <Skeleton className="h-4 w-24 bg-primary-foreground/20" />
      <Skeleton className="mt-2 h-3 w-32 max-w-full bg-primary-foreground/15" />
    </div>;
  }
  const value = data.value;
  if (value === "error") {
    return <div role="alert" className={cn(frame, "text-[13px] leading-5 text-primary-foreground/85")}>
      โหลดรายการของฉันไม่สำเร็จ
      <button type="button" onClick={retry} className="mt-1 flex min-h-8 items-center gap-1.5 rounded-sm font-medium text-primary-foreground underline underline-offset-4 outline-none">
        <RotateCcw className="size-3.5" aria-hidden />ลองอีกครั้ง
      </button>
    </div>;
  }
  if (!value.total) return null;

  const done = Math.max(0, value.total - value.awaiting - value.inProgress);
  const states = [
    { key: "awaiting", label: "รอคุณให้คะแนน", count: value.awaiting, dot: "bg-gold" },
    { key: "progress", label: "กำลังดำเนินการ", count: value.inProgress, dot: "bg-primary-foreground" },
    { key: "done", label: "เสร็จสิ้น", count: done, dot: "bg-[#8FE0C2]" },
  ].filter((s) => s.count > 0);
  const first = states[0];
  const rest = value.total - first.count;

  return <Link href="/repair/my" aria-label={`รายการของฉัน ${value.total} รายการ · ${first.label} ${first.count}`}
    className={cn(frame, "group/strip outline-none transition-colors hover:bg-primary-foreground/12 focus-visible:bg-primary-foreground/12")}>
    <span className="flex items-center gap-2 text-[13px] leading-5 font-medium text-primary-foreground">
      รายการของฉัน
      <span className="grid h-5 min-w-5 place-items-center rounded-[5px] bg-primary-foreground/18 px-1 text-xs tabular-nums">{value.total}</span>
      <ChevronRight className="ml-auto size-4 text-primary-foreground/75 transition-transform group-hover/strip:translate-x-0.5" aria-hidden />
    </span>
    <span className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs leading-5 text-primary-foreground/78">
      <i aria-hidden className={cn("size-1.5 shrink-0 rounded-full", first.dot)} />
      {first.label} <span className="tabular-nums">{first.count}</span>
      {rest > 0 && <span className="text-primary-foreground/60">· อีก <span className="tabular-nums">{rest}</span> รายการ</span>}
    </span>
  </Link>;
}

