"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertCircle, ArrowLeft, Bell, Building2, Camera, Check, ChevronDown, ChevronRight, CircleCheck, DoorOpen, FileText, History, Loader2, MapPin, RotateCcw, Send,
  SquareParking, Upload,
} from "lucide-react";
import { Mascot } from "@/components/shared/mascot";
import { Picker } from "@/components/shared/picker";
import { PriorityBadge } from "@/components/shared/priority-indicator";
import { useCurrentUser } from "@/components/shared/me-provider";
import { ErrorState, ForbiddenState } from "@/components/shared/states";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { clearDraft, draftKey, readDraft, writeDraft } from "@/lib/drafts";
import { initials } from "@/lib/platform/roles";
import { cn } from "@/lib/utils";
import { createTicket, getBuildings, getCategories, getRecentPlaces, MAX_PHOTOS } from "../api";
import { createTicketFieldErrors, errorCode, errorMessage } from "../errors";
import { priorityReason, ticketPriority, type PriorityResult } from "../priority";
import type { AreaType, Building, Category, Floor, Photo, RecentPlace, Room } from "../types";
import { CategoryTile, categoryIcon } from "./category-icon";
import { PhotoLightbox } from "./photo-gallery";
import { PhotoTile, usePhotoUploads, type PhotoItem } from "./photo-picker";
import { floorLabel, listDate, timeOf } from "./ticket-presentation";
import { useDiscardGuard } from "./use-discard-guard";

// S03 แจ้งซ่อมใหม่ — CR-014 wizard (docs/modules/repair/ui/screens/S03-report-form.md CR-014 block, visual
// reference docs/modules/repair/changes/CR-014/form-steps.html): 3 steps ปัญหาที่พบ → สถานที่ → รูปภาพและส่ง
// in one frame. Desktop: the frame is 880px wide and every step sits in the same grid cell (the others are
// invisible), so the body is as tall as the tallest step and the progress strip, card edge and footer never
// move. Phone / tablet: one step at a time with a sticky footer. The system sets the priority (BR-F02-2).
// Team mode, duplicate card and QR banner come with Stages 4–5.

const MAX_OTHER = 100;
const MAX_LOCATION = 100;
const MAX_DETAILS = 500;
/** More rooms than this on a floor → a searchable picker instead of cards (CR-014). */
const MAX_ROOM_CARDS = 9;
/** Unattached photos expire after 24 h (D-022); older drafts drop their photos. */
const DRAFT_PHOTO_TTL_MS = 20 * 60 * 60 * 1000;

type Values = {
  categoryId: string;
  /** Typed category name, only under the "อื่น ๆ" category (CR-014, optional). */
  categoryOther: string;
  symptomIds: string[];
  /** "อาการอื่นๆ" ticked → `symptomOther` required. */
  symptomOtherOn: boolean;
  symptomOther: string;
  details: string;
  buildingId: string;
  floorId: string;
  roomId: string;
  /** บอกจุดเพิ่มเติม (optional extra spot). */
  locationDetail: string;
};
const initial: Values = {
  categoryId: "", categoryOther: "", symptomIds: [], symptomOtherOn: false, symptomOther: "", details: "",
  buildingId: "", floorId: "", roomId: "", locationDetail: "",
};

type StepKey = "problem" | "location" | "send";
const STEPS: { key: StepKey; label: string }[] = [
  { key: "problem", label: "ปัญหาที่พบ" },
  { key: "location", label: "สถานที่" },
  { key: "send", label: "รูปภาพและส่ง" },
];
const FIELD_STEP: Record<string, StepKey> = {
  categoryId: "problem", categoryOther: "problem", symptomIds: "problem", symptomOther: "problem",
  buildingId: "location", floorId: "location", roomId: "location", locationDetail: "location",
  photoIds: "send", details: "send",
};

/** v1 drafts (CR-008, 4 steps, no room) are read too; their steps map onto the 3 CR-014 steps. */
type Draft = { v: 1; savedAt: number; step: string; values: Partial<Values>; photos: Photo[] };
const draftStep = (s: string): StepKey => (s === "location" ? "location" : s === "photo" || s === "review" || s === "send" ? "send" : "problem");

const AREA_LABELS: Record<AreaType, string> = {
  meeting_room: "ห้องประชุม", restroom: "ห้องน้ำ", office: "สำนักงาน", pantry: "Pantry",
  common_area: "พื้นที่ส่วนกลาง", parking: "ลานจอด", other: "อื่นๆ",
};

function validate(values: Values, photos: PhotoItem[]): Record<string, string> {
  const e: Record<string, string> = {};
  if (!values.categoryId) e.categoryId = "กรุณาเลือกหมวดงาน";
  else if (!values.symptomIds.length && !values.symptomOtherOn) e.symptomIds = "เลือกอาการอย่างน้อย 1 ข้อ";
  if (values.symptomOtherOn && !values.symptomOther.trim()) e.symptomOther = "ระบุอาการอื่นๆ";
  if (!values.buildingId) e.buildingId = "กรุณาเลือกอาคาร";
  else if (!values.floorId) e.floorId = "กรุณาเลือกชั้น";
  else if (!values.roomId) e.roomId = "เลือกห้องหรือจุดที่เกิด";
  if (values.locationDetail.length > MAX_LOCATION) e.locationDetail = "ไม่เกิน 100 ตัวอักษร";
  if (values.details.length > MAX_DETAILS) e.details = "ไม่เกิน 500 ตัวอักษร";
  if (photos.some((p) => p.status === "uploading")) e.photoIds = "รอให้รูปอัปโหลดเสร็จก่อน";
  else if (photos.some((p) => p.status === "failed")) e.photoIds = "มีรูปที่อัปโหลดไม่สำเร็จ ลองใหม่หรือลบรูปนั้น";
  else if (!photos.length) e.photoIds = "ถ่ายหรือแนบรูปปัญหาอย่างน้อย 1 รูป";
  return e;
}

const isDirty = (v: Values, photos: PhotoItem[]) =>
  photos.length > 0 || (Object.keys(initial) as (keyof Values)[]).some((k) => JSON.stringify(v[k]) !== JSON.stringify(initial[k]));

/** Keeps only what still exists in the master data (a draft can be days old; the master can change on submit). */
function sanitizeValues(input: Partial<Values>, categories: Category[], buildings: Building[]): Values {
  const v = { ...initial, ...input };
  const category = categories.find((c) => c.id === v.categoryId);
  if (!category) Object.assign(v, { categoryId: "", categoryOther: "", symptomIds: [], symptomOtherOn: false, symptomOther: "" });
  else {
    v.symptomIds = v.symptomIds.filter((id) => category.symptoms.some((s) => s.id === id));
    if (!category.isOther) v.categoryOther = "";
  }
  const building = buildings.find((b) => b.id === v.buildingId);
  const floor = building?.floors.find((f) => f.id === v.floorId);
  if (!building) Object.assign(v, { buildingId: "", floorId: "", roomId: "" });
  else if (!floor) Object.assign(v, { floorId: "", roomId: "" });
  else if (!floor.rooms.some((r) => r.id === v.roomId)) v.roomId = "";
  return v;
}

function sanitizeDraft(d: Draft, categories: Category[], buildings: Building[]): { values: Values; photos: PhotoItem[] } {
  const values = sanitizeValues(d.values, categories, buildings);
  const fresh = Date.now() - d.savedAt < DRAFT_PHOTO_TTL_MS;
  const photos: PhotoItem[] = fresh
    ? (d.photos ?? []).filter((p) => !p.url.startsWith("blob:")).slice(0, MAX_PHOTOS)
      .map((photo) => ({ key: photo.id, preview: photo.thumbUrl, status: "done", progress: 1, photo }))
    : [];
  return { values, photos };
}

/** Rooms whose area type the category lists first (a hint, never a filter — BR-F02-7). */
function splitRooms(rooms: Room[], category?: Category): { matching: Room[]; others: Room[] } {
  const areas = new Set(category?.areaTypes ?? []);
  return { matching: rooms.filter((r) => areas.has(r.areaType)), others: rooms.filter((r) => !areas.has(r.areaType)) };
}

export function ReportForm() {
  const me = useCurrentUser();
  const storageKey = draftKey("repair-report", me.employeeCode);
  const [values, setValues] = useState<Values>(initial);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [step, setStep] = useState<StepKey>("problem");
  const [attempted, setAttempted] = useState<StepKey[]>([]);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [master, setMaster] = useState<{ categories: Category[]; buildings: Building[] }>();
  const [recent, setRecent] = useState<RecentPlace[]>([]);
  const [masterError, setMasterError] = useState(false);
  const [masterReloading, setMasterReloading] = useState(false);
  const [revision, setRevision] = useState(0);
  const [ready, setReady] = useState(false);
  const [restoredAt, setRestoredAt] = useState<number | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const submitting = useRef(false);
  const frame = useRef<HTMLDivElement>(null);
  const dirty = isDirty(values, photos);
  const guard = useDiscardGuard(dirty);

  useEffect(() => {
    let active = true;
    Promise.all([getCategories(), getBuildings()]).then(([categories, buildings]) => {
      if (!active) return;
      setMaster({ categories, buildings }); setMasterError(false);
      // Restore the local draft once per visit (design-system.md "Draft").
      const draft = readDraft<Draft>(storageKey);
      if (draft?.v === 1) {
        const restored = sanitizeDraft(draft, categories, buildings);
        if (isDirty(restored.values, restored.photos)) {
          setValues(restored.values); setPhotos(restored.photos); setRestoredAt(draft.savedAt); setStep(draftStep(draft.step));
        }
      }
      setReady(true);
    }, () => { if (active) setMasterError(true); });
    getRecentPlaces().then((list) => { if (active) setRecent(list); }, () => { if (active) setRecent([]); });
    return () => { active = false; };
  }, [revision, storageKey]);

  // cacheComponents keeps a visited route alive (hidden) with its state. Leaving the form means the
  // report was sent or discarded (the draft is already cleared then), so start the next visit fresh.
  useEffect(() => () => {
    setValues(initial); setPhotos([]); setStep("problem"); setAttempted([]); setServerErrors({}); setSubmitError("");
    setMasterError(false); setReady(false); setRestoredAt(null);
    submitting.current = false; setBusy(false);
  }, []);

  // Save the draft while typing; uploaded photos are kept by id (they live 24 h on the server).
  useEffect(() => {
    if (!ready || submitting.current) return;
    if (!dirty) { clearDraft(storageKey); return; }
    const done = photos.flatMap((p) => p.status === "done" && p.photo ? [p.photo] : []);
    writeDraft(storageKey, { v: 1, savedAt: Date.now(), step, values, photos: done } satisfies Draft);
  }, [ready, dirty, values, photos, step, storageKey]);

  const categories = master?.categories ?? [];
  const buildings = master?.buildings ?? [];
  const category = categories.find((c) => c.id === values.categoryId);
  const building = buildings.find((b) => b.id === values.buildingId);
  const floor = building?.floors.find((f) => f.id === values.floorId);
  const room = floor?.rooms.find((r) => r.id === values.roomId);
  const checks = validate(values, photos);
  const shown = { ...Object.fromEntries(Object.entries(checks).filter(([k]) => attempted.includes(FIELD_STEP[k]))), ...serverErrors };
  const stepDone = (key: StepKey) => !Object.keys(checks).some((k) => FIELD_STEP[k] === key);
  const index = STEPS.findIndex((s) => s.key === step);
  const last = step === "send";
  // BR-F02-2: explain the level as soon as it is known.
  const priority = category && (values.symptomIds.length || (values.symptomOtherOn && values.symptomOther.trim()))
    ? ticketPriority(category, values.symptomIds) : null;
  const donePhotos = photos.flatMap((p) => p.status === "done" && p.photo ? [p.photo] : []);

  function update(patch: Partial<Values>) {
    setValues((old) => ({ ...old, ...patch }));
    setServerErrors((old) => {
      const next = { ...old };
      for (const k of Object.keys(patch)) delete next[k];
      if ("categoryId" in patch) { delete next.symptomIds; delete next.symptomOther; delete next.categoryOther; }
      if ("symptomIds" in patch || "symptomOtherOn" in patch) delete next.symptomIds;
      if ("buildingId" in patch) { delete next.floorId; delete next.roomId; }
      if ("floorId" in patch) delete next.roomId;
      return next;
    });
  }
  /** Changing the category clears its symptoms and typed text; the room stays (CR-014). */
  function pickCategory(id: string) {
    if (id === values.categoryId) return;
    update({ categoryId: id, symptomIds: [], symptomOtherOn: false, symptomOther: "", categoryOther: "" });
  }
  function focusStep(next: StepKey, field?: string) {
    window.requestAnimationFrame(() => {
      const panel = frame.current?.querySelector<HTMLElement>(`[data-step="${next}"]`);
      const el = field ? panel?.querySelector<HTMLElement>(`[data-field="${field}"] input:not(:disabled):not([type=file]), [data-field="${field}"] textarea, [data-field="${field}"] button:not(:disabled)`) : null;
      if (el) { el.focus(); el.scrollIntoView({ block: "center", behavior: "smooth" }); return; }
      panel?.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
      document.getElementById("report-progress")?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }
  function go(next: StepKey, field?: string) {
    setStep(next); setSubmitError(""); focusStep(next, field);
  }
  /** ถัดไป checks only this step; the final button re-checks every step and opens the first invalid one. */
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const keys: StepKey[] = last ? STEPS.map((s) => s.key) : [step];
    setAttempted((old) => [...new Set([...old, ...keys])]);
    const firstBad = Object.keys(checks).find((k) => keys.includes(FIELD_STEP[k]));
    if (firstBad) { go(FIELD_STEP[firstBad], firstBad); return; }
    if (!last) { go(STEPS[index + 1].key); return; }

    submitting.current = true; setBusy(true); setSubmitError(""); setServerErrors({});
    try {
      const ticket = await createTicket({
        categoryId: values.categoryId,
        ...(category?.isOther && values.categoryOther.trim() ? { categoryOther: values.categoryOther.trim() } : {}),
        symptomIds: values.symptomIds,
        ...(values.symptomOtherOn && values.symptomOther.trim() ? { symptomOther: values.symptomOther.trim() } : {}),
        buildingId: values.buildingId,
        floorId: values.floorId,
        roomId: values.roomId,
        ...(values.locationDetail.trim() ? { locationDetail: values.locationDetail.trim() } : {}),
        ...(values.details.trim() ? { details: values.details.trim() } : {}),
        photoIds: donePhotos.map((p) => p.id),
        teamHandled: null,
      });
      clearDraft(storageKey);
      // Stays busy until the route is hidden; the effect cleanup above resets the form.
      guard.finish(`/repair/new/done?id=${encodeURIComponent(ticket.id)}`);
    } catch (err: unknown) {
      const code = errorCode(err);
      const fields = createTicketFieldErrors(err);
      setServerErrors(fields);
      setSubmitError(code === "MASTER_DATA_CHANGED" || code === "PHOTO_NOT_FOUND" || code === "FORBIDDEN" ? errorMessage(err) : "ลองอีกครั้ง ข้อมูลในฟอร์มยังอยู่ครบ");
      const field = Object.keys(fields)[0];
      if (field && FIELD_STEP[field]) go(FIELD_STEP[field], field);
      if (code === "PHOTO_NOT_FOUND") { setServerErrors({ photoIds: errorMessage(err) }); go("send", "photoIds"); }
      if (code === "MASTER_DATA_CHANGED") {
        // Reload the master and keep what is still valid; open the first step that needs a new pick.
        setMasterReloading(true);
        try {
          const [cats, blds] = await Promise.all([getCategories(), getBuildings()]);
          setMaster({ categories: cats, buildings: blds });
          const next = sanitizeValues(values, cats, blds);
          setValues(next);
          setAttempted(STEPS.map((s) => s.key));
          const bad = Object.keys(validate(next, photos)).find((k) => FIELD_STEP[k] !== "send");
          go(bad ? FIELD_STEP[bad] : "problem", bad);
        } catch { setMasterError(true); }
        finally { setMasterReloading(false); }
      }
      submitting.current = false; setBusy(false);
    }
  }
  function resetForm() {
    clearDraft(storageKey);
    setValues(initial); setPhotos([]); setStep("problem"); setAttempted([]); setServerErrors({}); setSubmitError("");
    setRestoredAt(null); setResetOpen(false);
    focusStep("problem");
  }

  // CR-019 heading (prototype v4): breadcrumb, guide mascot, eyebrow, title, ล้างแบบฟอร์ม. Leaving stays guarded
  // (useDiscardGuard catches link clicks); the footer's ยกเลิก on step 1 replaces the old phone top bar.
  const header = <header className="px-4 pt-3 lg:px-0 lg:pt-0">
    <nav aria-label="เส้นทางหน้า">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-muted-foreground">
        <li><Link href="/" className="rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">หน้าแรก</Link></li>
        <li aria-hidden><ChevronRight className="size-3.5" /></li>
        <li><Link href="/repair/my" className="rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">แจ้งซ่อม</Link></li>
        <li aria-hidden><ChevronRight className="size-3.5" /></li>
        <li aria-current="page" className="text-foreground">แจ้งซ่อมใหม่</li>
      </ol>
    </nav>
    <div className="mt-3 mb-4 flex flex-wrap items-center gap-x-5 gap-y-1 lg:mb-5">
      <Mascot pose="guide" size={120} className="hidden shrink-0 sm:block" priority />
      <Mascot pose="guide" size={88} className="shrink-0 sm:hidden" priority />
      <div className="min-w-0 flex-1 basis-48">
        <p className="text-[11px] leading-5 font-semibold tracking-[0.16em] text-primary uppercase">New request</p>
        <h1 className="text-2xl leading-9 font-semibold lg:text-[28px] lg:leading-10">แจ้งซ่อมใหม่</h1>
        <p className="text-sm text-muted-foreground">กรอกทีละขั้น แล้วตรวจข้อมูลก่อนส่งให้ช่าง <span className="whitespace-nowrap">· ช่องที่มี <span className="text-destructive">*</span> จำเป็นต้องกรอก</span></p>
      </div>
      {dirty && master && <Button type="button" variant="link" className="h-9 px-0 max-sm:basis-full max-sm:justify-start" disabled={busy} onClick={() => setResetOpen(true)}>ล้างแบบฟอร์ม</Button>}
    </div>
  </header>;
  const discard = <AlertDialog open={guard.open} onOpenChange={guard.setOpen}><AlertDialogContent className="top-auto bottom-0 w-full max-w-none translate-y-0 rounded-b-none rounded-t-xl lg:top-1/2 lg:bottom-auto lg:max-w-lg lg:-translate-y-1/2 lg:rounded-xl"><AlertDialogHeader><AlertDialogTitle>ทิ้งข้อมูลที่กรอกไว้?</AlertDialogTitle><AlertDialogDescription>ข้อมูลและรูปที่แนบในหน้านี้จะหายไป</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>กรอกต่อ</AlertDialogCancel><Button variant="destructive" onClick={() => { clearDraft(storageKey); guard.discard(); }}>ทิ้งข้อมูล</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>;

  if (masterError && !master) return <>{header}<ErrorState onRetry={() => { setMasterError(false); setRevision((r) => r + 1); }} />{discard}</>;
  if (!master) return <>{header}<FormSkeleton /></>;
  if (!categories.length) return <>{header}<ForbiddenState title="ยังไม่มีหมวดงานในระบบ ติดต่อ Admin" />{discard}</>;

  const panel = (key: StepKey, content: ReactNode) => {
    const on = step === key;
    // Desktop: every step in the same grid cell (invisible when not current) → equal frame height.
    return <section key={key} data-step={key} aria-labelledby={`step-${key}-title`} aria-hidden={!on || undefined} inert={!on}
      className={cn("col-start-1 row-start-1 min-w-0", on ? "block" : "hidden lg:invisible lg:block")}>
      {content}
    </section>;
  };
  const stepHeading = (key: StepKey, title: ReactNode, sub: string, aside?: ReactNode) => <div className="mb-4 flex flex-wrap items-start gap-x-3 gap-y-2">
    <div className="min-w-0 flex-1">
      <h2 id={`step-${key}-title`} tabIndex={-1} className="text-lg leading-7 font-semibold outline-none sm:text-xl">{title}</h2>
      <p className="text-sm text-muted-foreground">{sub}</p>
    </div>
    {stepDone(key) && <span className="mt-1 inline-flex shrink-0 items-center gap-1 text-sm font-medium text-success"><CircleCheck className="size-4" aria-hidden />ครบแล้ว</span>}
    {aside && <div className="w-full sm:w-auto">{aside}</div>}
  </div>;

  return <>{header}
    <form onSubmit={submit} noValidate className="grid w-full items-start gap-4 px-3 sm:px-4 lg:grid-cols-[minmax(0,1fr)_24rem] lg:px-0">
      <div className="min-w-0">

      {restoredAt && <div className="mb-3 flex items-center gap-3 rounded-lg border border-primary/15 bg-secondary px-4 py-3 text-sm text-secondary-foreground" role="status">
        <RotateCcw className="size-4.5 shrink-0" aria-hidden />
        <p className="min-w-0 flex-1"><b className="font-semibold">กู้ข้อมูลที่กรอกค้างไว้เมื่อ {timeOf(new Date(restoredAt).toISOString())} น. แล้ว</b><span className="block text-xs">เผื่อหน้ารีเฟรชตอนสลับไปเปิดกล้องหรือแอปอื่น</span></p>
        <Button type="button" variant="link" className="h-9 shrink-0 px-0" onClick={resetForm}>เริ่มใหม่</Button>
      </div>}

      {submitError && <Alert variant="destructive" className="mb-3"><AlertCircle /><AlertTitle>ส่งไม่สำเร็จ</AlertTitle><AlertDescription>{submitError}</AlertDescription></Alert>}
      {masterError && <div className="mb-3"><ErrorState variant="inline" onRetry={() => setRevision((r) => r + 1)} /></div>}

      <div ref={frame} data-testid="report-frame" className="lg:overflow-hidden lg:rounded-xl lg:border lg:bg-card lg:shadow-card">
        <nav id="report-progress" aria-label="ขั้นตอนแจ้งซ่อม" className="mb-3 scroll-mt-16 rounded-xl border bg-card px-3 py-3 shadow-card lg:mb-0 lg:rounded-none lg:border-0 lg:border-b lg:px-6 lg:py-4 lg:shadow-none">
          <p className="sr-only" aria-live="polite">ขั้นตอน {index + 1} จาก {STEPS.length} · {STEPS[index].label}</p>
          <ol className="grid grid-cols-3 gap-2">{STEPS.map((s, n) => <li key={s.key} className="min-w-0">
            <button type="button" disabled={n > index || busy} aria-current={n === index ? "step" : undefined} onClick={() => go(s.key)}
              className="flex w-full min-w-0 items-center gap-2 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default sm:gap-2.5">
              <span aria-hidden className={cn("grid size-8 shrink-0 place-items-center rounded-full border text-sm font-semibold",
                n < index ? "border-primary bg-primary text-primary-foreground" : n === index ? "border-primary bg-primary text-primary-foreground ring-4 ring-primary/15" : "bg-card text-muted-foreground")}>
                {n < index ? <Check className="size-4" /> : n + 1}
              </span>
              <span className="min-w-0 leading-tight">
                <span className={cn("block text-[11px] sm:text-xs", n <= index ? "text-primary" : "text-muted-foreground")}>ขั้นตอนที่ {n + 1}</span>
                <span className={cn("block truncate text-xs sm:text-sm", n === index ? "font-semibold text-foreground" : "text-muted-foreground")}>{s.label}</span>
              </span>
            </button>
          </li>)}</ol>
        </nav>

        <fieldset disabled={busy || masterReloading} data-testid="report-body"
          className="grid min-w-0 rounded-xl border bg-card p-4 shadow-card disabled:opacity-70 sm:p-6 lg:rounded-none lg:border-0 lg:px-6 lg:py-5 lg:shadow-none">
          {panel("problem", <>
            {stepHeading("problem", "ปัญหาที่พบ", "เลือก 1 หมวด แล้วเลือกอาการที่เห็น")}
            <ProblemStep values={values} categories={categories} category={category} errors={shown}
              priority={priority && { level: priority.priority, reason: priorityReason({ source: priority.source, symptom: priority.symptom, categoryName: category?.name }) }}
              onPickCategory={pickCategory} onChange={update} />
          </>)}
          {panel("location", <>
            {stepHeading("location", "ปัญหาเกิดขึ้นที่ไหน", "เลือกอาคาร ชั้น และห้อง", <RecentPlaces recent={recent} buildings={buildings} onPick={update} />)}
            <LocationStep values={values} buildings={buildings} building={building} floor={floor} category={category} errors={shown} onChange={update} />
          </>)}
          {panel("send", <>
            {stepHeading("send", "รูปภาพและตรวจสอบก่อนส่ง", "แนบรูปอย่างน้อย 1 รูป เล่าเพิ่มได้ถ้าต้องการ แล้วตรวจข้อมูลก่อนกดส่ง")}
            <SendStep photos={photos} onPhotosChange={(next) => { setPhotos(next); setServerErrors((old) => { const n = { ...old }; delete n.photoIds; return n; }); }}
              disabled={busy} errors={shown} details={values.details} onDetails={(details) => update({ details })}
              summary={<ReviewList category={category} values={values} priority={priority} building={building} floor={floor} room={room} onEdit={(key) => go(key)} />} />
          </>)}
        </fieldset>

        <div className="sticky bottom-0 z-20 -mx-3 mt-3 flex items-center gap-3 border-t bg-background px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:-mx-4 sm:px-4 lg:static lg:mx-0 lg:mt-0 lg:bg-muted/40 lg:px-6 lg:py-3">
          <Button type="button" variant="outline" className="h-11 min-w-24 bg-card" disabled={busy} onClick={() => index > 0 ? go(STEPS[index - 1].key) : guard.leave()}>
            <ArrowLeft aria-hidden />{index > 0 ? "ย้อนกลับ" : "ยกเลิก"}</Button>
          <span className="flex-1 text-center text-xs text-muted-foreground lg:text-[13px]">ขั้นตอน {index + 1} จาก {STEPS.length}</span>
          <Button type="submit" className="h-11 sm:min-w-45" disabled={busy || masterReloading}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {last ? "ยืนยันส่งแจ้งซ่อม" : "ถัดไป"}
            {!busy && (last ? <Send aria-hidden /> : <ChevronRight aria-hidden />)}
          </Button>
        </div>
      </div>
      </div>
      <Summary category={category} values={values} priority={priority} building={building} floor={floor} room={room} me={me} onEdit={(key) => go(key)} />
      <div className="h-4 lg:hidden" aria-hidden />
    </form>
    <AlertDialog open={resetOpen} onOpenChange={setResetOpen}><AlertDialogContent className="rounded-xl"><AlertDialogHeader><AlertDialogTitle>ล้างข้อมูลในแบบฟอร์ม?</AlertDialogTitle><AlertDialogDescription>ข้อมูลที่กรอกและรูปที่เลือกจะถูกล้าง</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>เก็บไว้ก่อน</AlertDialogCancel><Button onClick={resetForm}>ล้างแบบฟอร์ม</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
    {discard}
  </>;
}

// ---- pieces ----

/** Loading skeleton in the shape of the 3-step frame. */
function FormSkeleton() {
  return <div className="mx-auto w-full max-w-220 px-3 pt-3 sm:px-4 lg:px-0 lg:pt-0" aria-busy="true" aria-label="กำลังโหลด">
    <Skeleton className="mb-3 h-5 w-72" />
    <div className="lg:rounded-xl lg:border lg:bg-card">
      <div className="mb-3 space-y-3 lg:mb-0 lg:border-b lg:px-6 lg:pt-4.5 lg:pb-3"><Skeleton className="h-4 w-40" /><div className="flex gap-2">{STEPS.map((s) => <Skeleton key={s.key} className="h-1 flex-1" />)}</div></div>
      <div className="space-y-4 rounded-xl border bg-card p-4 sm:p-6 lg:rounded-none lg:border-0 lg:px-6 lg:py-5">
        <Skeleton className="h-6 w-32" />
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">{Array.from({ length: 7 }, (_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-11 rounded-sm" />)}</div>
        <Skeleton className="h-14 w-full rounded-lg" />
      </div>
      <div className="hidden justify-between border-t px-6 py-3 lg:flex"><Skeleton className="h-11 w-24" /><Skeleton className="h-11 w-45" /></div>
    </div>
  </div>;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return <p id={id} className={cn("mt-2 flex items-start gap-1 text-sm text-destructive", !message && "hidden")} role={message ? "alert" : undefined}>{message && <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />}{message}</p>;
}

function Label({ id, htmlFor, children, required, help, optional }: { id?: string; htmlFor?: string; children: ReactNode; required?: boolean; help?: string; optional?: boolean }) {
  const Tag = htmlFor ? "label" : "div";
  return <Tag id={id} htmlFor={htmlFor} className="mb-2 flex flex-wrap items-baseline gap-x-2 text-sm leading-6 font-semibold">
    <span>{children}{required && <span className="text-destructive"> *</span>}</span>
    {help && <span className="text-xs font-normal text-muted-foreground">{help}</span>}
    {optional && <span className="text-xs font-normal text-muted-foreground">ไม่บังคับ</span>}
  </Tag>;
}

const choiceCard = (on: boolean, invalid?: boolean) => cn(
  "flex cursor-pointer items-center gap-2.5 rounded-lg border bg-card px-3 text-sm leading-5 outline-none focus-within:ring-2 focus-within:ring-ring",
  on ? "border-primary bg-secondary font-semibold ring-1 ring-primary" : invalid ? "border-destructive" : "hover:border-primary/40",
);

function ProblemStep({ values, categories, category, errors, priority, onPickCategory, onChange }: {
  values: Values; categories: Category[]; category?: Category; errors: Record<string, string>;
  priority: { level: Category["defaultPriority"]; reason: string } | null;
  onPickCategory: (id: string) => void; onChange: (patch: Partial<Values>) => void;
}) {
  return <div className="space-y-4">
    <div data-field="categoryId">
      <Label id="category-label" required>เลือกหมวดที่ตรงกับปัญหา</Label>
      <div role="radiogroup" aria-labelledby="category-label" aria-describedby="categoryId-error" aria-invalid={!!errors.categoryId} className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {categories.map((c) => {
          const on = values.categoryId === c.id;
          const Icon = categoryIcon(c);
          return <label key={c.id} className={cn(choiceCard(on, !!errors.categoryId), "min-h-14 py-2")}>
            <input type="radio" name="category" value={c.id} checked={on} onChange={() => onPickCategory(c.id)} className="sr-only" />
            <span className={cn("grid size-8.5 shrink-0 place-items-center rounded-md", on ? "bg-card text-primary" : "bg-svc-repair/10 text-svc-repair")}><Icon className="size-4.5" aria-hidden /></span>
            <span className="min-w-0 flex-1">{c.name}</span>
          </label>;
        })}
      </div>
      <FieldError id="categoryId-error" message={errors.categoryId} />
    </div>

    {category?.isOther && <div data-field="categoryOther">
      <Label htmlFor="categoryOther" optional>ระบุหมวดงาน</Label>
      <Input id="categoryOther" value={values.categoryOther} maxLength={MAX_OTHER} onChange={(e) => onChange({ categoryOther: e.target.value })} placeholder="เช่น ลิฟต์ ระบบเสียง" aria-invalid={!!errors.categoryOther} aria-describedby="categoryOther-error" className="h-11 rounded-sm bg-card px-3.5 text-base" />
      <FieldError id="categoryOther-error" message={errors.categoryOther} />
    </div>}

    <div data-field="symptomIds">
      <Label id="symptom-label" required help="เลือกได้มากกว่า 1 ข้อ">อาการที่พบ</Label>
      {/* Reserves 3 rows on desktop (the longest master list) so the frame does not grow per category. */}
      <div className="lg:min-h-35">
        {category ? <div role="group" aria-labelledby="symptom-label" aria-describedby="symptomIds-error" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {category.symptoms.map((s) => <label key={s.id} className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-sm border bg-card px-3 py-2 text-sm has-checked:border-primary/40 has-checked:bg-secondary/60 focus-within:ring-2 focus-within:ring-ring">
            <input type="checkbox" className="size-4 shrink-0 accent-primary" checked={values.symptomIds.includes(s.id)}
              onChange={(e) => onChange({ symptomIds: e.target.checked ? [...values.symptomIds, s.id] : values.symptomIds.filter((id) => id !== s.id) })} />
            {s.name}
          </label>)}
          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-sm border bg-card px-3 py-2 text-sm has-checked:border-primary/40 has-checked:bg-secondary/60 focus-within:ring-2 focus-within:ring-ring">
            <input type="checkbox" className="size-4 shrink-0 accent-primary" checked={values.symptomOtherOn}
              onChange={(e) => { onChange({ symptomOtherOn: e.target.checked, ...(e.target.checked ? {} : { symptomOther: "" }) }); if (e.target.checked) window.requestAnimationFrame(() => document.getElementById("symptomOther")?.focus()); }} />
            อาการอื่นๆ
          </label>
        </div> : <p className="grid min-h-23 place-items-center rounded-sm border border-dashed bg-muted/40 px-4 py-3 text-center text-sm text-muted-foreground lg:min-h-35">เลือกหมวดงานก่อน แล้วเลือกอาการที่พบได้ที่นี่</p>}
        <FieldError id="symptomIds-error" message={errors.symptomIds} />
      </div>
      {values.symptomOtherOn && <div className="mt-3" data-field="symptomOther"><Label htmlFor="symptomOther" required>ระบุอาการอื่นๆ</Label>
        <Input id="symptomOther" value={values.symptomOther} maxLength={MAX_OTHER} onChange={(e) => onChange({ symptomOther: e.target.value })} placeholder="อาการที่ไม่อยู่ในรายการ" aria-invalid={!!errors.symptomOther} aria-describedby="symptomOther-error" className="h-11 rounded-sm bg-card px-3.5 text-base" />
        <FieldError id="symptomOther-error" message={errors.symptomOther} /></div>}
    </div>

    <div aria-live="polite" className="flex min-h-12 items-center gap-2.5 rounded-lg bg-muted px-3.5 py-2.5 text-sm">
      {priority ? <p><span className="font-semibold">ความเร่งด่วนของงานนี้:</span> <PriorityBadge priority={priority.level} className="align-middle" /> <span className="text-muted-foreground">· {priority.reason} คุณไม่ต้องเลือกระดับเอง</span></p>
        : <p className="text-muted-foreground">ระบบจะบอกความเร่งด่วนให้เมื่อเลือกอาการแล้ว คุณไม่ต้องเลือกระดับเอง</p>}
    </div>
  </div>;
}

/** ที่เคยแจ้ง (#28): only rooms that still exist; one tap fills building, floor, room and spot — never preselected. */
function RecentPlaces({ recent, buildings, onPick }: { recent: RecentPlace[]; buildings: Building[]; onPick: (patch: Partial<Values>) => void }) {
  const [open, setOpen] = useState(false);
  const places = recent.filter((p) => buildings.some((b) => b.id === p.building.id && b.floors.some((f) => f.id === p.floor.id && f.rooms.some((r) => r.id === p.room.id))));
  if (!places.length) return null;
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <Button type="button" variant="outline" className="h-10 shrink-0 gap-1.5 border-dashed px-3 text-sm font-normal text-muted-foreground"><History className="size-4" aria-hidden />ที่เคยแจ้ง<ChevronDown className="size-4" aria-hidden /></Button>
    </PopoverTrigger>
    <PopoverContent align="end" className="w-80 p-1.5">
      <p className="px-2.5 pt-1.5 pb-1 text-xs text-muted-foreground">แตะเพื่อเติมอาคาร ชั้น และห้องให้</p>
      {places.map((p) => <button key={`${p.floor.id}|${p.room.id}`} type="button"
        onClick={() => { onPick({ buildingId: p.building.id, floorId: p.floor.id, roomId: p.room.id, locationDetail: p.locationDetail ?? "" }); setOpen(false); }}
        className="flex min-h-14 w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-left outline-none hover:bg-muted focus-visible:bg-muted">
        <MapPin className="size-5 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0"><b className="block truncate text-sm font-semibold">{p.room.name}</b>
          <small className="block truncate text-xs text-muted-foreground">{p.building.name} · {floorLabel(p.floor.name)}{p.locationDetail ? ` · ${p.locationDetail}` : ""} · แจ้งล่าสุด {listDate(p.lastReportedAt)}</small></span>
      </button>)}
    </PopoverContent>
  </Popover>;
}

function LocationStep({ values, buildings, building, floor, category, errors, onChange }: {
  values: Values; buildings: Building[]; building?: Building; floor?: Floor; category?: Category; errors: Record<string, string>;
  onChange: (patch: Partial<Values>) => void;
}) {
  return <div className="space-y-4">
    <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
      <div data-field="buildingId">
        <Label id="building-label" required>เลือกอาคาร</Label>
        <div role="radiogroup" aria-labelledby="building-label" aria-describedby="buildingId-error" className="grid gap-2 sm:grid-cols-2">
          {buildings.map((b) => {
            const on = values.buildingId === b.id;
            return <label key={b.id} className={cn(choiceCard(on, !!errors.buildingId), "min-h-14 py-2")}>
              <input type="radio" name="building" value={b.id} checked={on} onChange={() => onChange({ buildingId: b.id, floorId: "", roomId: "" })} className="sr-only" />
              <span className={cn("grid size-8.5 shrink-0 place-items-center rounded-md", on ? "bg-card text-primary" : "bg-muted text-muted-foreground")}>
                {b.floors.every((f) => f.rooms.every((r) => r.areaType === "parking")) ? <SquareParking className="size-4.5" aria-hidden /> : <Building2 className="size-4.5" aria-hidden />}
              </span>
              <span className="min-w-0 flex-1">{b.name}</span>
            </label>;
          })}
        </div>
        <FieldError id="buildingId-error" message={errors.buildingId} />
      </div>

      <div data-field="floorId">
        <Label id="floor-label" required>เลือกชั้น</Label>
        {building ? <div role="radiogroup" aria-labelledby="floor-label" aria-describedby="floorId-error" className="flex flex-wrap gap-2">
          {building.floors.map((f) => {
            const on = values.floorId === f.id;
            return <label key={f.id} aria-label={floorLabel(f.name)} className={cn("grid min-h-11 min-w-12 cursor-pointer place-items-center rounded-sm border bg-card px-3 text-sm focus-within:ring-2 focus-within:ring-ring",
              on ? "border-primary bg-secondary font-semibold text-secondary-foreground ring-1 ring-primary" : errors.floorId ? "border-destructive" : "hover:border-primary/40")}>
              <input type="radio" name="floor" value={f.id} checked={on} onChange={() => onChange({ floorId: f.id, roomId: "" })} className="sr-only" />
              {f.name}
            </label>;
          })}
        </div> : <p className="py-2 text-sm text-muted-foreground">เลือกอาคารเพื่อดูชั้นที่แจ้งได้</p>}
        <FieldError id="floorId-error" message={errors.floorId} />
      </div>
    </div>

    <div data-field="roomId">
      <Label id="room-label" required>ห้องหรือจุดที่เกิด</Label>
      {/* Reserves 3 rows of cards + group labels on desktop; more rooms use the picker. */}
      <div className="lg:min-h-53">
        {floor ? <RoomChoice rooms={floor.rooms} category={category} value={values.roomId} floor={floor} building={building!} invalid={!!errors.roomId} onPick={(roomId) => onChange({ roomId })} />
          : <p className="grid min-h-23 place-items-center rounded-sm border border-dashed bg-muted/40 px-4 py-3 text-center text-sm text-muted-foreground lg:min-h-53">เลือกอาคารและชั้น แล้วเลือกห้องหรือจุดที่เกิดได้ที่นี่</p>}
        <FieldError id="roomId-error" message={errors.roomId} />
      </div>
    </div>

    <div data-field="locationDetail">
      <Label htmlFor="locationDetail" optional>บอกจุดเพิ่มเติม</Label>
      <Input id="locationDetail" value={values.locationDetail} maxLength={MAX_LOCATION} onChange={(e) => onChange({ locationDetail: e.target.value })} placeholder="เช่น ฝั่งหน้าต่าง เครื่องที่ 2" aria-invalid={!!errors.locationDetail} aria-describedby="locationDetail-error" className="h-11 rounded-sm bg-card px-3.5 text-base" />
      <FieldError id="locationDetail-error" message={errors.locationDetail} />
    </div>
  </div>;
}

/** Room cards (matching the category first, then the rest) or a searchable picker for a big floor (CR-014). */
function RoomChoice({ rooms, category, value, floor, building, invalid, onPick }: {
  rooms: Room[]; category?: Category; value: string; floor: Floor; building: Building; invalid: boolean; onPick: (id: string) => void;
}) {
  const { matching, others } = splitRooms(rooms, category);
  if (rooms.length > MAX_ROOM_CARDS) {
    return <Picker value={value} onValueChange={onPick} title="ห้องหรือจุดที่เกิด" context={`${building.name} · ${floorLabel(floor.name)}`} icon={DoorOpen}
      placeholder="เลือกห้องหรือจุดที่เกิด" searchPlaceholder="ค้นหาห้อง" emptyText="ไม่พบห้องที่ค้นหา" invalid={invalid}
      aria-labelledby="room-label" aria-describedby="roomId-error"
      options={[...matching, ...others].map((r) => ({ value: r.id, label: r.name, description: matching.includes(r) ? `ตรงกับปัญหา · ${AREA_LABELS[r.areaType]}` : AREA_LABELS[r.areaType] }))} />;
  }
  const card = (r: Room, caption: boolean) => {
    const on = value === r.id;
    return <label key={r.id} className={cn(choiceCard(on, invalid), "min-h-11 rounded-sm py-1.5")}>
      <input type="radio" name="room" value={r.id} checked={on} onChange={() => onPick(r.id)} className="sr-only" />
      <DoorOpen className={cn("size-4 shrink-0", on ? "text-primary" : "text-muted-foreground")} aria-hidden />
      <span className="min-w-0 flex-1">{r.name}</span>
      {caption && <small className="shrink-0 text-xs font-normal text-muted-foreground">{AREA_LABELS[r.areaType]}</small>}
    </label>;
  };
  const grid = "grid gap-2 sm:grid-cols-2 lg:grid-cols-3";
  if (!matching.length || !others.length) {
    return <div role="radiogroup" aria-labelledby="room-label" aria-describedby="roomId-error" className={grid}>{rooms.map((r) => card(r, matching.length > 0))}</div>;
  }
  return <div role="radiogroup" aria-labelledby="room-label" aria-describedby="roomId-error" className="space-y-2.5">
    <div><p className="mb-1.5 text-xs text-muted-foreground">ห้องที่ตรงกับปัญหา ({category!.name})</p><div className={grid}>{matching.map((r) => card(r, true))}</div></div>
    <div><p className="mb-1.5 text-xs text-muted-foreground">ห้องอื่นบนชั้นนี้</p><div className={grid}>{others.map((r) => card(r, false))}</div></div>
  </div>;
}

function SendStep({ photos, onPhotosChange, disabled, errors, details, onDetails, summary }: {
  photos: PhotoItem[]; onPhotosChange: React.Dispatch<React.SetStateAction<PhotoItem[]>>; disabled?: boolean; errors: Record<string, string>;
  details: string; onDetails: (value: string) => void; summary: ReactNode;
}) {
  const gallery = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const uploads = usePhotoUploads(photos, onPhotosChange, disabled);
  const [drag, setDrag] = useState(false);
  const [opened, setOpened] = useState<string | null>(null);
  const done = photos.filter((p) => p.status === "done" && p.photo);
  const lightboxIndex = done.findIndex((p) => p.key === opened);
  const error = errors.photoIds;
  return <div className="grid items-start gap-5 lg:grid-cols-2">
    <div className="min-w-0" data-field="photoIds">
      <Label id="photo-label" required help={`${photos.length}/${MAX_PHOTOS} รูป`}>รูปภาพ</Label>
      <input type="file" ref={gallery} accept="image/*" multiple className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { uploads.choose(e.target.files); e.target.value = ""; }} disabled={disabled} />
      <input type="file" ref={camera} accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { uploads.choose(e.target.files); e.target.value = ""; }} disabled={disabled} />
      <div className="grid grid-cols-2 gap-2 lg:hidden">
        <Button type="button" className="h-12" disabled={disabled || uploads.full} onClick={() => camera.current?.click()} aria-describedby="photoIds-error photo-hint"><Camera aria-hidden />ถ่ายรูป</Button>
        <Button type="button" variant="outline" className="h-12" disabled={disabled || uploads.full} onClick={() => gallery.current?.click()}><Upload aria-hidden />เลือกจากคลังรูป</Button>
      </div>
      <button type="button" disabled={disabled || uploads.full} onClick={() => gallery.current?.click()} aria-describedby="photoIds-error photo-hint"
        onDragEnter={(e) => { e.preventDefault(); setDrag(true); }} onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDrag(false); }} onDrop={(e) => { e.preventDefault(); setDrag(false); uploads.choose(e.dataTransfer.files); }}
        className={cn("hidden min-h-32 w-full items-center gap-3.5 rounded-lg border-2 border-dashed bg-card px-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 lg:flex",
          drag ? "border-primary bg-secondary" : error ? "border-destructive" : "border-input hover:border-primary/50")}>
        <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-secondary text-primary"><Upload className="size-5.5" aria-hidden /></span>
        <span><b className="block text-sm font-semibold">ลากรูปมาวาง หรือคลิกเพื่อเลือก</b><span className="text-[13px] text-muted-foreground">JPG PNG WebP HEIC ไม่เกิน 10 MB ต่อรูป</span></span>
      </button>
      {photos.length > 0 && <div className="mt-3 grid grid-cols-3 gap-2">{photos.map((item, i) => <PhotoTile key={item.key} item={item} index={i} disabled={disabled} className="aspect-square"
        onOpen={() => setOpened(item.key)} onRetry={() => uploads.retry(item)} onRemove={() => uploads.remove(item)} />)}</div>}
      {uploads.message && <p role="alert" className="mt-2 flex items-center gap-1 text-sm text-destructive"><AlertCircle className="size-4" aria-hidden />{uploads.message}</p>}
      <FieldError id="photoIds-error" message={error} />
      <div id="photo-hint" className="mt-3 space-y-0.5 text-[13px] leading-5 text-muted-foreground">
        <b className="block text-sm font-semibold text-foreground">ถ่ายให้เห็นปัญหาชัดเจน</b>
        <p>มุมใกล้: ให้เห็นอาการ · มุมกว้าง: ให้เห็นตำแหน่ง</p>
        <p>แนบอย่างน้อย 1 รูป สูงสุด 5 รูป</p>
      </div>
      <PhotoLightbox photos={done.map((p) => p.photo!)} index={lightboxIndex < 0 ? null : lightboxIndex} onIndexChange={(i) => setOpened(i === null ? null : done[i].key)} />
    </div>

    <div className="min-w-0 space-y-4">
      <div data-field="details">
        <div className="flex items-baseline justify-between gap-3"><Label htmlFor="details" optional>เล่ารายละเอียดเพิ่ม</Label><span id="details-count" className="text-xs text-muted-foreground">{details.length}/{MAX_DETAILS}</span></div>
        <Textarea id="details" value={details} maxLength={MAX_DETAILS} rows={4} onChange={(e) => onDetails(e.target.value)} placeholder="เช่น เริ่มเป็นตั้งแต่เมื่อไร เป็นตลอดหรือเป็นๆ หายๆ" aria-invalid={!!errors.details} aria-describedby="details-count details-error" className="min-h-30 rounded-sm bg-card px-3.5 py-2.5 text-base" />
        <FieldError id="details-error" message={errors.details} />
      </div>
      <div className="lg:hidden">
        <h3 className="mb-2 text-sm leading-6 font-semibold">ตรวจสอบก่อนส่ง</h3>
        {summary}
      </div>
    </div>
  </div>;
}

/** ตรวจสอบก่อนส่ง: ปัญหา · ความเร่งด่วน · สถานที่, each with แก้ไข back to its step (photos are not repeated). */
function ReviewList({ category, values, priority, building, floor, room, onEdit }: {
  category?: Category; values: Values; priority: PriorityResult | null; building?: Building; floor?: Floor; room?: Room; onEdit: (step: StepKey) => void;
}) {
  const symptoms = [
    ...(category?.symptoms.filter((s) => values.symptomIds.includes(s.id)).map((s) => s.name) ?? []),
    ...(values.symptomOtherOn && values.symptomOther.trim() ? [values.symptomOther.trim()] : []),
  ];
  const categoryLabel = category ? [category.name, category.isOther ? values.categoryOther.trim() : ""].filter(Boolean).join(" · ") : "";
  const dash = <span className="text-muted-foreground">ยังไม่ได้เลือก</span>;
  const row = (label: string, body: ReactNode, step?: StepKey) => <div className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto] items-start gap-2.5 border-t px-3.5 py-2.5 text-sm first:border-0">
    <dt className="pt-px text-muted-foreground">{label}</dt>
    <dd className="min-w-0 leading-6 wrap-break-word">{body}</dd>
    {step ? <Button type="button" variant="link" className="h-6 px-0 text-sm" onClick={() => onEdit(step)} aria-label={`แก้ไข${label}`}>แก้ไข</Button> : <span />}
  </div>;
  return <dl className="overflow-hidden rounded-lg border bg-card">
    {row("ปัญหา", category ? <><b className="font-semibold">{categoryLabel}</b>{symptoms.length > 0 && <span className="block">{symptoms.join(" · ")}</span>}</> : dash, "problem")}
    {row("ความเร่งด่วน", priority ? <span className="flex flex-wrap items-center gap-1.5"><PriorityBadge priority={priority.priority} /><span className="text-muted-foreground">{priority.source === "symptom" ? "จากอาการ" : "ระดับเริ่มต้นของหมวด"}</span></span> : dash)}
    {row("สถานที่", building && floor ? <>{building.name} · {floorLabel(floor.name)}<span className="block">{room ? <b className="font-semibold">{room.name}</b> : dash}{values.locationDetail.trim() && <span className="text-muted-foreground"> · {values.locationDetail.trim()}</span>}</span></> : dash, "location")}
  </dl>;
}

/** สรุปการแจ้งซ่อม (CR-019, desktop): live on every step; แก้ไข jumps back to that step. */
function Summary({ category, values, priority, building, floor, room, me, onEdit }: {
  category?: Category; values: Values; priority: PriorityResult | null; building?: Building; floor?: Floor; room?: Room;
  me: { name: string; department: string | null }; onEdit: (step: StepKey) => void;
}) {
  const symptoms = [
    ...(category?.symptoms.filter((s) => values.symptomIds.includes(s.id)).map((s) => s.name) ?? []),
    ...(values.symptomOtherOn && values.symptomOther.trim() ? [values.symptomOther.trim()] : []),
  ];
  const categoryLabel = category ? [category.name, category.isOther ? values.categoryOther.trim() : ""].filter(Boolean).join(" · ") : "";
  const dash = <span className="text-muted-foreground">ยังไม่ได้เลือก</span>;
  const row = (label: string, tile: ReactNode, body: ReactNode, step?: StepKey) => <div className="flex items-start gap-3 border-t px-5 py-4 first:border-0">
    {tile}
    <div className="min-w-0 flex-1">
      <dt className="text-xs leading-5 text-muted-foreground">{label}</dt>
      <dd className="text-sm leading-6 wrap-break-word">{body}</dd>
    </div>
    {step && <Button type="button" variant="link" className="h-6 px-0 text-[13px]" onClick={() => onEdit(step)} aria-label={`แก้ไข${label}`}>แก้ไข</Button>}
  </div>;
  const soft = "grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-primary";
  return <aside aria-labelledby="summary-title" className="hidden space-y-4 lg:sticky lg:top-26 lg:block">
    <section className="overflow-hidden rounded-xl border bg-card shadow-card">
      <h2 id="summary-title" className="flex items-center justify-between border-b px-5 py-4 text-base leading-6 font-semibold">สรุปการแจ้งซ่อม<FileText className="size-4.5 text-muted-foreground" aria-hidden /></h2>
      <dl>
        {row("ปัญหาที่พบ", <CategoryTile icon={category?.icon} />,
          category ? <><b className="font-semibold">{categoryLabel}</b>{symptoms.length > 0 && <span className="block text-muted-foreground">{symptoms.join(" · ")}</span>}</> : dash, "problem")}
        {priority && row("ความเร่งด่วน", <span aria-hidden className={soft}><AlertCircle className="size-4.5" /></span>,
          <span className="flex flex-wrap items-center gap-1.5"><PriorityBadge priority={priority.priority} /><span className="text-muted-foreground">{priority.source === "symptom" ? "จากอาการ" : "ระดับเริ่มต้นของหมวด"}</span></span>)}
        {row("สถานที่", <span aria-hidden className={soft}><MapPin className="size-4.5" /></span>,
          building && floor ? <><b className="font-semibold">{building.name} · {floorLabel(floor.name)}</b><span className="block text-muted-foreground">{room ? room.name : "ยังไม่ได้เลือกห้อง"}{values.locationDetail.trim() && ` · ${values.locationDetail.trim()}`}</span></> : dash, "location")}
        {row("ผู้แจ้ง", <span aria-hidden className={cn(soft, "rounded-full text-xs font-semibold")}>{initials(me.name)}</span>,
          <><b className="font-semibold">{me.name}</b>{me.department && <span className="block text-muted-foreground">{me.department}</span>}</>)}
      </dl>
    </section>
    <div className="flex gap-3 px-5 text-[13px] leading-5 text-muted-foreground">
      <Bell className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <p><b className="block text-sm font-semibold text-foreground">ส่งแล้วติดตามได้ตลอด</b>ดูความคืบหน้าได้ที่หน้าติดตามงานซ่อม ตั้งแต่รับเรื่องจนปิดงาน</p>
    </div>
  </aside>;
}
