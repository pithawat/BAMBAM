"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, HardHat, ListChecks, ListOrdered, Wrench, type LucideIcon } from "lucide-react";
import { useCurrentUser } from "@/components/shared/me-provider";
import { can, managesRepair, PERM, seesRepairQueue } from "@/lib/platform/permissions";
import type { Me } from "@/lib/platform/types";
import { cn } from "@/lib/utils";

// Repair section nav (_common.md §1, CR-010): the staff tools that used to sit in the sidebar, same destinations;
// items follow the permission rules of D-050 (settings CR-007 A). Shown on the repair list pages only for roles with more than one destination; employees reach
// แจ้งซ่อมใหม่ from S06 itself. Pending pages (Stage 3 / 7) keep their links, as the sidebar did.

type Item = { label: string; href: string; icon: LucideIcon };

const TRACK: Item = { label: "ติดตามงานซ่อม", href: "/repair/my", icon: ListChecks };
const CONTRACTORS: Item = { label: "ช่างภายนอก", href: "/repair/contractors", icon: HardHat };
const WORK: Item = { label: "งานซ่อม", href: "/repair/work", icon: Wrench };
const QUEUE: Item = { label: "งานทั้งหมด", href: "/repair/admin/queue", icon: ListOrdered };
const OVERVIEW: Item = { label: "ภาพรวมอาคาร", href: "/repair/admin/overview", icon: Building2 };

/**
 * D-050: งานซ่อม = `work`; ช่างภายนอก = `contractor.manage` or the manager queue; ภาพรวมอาคาร = manager + `overview.view`.
 * CR-034: ติดตามงานซ่อม = `report`.
 */
function itemsFor(me: Me): Item[] {
  const items = can(me, PERM.ticketReport) ? [TRACK] : [];
  if (can(me, PERM.ticketWork)) items.push(WORK);
  if (seesRepairQueue(me)) items.push(QUEUE);
  if (can(me, PERM.contractorManage) || seesRepairQueue(me)) items.push(CONTRACTORS);
  if (managesRepair(me) && can(me, PERM.overviewView)) items.push(OVERVIEW);
  return items.length > 1 ? items : [];
}

const within = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

export function RepairNav() {
  const pathname = usePathname();
  const me = useCurrentUser();
  const items = itemsFor(me);
  if (!items.some((i) => within(pathname, i.href))) return null;
  return (
    <nav aria-label="เมนูงานซ่อม" className="overflow-x-auto px-4 pt-3 print:hidden lg:px-0 lg:pt-0 lg:pb-4">
      <ul className="flex w-max gap-1 rounded-xl border bg-card p-1 shadow-card">
        {items.map((item) => {
          const active = within(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
                  active ? "bg-secondary font-semibold text-secondary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <item.icon className="size-4" aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
