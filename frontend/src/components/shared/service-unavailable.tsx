"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { usesService } from "@/lib/platform/permissions";
import { useCurrentUser } from "./me-provider";
import { SERVICES, ServiceIcon, SoonChip, type Service } from "./service-icon";
import { ForbiddenState } from "./states";

/**
 * Car / room booking before their modules exist (CR-010): the navbar keeps the three services equal, and this page
 * says plainly that the service is not open yet. No booking form, no sample workflow. Without `car_booking.use` /
 * `room_booking.use` the route is Forbidden (settings CR-006).
 */
export function ServiceUnavailable({ service }: { service: Exclude<Service, "repair"> }) {
  const me = useCurrentUser();
  const { label } = SERVICES[service];
  if (!usesService(me, service)) return <ForbiddenState reason={`บัญชีนี้ไม่มีสิทธิ์ใช้ระบบ${label} กรุณาติดต่อผู้ดูแลระบบ`} />;
  return (
    <section aria-labelledby="service-title" className="mx-4 mt-5 rounded-xl border bg-card px-6 py-10 text-center shadow-card lg:mx-auto lg:mt-8 lg:max-w-140 lg:py-14">
      <ServiceIcon service={service} className="mx-auto" />
      <p className="mt-4 text-[13px] text-muted-foreground">BAMBAM / {label}</p>
      <h1 id="service-title" className="mt-1 flex items-center justify-center gap-2 text-2xl leading-9 font-semibold">
        {label}
        <SoonChip />
      </h1>
      <p className="mx-auto mt-2 max-w-90 text-[15px] text-muted-foreground">บริการนี้กำลังเตรียมเปิดให้ใช้งาน คุณยังใช้บริการอื่นได้จากเมนูด้านบน</p>
      <Button asChild variant="outline" className="mt-6">
        <Link href="/">กลับหน้าแรก</Link>
      </Button>
    </section>
  );
}
