import { cn } from "@/lib/utils";

export type Priority = "critical" | "high" | "medium" | "low";

// Labels from _common.md §2; colors from design-system.md (ปกติ / ต่ำ = muted).
const PRIORITY: Record<Priority, { label: string; bars: number; color: string }> = {
  critical: { label: "ฉุกเฉิน", bars: 3, color: "text-destructive" },
  high: { label: "สูง", bars: 3, color: "text-priority-high" },
  medium: { label: "ปกติ", bars: 2, color: "text-muted-foreground" },
  low: { label: "ต่ำ", bars: 1, color: "text-muted-foreground" },
};

/** Three bars + text. Color is never the only signal. */
export function PriorityIndicator({ priority, className }: { priority: Priority; className?: string }) {
  const p = PRIORITY[priority];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[13.5px] font-medium", p.color, className)}>
      <span aria-hidden className="flex items-end gap-0.5">
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn("w-1 rounded-full", i === 1 ? "h-1.5" : i === 2 ? "h-2.5" : "h-3.5", i <= p.bars ? "bg-current" : "bg-current/20")}
          />
        ))}
      </span>
      {p.label}
    </span>
  );
}
