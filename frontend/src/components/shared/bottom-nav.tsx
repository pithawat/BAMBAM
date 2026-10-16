"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, House, ListChecks, ScanLine, UserRound, Wrench } from "lucide-react";
import { useCurrentUser } from "@/components/shared/me-provider";
import { cn } from "@/lib/utils";

// Mobile bottom nav — 5 slots (_common.md §1, D-019). The technician's second slot is
// their work list instead of "ติดตามงาน" (CR-005).
const ITEMS = [
  { href: "/", label: "หน้าแรก", icon: House },
  { href: "/repair/my", label: "ติดตามงาน", icon: ListChecks },
  { href: "/repair/scan", label: "สแกน", icon: ScanLine, center: true },
  { href: "/notifications", label: "แจ้งเตือน", icon: Bell },
  { href: "/profile", label: "โปรไฟล์", icon: UserRound },
] as const;

/** Pages that show the bottom nav (S02, S06, S09, S13, S14). Others are sub-pages or full-screen flows. */
export const BOTTOM_NAV_PATHS = ["/", "/repair/my", "/repair/work", "/notifications", "/profile"];

export function BottomNav({ unread = false }: { unread?: boolean }) {
  const pathname = usePathname();
  const me = useCurrentUser();
  const items = me.role === "technician"
    ? ITEMS.map((item) => item.href === "/repair/my" ? { href: "/repair/work", label: "งานซ่อม", icon: Wrench } as const : item)
    : ITEMS;
  return (
    <nav
      aria-label="เมนูหลัก"
      className="fixed inset-x-0 bottom-0 z-30 rounded-t-[26px] bg-card pb-[env(safe-area-inset-bottom)] shadow-nav lg:hidden"
    >
      <ul className="mx-auto grid h-22 max-w-140 grid-cols-5 px-1.5 pt-2.5">
        {items.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          if ("center" in item) {
            return (
              <li key={item.href} className="flex justify-center">
                <Link
                  href={item.href}
                  aria-label="สแกน QR แจ้งซ่อม"
                  className="-mt-7 flex flex-col items-center gap-0.5 text-[11.5px] font-medium text-muted-foreground"
                >
                  <span className="grid size-14.5 place-items-center rounded-full border-4 border-white bg-brand text-white shadow-brand">
                    <Icon className="size-6.5" aria-hidden />
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          }
          return (
            <li key={item.href} className="flex justify-center">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-11 min-w-14 flex-col items-center gap-0.5 text-[11.5px] font-medium",
                  active ? "font-semibold text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5.5" aria-hidden />
                {item.href === "/notifications" && unread && (
                  <span className="absolute top-0 left-[calc(50%+6px)] size-2.5 rounded-full border-2 border-white bg-destructive" />
                )}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
