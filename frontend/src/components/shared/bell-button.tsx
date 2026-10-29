import Link from "next/link";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Bell → /notifications. Placeholder until repair Stage 7 adds the unread count
 * (GET /api/v1/notifications/unread-count, D-023).
 */
export function BellButton({ onGradient, count, className }: { onGradient?: boolean; count?: number; className?: string }) {
  return (
    <Link
      href="/notifications"
      aria-label={count ? `แจ้งเตือน ${count} รายการที่ยังไม่อ่าน` : "แจ้งเตือน"}
      className={cn(
        "relative grid size-11 shrink-0 place-items-center rounded-full",
        onGradient ? "bg-white text-primary" : "bg-card text-foreground shadow-card",
        className,
      )}
    >
      <Bell className="size-5" aria-hidden />
      {!!count && (
        <span className="absolute -top-1 -right-1 min-w-5 rounded-full border-2 border-white bg-destructive px-1 text-center font-heading text-[11px] leading-4 font-bold text-white">
          {count}
        </span>
      )}
    </Link>
  );
}
