"use client";

import Link from "next/link";
import { ChevronRight, QrCode, Wrench } from "lucide-react";
import { Mascot } from "@/components/shared/mascot";
import { useCurrentUser } from "@/components/shared/me-provider";
import { PageHeader } from "@/components/shared/page-header";
import { SERVICES, ServiceIcon, SoonChip, type Service } from "@/components/shared/service-icon";
import { Button } from "@/components/ui/button";
import { formatLongDate } from "@/lib/format";
import { EmptyState } from "@/components/shared/states";
import { can, canReport, PERM, repairHome, usesService, type ServiceKey } from "@/lib/platform/permissions";
import { initials } from "@/lib/platform/roles";
import type { Me } from "@/lib/platform/types";
import { cn } from "@/lib/utils";
import { AdminDashboard } from "@/modules/repair/components/dashboard/admin-dashboard";

// Home: whoever has `repair.overview.view` (Admin, Superadmin; settings CR-001) gets the S29 dashboard (repair
// Stage 3D, CR-016); every other role keeps the
// S02 Home — Stage 0 placeholder (D-023): greeting, the option-a CTA card and the services only. Settings CR-006:
// services and the CTA follow permissions (no report → "ไปที่งานซ่อม"; no repair key → greeting only).
// Role widgets and "ติดตามงานซ่อม" come in repair Stage 6 (no bell, repair CR-024). Account and role
// switcher are in the navbar (CR-010).

type ServiceCard = { service: Service & ServiceKey; href?: string; hint: string };

function serviceCards(me: Me): ServiceCard[] {
  const all: ServiceCard[] = [
    canReport(me)
      ? { service: "repair", href: "/repair/new", hint: "แจ้งปัญหาในอาคาร" }
      : { service: "repair", href: repairHome(me), hint: "ดูงานซ่อม" },
    { service: "car", hint: "รถส่วนกลาง" },
    { service: "room", hint: "ห้องประชุมทุกชั้น" },
  ];
  return all.filter((c) => usesService(me, c.service));
}

const GRID_COLS = ["", "grid-cols-1", "grid-cols-2", "grid-cols-3"];

function NoServices({ className }: { className?: string }) {
  return <EmptyState title="ยังไม่มีบริการที่ใช้ได้" hint="ติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์" className={className} />;
}

export default function HomePage() {
  const me = useCurrentUser();
  return can(me, PERM.overviewView) ? <AdminDashboard /> : <EmployeeHome />;
}

function EmployeeHome() {
  const me = useCurrentUser();
  const firstName = me.name.split(/\s+/)[0];
  const today = formatLongDate(new Date());
  const services = serviceCards(me);
  const report = canReport(me);
  const repair = usesService(me, "repair");

  return (
    <>
      {/* mobile */}
      <div className="lg:hidden">
        <header className="relative overflow-hidden rounded-b-[34px] bg-brand px-4 pt-5 pb-36 text-white">
          <span aria-hidden className="pointer-events-none absolute -top-18 -right-28 size-68 rounded-full bg-white/15" />
          <span aria-hidden className="pointer-events-none absolute -bottom-24 -left-20 size-50 rounded-full bg-white/10" />
          <div className="relative flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-white/65 bg-white/20 font-heading text-[15px] font-semibold">
              {initials(me.name)}
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-heading text-xl font-semibold">สวัสดี คุณ{firstName}</h1>
              <p className="truncate text-[13px] text-white/90">
                {me.department ? `${me.department} · ` : ""}
                {today}
              </p>
            </div>
          </div>
        </header>

        <section className="relative mx-4 -mt-13.5 rounded-[26px] bg-card p-4.5 shadow-float">
          <Mascot pose="welcome" size={104} surface="none" className="absolute -top-25 right-3" />
          {report ? (
            <>
              <h2 className="font-heading text-lg font-semibold">เจออะไรเสีย บอก BAMBAM</h2>
              <p className="mt-0.5 mb-3.5 text-[13.5px] text-muted-foreground">ถ่ายรูป เลือกอาการ ส่งถึงช่างในหมวดนั้นทันที</p>
              <div className="flex gap-2.5">
                <Button asChild variant="brand" className="flex-1">
                  <Link href="/repair/new">
                    <Wrench aria-hidden />
                    แจ้งซ่อม
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/repair/scan">
                    <QrCode aria-hidden />
                    สแกน QR
                  </Link>
                </Button>
              </div>
            </>
          ) : repair ? (
            <>
              <h2 className="font-heading text-lg font-semibold">งานซ่อมของคุณ</h2>
              <p className="mt-0.5 mb-3.5 text-[13.5px] text-muted-foreground">ดูงานที่ได้รับมอบหมายและงานที่คุณติดตาม</p>
              <Button asChild variant="brand" className="w-full">
                <Link href={repairHome(me)}>
                  <Wrench aria-hidden />
                  ไปที่งานซ่อม
                </Link>
              </Button>
            </>
          ) : (
            <h2 className="pr-28 font-heading text-lg font-semibold">สวัสดี คุณ{firstName}</h2>
          )}
        </section>

        <section className="px-4 pt-5.5">
          <h2 className="mb-3 font-heading text-lg font-semibold">บริการ</h2>
          {services.length === 0 && <NoServices />}
          <div className={cn("grid gap-2.5", GRID_COLS[services.length])}>
            {services.map(({ service, href }) => {
              const body = (
                <>
                  <ServiceIcon service={service} disabled={!href} />
                  <b className="font-heading text-sm leading-snug font-semibold">{SERVICES[service].label}</b>
                  {!href && <SoonChip />}
                </>
              );
              const cls = "flex flex-col items-center gap-2 rounded-[22px] bg-card px-2 pt-4 pb-3 text-center shadow-card";
              return href ? (
                <Link key={service} href={href} className={cls}>
                  {body}
                </Link>
              ) : (
                <div key={service} className={cls} aria-disabled>
                  {body}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* desktop */}
      <div className="hidden lg:block">
        <PageHeader title="หน้าแรก" variant="none" />
        <section className="relative h-49 overflow-hidden rounded-2xl bg-brand px-9 py-7.5 text-white">
          <span aria-hidden className="pointer-events-none absolute -top-52 right-30 size-95 rounded-full bg-white/15" />
          <span aria-hidden className="pointer-events-none absolute -right-15 -bottom-35 size-60 rounded-full bg-white/10" />
          <h2 className="relative font-heading text-[28px] leading-[38px] font-bold">สวัสดี คุณ{firstName}</h2>
          <p className="relative mt-1 mb-4.5 text-[15px] text-white/95">{today}</p>
          {repair && (
            <div className="relative flex gap-2.5">
              <Button asChild variant="white">
                {report ? (
                  <Link href="/repair/new">
                    <Wrench aria-hidden />
                    แจ้งซ่อม
                  </Link>
                ) : (
                  <Link href={repairHome(me)}>
                    <Wrench aria-hidden />
                    ไปที่งานซ่อม
                  </Link>
                )}
              </Button>
              <Button asChild variant="glass">
                <Link href="/repair/my">ติดตามงานซ่อม</Link>
              </Button>
            </div>
          )}
          <Mascot pose="welcome" size={184} surface="none" className="absolute right-17 bottom-2" />
        </section>

        {services.length === 0 && <NoServices className="my-5" />}
        <div className={cn("grid gap-4.5", services.length > 0 && "my-5", GRID_COLS[services.length])}>
          {services.map(({ service, href, hint }) => {
            const body = (
              <>
                <ServiceIcon service={service} disabled={!href} />
                <span className="min-w-0 flex-1">
                  <b className="block font-heading text-base font-semibold">{SERVICES[service].label}</b>
                  <span className="text-[13px] text-muted-foreground">{hint}</span>
                </span>
                {href ? <ChevronRight className="size-5 text-muted-foreground" aria-hidden /> : <SoonChip />}
              </>
            );
            const cls = "flex items-center gap-3.5 rounded-xl bg-card px-4.5 py-4 shadow-card";
            return href ? (
              <Link key={service} href={href} className={cls}>
                {body}
              </Link>
            ) : (
              <div key={service} className={cls} aria-disabled>
                {body}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
