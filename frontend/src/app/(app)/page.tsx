"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRight, Clock, Sparkles, Wrench } from "lucide-react";
import { Mascot } from "@/components/shared/mascot";
import { useCurrentUser } from "@/components/shared/me-provider";
import { SERVICES } from "@/components/shared/service-icon";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { can, canReport, PERM, repairHome, usesService } from "@/lib/platform/permissions";
import { cn } from "@/lib/utils";
import { AdminDashboard } from "@/modules/repair/components/dashboard/admin-dashboard";
import { HomeTickets } from "@/modules/repair/components/home-tickets";

// Home: whoever has `repair.overview.view` (Admin, Superadmin; settings CR-001) gets the S29 dashboard (repair
// Stage 3D, CR-016); every other role gets the S02 employee Home. CR-035 (layout from
// output/home-user-redesign/index.html): centred greeting, overlapping service cards with the repair card in the
// middle on the primary mascot panel, then รายการของฉัน (#35) for those who can report. Settings CR-006: services
// and the CTA follow permissions (no report → "ไปที่งานซ่อม"; no repair key → no repair card). Car / room booking
// are not open yet, so their cards only announce them. Account and role switcher are in the navbar (CR-010).

type SoonService = "car" | "room";

const SOON: Record<SoonService, { title: string; hint: string }> = {
  car: { title: "ทุกการเดินทาง", hint: "บริการจองรถส่วนกลาง" },
  room: { title: "พื้นที่สำหรับไอเดีย", hint: "บริการจองห้องประชุม" },
};

export default function HomePage() {
  const me = useCurrentUser();
  return can(me, PERM.overviewView) ? <AdminDashboard /> : <EmployeeHome />;
}

function EmployeeHome() {
  const me = useCurrentUser();
  const firstName = me.name.split(/\s+/)[0];
  const repair = usesService(me, "repair");
  const report = canReport(me);
  const soon = (["car", "room"] as const).filter((service) => usesService(me, service));
  const count = soon.length + (repair ? 1 : 0);

  return (
    <div className="px-4 lg:px-0">
      <section aria-labelledby="home-title" className="pt-6 pb-5 text-center lg:pt-8 lg:pb-6">
        <p className="mb-4 flex items-center justify-center gap-2 text-[13px] text-muted-foreground">
          <Sparkles className="size-4 shrink-0 text-primary" aria-hidden />
          สวัสดี คุณ{firstName} · วันนี้ให้เราช่วยอะไรดี?
        </p>
        <h1 id="home-title" className="text-[32px] leading-[1.4] font-semibold tracking-[-0.04em] text-balance sm:text-[40px] lg:text-[46px] lg:leading-[1.35]">
          เรื่องในที่ทำงาน<br />
          <span className="text-primary">จัดการง่าย ในที่เดียว</span>
        </h1>
        <p className="mt-3.5 text-[13px] leading-7 text-muted-foreground sm:text-sm">
          แจ้งซ่อม จองรถ และจองห้องประชุม<br />
          พื้นที่บริการที่พร้อมช่วยดูแลวันทำงานของคุณ
        </p>
      </section>

      {count === 0 ? (
        <EmptyState title="ยังไม่มีบริการที่ใช้ได้" hint="ติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์" className="mx-auto mb-10 max-w-xl" />
      ) : (
        <section
          aria-label="บริการสำหรับคุณ"
          className={cn(
            "mx-auto grid gap-3 pb-5 sm:grid-cols-2 sm:gap-4 lg:items-start lg:gap-0 lg:pb-12",
            count === 3 ? "max-w-[1030px] lg:grid-cols-3 lg:px-5.5" : count === 2 ? "max-w-3xl lg:px-5.5" : "max-w-md sm:grid-cols-1",
          )}
        >
          {repair && <RepairCard report={report} href={report ? "/repair/new" : repairHome(me)} count={count} />}
          {soon.map((service) => <SoonCard key={service} service={service} />)}
        </section>
      )}

      {soon.length > 0 && (
        <p className="mb-8 flex items-start gap-2 text-xs leading-5 text-muted-foreground sm:justify-center lg:mb-10">
          <Clock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {soon.map((service) => SERVICES[service].label).join("และ")}กำลังเตรียมเปิดให้บริการ
        </p>
      )}

      {report && <HomeTickets />}
    </div>
  );
}

const CARD_TITLE = "mt-2.5 text-[25px] leading-[1.35] font-semibold tracking-[-0.035em] sm:text-[27px] lg:mt-3.5";

/** The live service, on the primary mascot panel (CR-035). Raised over its neighbours on desktop. */
function RepairCard({ report, href, count }: { report: boolean; href: string; count: number }) {
  return (
    <article
      aria-labelledby="repair-title"
      className={cn(
        "relative isolate flex h-63 flex-col overflow-hidden rounded-2xl bg-primary p-5 text-primary-foreground",
        "sm:h-70 sm:px-7.5 sm:py-6.5",
        "lg:z-3 lg:h-[345px] lg:p-6 lg:shadow-[0_16px_30px_-22px_color-mix(in_srgb,var(--primary)_65%,transparent)]",
        count === 3 && "sm:col-span-2 lg:col-span-1",
        count > 1 && "lg:-mx-4",
      )}
    >
      <p className="flex items-center gap-2 text-xs text-primary-foreground/85">
        <Wrench className="size-4" aria-hidden />
        {SERVICES.repair.label}
      </p>
      {report ? (
        <>
          <h2 id="repair-title" className={CARD_TITLE}>เจออะไรเสีย<br />บอก BAMBAM</h2>
          <p className="mt-1 max-w-40 text-[13px] leading-6 text-primary-foreground/88">แจ้งปัญหา<br />ให้ทีมอาคารช่วยดูแล</p>
        </>
      ) : (
        <>
          <h2 id="repair-title" className={CARD_TITLE}>งานซ่อมของคุณ</h2>
          <p className="mt-1 max-w-44 text-[13px] leading-6 text-primary-foreground/88">ดูงานที่ได้รับมอบหมายและงานที่คุณติดตาม</p>
        </>
      )}
      <Mascot pose="tracking" size={172} priority className="absolute right-3 bottom-2.5 -z-1 sm:hidden" />
      <Mascot pose="tracking" size={225} priority className="absolute right-11 bottom-5 -z-1 hidden sm:inline-block lg:hidden" />
      <Mascot pose="tracking" size={210} priority className="absolute right-1.5 bottom-2.5 -z-1 hidden lg:inline-block" />
      <Button asChild variant="white" className="mt-auto h-11 self-start px-4 text-[13px]">
        <Link href={href}>
          {report ? "แจ้งซ่อมใหม่" : "ไปที่งานซ่อม"}
          <ArrowRight aria-hidden />
        </Link>
      </Button>
    </article>
  );
}

/** A service that is not open yet: tinted card, line drawing, disabled action. Tilted under the repair card on desktop. */
function SoonCard({ service }: { service: SoonService }) {
  const { label, color } = SERVICES[service];
  return (
    <article
      aria-labelledby={`${service}-title`}
      style={{ "--c": color, background: "color-mix(in srgb, var(--c) 10%, var(--card))" } as CSSProperties}
      className={cn(
        "relative flex h-46 flex-col overflow-hidden rounded-2xl p-5 sm:h-57.5 sm:px-6 sm:py-5.5",
        "lg:z-1 lg:h-[315px] lg:translate-y-6 lg:p-6",
        service === "car" ? "lg:-order-1 lg:origin-[80%_85%] lg:-rotate-5" : "lg:origin-[20%_85%] lg:rotate-5",
      )}
    >
      <p className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-1.25 rounded-full bg-current" />เร็วๆ นี้</span>
      </p>
      <h2 id={`${service}-title`} className={cn(CARD_TITLE, "mt-2")}>{SOON[service].title}</h2>
      <p className="mt-0.5 max-w-46 text-[13px] text-muted-foreground">{SOON[service].hint}</p>
      <ServiceArt service={service} />
      <Button disabled aria-label={`${label} ยังไม่เปิดให้บริการ`} className="relative mt-auto h-11 self-start bg-card/75 px-4 text-[13px] text-muted-foreground disabled:opacity-100">
        ยังไม่เปิดให้บริการ
      </Button>
    </article>
  );
}

/** Line drawing in the service colour (from the Home proposal). */
function ServiceArt({ service }: { service: SoonService }) {
  const paper = { fill: "var(--card)" };
  const tint = { fill: "currentColor", stroke: "none", opacity: 0.13 };
  return (
    <svg
      viewBox="0 0 185 145"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: "var(--c)" }}
      className="absolute right-3 bottom-10 h-25 w-29 sm:right-5 sm:bottom-14 sm:h-22.5 sm:w-26 lg:right-6 lg:bottom-16 lg:h-35 lg:w-44.5"
    >
      {service === "car" ? (
        <>
          <path style={tint} d="M20 98h143v20H20z" />
          <path style={paper} d="m35 60 17-30h69l24 30 15 10v34H22V75Z" />
          <path style={tint} d="m45 57 12-20h58l17 20Z" />
          <path d="M88 37v20M30 65h115M22 87h138m-126-14h21m72 0h21M73 96h36" />
          <rect style={paper} x="32" y="99" width="19" height="19" rx="6" />
          <rect style={paper} x="129" y="99" width="19" height="19" rx="6" />
          <path opacity={0.45} d="M13 128h159M10 48h19m-16 9h10m123-27 8-6m3 17h11" />
        </>
      ) : (
        <>
          <path style={paper} d="M24 121V22h134v99Z" />
          <path style={tint} d="M35 33h68v46H35z" />
          <path d="M69 33v46M35 57h68M116 33h29v46h-29Z" />
          <path style={paper} d="M49 87h82a5 5 0 0 1 0 10H49a5 5 0 0 1 0-10Z" />
          <path d="M59 97v24m63-24v24M37 108h18m-18-10v23m94-13h15m0-10v23M16 122h151" />
          <path opacity={0.45} d="M43 14h36M163 43h9m-4-5v10" />
        </>
      )}
    </svg>
  );
}
