"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Building2, HardHat, House, ListChecks, ListOrdered, LogOut, Wrench, type LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { initials, ROLE_LABELS } from "@/lib/platform/roles";
import type { Me, Role } from "@/lib/platform/types";
import { cn } from "@/lib/utils";
import { LogoutDialog } from "./logout-dialog";
import { SERVICES, SoonChip, type Service } from "./service-icon";

// Desktop sidebar per role — _common.md §1. Module menus are listed here so the
// shell shows every module from docs/PROJECT.md (car and room: "เร็วๆ นี้").

type NavItem = { label: string; href: string; icon: LucideIcon; roles?: Role[] };
type ServiceItem = { service: Service; href?: string };
type Group = { label: string; items: NavItem[]; roles: Role[] };

const MAIN: NavItem[] = [
  { label: "หน้าแรก", href: "/", icon: House },
  { label: "ติดตามงานซ่อม", href: "/repair/my", icon: ListChecks },
  { label: "แจ้งเตือน", href: "/notifications", icon: Bell },
];

const SERVICE_ITEMS: ServiceItem[] = [{ service: "repair", href: "/repair/new" }, { service: "car" }, { service: "room" }];

const GROUPS: Group[] = [
  {
    label: "งานช่าง",
    roles: ["technician"],
    items: [
      { label: "งานซ่อม", href: "/repair/work", icon: Wrench },
      { label: "ช่างภายนอก", href: "/repair/contractors", icon: HardHat },
    ],
  },
  {
    label: "จัดการงานซ่อม",
    roles: ["admin", "executive"],
    items: [
      { label: "งานทั้งหมด", href: "/repair/admin/queue", icon: ListOrdered },
      { label: "ช่างภายนอก", href: "/repair/contractors", icon: HardHat },
      { label: "ภาพรวมอาคาร", href: "/repair/admin/overview", icon: Building2 },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

const itemClass =
  "h-11.5 gap-3 rounded-sm px-3 text-[14.5px] font-medium data-[active=true]:bg-secondary data-[active=true]:font-semibold data-[active=true]:text-secondary-foreground [&>svg]:size-5";

export function AppSidebar({ me }: { me: Me }) {
  const pathname = usePathname();
  return (
    <Sidebar collapsible="none" className="h-svh border-r border-sidebar-border">
      <SidebarHeader className="px-4 pt-5.5 pb-3">
        <Link href="/" className="flex items-center gap-2.5 px-2.5">
          <Image src="/brand/bam-logo.webp" alt="BAMBAM" width={84} height={27} className="h-6.5 w-auto" priority />
          <span className="text-[11.5px] leading-tight text-muted-foreground">Workplace Service</span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarMenu className="gap-1">
            {MAIN.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton asChild isActive={isActive(pathname, item.href)} className={itemClass}>
                  <Link href={item.href}>
                    <item.icon aria-hidden />
                    {item.label}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-xs font-semibold">บริการ</SidebarGroupLabel>
          <SidebarMenu className="gap-1">
            {SERVICE_ITEMS.map(({ service, href }) => {
              const s = SERVICES[service];
              const icon = (
                <span
                  aria-hidden
                  style={{ "--c": s.color } as CSSProperties}
                  className="grid size-7 place-items-center rounded-[10px] bg-(--c)/14 text-(--c)"
                >
                  <s.icon className="size-4" />
                </span>
              );
              return (
                <SidebarMenuItem key={service}>
                  {href ? (
                    <SidebarMenuButton asChild isActive={isActive(pathname, href)} className={itemClass}>
                      <Link href={href}>
                        {icon}
                        {s.label}
                      </Link>
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton aria-disabled className={cn(itemClass, "cursor-default opacity-80 hover:bg-transparent")}>
                      {icon}
                      {s.label}
                      <SoonChip className="ml-auto" />
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>

        {GROUPS.filter((g) => g.roles.includes(me.role)).map((g) => (
          <SidebarGroup key={g.label}>
            <SidebarGroupLabel className="px-3 text-xs font-semibold">{g.label}</SidebarGroupLabel>
            <SidebarMenu className="gap-1">
              {g.items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isActive(pathname, item.href)} className={itemClass}>
                    <Link href={item.href}>
                      <item.icon aria-hidden />
                      {item.label}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="flex items-center gap-2.5 rounded-[18px] bg-muted p-3">
          <Link href="/profile" className="flex min-w-0 flex-1 items-center gap-2.5" aria-label="โปรไฟล์">
            <span className="grid size-9.5 shrink-0 place-items-center rounded-full bg-brand font-heading text-[13px] font-semibold text-white">
              {initials(me.name)}
            </span>
            <span className="min-w-0 leading-snug">
              <b className="block truncate text-sm">{me.name}</b>
              <span className="block truncate text-xs text-muted-foreground">{ROLE_LABELS[me.role]}</span>
            </span>
          </Link>
          <LogoutDialog
            trigger={
              <button
                type="button"
                aria-label="ออกจากระบบ"
                className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-card"
              >
                <LogOut className="size-4.5" aria-hidden />
              </button>
            }
          />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
