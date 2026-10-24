"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import { useSearchParams } from "next/navigation";
import { AlertCircle, Info, LogOut } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { env } from "@/lib/env";
import { loginUrl, safeNext } from "@/lib/platform/api";
import "./login.css";

// The prototype's own font, for this screen only (D-095); the rest of the app stays on Anuphan.
const plex = IBM_Plex_Sans_Thai({ subsets: ["thai", "latin"], weight: ["400", "500", "600", "700"], display: "swap" });

// S01 เข้าสู่ระบบ + ออกจากระบบแล้ว (CR-019): a 1:1 port of bam-workplace-login-v7.html — brand bar + help, the centred
// hero (audience chip, headline, RMC SSO button, three services), tilted service cards and the login mascot around
// it (above 1050px; the mascot moves above the chip below that). Never starts login by itself (sso.md Flow 1).
// /signed-out renders the same screen with an "ออกจากระบบแล้ว" notice.

const MESSAGES = {
  error: { title: "เข้าสู่ระบบไม่สำเร็จ", body: "กรุณาลองใหม่", destructive: true },
  expired: { title: "เซสชันหมดอายุ", body: "กรุณาเข้าสู่ระบบอีกครั้ง ระบบจะพากลับไปหน้าเดิม", destructive: false },
  maintenance: {
    title: "ปิดปรับปรุงชั่วคราว",
    body: "ระบบเข้าสู่ระบบ RMC SSO ปิดปรับปรุงอยู่ กรุณาลองใหม่ภายหลัง",
    destructive: false,
  },
} as const;

/** The prototype's stroke icons (24×24 paths), so the cards and buttons match it exactly. */
const ICONS = {
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  tool: <path d="M14.5 6.5a5 5 0 0 0-6.7 6.7L3 18a2.1 2.1 0 0 0 3 3l4.8-4.8a5 5 0 0 0 6.7-6.7L14 13l-3-3z" />,
  shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z" /><path d="m8 12 3 3 5-6" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.4 9a2.7 2.7 0 0 1 5.2 1c0 2-2.6 2-2.6 4m0 3h.01" /></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3" /></>,
  car: <path d="m5 8 2-5h10l2 5M4 8h16l1 4v7H3v-7zM3 15h18M6 19v2m12-2v2M6 11h2m8 0h2" />,
  meeting: <><rect x="6" y="8" width="12" height="8" rx="2" /><path d="M9 4h6M9 20h6M2 9v6m20-6v6M9 4v4m6-4v4m-6 8v4m6-4v4M2 12h4m12 0h4" /></>,
  spinner: <path d="M21 12a9 9 0 1 1-6.2-8.6" />,
};
function Icon({ name, className }: { name: keyof typeof ICONS; className?: string }) {
  return <svg viewBox="0 0 24 24" aria-hidden className={className}>{ICONS[name]}</svg>;
}

export function LoginScreen({ signedOut = false }: { signedOut?: boolean }) {
  const stageRef = useRef<HTMLElement>(null);
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);
  const next = signedOut ? "/" : safeNext(params.get("next"));
  const reason = params.get("reason");
  const message = signedOut ? null
    : params.get("error") ? MESSAGES.error
      : reason === "expired" ? MESSAGES.expired
        : reason === "maintenance" ? MESSAGES.maintenance
          : null;
  const maintenance = !signedOut && reason === "maintenance";

  // Fit the actual content, including notices and wrapped copy, to the available
  // height. Keep the stage width intact so the surrounding cards stay at its edges.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const main = stage.querySelector<HTMLElement>(".bl-main")!;
    const scene = stage.querySelector<HTMLElement>(".bl-scene")!;
    function fit() {
      const stacked = window.matchMedia("(max-width: 1050px)").matches;
      const style = getComputedStyle(stage!);
      const sceneStyle = getComputedStyle(scene);
      const available = stage!.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      const natural = main.offsetHeight + (stacked ? scene.offsetHeight + parseFloat(sceneStyle.marginBottom) : 0);
      stage!.style.setProperty("--bl-fit", String(Math.min(1, Math.max(0, available / natural))));
      const decorationHeight = window.matchMedia("(min-width: 1281px)").matches ? 720 : 650;
      stage!.style.setProperty("--bl-decoration-fit", String(Math.min(1, stage!.clientHeight / decorationHeight)));
    }
    const observer = new ResizeObserver(fit);
    observer.observe(stage);
    observer.observe(main);
    observer.observe(scene);
    fit();
    void document.fonts.ready.then(fit);
    return () => observer.disconnect();
  }, []);

  function start() {
    setBusy(true);
    // Mocks: no SSO, go straight in. Real: full navigation to the API, which redirects to RMC SSO.
    window.location.assign(env.useMocks ? next : loginUrl(next));
  }

  return (
    <div className={`bl-page ${plex.className}`}>
      <header className="bl-nav">
        <span className="bl-brand">
          <Image src="/brand/bam-logo.webp" alt="BAM" width={480} height={154} priority className="bl-brandLogo" />
          <span className="bl-brandCaption">WORKPLACE<br />SERVICES</span>
        </span>
        <button type="button" className="bl-help" onClick={() => setHelp(true)}><Icon name="help" /><span>ความช่วยเหลือ</span></button>
      </header>

      <main className="bl-stage" ref={stageRef}>
        <article aria-hidden className="bl-card bl-repair">
          <div className="bl-repairArt"><Icon name="tool" /><span className="bl-spark">+</span><span className="bl-dot" /></div>
          <div className="bl-cardCopy"><span className="bl-cardEyebrow">แจ้งซ่อม</span><h3>เจอปัญหา บอกเราได้เลย</h3>
            <div className="bl-tags"><span>แอร์</span><span>ไฟฟ้า</span><span>ประปา</span></div></div>
        </article>
        <article aria-hidden className="bl-card bl-car">
          <div className="bl-carArt"><Icon name="car" /><span /></div>
          <span className="bl-cardEyebrow">จองรถ</span><h3>พร้อมไปทุกงานของคุณ</h3>
          <div className="bl-tags"><span>เลือกวันเดินทาง</span><span>ระบุจุดหมาย</span></div>
        </article>
        <article aria-hidden className="bl-card bl-room">
          <div className="bl-roomArt"><Icon name="meeting" /><div className="bl-slots"><i /><i /><i /></div></div>
          <div className="bl-cardCopy"><span className="bl-cardEyebrow">จองห้องประชุม</span><h3>ห้องพร้อม ทีมก็พร้อม</h3><p>เลือกห้องและเวลาที่เหมาะกับงาน</p></div>
        </article>

        <section className="bl-main">
          <div className="bl-eyebrow"><span />สำหรับพนักงาน CPAC สำนักงานใหญ่</div>
          <h1 className="bl-title">ทุกเรื่องในที่ทำงาน<br /><span>ให้ BAM ช่วยดูแล</span></h1>
          <p className="bl-description">แจ้งซ่อม จองรถ และจองห้องประชุม<br />จัดการบริการในที่ทำงานได้จากที่เดียว</p>

          {signedOut && <Alert className="bl-notice" role="status">
            <LogOut aria-hidden /><AlertTitle className="font-semibold">ออกจากระบบแล้ว</AlertTitle><AlertDescription>ขอบคุณที่ใช้ BAMBAM</AlertDescription>
          </Alert>}
          {message && <Alert variant={message.destructive ? "destructive" : "default"} className="bl-notice">
            {message.destructive ? <AlertCircle aria-hidden /> : <Info aria-hidden />}
            <AlertTitle className="font-semibold">{message.title}</AlertTitle><AlertDescription>{message.body}</AlertDescription>
          </Alert>}

          <button type="button" className="bl-cta" onClick={start} disabled={busy || maintenance}>
            <Icon name={busy ? "spinner" : "lock"} className={busy ? "bl-spin" : undefined} />
            <span>เข้าสู่ระบบด้วย RMC SSO</span>
            <Icon name="arrow" className="bl-ctaArrow" />
          </button>
          <p className="bl-accountNote"><Icon name="shield" />ใช้บัญชีบริษัทของคุณเพื่อเข้าใช้งาน</p>

          <div className="bl-services">
            <h2 className="bl-servicesTitle">เข้าสู่ระบบเพื่อใช้บริการ</h2>
            <ul className="bl-serviceList" aria-label="บริการใน BAM">
              <li><span className="bl-symbol bl-maintenance"><Icon name="tool" /></span><span>แจ้งซ่อม</span></li>
              <li><span className="bl-symbol bl-vehicle"><Icon name="car" /></span><span>จองรถ</span></li>
              <li><span className="bl-symbol bl-meeting"><Icon name="meeting" /></span><span>จองห้องประชุม</span></li>
            </ul>
          </div>
        </section>

        <div aria-hidden className="bl-scene">
          <div className="bl-speech">พร้อมช่วยดูแลครับ <span>✦</span></div>
          <div className="bl-halo" />
          <Image src="/brand/bam-mascot-login.webp" alt="" width={631} height={640} priority className="bl-mascot" />
          <span className="bl-mascotLabel">YOUR WORKPLACE BUDDY</span>
        </div>

        <article aria-hidden className="bl-card bl-account">
          <span className="bl-check"><Icon name="shield" /></span>
          <div><span className="bl-cardEyebrow">BAM WORKPLACE SERVICES</span><h3>บัญชีเดียว ครบทุกบริการ</h3><p>ดูแลทุกเรื่องในวันทำงานของคุณ</p></div>
        </article>
      </main>

      <footer className="bl-footer">
        <span>ดูแลทุกพื้นที่ ให้ทุกวันทำงานราบรื่น</span>
        <span>BAM Workplace Services <i>·</i> CPAC สำนักงานใหญ่</span>
        <button type="button" className="bl-footerHelp" onClick={() => setHelp(true)}>ต้องการความช่วยเหลือ?<Icon name="arrow" /></button>
      </footer>

      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className={`sm:max-w-md ${plex.className}`}>
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
