"use client";

import Link from "next/link";
import { ChevronRight, QrCode, Wrench } from "lucide-react";
import { BellButton } from "@/components/shared/bell-button";
import { Mascot } from "@/components/shared/mascot";
import { useCurrentUser } from "@/components/shared/me-provider";
import { PageHeader } from "@/components/shared/page-header";
import { RoleSwitcher } from "@/components/shared/role-switcher";
import { SERVICES, ServiceIcon, SoonChip, type Service } from "@/components/shared/service-icon";
import { Button } from "@/components/ui/button";
import { formatLongDate } from "@/lib/format";
import { initials } from "@/lib/platform/roles";

// S02 Home — Stage 0 placeholder (D-023): greeting, the option-a CTA card and
// the services only. Role widgets, "ติดตามงานซ่อม" and the bell count come in repair Stage 7.

const SERVICE_LIST: { service: Service; href?: string; hint: string }[] = [
  { service: "repair", href: "/repair/new", hint: "แจ้งปัญหาในอาคาร" },
  { service: "car", hint: "รถส่วนกลาง" },
  { service: "room", hint: "ห้องประชุมทุกชั้น" },
];

export default function HomePage() {
  const me = useCurrentUser();
  const firstName = me.name.split(/\s+/)[0];
  const today = formatLongDate(new Date());

  return (
    <>
      {/* mobile */}
      <div className="lg:hidden">
        <header className="relative overflow-hidden rounded-b-[34px] bg-brand px-4 pt-3 pb-36 text-white">
          <span aria-hidden className="pointer-events-none absolute -top-18 -right-28 size-68 rounded-full bg-white/15" />
          <span aria-hidden className="pointer-events-none absolute -bottom-24 -left-20 size-50 rounded-full bg-white/10" />
          <div className="relative">
            <RoleSwitcher variant="pill" />
          </div>
          <div className="relative mt-3 flex items-center gap-3">
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
            <BellButton onGradient />
          </div>
        </header>

        <section className="relative mx-4 -mt-13.5 rounded-[26px] bg-card p-4.5 shadow-float">
          <Mascot pose="bust" size={96} className="absolute -top-23 right-3" />
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
        </section>

        <section className="px-4 pt-5.5">
          <h2 className="mb-3 font-heading text-lg font-semibold">บริการ</h2>
          <div className="grid grid-cols-3 gap-2.5">
            {SERVICE_LIST.map(({ service, href }) => {
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
          <div className="relative flex gap-2.5">
            <Button asChild variant="white">
              <Link href="/repair/new">
                <Wrench aria-hidden />
                แจ้งซ่อม
              </Link>
            </Button>
            <Button asChild variant="glass">
              <Link href="/repair/my">ติดตามงานซ่อม</Link>
            </Button>
          </div>
          <Mascot pose="full" size={208} className="absolute right-17 -bottom-1.5" />
        </section>

        <div className="my-5 grid grid-cols-3 gap-4.5">
          {SERVICE_LIST.map(({ service, href, hint }) => {
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
