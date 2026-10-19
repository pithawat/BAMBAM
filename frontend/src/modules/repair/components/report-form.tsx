"use client";

/* eslint-disable @next/next/no-img-element -- Authenticated API paths and blob previews require plain images (HANDOFF). */
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertCircle, Armchair, Building2, Camera, ChevronLeft, ChevronRight, CircleCheck, Droplets, Ellipsis, FileText,
  Lightbulb, Loader2, MapPin, RotateCcw, Send, Snowflake, Sparkles, Upload, Wrench, X, type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PriorityBadge } from "@/components/shared/priority-indicator";
import { useCurrentUser } from "@/components/shared/me-provider";
import { ErrorState, ForbiddenState } from "@/components/shared/states";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { clearDraft, draftKey, readDraft, writeDraft } from "@/lib/drafts";
import { cn } from "@/lib/utils";
import { createTicket, getBuildings, getCategories, getRecentPlaces, MAX_PHOTOS } from "../api";
import { createTicketFieldErrors, errorCode, errorMessage } from "../errors";
import { priorityReason, ticketPriority } from "../priority";
import type { Building, Category, Photo, RecentPlace } from "../types";
import { PhotoLightbox } from "./photo-gallery";
import { PhotoTile, usePhotoUploads, type PhotoItem } from "./photo-picker";
import { listDate, timeOf } from "./ticket-presentation";
import { useDiscardGuard } from "./use-discard-guard";

// S03 แจ้งซ่อมใหม่ — CR-008 step wizard (docs/modules/repair/ui/screens/S03-report-form.md, visual source
// docs/modules/repair/changes/CR-008/style-and-form.html + form-wizard.*). One step at a time on every size:
// ปัญหาที่พบ → สถานที่ → รูปภาพ → ตรวจสอบก่อนส่ง. The system sets the priority (BR-F02-2) and the form
// explains it. Team mode, duplicate card and QR banner come with Stages 4–5.

/** Category "อื่นๆ" (typed name, CR-008). */
const OTHER = "other";
const MAX_OTHER = 100;
const MAX_LOCATION = 100;
const MAX_DETAILS = 500;
/** Unattached photos expire after 24 h (D-022); older drafts drop their photos. */
const DRAFT_PHOTO_TTL_MS = 20 * 60 * 60 * 1000;

type Values = {
  /** "" · a category id · OTHER */
  categoryId: string;
  categoryOther: string;
  symptomIds: string[];
  /** "อาการอื่นๆ" ticked (listed category). Category OTHER always types the symptom. */
  symptomOtherOn: boolean;
  symptomOther: string;
  details: string;
  buildingId: string;
  floorId: string;
  locationDetail: string;
};
const initial: Values = {
  categoryId: "", categoryOther: "", symptomIds: [], symptomOtherOn: false, symptomOther: "", details: "",
  buildingId: "", floorId: "", locationDetail: "",
};

type StepKey = "problem" | "location" | "photo" | "review";
const STEPS: { key: StepKey; label: string }[] = [
  { key: "problem", label: "ปัญหาที่พบ" },
  { key: "location", label: "สถานที่" },
  { key: "photo", label: "รูปภาพ" },
  { key: "review", label: "ตรวจสอบ" },
];
const FIELD_STEP: Record<string, StepKey> = {
  categoryId: "problem", categoryOther: "problem", symptomIds: "problem", symptomOther: "problem", details: "problem",
  buildingId: "location", floorId: "location", locationDetail: "location", photoIds: "photo",
};

type Draft = { v: 1; savedAt: number; step: StepKey; values: Values; photos: Photo[] };

const ICONS: Record<string, LucideIcon> = { snowflake: Snowflake, lightbulb: Lightbulb, droplets: Droplets, armchair: Armchair, sparkles: Sparkles };
const categoryIcon = (c?: Category) => (c ? ICONS[c.icon] ?? Wrench : Ellipsis);

function validate(values: Values, photos: PhotoItem[]): Record<string, string> {
  const e: Record<string, string> = {};
  if (!values.categoryId) e.categoryId = "กรุณาเลือกหมวดงาน";
  else if (values.categoryId === OTHER) {
    if (!values.categoryOther.trim()) e.categoryOther = "ระบุหมวดงาน";
    if (!values.symptomOther.trim()) e.symptomOther = "ระบุอาการที่พบ";
  } else {
    if (!values.symptomIds.length && !values.symptomOtherOn) e.symptomIds = "เลือกอาการอย่างน้อย 1 ข้อ";
    if (values.symptomOtherOn && !values.symptomOther.trim()) e.symptomOther = "ระบุอาการอื่นๆ";
  }
  if (values.details.length > MAX_DETAILS) e.details = "ไม่เกิน 500 ตัวอักษร";
  if (!values.buildingId) e.buildingId = "กรุณาเลือกอาคาร";
  else if (!values.floorId) e.floorId = "กรุณาเลือกชั้น";
  if (values.locationDetail.length > MAX_LOCATION) e.locationDetail = "ไม่เกิน 100 ตัวอักษร";
  if (photos.some((p) => p.status === "uploading")) e.photoIds = "รอให้รูปอัปโหลดเสร็จก่อน";
  else if (photos.some((p) => p.status === "failed")) e.photoIds = "มีรูปที่อัปโหลดไม่สำเร็จ ลองใหม่หรือลบรูปนั้น";
  else if (!photos.length) e.photoIds = "ถ่ายหรือแนบรูปปัญหาอย่างน้อย 1 รูป";
  return e;
}

const isDirty = (v: Values, photos: PhotoItem[]) =>
  photos.length > 0 || (Object.keys(initial) as (keyof Values)[]).some((k) => JSON.stringify(v[k]) !== JSON.stringify(initial[k]));

/** Keeps only what still exists in the master data (a draft can be days old). */
function sanitize(d: Draft, categories: Category[], buildings: Building[]): { values: Values; photos: PhotoItem[] } {
  const v = { ...initial, ...d.values };
  const category = categories.find((c) => c.id === v.categoryId);
  if (v.categoryId !== OTHER && !category) Object.assign(v, { categoryId: "", symptomIds: [], symptomOtherOn: false, symptomOther: "" });
  if (category) v.symptomIds = v.symptomIds.filter((id) => category.symptoms.some((s) => s.id === id));
  const building = buildings.find((b) => b.id === v.buildingId);
  if (!building) Object.assign(v, { buildingId: "", floorId: "" });
  else if (!building.floors.some((f) => f.id === v.floorId)) v.floorId = "";
  const fresh = Date.now() - d.savedAt < DRAFT_PHOTO_TTL_MS;
  const photos: PhotoItem[] = fresh
    ? (d.photos ?? []).filter((p) => !p.url.startsWith("blob:")).slice(0, MAX_PHOTOS)
      .map((photo) => ({ key: photo.id, preview: photo.thumbUrl, status: "done", progress: 1, photo }))
    : [];
  return { values: v, photos };
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
  const [showDetails, setShowDetails] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const submitting = useRef(false);
  const panel = useRef<HTMLElement>(null);
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
        const restored = sanitize(draft, categories, buildings);
        if (isDirty(restored.values, restored.photos)) {
          setValues(restored.values); setPhotos(restored.photos); setRestoredAt(draft.savedAt);
          setShowDetails(!!restored.values.details);
          setStep(STEPS.some((s) => s.key === draft.step) ? draft.step : "problem");
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
    setMasterError(false); setReady(false); setRestoredAt(null); setShowDetails(false);
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
  const isOther = values.categoryId === OTHER;
  const category = categories.find((c) => c.id === values.categoryId);
  const building = buildings.find((b) => b.id === values.buildingId);
  const floor = building?.floors.find((f) => f.id === values.floorId);
  const checks = validate(values, photos);
  const shown = { ...Object.fromEntries(Object.entries(checks).filter(([k]) => attempted.includes(FIELD_STEP[k]))), ...serverErrors };
  const stepDone = (key: StepKey) => key === "review" || !Object.keys(checks).some((k) => FIELD_STEP[k] === key);
  const index = STEPS.findIndex((s) => s.key === step);
  const last = step === "review";
  const symptomNames = [
    ...(category?.symptoms.filter((s) => values.symptomIds.includes(s.id)).map((s) => s.name) ?? []),
    ...((isOther || values.symptomOtherOn) && values.symptomOther.trim() ? [values.symptomOther.trim()] : []),
  ];
  const title = symptomNames.join(" · ");
  const categoryLabel = isOther ? values.categoryOther.trim() || "อื่นๆ" : category?.name ?? "";
  // BR-F02-2: explain the level as soon as it is known.
  const priority = isOther
    ? values.categoryOther.trim() && values.symptomOther.trim() ? ticketPriority(undefined, [], true) : null
    : category && (values.symptomIds.length || (values.symptomOtherOn && values.symptomOther.trim()))
      ? ticketPriority(category, values.symptomIds, false) : null;
  const donePhotos = photos.flatMap((p) => p.status === "done" && p.photo ? [p.photo] : []);

  function update(patch: Partial<Values>) {
    setValues((old) => ({ ...old, ...patch }));
    setServerErrors((old) => {
      const next = { ...old };
      for (const k of Object.keys(patch)) delete next[k];
      if ("categoryId" in patch) { delete next.symptomIds; delete next.symptomOther; delete next.categoryOther; }
      if ("symptomIds" in patch || "symptomOtherOn" in patch) delete next.symptomIds;
      if ("buildingId" in patch) delete next.floorId;
      return next;
    });
  }
  function pickCategory(id: string) {
    if (id === values.categoryId) return;
    update({ categoryId: id, symptomIds: [], symptomOtherOn: false, symptomOther: "", categoryOther: id === OTHER ? values.categoryOther : "" });
  }
  function focusStep(field?: string) {
    window.requestAnimationFrame(() => {
      const el = field ? panel.current?.querySelector<HTMLElement>(`[data-field="${field}"] input:not(:disabled), [data-field="${field}"] textarea, [data-field="${field}"] button:not(:disabled)`) : null;
      if (el) { el.focus(); el.scrollIntoView({ block: "center", behavior: "smooth" }); return; }
      panel.current?.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
      document.getElementById("report-progress")?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }
  function go(next: StepKey, field?: string) {
    setStep(next); setSubmitError(""); focusStep(field);
  }
  /** ถัดไป checks only this step; the final button re-checks every step and opens the first invalid one. */
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const keys: StepKey[] = last ? ["problem", "location", "photo"] : [step];
    setAttempted((old) => [...new Set([...old, ...keys])]);
    const firstBad = Object.keys(checks).find((k) => keys.includes(FIELD_STEP[k]));
    if (firstBad) { go(FIELD_STEP[firstBad], firstBad); return; }
    if (!last) { go(STEPS[index + 1].key); return; }

    submitting.current = true; setBusy(true); setSubmitError(""); setServerErrors({});
    try {
      const ticket = await createTicket({
        ...(isOther ? { categoryOther: values.categoryOther.trim() } : { categoryId: values.categoryId }),
        symptomIds: isOther ? [] : values.symptomIds,
        ...((isOther || values.symptomOtherOn) && values.symptomOther.trim() ? { symptomOther: values.symptomOther.trim() } : {}),
        buildingId: values.buildingId,
        floorId: values.floorId,
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
      if (code === "PHOTO_NOT_FOUND") { setServerErrors({ photoIds: errorMessage(err) }); go("photo", "photoIds"); }
      if (code === "MASTER_DATA_CHANGED") {
        setMasterReloading(true);
        try {
          const [categories, buildings] = await Promise.all([getCategories(), getBuildings()]);
          setMaster({ categories, buildings });
          setValues((old) => ({ ...old, categoryId: "", symptomIds: [], symptomOtherOn: false, symptomOther: "", buildingId: "", floorId: "" }));
          go("problem", "categoryId");
        } catch { setMasterError(true); }
        finally { setMasterReloading(false); }
      }
      submitting.current = false; setBusy(false);
    }
  }
  function resetForm() {
    clearDraft(storageKey);
    setValues(initial); setPhotos([]); setStep("problem"); setAttempted([]); setServerErrors({}); setSubmitError("");
    setRestoredAt(null); setShowDetails(false); setResetOpen(false);
    focusStep();
  }

  const topBar = <div className="sticky top-0 z-20 flex h-14 items-center border-b bg-card px-2 lg:hidden">
    <Button type="button" variant="ghost" size="icon" aria-label={index > 0 ? "ย้อนกลับ" : "ออกจากหน้าแจ้งซ่อม"} disabled={busy} onClick={() => index > 0 ? go(STEPS[index - 1].key) : guard.leave()}><ChevronLeft /></Button>
    <p className="flex-1 text-center text-base font-semibold">แจ้งซ่อมใหม่</p>
    <Button type="button" variant="ghost" size="icon" aria-label="ปิดฟอร์ม" disabled={busy} onClick={() => guard.leave()}><X /></Button>
  </div>;
  const header = <><PageHeader title="แจ้งซ่อมใหม่" variant="none" />{topBar}</>;
  const discard = <AlertDialog open={guard.open} onOpenChange={guard.setOpen}><AlertDialogContent className="top-auto bottom-0 w-full max-w-none translate-y-0 rounded-b-none rounded-t-xl lg:top-1/2 lg:bottom-auto lg:max-w-lg lg:-translate-y-1/2 lg:rounded-xl"><AlertDialogHeader><AlertDialogTitle>ทิ้งข้อมูลที่กรอกไว้?</AlertDialogTitle><AlertDialogDescription>ข้อมูลและรูปที่แนบในหน้านี้จะหายไป</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>กรอกต่อ</AlertDialogCancel><Button variant="destructive" onClick={() => { clearDraft(storageKey); guard.discard(); }}>ทิ้งข้อมูล</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>;

  if (masterError && !master) return <>{header}<ErrorState onRetry={() => { setMasterError(false); setRevision((r) => r + 1); }} />{discard}</>;
  if (!master) return <>{header}<div className="mx-auto max-w-260 space-y-4 px-4 py-6 lg:px-0" aria-busy="true" aria-label="กำลังโหลด"><Skeleton className="h-5 w-56" /><div className="flex gap-2">{STEPS.map((s) => <Skeleton key={s.key} className="h-1 flex-1" />)}</div><div className="grid grid-cols-2 gap-3 rounded-xl border bg-card p-5 lg:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-19 rounded-lg" />)}</div></div></>;
  if (!categories.length) return <>{header}<ForbiddenState title="ยังไม่มีหมวดงานในระบบ ติดต่อ Admin" />{discard}</>;

  const narrow = step === "location" || step === "review";
  return <>{header}
    <form onSubmit={submit} noValidate className={cn("mx-auto w-full px-3 pt-3 sm:px-4 lg:px-0 lg:pt-0", narrow ? "max-w-180" : "max-w-260")}>
      <div className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="mr-auto text-sm text-muted-foreground">กรอกทีละขั้น แล้วตรวจข้อมูลก่อนส่งให้ช่าง <span className="whitespace-nowrap">· ช่องที่มี <span className="text-destructive">*</span> จำเป็นต้องกรอก</span></p>
        {dirty && <Button type="button" variant="link" className="h-9 px-0" disabled={busy} onClick={() => setResetOpen(true)}>ล้างแบบฟอร์ม</Button>}
      </div>

      {restoredAt && <div className="mt-2 flex items-center gap-3 rounded-lg border border-primary/15 bg-secondary px-4 py-3 text-sm text-secondary-foreground" role="status">
        <RotateCcw className="size-4.5 shrink-0" aria-hidden />
        <p className="min-w-0 flex-1"><b className="font-semibold">กู้ข้อมูลที่กรอกค้างไว้เมื่อ {timeOf(new Date(restoredAt).toISOString())} น. แล้ว</b><span className="block text-xs">เผื่อหน้ารีเฟรชตอนสลับไปเปิดกล้องหรือแอปอื่น</span></p>
        <Button type="button" variant="link" className="h-9 shrink-0 px-0" onClick={resetForm}>เริ่มใหม่</Button>
      </div>}

      <nav id="report-progress" aria-label="ขั้นตอนแจ้งซ่อม" className="mt-3 mb-3 scroll-mt-16">
        <div className="mb-2 flex justify-between gap-3 text-sm text-muted-foreground" aria-live="polite">
          <b className="font-medium text-foreground">ขั้นตอน {index + 1} จาก {STEPS.length}</b>
          <span>{last ? "ตรวจข้อมูลแล้วกดส่งได้เลย" : `เหลืออีก ${STEPS.length - index - 1} ขั้นตอน`}</span>
        </div>
        <ol className="flex gap-1.5 sm:gap-2">{STEPS.map((s, n) => <li key={s.key} className="min-w-0 flex-1">
          <button type="button" disabled={n > index || busy} aria-current={n === index ? "step" : undefined} onClick={() => go(s.key)}
            className={cn("w-full rounded-sm pb-1 text-left text-xs leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default sm:text-sm", n === index ? "font-semibold text-primary" : "text-muted-foreground")}>
            <span aria-hidden className={cn("mb-2 block h-1 rounded-full", n < index ? "bg-primary/45" : n === index ? "bg-primary" : "bg-border")} />
            {n + 1}. {s.label}
          </button>
        </li>)}</ol>
      </nav>

      {submitError && <Alert variant="destructive" className="mb-3"><AlertCircle /><AlertTitle>ส่งไม่สำเร็จ</AlertTitle><AlertDescription>{submitError}</AlertDescription></Alert>}
      {masterError && <div className="mb-3"><ErrorState variant="inline" onRetry={() => setRevision((r) => r + 1)} /></div>}

      <fieldset disabled={busy || masterReloading} className="min-w-0 disabled:opacity-70">
        <section ref={panel} aria-labelledby="step-title" className={cn("min-w-0", step !== "review" && "rounded-xl border bg-card p-4 shadow-card sm:p-6")}>
          <div className="mb-4 flex items-center gap-3 sm:mb-5">
            <h2 id="step-title" tabIndex={-1} className="flex-1 text-lg leading-7 font-semibold outline-none sm:text-xl">
              {step === "problem" ? "ปัญหาที่พบ" : step === "location" ? "ปัญหาเกิดขึ้นที่ไหน" : step === "photo" ? <><span className="lg:hidden">ถ่ายรูปปัญหา</span><span className="hidden lg:inline">รูปภาพ</span></> : "ตรวจสอบก่อนส่ง"}
            </h2>
            {step !== "review" && stepDone(step) && <span className="inline-flex items-center gap-1 text-sm font-medium text-success"><CircleCheck className="size-4" aria-hidden />ครบแล้ว</span>}
          </div>

          {step === "problem" && <ProblemStep values={values} categories={categories} category={category} isOther={isOther} errors={shown}
            priority={priority && { level: priority.priority, reason: priorityReason({ source: priority.source, symptom: priority.symptom, categoryName: category?.name }) }}
            showDetails={showDetails} onShowDetails={() => { setShowDetails(true); window.requestAnimationFrame(() => document.getElementById("details")?.focus()); }}
            onPickCategory={pickCategory} onChange={update} />}
          {step === "location" && <LocationStep values={values} buildings={buildings} building={building} recent={recent} errors={shown} onChange={update} />}
          {step === "photo" && <PhotoStep photos={photos} onChange={(next) => { setPhotos(next); setServerErrors((old) => { const n = { ...old }; delete n.photoIds; return n; }); }} disabled={busy} error={shown.photoIds} />}
          {step === "review" && <ReviewCard icon={categoryIcon(isOther ? undefined : category)} categoryLabel={categoryLabel} title={title} details={values.details.trim()}
            place={building && floor ? `${building.name} · ชั้น ${floor.name}` : ""} spot={values.locationDetail.trim()} photos={donePhotos} onEdit={(key) => go(key)} />}
        </section>
      </fieldset>

      <div className="sticky bottom-0 z-20 -mx-3 mt-3 flex items-center gap-3 border-t bg-background px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:-mx-4 sm:px-4 lg:mx-0 lg:border-0 lg:px-0 lg:pb-4">
        <Button type="button" variant="outline" className="h-12 min-w-24" disabled={index === 0 || busy} onClick={() => go(STEPS[index - 1].key)}>ย้อนกลับ</Button>
        <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">ข้อมูลที่กรอกไว้จะอยู่เมื่อย้อนกลับ</span>
        <Button type="submit" className="ml-auto h-12 max-w-60 flex-1 sm:ml-0 sm:min-w-45 sm:flex-none" disabled={busy || masterReloading}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {last ? "ยืนยันส่งแจ้งซ่อม" : "ถัดไป"}
          {!busy && (last ? <Send aria-hidden /> : <ChevronRight aria-hidden />)}
        </Button>
      </div>
    </form>
    <AlertDialog open={resetOpen} onOpenChange={setResetOpen}><AlertDialogContent className="rounded-xl"><AlertDialogHeader><AlertDialogTitle>ล้างข้อมูลในแบบฟอร์ม?</AlertDialogTitle><AlertDialogDescription>ข้อมูลที่กรอกและรูปที่เลือกจะถูกล้าง</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>เก็บไว้ก่อน</AlertDialogCancel><Button onClick={resetForm}>ล้างแบบฟอร์ม</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
    {discard}
  </>;
}

// ---- pieces ----

function FieldError({ id, message }: { id: string; message?: string }) {
  return <p id={id} className={cn("mt-2 flex items-start gap-1 text-sm text-destructive", !message && "hidden")} role={message ? "alert" : undefined}>{message && <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />}{message}</p>;
}

function Label({ id, htmlFor, children, required, help, optional }: { id?: string; htmlFor?: string; children: ReactNode; required?: boolean; help?: string; optional?: boolean }) {
  const Tag = htmlFor ? "label" : "div";
  return <Tag id={id} htmlFor={htmlFor} className="mb-2 flex flex-wrap items-baseline gap-x-2 text-[15px] leading-6 font-semibold">
    <span>{children}{required && <span className="text-destructive"> *</span>}</span>
    {help && <span className="text-xs font-normal text-muted-foreground">{help}</span>}
    {optional && <span className="text-xs font-normal text-muted-foreground">ไม่บังคับ</span>}
  </Tag>;
}

/** Radio circle of a choice card (design-system.md "Choice cards"). */
function RadioMark({ on, className }: { on: boolean; className?: string }) {
  return <span aria-hidden className={cn("size-4 shrink-0 rounded-full border-2 border-input bg-card", on && "border-5 border-primary", className)} />;
}

function ProblemStep({ values, categories, category, isOther, errors, priority, showDetails, onShowDetails, onPickCategory, onChange }: {
  values: Values; categories: Category[]; category?: Category; isOther: boolean; errors: Record<string, string>;
  priority: { level: Category["defaultPriority"]; reason: string } | null; showDetails: boolean; onShowDetails: () => void;
  onPickCategory: (id: string) => void; onChange: (patch: Partial<Values>) => void;
}) {
  const cards = [
    ...categories.map((c) => ({ id: c.id, name: c.name, icon: categoryIcon(c), hint: c.symptoms.slice(0, 3).map((s) => s.name).join(" · ") })),
    { id: OTHER, name: "อื่นๆ", icon: Ellipsis, hint: "ปัญหาที่ไม่ตรงกับหมวดด้านบน" },
  ];
  return <div className="space-y-5">
    <div data-field="categoryId">
      <Label id="category-label" required help="เลือก 1 หมวด">เลือกหมวดที่ตรงกับปัญหา</Label>
      <div role="radiogroup" aria-labelledby="category-label" aria-describedby="categoryId-error" aria-invalid={!!errors.categoryId} className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5">
        {cards.map((c) => {
          const on = values.categoryId === c.id;
          return <label key={c.id} className={cn("relative grid min-h-28 cursor-pointer grid-cols-[1fr_auto] content-start gap-1.5 rounded-lg border bg-card p-2.5 outline-none focus-within:ring-2 focus-within:ring-ring sm:flex sm:min-h-19 sm:items-center sm:gap-2.5",
            on ? "border-primary bg-secondary/60 ring-1 ring-primary" : errors.categoryId ? "border-destructive" : "hover:border-primary/40")}>
            <input type="radio" name="category" value={c.id} checked={on} onChange={() => onPickCategory(c.id)} className="sr-only" />
            <span className={cn("grid size-8 place-items-center rounded-md sm:size-9", on ? "bg-secondary text-primary" : "bg-muted text-muted-foreground")}><c.icon className="size-5" aria-hidden /></span>
            <span className="col-span-2 row-start-2 min-w-0 sm:flex-1"><b className="block text-sm leading-6 font-medium">{c.name}</b><small className="mt-0.5 block text-xs leading-5 text-muted-foreground">{c.hint}</small></span>
            <RadioMark on={on} className="col-start-2 row-start-1 justify-self-end sm:self-start" />
          </label>;
        })}
      </div>
      <FieldError id="categoryId-error" message={errors.categoryId} />
    </div>

    {isOther && <div className="space-y-4 border-t pt-4">
      <div data-field="categoryOther"><Label htmlFor="categoryOther" required>ระบุหมวดงาน</Label>
        <Input id="categoryOther" value={values.categoryOther} maxLength={MAX_OTHER} onChange={(e) => onChange({ categoryOther: e.target.value })} placeholder="เช่น ลิฟต์ ระบบเสียง" aria-invalid={!!errors.categoryOther} aria-describedby="categoryOther-error" className="h-12 rounded-sm bg-card px-3.5 text-base" />
        <FieldError id="categoryOther-error" message={errors.categoryOther} /></div>
      <div data-field="symptomOther"><Label htmlFor="symptomOther" required>อาการที่พบ</Label>
        <Input id="symptomOther" value={values.symptomOther} maxLength={MAX_OTHER} onChange={(e) => onChange({ symptomOther: e.target.value })} placeholder="เช่น ลิฟต์ค้างที่ชั้น 3" aria-invalid={!!errors.symptomOther} aria-describedby="symptomOther-error" className="h-12 rounded-sm bg-card px-3.5 text-base" />
        <FieldError id="symptomOther-error" message={errors.symptomOther} /></div>
    </div>}

    {category && <div className="border-t pt-4" data-field="symptomIds">
      <Label id="symptom-label" required help="เลือกได้มากกว่า 1 ข้อ">อาการที่พบ</Label>
      <div role="group" aria-labelledby="symptom-label" aria-describedby="symptomIds-error" className="grid gap-2 sm:grid-cols-2">
        {category.symptoms.map((s) => <label key={s.id} className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-sm border bg-card px-3 py-2 text-[15px] has-checked:border-primary/40 has-checked:bg-secondary/60 focus-within:ring-2 focus-within:ring-ring">
          <input type="checkbox" className="size-4 shrink-0 accent-primary" checked={values.symptomIds.includes(s.id)}
            onChange={(e) => onChange({ symptomIds: e.target.checked ? [...values.symptomIds, s.id] : values.symptomIds.filter((id) => id !== s.id) })} />
          {s.name}
        </label>)}
        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-sm border bg-card px-3 py-2 text-[15px] has-checked:border-primary/40 has-checked:bg-secondary/60 focus-within:ring-2 focus-within:ring-ring">
          <input type="checkbox" className="size-4 shrink-0 accent-primary" checked={values.symptomOtherOn}
            onChange={(e) => { onChange({ symptomOtherOn: e.target.checked, ...(e.target.checked ? {} : { symptomOther: "" }) }); if (e.target.checked) window.requestAnimationFrame(() => document.getElementById("symptomOther")?.focus()); }} />
          อาการอื่นๆ
        </label>
      </div>
      <FieldError id="symptomIds-error" message={errors.symptomIds} />
      {values.symptomOtherOn && <div className="mt-3" data-field="symptomOther"><Label htmlFor="symptomOther" required>ระบุอาการอื่นๆ</Label>
        <Input id="symptomOther" value={values.symptomOther} maxLength={MAX_OTHER} onChange={(e) => onChange({ symptomOther: e.target.value })} placeholder="อาการที่ไม่อยู่ในรายการ" aria-invalid={!!errors.symptomOther} aria-describedby="symptomOther-error" className="h-12 rounded-sm bg-card px-3.5 text-base" />
        <FieldError id="symptomOther-error" message={errors.symptomOther} /></div>}
    </div>}

    {!values.categoryId && <p className="rounded-sm bg-muted/70 px-4 py-3 text-sm text-muted-foreground">เลือกหมวดงานก่อน แล้วเลือกอาการที่พบได้ที่นี่</p>}

    <div aria-live="polite">{priority && <div className="rounded-lg border bg-muted/50 px-4 py-3">
      <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">ความเร่งด่วนของงานนี้: <PriorityBadge priority={priority.level} /></p>
      <p className="mt-1 text-sm text-muted-foreground">{priority.reason} · คุณไม่ต้องเลือกระดับเอง</p>
    </div>}</div>

    <div data-field="details">
      {!showDetails && !values.details ? <Button type="button" variant="link" className="h-11 px-0 text-[15px]" onClick={onShowDetails}>+ เล่ารายละเอียดเพิ่ม <span className="font-normal text-muted-foreground">(ไม่บังคับ)</span></Button>
        : <>
          <div className="flex items-baseline justify-between gap-3"><Label htmlFor="details" optional>รายละเอียดเพิ่มเติม</Label><span id="details-count" className="text-xs text-muted-foreground">{values.details.length}/{MAX_DETAILS}</span></div>
          <Textarea id="details" value={values.details} maxLength={MAX_DETAILS} rows={3} onChange={(e) => onChange({ details: e.target.value })} placeholder="เช่น เริ่มเป็นตั้งแต่เมื่อไร เป็นตลอดหรือเป็นๆ หายๆ" aria-invalid={!!errors.details} aria-describedby="details-count details-error" className="min-h-20 rounded-sm bg-card px-3.5 py-2.5 text-base" />
          <FieldError id="details-error" message={errors.details} />
        </>}
    </div>
  </div>;
}

function LocationStep({ values, buildings, building, recent, errors, onChange }: {
  values: Values; buildings: Building[]; building?: Building; recent: RecentPlace[]; errors: Record<string, string>; onChange: (patch: Partial<Values>) => void;
}) {
  // ที่เคยแจ้ง (#28): only places that still exist; one tap fills building, floor and spot — never preselected.
  const places = recent.filter((p) => buildings.some((b) => b.id === p.building.id && b.floors.some((f) => f.id === p.floor.id)));
  return <div className="space-y-5">
    <div data-field="buildingId">
      <Label id="building-label" required>เลือกอาคาร</Label>
      <div role="radiogroup" aria-labelledby="building-label" aria-describedby="buildingId-error" className="grid gap-2 sm:grid-cols-2 sm:gap-2.5">
        {buildings.map((b) => {
          const on = values.buildingId === b.id;
          return <label key={b.id} className={cn("flex min-h-16 cursor-pointer items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5 text-sm leading-6 outline-none focus-within:ring-2 focus-within:ring-ring sm:min-h-18",
            on ? "border-primary bg-secondary/60 ring-1 ring-primary" : errors.buildingId ? "border-destructive" : "hover:border-primary/40")}>
            <input type="radio" name="building" value={b.id} checked={on} onChange={() => onChange({ buildingId: b.id, floorId: "", locationDetail: "" })} className="sr-only" />
            <Building2 className={cn("size-6 shrink-0", on ? "text-primary" : "text-muted-foreground")} aria-hidden />
            <span className="min-w-0 flex-1 font-medium">{b.name}</span>
            <RadioMark on={on} />
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
          return <label key={f.id} className={cn("grid min-h-11 min-w-16 cursor-pointer place-items-center rounded-sm border bg-card px-3 text-sm focus-within:ring-2 focus-within:ring-ring",
            on ? "border-primary bg-primary font-semibold text-primary-foreground" : errors.floorId ? "border-destructive" : "hover:border-primary/40")}>
            <input type="radio" name="floor" value={f.id} checked={on} onChange={() => onChange({ floorId: f.id })} className="sr-only" />
            ชั้น {f.name}
          </label>;
        })}
      </div> : <p className="py-1 text-sm text-muted-foreground">เลือกอาคารเพื่อดูชั้นที่แจ้งได้</p>}
      <FieldError id="floorId-error" message={errors.floorId} />
    </div>

    <div data-field="locationDetail">
      <Label htmlFor="locationDetail" optional>ห้องหรือจุดที่เกิด</Label>
      <Input id="locationDetail" value={values.locationDetail} maxLength={MAX_LOCATION} onChange={(e) => onChange({ locationDetail: e.target.value })} placeholder="เช่น ห้องประชุม 5B ฝั่งหน้าต่าง" aria-invalid={!!errors.locationDetail} aria-describedby="locationDetail-hint locationDetail-error" className="h-12 rounded-sm bg-card px-3.5 text-base" />
      <p id="locationDetail-hint" className="mt-1.5 text-xs text-muted-foreground">บอกจุดที่ช่างหาเจอง่าย</p>
      <FieldError id="locationDetail-error" message={errors.locationDetail} />
    </div>

    {places.length > 0 && <details className="group border-t pt-1">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden />ที่เคยแจ้ง <span className="text-xs font-normal text-muted-foreground">แตะเพื่อเติมอาคาร ชั้น และห้องให้</span>
      </summary>
      <div className="flex flex-wrap gap-2 pb-2">{places.map((p) => {
        const on = values.buildingId === p.building.id && values.floorId === p.floor.id && values.locationDetail === (p.locationDetail ?? "");
        return <button key={`${p.floor.id}|${p.locationDetail ?? ""}`} type="button" aria-pressed={on}
          onClick={() => onChange({ buildingId: p.building.id, floorId: p.floor.id, locationDetail: p.locationDetail ?? "" })}
          className={cn("flex min-h-14 flex-[1_1_220px] items-center gap-2.5 rounded-lg border bg-card px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring", on ? "border-primary bg-secondary/60" : "hover:border-primary/40")}>
          <MapPin className="size-5 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0"><b className="block truncate text-sm font-semibold">{p.building.name} · ชั้น {p.floor.name}</b><small className="block truncate text-xs text-muted-foreground">{p.locationDetail ?? "ไม่ได้ระบุจุด"} · แจ้งล่าสุด {listDate(p.lastReportedAt)}</small></span>
        </button>;
      })}</div>
    </details>}
  </div>;
}

function PhotoStep({ photos, onChange, disabled, error }: { photos: PhotoItem[]; onChange: React.Dispatch<React.SetStateAction<PhotoItem[]>>; disabled?: boolean; error?: string }) {
  const gallery = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const uploads = usePhotoUploads(photos, onChange, disabled);
  const [drag, setDrag] = useState(false);
  const [opened, setOpened] = useState<string | null>(null);
  const done = photos.filter((p) => p.status === "done" && p.photo);
  const lightboxIndex = done.findIndex((p) => p.key === opened);
  const has = photos.length > 0;
  return <div className="grid items-start gap-4 lg:grid-cols-2 lg:gap-5" data-field="photoIds">
    <div className="min-w-0">
      <Label id="photo-label" required>รูปภาพ <span className="text-xs font-normal text-muted-foreground">{photos.length}/{MAX_PHOTOS} รูป</span></Label>
      <input ref={gallery} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { uploads.choose(e.target.files); e.target.value = ""; }} disabled={disabled} />
      <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { uploads.choose(e.target.files); e.target.value = ""; }} disabled={disabled} />
      <div className="grid grid-cols-2 gap-2 lg:hidden">
        <Button type="button" className="h-12" disabled={disabled || uploads.full} onClick={() => camera.current?.click()} aria-describedby="photoIds-error photo-hint"><Camera aria-hidden />ถ่ายรูป</Button>
        <Button type="button" variant="outline" className="h-12" disabled={disabled || uploads.full} onClick={() => gallery.current?.click()}><Upload aria-hidden />เลือกจากคลังรูป</Button>
      </div>
      <button type="button" disabled={disabled || uploads.full} onClick={() => gallery.current?.click()} aria-describedby="photoIds-error photo-hint"
        onDragEnter={(e) => { e.preventDefault(); setDrag(true); }} onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDrag(false); }} onDrop={(e) => { e.preventDefault(); setDrag(false); uploads.choose(e.dataTransfer.files); }}
        className={cn("hidden min-h-28 w-full items-center gap-4 rounded-lg border-2 border-dashed bg-card px-5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 lg:flex",
          drag ? "border-primary bg-secondary" : error ? "border-destructive" : "border-input hover:border-primary/50")}>
        <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-secondary text-primary"><Upload className="size-5.5" aria-hidden /></span>
        <span><b className="block text-[15px] font-semibold">คลิกเพื่อเลือกรูป หรือลากมาวาง</b><span className="text-sm text-muted-foreground">JPG, PNG, WebP, HEIC · ไม่เกิน 10 MB ต่อรูป</span></span>
      </button>
      <p id="photo-hint" className="mt-3 text-sm leading-6 text-muted-foreground">แนบอย่างน้อย 1 รูป สูงสุด 5 รูป · เลือกเพิ่มหรือลบรูปได้ก่อนส่ง</p>
      {uploads.message && <p role="alert" className="mt-2 flex items-center gap-1 text-sm text-destructive"><AlertCircle className="size-4" aria-hidden />{uploads.message}</p>}
      <FieldError id="photoIds-error" message={error} />
    </div>
    <aside aria-label="รูปที่แนบและคำแนะนำ" className="min-w-0 rounded-lg border bg-muted/50 p-3.5 sm:p-4">
      <div className="mb-2.5 flex items-center justify-between gap-2 text-sm"><b className="font-semibold">{has ? "รูปที่แนบแล้ว" : "ถ่ายให้เห็นปัญหาชัดเจน"}</b><span className="text-xs text-muted-foreground">{photos.length}/{MAX_PHOTOS} รูป</span></div>
      {has ? <div className="grid grid-cols-2 gap-2">{photos.map((item, i) => <PhotoTile key={item.key} item={item} index={i} disabled={disabled} className="aspect-4/3"
        onOpen={() => setOpened(item.key)} onRetry={() => uploads.retry(item)} onRemove={() => uploads.remove(item)} />)}</div>
        : <div className="space-y-3">
          <PhotoTip icon={Camera} title="มุมใกล้: ให้เห็นอาการ" text="เช่น จุดน้ำรั่ว หรือส่วนที่ชำรุด" />
          <PhotoTip icon={MapPin} title="มุมกว้าง: ให้เห็นตำแหน่ง" text="ให้ช่างรู้ว่าอยู่ตรงไหนของห้อง" />
          <p className="text-xs leading-5 text-muted-foreground">ไม่ต้องถ่ายให้สวย แค่เห็นปัญหาและบริเวณรอบ ๆ ชัดเจน</p>
        </div>}
    </aside>
    <PhotoLightbox photos={done.map((p) => p.photo!)} index={lightboxIndex < 0 ? null : lightboxIndex} onIndexChange={(i) => setOpened(i === null ? null : done[i].key)} />
  </div>;
}

function PhotoTip({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return <div className="flex items-start gap-2.5"><Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden /><div><b className="block text-sm font-semibold">{title}</b><p className="text-[13px] text-muted-foreground">{text}</p></div></div>;
}

function ReviewCard({ icon: Icon, categoryLabel, title, details, place, spot, photos, onEdit }: {
  icon: LucideIcon; categoryLabel: string; title: string; details: string; place: string; spot: string; photos: Photo[]; onEdit: (step: StepKey) => void;
}) {
  const [index, setIndex] = useState<number | null>(null);
  const edit = (step: StepKey, label: string) => <Button type="button" variant="link" className="h-11 shrink-0 px-0 text-sm" onClick={() => onEdit(step)} aria-label={`แก้ไข${label}`}>แก้ไข</Button>;
  const row = (step: StepKey, label: string, RowIcon: LucideIcon, body: ReactNode) => <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-b py-3 last:border-0 sm:grid-cols-[110px_minmax(0,1fr)_auto]">
    <h3 className="flex items-center gap-1.5 self-center text-sm font-normal text-muted-foreground sm:self-start sm:pt-2.5"><RowIcon className="size-4 shrink-0" aria-hidden />{label}</h3>
    <div className="col-span-2 row-start-2 min-w-0 text-[15px] leading-7 wrap-break-word sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:pt-2">{body}</div>
    <div className="col-start-2 row-start-1 sm:col-start-3">{edit(step, label)}</div>
  </div>;
  return <>
    <p className="-mt-2 mb-4 text-sm text-muted-foreground">ตรวจปัญหา สถานที่ และรูปให้ถูกต้อง กดแก้ไขเพื่อกลับไปยังขั้นตอนนั้นได้</p>
    <article aria-label="สรุปข้อมูลแจ้งซ่อม" className="overflow-hidden rounded-xl border bg-card shadow-raised">
      <header className="flex items-start gap-3 border-b bg-secondary/40 px-4 py-4 sm:px-5">
        <span className="mt-1 grid size-9 shrink-0 place-items-center rounded-md bg-secondary text-primary"><Icon className="size-5" aria-hidden /></span>
        <div className="min-w-0 flex-1"><p className="text-[13px] text-muted-foreground">{categoryLabel}</p><h3 className="text-lg leading-7 font-medium wrap-break-word">{title}</h3></div>
        {edit("problem", "ปัญหาที่พบ")}
      </header>
      <div className="px-4 sm:px-5">
        {details && row("problem", "รายละเอียด", FileText, <p className="whitespace-pre-wrap">{details}</p>)}
        {row("location", "สถานที่", MapPin, <><p className="font-medium">{place}</p><p className="text-[13px] text-muted-foreground">{spot || "ไม่ได้ระบุห้อง / จุด"}</p></>)}
        {row("photo", `รูปแนบ (${photos.length})`, Camera, <div className="flex flex-wrap gap-2 pb-1">{photos.map((p, i) => <button key={p.id} type="button" onClick={() => setIndex(i)} className="h-14 w-18 overflow-hidden rounded-sm border bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`รูปที่แนบ ${i + 1} เปิดรูปเต็ม`}><img src={p.thumbUrl} alt={`รูปที่แนบ ${i + 1}`} className="size-full object-cover" /></button>)}</div>)}
      </div>
    </article>
    <PhotoLightbox photos={photos} index={index} onIndexChange={setIndex} />
  </>;
}
