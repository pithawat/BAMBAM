"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import { ArrowRight, Sparkles, Wrench } from "lucide-react";
import { Mascot } from "@/components/shared/mascot";
import { useCurrentUser } from "@/components/shared/me-provider";
import { SERVICES } from "@/components/shared/service-icon";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { can, canReport, PERM, repairHome, usesService } from "@/lib/platform/permissions";
import { cn } from "@/lib/utils";
import { AdminDashboard } from "@/modules/repair/components/dashboard/admin-dashboard";
import { HomeTicketsStrip } from "@/modules/repair/components/home-tickets";

// Home: whoever has `repair.overview.view` (Admin, Superadmin; settings CR-001) gets the S29 dashboard (repair
// Stage 3D, CR-016); every other role gets the S02 employee Home. CR-040 (layout and type from the owner reference
// `App (1).tsx` + `index (1).css`, IBM Plex Sans Thai): centred greeting and headline (no sub-line), then the service
// cards side by side on desktop: car tilted left, the repair card in the middle on the primary mascot panel with its
// "รายการของฉัน" strip, room tilted right. Phones / tablets (content max 560px): the repair card spans the row, car and room sit tilted under it
// (three columns would break the Thai words at a readable size). Settings CR-006: services and the CTA follow permissions (no report →
// "ไปที่งานซ่อม"; no repair key → no repair card). Car / room booking are not open yet, so their cards only announce
// them. Account and role switcher are in the navbar (CR-010).

/** The reference's face. Applied by overriding the app font variable inside the Home only (headings included). */
const plex = IBM_Plex_Sans_Thai({ subsets: ["thai", "latin"], weight: ["400", "500", "600"], display: "swap" });

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
    <div className="px-3.5 font-sans sm:px-6 lg:px-0" style={{ "--font-anuphan": plex.style.fontFamily } as CSSProperties}>
      <section aria-labelledby="home-title" className="pt-6 pb-5 text-center sm:pt-8 lg:pt-[clamp(8px,2vh,20px)] lg:pb-[clamp(16px,2.8vh,26px)]">
        <p className="mb-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-muted-foreground sm:text-[13px] lg:mb-3.5">
          <Sparkles className="size-4 shrink-0 text-primary" aria-hidden />
          สวัสดี คุณ{firstName}
          <span aria-hidden className="h-3 w-px bg-input" />
          วันนี้ให้เราช่วยอะไรดี?
        </p>
        <h1 id="home-title" className="text-[29px] leading-[1.4] font-semibold tracking-[-0.025em] sm:text-[38px] lg:text-[clamp(36px,5vh,48px)] lg:leading-[1.3]">
          เรื่องในที่ทำงาน
          <span className="mt-0.5 block text-primary">จัดการง่าย ในที่เดียว</span>
        </h1>
      </section>

      {count === 0 ? (
        <EmptyState title="ยังไม่มีบริการที่ใช้ได้" hint="ติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์" className="mx-auto mb-10 max-w-xl" />
      ) : (
        <section
          aria-label="บริการสำหรับคุณ"
          className={cn(
            "mx-auto grid items-start gap-2.5 px-1 pt-2 pb-4 lg:gap-3 lg:px-2 lg:pt-2.5 lg:pb-5",
            count === 3 ? "max-w-[1072px] grid-cols-2 lg:grid-cols-3" : count === 2 ? "max-w-3xl grid-cols-1 lg:grid-cols-2" : "max-w-sm grid-cols-1",
          )}
        >
          {repair && <RepairCard report={report} href={report ? "/repair/new" : repairHome(me)} wide={count === 3} />}
          {soon.map((service) => <SoonCard key={service} service={service} tilt={count > 1} phoneTilt={count === 3} />)}
        </section>
      )}

      <footer className="flex justify-center pt-6 pb-4 text-xs text-muted-foreground lg:pt-5">
        © {new Date().getFullYear()} BAMBAM Workplace
      </footer>
    </div>
  );
}

/** Card body height (reference: `clamp(240px, 34vh, 325px)` on desktop). */
const CARD_BODY = "relative isolate lg:h-[clamp(240px,34vh,325px)] lg:p-6";
const CARD_TITLE = "font-semibold tracking-[-0.02em] lg:mt-3.5 lg:text-[26px] lg:leading-[1.35]";
const CARD_HINT = "mt-1 text-[13px] leading-[1.7] lg:mt-1.5";
const CARD_ACTION = "absolute h-10 gap-1.5 rounded-md px-3.5 text-[13px] lg:bottom-5 lg:left-6";

/** The live service, on the primary mascot panel; it sits above its tilted neighbours. */
function RepairCard({ report, href, wide }: { report: boolean; href: string; wide: boolean }) {
  return (
    <article
      aria-labelledby="repair-title"
      className={cn(
        "relative z-2 min-w-0 overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-[0_8px_18px_color-mix(in_srgb,var(--primary)_12%,transparent)] lg:rounded-[18px]",
        wide && "col-span-2 lg:col-span-1",
      )}
    >
      <div className={cn(CARD_BODY, "h-56 p-5")}>
        <p className="flex items-center gap-1.5 text-xs text-primary-foreground/85">
          <Wrench className="size-4 shrink-0" aria-hidden />
          {SERVICES.repair.label}
        </p>
        {report ? (
          <>
            <h2 id="repair-title" className={cn(CARD_TITLE, "mt-3 text-[23px] leading-[1.4] lg:max-w-[68%]")}>เจออะไรเสีย<br />บอก BAMBAM</h2>
            <p className={cn(CARD_HINT, "text-primary-foreground/85 lg:max-w-[50%]")}>แจ้งปัญหา<br />ให้ทีมอาคารช่วยดูแล</p>
          </>
        ) : (
          <>
            <h2 id="repair-title" className={cn(CARD_TITLE, "mt-3 text-[23px] leading-[1.4] lg:max-w-[68%]")}>งานซ่อมของคุณ</h2>
            <p className={cn(CARD_HINT, "max-w-[55%] text-primary-foreground/85 lg:max-w-[50%]")}>ดูงานที่ได้รับมอบหมายและงานที่คุณติดตาม</p>
          </>
        )}
        <Mascot pose="tracking" size={168} priority className="absolute right-3 bottom-1 -z-1 lg:hidden" />
        <Mascot pose="tracking" size={214} priority className="absolute right-1 bottom-2 -z-1 hidden lg:inline-block" />
        <Button asChild variant="white" className={cn(CARD_ACTION, "bottom-5 left-5")}>
          <Link href={href}>
            {report ? "แจ้งซ่อมใหม่" : "ไปที่งานซ่อม"}
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>
      {report && <HomeTicketsStrip />}
    </article>
  );
}

/** A service that is not open yet: tinted card, line drawing, disabled action. Car tilts left of the repair card, room right. */
function SoonCard({ service, tilt, phoneTilt }: { service: SoonService; tilt: boolean; phoneTilt: boolean }) {
  const { label, color } = SERVICES[service];
  return (
    <article
      aria-labelledby={`${service}-title`}
      style={{ "--c": color, background: "color-mix(in srgb, var(--c) 10%, var(--card))" } as CSSProperties}
      className={cn(
        "relative z-1 min-w-0 overflow-hidden rounded-2xl lg:rounded-[18px]",
        service === "car" && "lg:-order-1",
        phoneTilt && (service === "car" ? "mt-1 -rotate-2" : "mt-1 rotate-2"),
        tilt && (service === "car" ? "lg:mt-0 lg:translate-y-[13px] lg:-rotate-4" : "lg:mt-0 lg:translate-y-[13px] lg:rotate-4"),
      )}
    >
      <div className={cn(CARD_BODY, "h-50 p-4")}>
        <p className="flex items-center gap-2.5 text-xs text-muted-foreground">
          <span className="truncate">{label}</span>
          <span className="hidden shrink-0 items-center gap-1.5 lg:inline-flex"><span aria-hidden className="size-1.25 rounded-full bg-current" />เร็วๆ นี้</span>
        </p>
        <h2 id={`${service}-title`} className={cn(CARD_TITLE, "mt-2 text-[17px] leading-[1.45]")}>{SOON[service].title}</h2>
        <p className={cn(CARD_HINT, "mt-0.5 text-xs text-muted-foreground lg:mt-1 lg:text-[13px]")}>{SOON[service].hint}</p>
        <ServiceArt service={service} />
        <Button disabled aria-label={`${label} ยังไม่เปิดให้บริการ`} className={cn(CARD_ACTION, "inset-x-3 bottom-3 h-9 px-1 text-xs lg:inset-x-auto lg:h-10 lg:px-3.5 lg:text-[13px]", "bg-card/80 text-muted-foreground disabled:opacity-100")}>
          <span className="lg:hidden">เร็วๆ นี้</span>
          <span className="hidden lg:inline">ยังไม่เปิดให้บริการ</span>
        </Button>
      </div>
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
      className="absolute right-1 bottom-11 -z-1 h-auto w-[44%] max-w-36 lg:right-2 lg:bottom-17 lg:w-[52%] lg:max-w-none"
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
