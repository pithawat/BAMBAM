import { cn } from "@/lib/utils";

export type Priority = "critical" | "high" | "medium" | "low";

// Labels from _common.md §2; colours from design-system.md (CR-008 priority tokens).
const PRIORITY: Record<Priority, { label: string; bars: number; color: string; badge: string }> = {
  critical: { label: "ฉุกเฉิน", bars: 3, color: "text-priority-critical", badge: "bg-priority-critical/10 text-priority-critical" },
  high: { label: "สูง", bars: 3, color: "text-priority-high", badge: "bg-priority-high/10 text-priority-high" },
  medium: { label: "ปกติ", bars: 2, color: "text-priority-medium", badge: "bg-priority-medium/10 text-priority-medium" },
  low: { label: "ต่ำ", bars: 1, color: "text-priority-low", badge: "bg-priority-low/10 text-priority-low" },
};

export const PRIORITY_LABEL = (p: Priority) => PRIORITY[p].label;

/** Three bars + text (lists). Colour is never the only signal. */
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

/** Pill badge with a dot + label (S03 explanation, S05, S07 facts — design-system.md "Priority"). */
export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  const p = PRIORITY[priority];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[13.5px] font-semibold whitespace-nowrap", p.badge, className)}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {p.label}
    </span>
  );
}
