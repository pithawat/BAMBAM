"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, Info, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { env } from "@/lib/env";
import { loginUrl, safeNext } from "@/lib/platform/api";
import { BrandLogo } from "../auth-frame";

// S01 copy (exact).
const MESSAGES = {
  error: { title: "เข้าสู่ระบบไม่สำเร็จ", body: "กรุณาลองใหม่", destructive: true },
  expired: { title: "เซสชันหมดอายุ", body: "กรุณาเข้าสู่ระบบอีกครั้ง ระบบจะพากลับไปหน้าเดิม", destructive: false },
  maintenance: {
    title: "ปิดปรับปรุงชั่วคราว",
    body: "ระบบเข้าสู่ระบบ RMC SSO ปิดปรับปรุงอยู่ กรุณาลองใหม่ภายหลัง",
    destructive: false,
  },
} as const;

export function LoginCard() {
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const next = safeNext(params.get("next"));
  const reason = params.get("reason");
  const message = params.get("error")
    ? MESSAGES.error
    : reason === "expired"
      ? MESSAGES.expired
      : reason === "maintenance"
        ? MESSAGES.maintenance
        : null;
  const maintenance = reason === "maintenance";

  function start() {
    setBusy(true);
    // Mocks: no SSO, go straight in. Real: full navigation to the API, which redirects to RMC SSO.
    window.location.assign(env.useMocks ? next : loginUrl(next));
  }

  return (
    <div className="flex flex-col items-center text-center">
      <BrandLogo />
      <h2 className="mt-5 font-heading text-[28px] leading-[38px] font-bold">ยินดีต้อนรับสู่ BAMBAM</h2>
      <p className="mt-1 text-muted-foreground">ศูนย์รวมบริการที่ทำงาน สำหรับพนักงาน CPAC สำนักงานใหญ่</p>

      {message && (
        <Alert variant={message.destructive ? "destructive" : "default"} className="mt-5 text-left">
          {message.destructive ? <AlertCircle aria-hidden /> : <Info aria-hidden />}
          <AlertTitle className="font-semibold">{message.title}</AlertTitle>
          <AlertDescription>{message.body}</AlertDescription>
        </Alert>
      )}

      <Button className="mt-6 w-full" onClick={start} disabled={busy || maintenance}>
        {busy && <Loader2 className="animate-spin" aria-hidden />}
        เข้าสู่ระบบ
      </Button>
      <p className="mt-3 text-[12.5px] text-muted-foreground">ใช้บัญชี RMC SSO เดียวกับระบบอื่นของบริษัท</p>
    </div>
  );
}
