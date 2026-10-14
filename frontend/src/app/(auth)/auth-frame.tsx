import Image from "next/image";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Mascot, type MascotPose } from "@/components/shared/mascot";

/**
 * S01 frame shared by /login and /signed-out.
 * Mobile: gradient hero with the mascot + white card overlapping it by ~54px.
 * Desktop: 1120px frame, gradient panel left (55%), card right (45%).
 */
export function AuthFrame({ pose, children }: { pose: MascotPose; children: ReactNode }) {
  return (
    <div className="min-h-svh bg-background lg:grid lg:place-items-center lg:p-8">
      {/* mobile */}
      <div className="mx-auto flex min-h-svh max-w-140 flex-col lg:hidden">
        <div className="relative flex h-80 items-end justify-center overflow-hidden rounded-b-[34px] bg-brand pb-16">
          <Circles />
          <Mascot pose={pose} size={pose === "full" ? 200 : 150} priority className="relative" />
        </div>
        <Card className="relative mx-4 -mt-13.5 gap-0 rounded-[26px] border-0 p-6 shadow-float">{children}</Card>
        <p className="mt-auto py-6 text-center text-[12.5px] text-muted-foreground">CPAC สำนักงานใหญ่</p>
      </div>

      {/* desktop */}
      <div className="hidden w-full max-w-280 grid-cols-[55fr_45fr] gap-6 lg:grid">
        <div className="relative min-h-140 overflow-hidden rounded-2xl bg-brand p-10 text-white">
          <Circles />
          <h1 className="relative font-heading text-[28px] leading-[38px] font-bold">เจออะไรเสีย บอก BAMBAM</h1>
          <p className="relative mt-2 max-w-sm text-[15px] text-white/95">
            แจ้งซ่อม ติดตามงาน และตรวจรับ ได้ทั้งบนมือถือและคอมพิวเตอร์
          </p>
          <Mascot pose={pose} size={280} priority className="absolute right-6 bottom-0" />
        </div>
        <div className="flex flex-col justify-center">
          <Card className="gap-0 rounded-xl border-0 p-10 shadow-card">{children}</Card>
          <p className="mt-4 text-center text-[12.5px] text-muted-foreground">CPAC สำนักงานใหญ่</p>
        </div>
      </div>
    </div>
  );
}

export function BrandLogo() {
  return <Image src="/brand/bam-logo.webp" alt="BAMBAM" width={96} height={31} className="h-auto w-24" priority />;
}

function Circles() {
  return (
    <>
      <span aria-hidden className="pointer-events-none absolute -top-18 -right-28 size-68 rounded-full bg-white/15" />
      <span aria-hidden className="pointer-events-none absolute -bottom-24 -left-20 size-50 rounded-full bg-white/10" />
      <span aria-hidden className="pointer-events-none absolute right-18 -bottom-8 size-22 rounded-full bg-white/10" />
    </>
  );
}
