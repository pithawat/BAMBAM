"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, ArrowLeft, ChevronRight, Keyboard, Loader2, QrCode, Search } from "lucide-react";
import { MascotPanel } from "@/components/shared/mascot";
import { useCurrentUser } from "@/components/shared/me-provider";
import { ForbiddenState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { canReport, repairHome } from "@/lib/platform/permissions";
import { cn } from "@/lib/utils";
import { lookupAsset } from "../api";
import { errorCode, GENERIC_ERROR } from "../errors";
import { assetCodeFromQr, assetFormPath, createQrDecoder, useCanScanInApp } from "../qr";

// S16 สแกน QR แจ้งซ่อม (docs/modules/repair/ui/screens/S16-scan-qr.md, F13-B, CR-036). Phones (coarse pointer +
// camera API): full-screen camera that reads only this origin's `/q/{code}` labels and opens S03 prefilled — no
// lookup here, S03 handles "not found". Every other device: the manual-code card. Manual codes are looked up (#25).

const NOT_BAMBAM = "QR นี้ไม่ใช่ของ BAMBAM";
const SCAN_EVERY_MS = 200;
/** The same foreign QR held in front of the camera toasts once per this window. */
const REPEAT_TOAST_MS = 3000;
const MAX_CODE = 30;
const REPORT_FORBIDDEN = "บัญชีนี้ไม่มีสิทธิ์แจ้งซ่อม กรุณาติดต่อผู้ดูแลระบบ";

const noSubscribe = () => () => {};
/** The camera needs a secure context (HTTPS; localhost on dev) and the media API. */
const cameraAvailable = () => window.isSecureContext && typeof navigator.mediaDevices?.getUserMedia === "function";

export function ScanQrScreen() {
  const me = useCurrentUser();
  // The phone check reads the browser: render nothing on the server pass so a phone never flashes the desktop card.
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  const inApp = useCanScanInApp();
  if (!canReport(me)) return <ForbiddenState reason={REPORT_FORBIDDEN} action={{ label: "ไปที่งานซ่อม", href: repairHome(me) }} />;
  if (!hydrated) return null;
  return inApp ? <CameraScan /> : <DesktopScan />;
}

function CameraScan() {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<"starting" | "live" | "blocked">(() => (cameraAvailable() ? "starting" : "blocked"));
  const [attempt, setAttempt] = useState(0);
  const [manual, setManual] = useState(false);
  // The decode loop pauses while the manual sheet is open.
  const paused = useRef(false);
  useEffect(() => { paused.current = manual; }, [manual]);

  useEffect(() => {
    const el = video.current;
    if (!el || !cameraAvailable()) return;
    let active = true;
    let stream: MediaStream | null = null;
    let timer = 0;
    let toasted = { text: "", at: 0 };
    const stop = () => {
      window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
      el.srcObject = null;
    };
    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      } catch {
        // NotAllowedError (denied), NotFoundError (no camera), NotReadableError (in use) … → the blocked card
        if (active) setPhase("blocked");
        return;
      }
      if (!active) { stop(); return; }
      el.srcObject = stream;
      await el.play().catch(() => undefined); // muted + playsInline plays inline on iOS; frames decode either way
      const decode = await createQrDecoder();
      if (!active) return;
      setPhase("live");
      const tick = async () => {
        if (!active) return;
        const text = paused.current ? null : await decode(el).catch(() => null);
        if (!active) return;
        if (text) {
          const code = assetCodeFromQr(text);
          if (code) {
            active = false; stop();
            navigator.vibrate?.(50);
            router.push(assetFormPath(code));
            return;
          }
          const now = Date.now();
          if (text !== toasted.text || now - toasted.at > REPEAT_TOAST_MS) { toast.error(NOT_BAMBAM); toasted = { text, at: now }; }
        }
        timer = window.setTimeout(tick, SCAN_EVERY_MS);
      };
      void tick();
    })();
    // Leaving the page (back, navigation, the route being hidden) always turns the camera off.
    return () => { active = false; stop(); };
  }, [attempt, router]);

  function retry() {
    setPhase(cameraAvailable() ? "starting" : "blocked");
    setAttempt((n) => n + 1);
  }
  function back() {
    if (window.history.length > 1) router.back();
    else router.push("/repair/my");
  }

  return <>
    {phase === "blocked" ? <Blocked onRetry={retry} onManual={() => setManual(true)} /> : (
      <div data-testid="qr-camera" className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-black text-white">
        <video ref={video} muted playsInline autoPlay aria-hidden className="absolute inset-0 size-full object-cover" />
        <div className="relative z-10 flex items-center gap-1 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
          <Button type="button" variant="ghost" size="icon" aria-label="ย้อนกลับ" onClick={back}
            className="text-white hover:bg-white/15 hover:text-white focus-visible:ring-white/60"><ArrowLeft /></Button>
          <h1 className="text-lg leading-7 font-semibold">สแกน QR แจ้งซ่อม</h1>
        </div>

        <div className="relative flex flex-1 flex-col items-center justify-center px-6">
          {/* The window's spread shadow is the dark scrim around it: only the frame shows the camera clear. */}
          <div className="relative size-60 rounded-2xl shadow-[0_0_0_100vmax_color-mix(in_oklch,var(--foreground)_60%,transparent)]">
            <span aria-hidden className="absolute -top-1 -left-1 size-9 rounded-tl-2xl border-t-4 border-l-4 border-white" />
            <span aria-hidden className="absolute -top-1 -right-1 size-9 rounded-tr-2xl border-t-4 border-r-4 border-white" />
            <span aria-hidden className="absolute -bottom-1 -left-1 size-9 rounded-bl-2xl border-b-4 border-l-4 border-white" />
            <span aria-hidden className="absolute -right-1 -bottom-1 size-9 rounded-br-2xl border-r-4 border-b-4 border-white" />
            {phase === "starting"
              ? <Loader2 aria-label="กำลังเปิดกล้อง" className="absolute inset-0 m-auto size-7 animate-spin text-white/90" />
              : <span aria-hidden data-testid="qr-scan-line" className="qr-scan-line absolute inset-x-4 top-4 h-0.5 rounded-full bg-white/90 motion-reduce:hidden" />}
          </div>
          {/* positioned so the copy paints above the window's scrim */}
          <p className="relative mt-9 text-center text-lg leading-7 font-semibold text-balance">ส่องกล้องไปที่ QR บนอุปกรณ์</p>
          <p className="relative mt-1 text-center text-sm leading-6 text-white/85">ระบบจะเติมข้อมูลอุปกรณ์ให้อัตโนมัติ</p>
        </div>

        <div className="relative z-10 mx-auto grid w-full max-w-md gap-1.5 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button type="button" variant="glass" className="h-12 w-full text-base" onClick={() => setManual(true)}><Keyboard aria-hidden />กรอกรหัสอุปกรณ์เอง</Button>
          <Button asChild variant="link" className="h-11 text-white"><Link href="/repair/new">แจ้งซ่อมโดยไม่สแกน</Link></Button>
        </div>
        <style href="repair-qr-scan-line" precedence="default">{`
          @keyframes repair-qr-scan { from { transform: translateY(0) } to { transform: translateY(13rem) } }
          .qr-scan-line { animation: repair-qr-scan 1.8s cubic-bezier(.45,0,.55,1) infinite alternate }
        `}</style>
      </div>
    )}
    <Sheet open={manual} onOpenChange={setManual}>
      <SheetContent side="bottom" aria-describedby={undefined} className="gap-0 rounded-t-[26px] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <SheetHeader className="px-0 pt-1 pb-3"><SheetTitle className="text-lg leading-7 font-semibold">กรอกรหัสอุปกรณ์</SheetTitle></SheetHeader>
        <ManualCode id="sheet-code" stacked autoFocus />
      </SheetContent>
    </Sheet>
  </>;
}

/** Camera denied / missing / insecure context: the page background with a mascot card (S16 "Camera blocked"). */
function Blocked({ onRetry, onManual }: { onRetry: () => void; onManual: () => void }) {
  return <div className="px-4 pt-3 pb-8 lg:px-0 lg:pt-0">
    <PageHead />
    <MascotPanel as="div" pose="review" size={[92, 128]} role="alert" className="mx-auto mt-4 max-w-2xl">
      <h2 className="font-heading text-xl leading-8 font-semibold">เปิดกล้องไม่ได้</h2>
      <p className="mt-0.5 text-sm leading-6 text-pretty text-primary-foreground/88">อนุญาตให้ BAMBAM ใช้กล้องในการตั้งค่าเบราว์เซอร์ หรือกรอกรหัสอุปกรณ์เอง</p>
      <div className="mt-4 flex flex-wrap gap-2.5">
        <Button type="button" onClick={onRetry}>ลองอีกครั้ง</Button>
        <Button type="button" variant="outline" onClick={onManual}><Keyboard aria-hidden />กรอกรหัสอุปกรณ์เอง</Button>
      </div>
    </MascotPanel>
    <p className="mt-4 text-center"><Button asChild variant="link" className="h-11"><Link href="/repair/new">แจ้งซ่อมโดยไม่สแกน</Link></Button></p>
  </div>;
}

/** Desktop (and any device without the in-app camera): the printed QR is meant for the phone's own camera. */
function DesktopScan() {
  return <div className="px-4 pt-3 pb-10 lg:px-0 lg:pt-0">
    <PageHead />
    <section aria-labelledby="scan-manual-title" data-testid="qr-manual-card" className="mx-auto mt-6 max-w-140 rounded-xl border bg-card p-5 shadow-card sm:p-8">
      <div className="flex flex-col items-center text-center">
        <span aria-hidden className="grid size-14 place-items-center rounded-full bg-secondary text-primary"><QrCode className="size-7" /></span>
        <h2 id="scan-manual-title" className="mt-4 max-w-96 text-base leading-7 font-semibold text-balance">ใช้กล้องมือถือสแกน QR บนอุปกรณ์ได้เลย ไม่ต้องเปิดแอปก่อน</h2>
      </div>
      <ManualCode id="desktop-code" className="mt-6" autoFocus />
      <div className="mt-5 border-t pt-4 text-center"><Button asChild variant="link" className="h-9"><Link href="/repair/new">แจ้งซ่อมโดยไม่สแกน</Link></Button></div>
    </section>
  </div>;
}

function PageHead() {
  return <header>
    <nav aria-label="เส้นทางหน้า">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-muted-foreground">
        <li><Link href="/" className="rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">หน้าแรก</Link></li>
        <li aria-hidden><ChevronRight className="size-3.5" /></li>
        <li><Link href="/repair/my" className="rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">แจ้งซ่อม</Link></li>
        <li aria-hidden><ChevronRight className="size-3.5" /></li>
        <li aria-current="page" className="text-foreground">สแกน QR แจ้งซ่อม</li>
      </ol>
    </nav>
    <h1 className="mt-2 text-2xl leading-9 font-semibold tracking-tight lg:text-[28px] lg:leading-10">สแกน QR แจ้งซ่อม</h1>
  </header>;
}

/**
 * รหัสอุปกรณ์ + ค้นหา (sheet on the camera view, inline on the desktop card): trimmed, uppercase, max 30; found →
 * S03 prefilled, 404 → message under the field, any other failure → the generic toast.
 */
function ManualCode({ id, stacked, autoFocus, className }: { id: string; stacked?: boolean; autoFocus?: boolean; className?: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Stays busy until the route is hidden (cacheComponents keeps it alive); the next visit starts fresh.
  useEffect(() => () => { setBusy(false); setCode(""); setError(""); }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const value = code.trim().toUpperCase();
    setCode(value);
    if (!value) { setError("กรุณากรอกรหัสอุปกรณ์"); input.current?.focus(); return; }
    setBusy(true); setError("");
    try {
      const found = await lookupAsset(value);
      router.push(assetFormPath(found.code));
    } catch (err) {
      setBusy(false);
      if (errorCode(err) === "ASSET_NOT_FOUND") { setError("ไม่พบอุปกรณ์รหัสนี้"); input.current?.focus(); }
      else toast.error(GENERIC_ERROR);
    }
  }

  return <form onSubmit={submit} noValidate className={className}>
    <label htmlFor={id} className="mb-2 block text-sm leading-6 font-semibold">รหัสอุปกรณ์</label>
    <div className={cn("grid gap-3", !stacked && "sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start")}>
      <div className="min-w-0">
      <Input ref={input} id={id} value={code} maxLength={MAX_CODE} autoFocus={autoFocus} placeholder="เช่น AC-05-012"
        autoComplete="off" autoCapitalize="characters" autoCorrect="off" spellCheck={false} enterKeyHint="search"
        onChange={(e) => { setCode(e.target.value.toUpperCase()); if (error) setError(""); }}
        aria-invalid={!!error || undefined} aria-describedby={`${id}-error`}
        className="h-12 rounded-sm bg-card px-3.5 text-base tracking-wide tabular-nums" />
      <p id={`${id}-error`} role={error ? "alert" : undefined} className={cn("mt-2 flex items-start gap-1 text-sm text-destructive", !error && "hidden")}>
        {error && <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />}{error}
      </p>
      </div>
      <Button type="submit" className={cn("h-12", stacked ? "w-full" : "sm:min-w-32")} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Search aria-hidden />}ค้นหา
      </Button>
    </div>
  </form>;
}
