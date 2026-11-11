import { cn } from "@/lib/utils";
import { LABEL_BADGE } from "../../labels";
import type { LabelStatus } from "../../types";

// The QR label status badge of S20 rows and S30 rows (CR-007): warning for moved / changed, muted for never, none for current.

export function LabelBadge({ status, className }: { status: LabelStatus; className?: string }) {
  const b = LABEL_BADGE[status];
  if (!b) return null;
  return (
    <span
      data-testid="label-badge"
      data-status={status}
      className={cn(
        "inline-flex w-fit items-center rounded-md px-1.5 py-0.5 font-sans text-xs leading-tight",
        b.tone === "warning" ? "bg-warning/12 font-medium text-warning" : "bg-muted text-muted-foreground",
        className,
      )}
    >
      {b.text}
    </span>
  );
}
