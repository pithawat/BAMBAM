"use client";

import { useState } from "react";
import Image from "next/image";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { env } from "@/lib/env";
import { loginUrl, safeNext } from "@/lib/platform/api";
import "./login.css";

// The headline keeps the previous login's IBM Plex Sans Thai 650 + underline swoosh (owner, 2026-11-03; D-095).
const plex = IBM_Plex_Sans_Thai({ subsets: ["thai", "latin"], weight: ["600", "700"], display: "swap" });

// S01 เข้าสู่ระบบ + ออกจากระบบแล้ว (CR-037): a port of output/qr-login-redesign/login.html — logo + help, the
// headline, one RMC SSO button with the account hint, the login mascot on a blue arch, footer. Anuphan like the
// rest of the app (headline: see `plex`). Never starts login by itself (sso.md Flow 1). /signed-out renders the same screen with an
// "ออกจากระบบแล้ว" notice.

const MESSAGES = {
  error: { title: "เข้าสู่ระบบไม่สำเร็จ", body: "กรุณาลองใหม่", destructive: true },
  expired: { title: "เซสชันหมดอายุ", body: "กรุณาเข้าสู่ระบบอีกครั้ง ระบบจะพากลับไปหน้าเดิม", destructive: false },
  maintenance: {
    title: "ปิดปรับปรุงชั่วคราว",
    body: "ระบบเข้าสู่ระบบ RMC SSO ปิดปรับปรุงอยู่ กรุณาลองใหม่ภายหลัง",
    destructive: false,
  },
} as const;
const SIGNED_OUT = { title: "ออกจากระบบแล้ว", body: "ขอบคุณที่ใช้ BAMBAM", destructive: false };

export function LoginScreen({ signedOut = false }: { signedOut?: boolean }) {
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);
  const next = signedOut ? "/" : safeNext(params.get("next"));
  const reason = params.get("reason");
  const message = signedOut ? SIGNED_OUT
    : params.get("error") ? MESSAGES.error
      : reason === "expired" ? MESSAGES.expired
        : reason === "maintenance" ? MESSAGES.maintenance
          : null;
  const maintenance = !signedOut && reason === "maintenance";

  function start() {
    setBusy(true);
    // Mocks: no SSO, go straight in. Real: full navigation to the API, which redirects to RMC SSO.
    window.location.assign(env.useMocks ? next : loginUrl(next));
  }

  return (
    <div className="bl-page">
      <header className="bl-nav">
        <Image src="/brand/bam-logo.webp" alt="BAM" width={480} height={154} priority className="bl-logo" />
        <button type="button" className="bl-help" onClick={() => setHelp(true)}>ความช่วยเหลือ</button>
      </header>

      <main className="bl-hero">
        <section className="bl-copy">
          <h1 className={`bl-title ${plex.className}`}>ทุกเรื่องในที่ทำงาน<br /><span>ให้ BAM ช่วยดูแล</span></h1>
          <p className="bl-description">แจ้งซ่อม จองรถ และจองห้องประชุม</p>

          {message && (
            <div className={`bl-notice${message.destructive ? " bl-noticeError" : ""}`} role={message.destructive ? "alert" : "status"}>
              <strong>{message.title}</strong>{message.body}
            </div>
          )}

          <button type="button" className="bl-cta" onClick={start} disabled={busy || maintenance} aria-describedby="bl-busy">
            <span>เข้าสู่ระบบด้วย RMC SSO</span>
            <svg viewBox="0 0 24 24" aria-hidden><path d="M4 12h16m-6-6 6 6-6 6" /></svg>
          </button>
          <p className="bl-accountNote">ใช้บัญชีบริษัทของคุณเพื่อเข้าใช้งาน</p>
          <p id="bl-busy" className="sr-only" role="status">{busy ? "กำลังไปหน้าเข้าสู่ระบบ RMC SSO" : ""}</p>
        </section>

        <div className="bl-visual" aria-hidden>
          <Image src="/brand/bam-mascot-login-white.webp" alt="" width={631} height={640} priority />
        </div>
      </main>

      <footer className="bl-footer">
        <span>BAM Workplace Services</span>
        <span>สำหรับพนักงาน CPAC สำนักงานใหญ่</span>
      </footer>

      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ต้องการความช่วยเหลือ?</DialogTitle>
            <DialogDescription className="space-y-2 text-left">
              <span className="block">หากเข้าสู่ระบบด้วยบัญชีบริษัทไม่ได้ กรุณาติดต่อผู้ดูแล RMC SSO ของหน่วยงาน</span>
              <span className="block">สำหรับบริการแจ้งซ่อม จองรถ และจองห้องประชุม สามารถติดต่อผู้ดูแลบริการผ่านช่องทางภายในบริษัท</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter><Button type="button" onClick={() => setHelp(false)}>เข้าใจแล้ว</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
