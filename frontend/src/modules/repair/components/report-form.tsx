"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { z } from "zod";
import { AlertCircle, Armchair, Building2, Check, ChevronLeft, CircleAlert, Droplets, Info, Layers, Lightbulb, Loader2, Snowflake, Sparkles, Wrench, X } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PriorityIndicator } from "@/components/shared/priority-indicator";
import { ErrorState, ForbiddenState } from "@/components/shared/states";
import { ChoiceField } from "@/components/shared/choice-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { createTicket, getBuildings, getCategories, MAX_PHOTOS } from "../api";
import { createTicketFieldErrors, errorCode, errorMessage } from "../errors";
import { PRIORITIES, type Building, type Category, type Priority } from "../types";
import { PhotoGallery } from "./photo-gallery";
import { PhotoPicker, type PhotoItem } from "./photo-picker";
import { useDiscardGuard } from "./use-discard-guard";

const schema = z.object({
  categoryId: z.string().min(1, "กรุณาเลือกหมวดงาน"),
  symptomIds: z.array(z.string()).min(1, "เลือกอาการอย่างน้อย 1 ข้อ"),
  buildingId: z.string().min(1, "กรุณาเลือกอาคาร"),
  floorId: z.string().min(1, "กรุณาเลือกชั้น"),
  locationDetail: z.string().max(100, "ไม่เกิน 100 ตัวอักษร"),
  details: z.string().max(500, "ไม่เกิน 500 ตัวอักษร"),
  priority: z.enum(PRIORITIES, { error: "กรุณาเลือกความเร่งด่วน" }),
  photoIds: z.array(z.string()).min(1, "แนบรูปอย่างน้อย 1 รูป").max(MAX_PHOTOS, "แนบได้สูงสุด 5 รูป"),
});
type Values = Omit<z.infer<typeof schema>, "photoIds">;
const initial: Values = { categoryId: "", symptomIds: [], buildingId: "", floorId: "", locationDetail: "", details: "", priority: "medium" };
const STEPS = ["เกิดปัญหาเกี่ยวกับอะไร", "เกิดที่ไหน", "รูปและรายละเอียด", "ความเร่งด่วน"];
const FIELDS = [["categoryId", "symptomIds"], ["buildingId", "floorId", "locationDetail"], ["photoIds", "details"], ["priority"]];
const ICONS: Record<string, typeof Wrench> = { snowflake: Snowflake, lightbulb: Lightbulb, droplets: Droplets, armchair: Armchair, sparkles: Sparkles };
const HINTS: Record<Priority, string> = { critical: "อันตราย หรือกระทบงานหลายคนทันที", high: "กระทบการทำงานของคุณหรือทีม", medium: "ใช้งานได้ แต่ไม่สะดวก", low: "ไม่เร่งด่วน" };

function validate(values: Values, photos: PhotoItem[]) {
  const result = schema.safeParse({ ...values, photoIds: photos.flatMap((p) => p.status === "done" && p.photo ? [p.photo.id] : []) });
  const errors: Record<string, string> = {};
  if (!result.success) for (const issue of result.error.issues) errors[String(issue.path[0])] ??= issue.message;
  if (photos.some((p) => p.status === "uploading")) errors.photoIds = "รอให้รูปอัปโหลดเสร็จก่อน";
  else if (photos.some((p) => p.status === "failed")) errors.photoIds = "มีรูปที่อัปโหลดไม่สำเร็จ ลองใหม่หรือลบรูปนั้น";
  return errors;
}

function FormField({ name, label, required, error, children }: { name: string; label: string; required?: boolean; error?: string; children: ReactNode }) {
  return <Field data-field={name} data-invalid={!!error} className="gap-2 text-foreground">
    <FieldLabel id={`${name}-label`} htmlFor={name} className="text-sm font-medium">{label}{required && <span className="text-destructive">*</span>}</FieldLabel>
    {children}
    <p id={`${name}-error`} className={cn("flex items-start gap-1 text-sm text-destructive", !error && "hidden")} role={error ? "alert" : undefined}>{error && <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />}{error}</p>
  </Field>;
}

export function ReportForm() {
  const [values, setValues] = useState<Values>(initial);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [step, setStep] = useState(0);
  const [attempted, setAttempted] = useState<number[]>([]);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [master, setMaster] = useState<{ categories: Category[]; buildings: Building[] }>();
  const [masterError, setMasterError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [masterReloading, setMasterReloading] = useState(false);
  const submitting = useRef(false);
  const dirty = values.categoryId !== "" || values.buildingId !== "" || values.locationDetail !== "" || values.details !== "" || values.priority !== "medium" || photos.length > 0;
  const guard = useDiscardGuard(dirty);
  useEffect(() => {
    let active = true;
    Promise.all([getCategories(), getBuildings()]).then(([categories, buildings]) => {
      if (active) { setMaster({ categories, buildings }); setMasterError(false); }
    }, () => { if (active) setMasterError(true); });
    return () => { active = false; };
  }, [revision]);
  const categories = master?.categories ?? [];
  const buildings = master?.buildings ?? [];
  const category = categories.find((c) => c.id === values.categoryId);
  const building = buildings.find((b) => b.id === values.buildingId);
  const errors = { ...Object.fromEntries(Object.entries(validate(values, photos)).filter(([key]) => attempted.some((s) => FIELDS[s].includes(key)))), ...serverErrors };

  // cacheComponents keeps a visited route alive (hidden) with its state. Leaving the form
  // means the draft was submitted or discarded, and PhotoPicker has already aborted uploads
  // and revoked previews on hide, so start the next visit with a fresh draft.
  useEffect(() => () => {
    setValues(initial); setPhotos([]); setStep(0); setAttempted([]); setServerErrors({}); setSubmitError(""); setMasterError(false);
    submitting.current = false; setBusy(false);
  }, []);

  // Desktop section status + summary panel (S03 desktop, CR-002).
  const checks = validate(values, photos);
  const sectionDone = FIELDS.map((fields) => fields.every((f) => !checks[f]));
  const sectionErrors = FIELDS.map((fields) => fields.filter((f) => errors[f]).length);
  const floor = building?.floors.find((f) => f.id === values.floorId);
  const uploading = photos.filter((p) => p.status === "uploading").length;
  const donePhotos = photos.filter((p) => p.status === "done").length;
  const summaryRows = [
    { label: "หมวดงาน · อาการ", step: 0, field: values.categoryId ? "symptomIds" : "categoryId", done: !checks.categoryId && !checks.symptomIds, attempted: !!(errors.categoryId || errors.symptomIds),
      value: category && values.symptomIds.length ? `${category.name} · ${category.symptoms.filter((s) => values.symptomIds.includes(s.id)).map((s) => s.name).join(", ")}` : "ยังไม่ได้เลือก" },
    { label: "สถานที่", step: 1, field: values.buildingId ? "floorId" : "buildingId", done: !checks.buildingId && !checks.floorId, attempted: !!(errors.buildingId || errors.floorId),
      value: building && floor ? `${building.name} ชั้น ${floor.name}${values.locationDetail ? ` · ${values.locationDetail}` : ""}` : "ยังไม่ได้เลือก" },
    { label: "รูปภาพ", step: 2, field: "photoIds", done: !checks.photoIds, attempted: !!errors.photoIds,
      value: uploading ? `กำลังอัปโหลด ${uploading} รูป` : checks.photoIds && donePhotos ? checks.photoIds : donePhotos ? `${donePhotos} รูป` : "ยังไม่ได้แนบ — อย่างน้อย 1 รูป" },
    { label: "ความเร่งด่วน", step: 3, field: "priority", done: !checks.priority, attempted: !!errors.priority, value: <PriorityIndicator priority={values.priority} /> },
  ];
  const doneCount = summaryRows.filter((r) => r.done).length;

  function update<K extends keyof Values>(name: K, value: Values[K]) {
    setValues((old) => ({ ...old, [name]: value, ...(name === "categoryId" ? { symptomIds: [] } : {}), ...(name === "buildingId" ? { floorId: "" } : {}) }));
    setServerErrors((old) => { const next = { ...old }; delete next[name]; if (name === "categoryId") delete next.symptomIds; if (name === "buildingId") delete next.floorId; return next; });
  }
  function goToStep(next: number, field?: string) {
    setStep(next);
    window.requestAnimationFrame(() => {
      const section = document.getElementById(`report-step-${next}`);
      if (field) {
        const group = document.querySelector(`[data-field="${field}"]`);
        const input = group?.querySelector<HTMLElement>("button:not(:disabled), input:not(:disabled), textarea");
        input?.focus(); group?.scrollIntoView({ block: "center", behavior: "smooth" });
      } else { section?.querySelector<HTMLElement>("h2")?.focus(); window.scrollTo({ top: 0, behavior: "smooth" }); }
    });
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const mobile = window.matchMedia("(max-width: 1023px)").matches;
    const last = !mobile || step === 3;
    const checks = validate(values, photos);
    const relevant = last ? [0, 1, 2, 3] : [step];
    setAttempted((old) => [...new Set([...old, ...relevant])]);
    const first = relevant.flatMap((s) => FIELDS[s]).find((key) => checks[key]);
    if (first) { goToStep(FIELDS.findIndex((fields) => fields.includes(first)), first); return; }
    if (!last) { goToStep(step + 1); return; }
    submitting.current = true; setBusy(true); setSubmitError(""); setServerErrors({});
    try {
      const ticket = await createTicket({ ...values, photoIds: photos.map((p) => p.photo!.id), teamHandled: null });
      // Stays busy until the route is hidden; the effect cleanup above resets the draft.
      guard.finish(`/repair/new/done?id=${encodeURIComponent(ticket.id)}`);
    } catch (err: unknown) {
      const fields = createTicketFieldErrors(err); setServerErrors(fields);
      const code = errorCode(err);
      setSubmitError(code === "VALIDATION_FAILED" ? "ลองอีกครั้ง ข้อมูลในฟอร์มยังอยู่ครบ" : code === "MASTER_DATA_CHANGED" || code === "PHOTO_NOT_FOUND" || code === "FORBIDDEN" ? errorMessage(err) : "ลองอีกครั้ง ข้อมูลในฟอร์มยังอยู่ครบ");
      const field = Object.keys(fields)[0];
      if (field) goToStep(Math.max(0, FIELDS.findIndex((f) => f.includes(field))), field);
      if (code === "PHOTO_NOT_FOUND") {
        setServerErrors({ photoIds: errorMessage(err) }); goToStep(2, "photoIds");
      }
      if (code === "MASTER_DATA_CHANGED") {
        setMasterReloading(true);
        try {
          const [categories, buildings] = await Promise.all([getCategories(), getBuildings()]);
          setMaster({ categories, buildings });
          setValues((old) => ({ ...old, categoryId: "", symptomIds: [], buildingId: "", floorId: "" }));
          goToStep(0, "categoryId");
        } catch { setMasterError(true); }
        finally { setMasterReloading(false); }
      }
      submitting.current = false; setBusy(false);
    }
  }
  const header = <><PageHeader title="แจ้งซ่อม" variant="none" /><div className="sticky top-0 z-20 flex h-14 items-center border-b bg-card px-2 lg:hidden"><Button type="button" variant="ghost" size="icon" aria-label="ย้อนกลับ" disabled={busy} onClick={() => step > 0 ? goToStep(step - 1) : guard.leave()}><ChevronLeft /></Button><h1 className="flex-1 text-center font-heading text-base font-semibold">แจ้งซ่อม</h1><Button type="button" variant="ghost" size="icon" aria-label="ปิดฟอร์ม" disabled={busy} onClick={() => guard.leave()}><X /></Button></div></>;
  const discard = <AlertDialog open={guard.open} onOpenChange={guard.setOpen}><AlertDialogContent className="top-auto bottom-0 w-full max-w-none translate-y-0 rounded-b-none rounded-t-2xl lg:top-1/2 lg:bottom-auto lg:max-w-lg lg:-translate-y-1/2 lg:rounded-xl"><AlertDialogHeader><AlertDialogTitle>ทิ้งข้อมูลที่กรอกไว้?</AlertDialogTitle><AlertDialogDescription>ข้อมูลและรูปที่แนบในหน้านี้จะหายไป</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>กรอกต่อ</AlertDialogCancel><Button variant="destructive" onClick={guard.discard}>ทิ้งข้อมูล</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>;
  if (masterError && !master) return <>{header}<ErrorState onRetry={() => { setMasterError(false); setRevision((r) => r + 1); }} />{discard}</>;
  if (!master) return <>{header}<div className="space-y-5 px-4 py-6" aria-busy="true" aria-label="กำลังโหลด"><Skeleton className="h-7 w-52" /><div className="grid grid-cols-2 gap-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div><Skeleton className="h-11 w-full" /></div></>;
  if (!categories.length) return <>{header}<ForbiddenState title="ยังไม่มีหมวดงานในระบบ ติดต่อ Admin" />{discard}</>;
  const panel = (index: number, children: ReactNode) => {
    const done = sectionDone[index];
    const failing = sectionErrors[index];
    return <section id={`report-step-${index}`} className={cn("space-y-5 lg:block lg:space-y-4 lg:rounded-xl lg:bg-card lg:p-5 lg:shadow-card", failing > 0 && "lg:ring-2 lg:ring-destructive", step !== index && "hidden")}>
      <h2 tabIndex={-1} className="flex items-center font-heading text-lg font-semibold outline-none lg:text-base">
        <span aria-hidden className={cn("mr-2.5 hidden size-7 items-center justify-center rounded-full text-sm lg:inline-flex", failing > 0 ? "bg-destructive text-white" : done ? "bg-success text-white" : "bg-secondary text-primary")}>{done && !failing ? <Check className="size-4" strokeWidth={3} /> : index + 1}</span>
        <span className="flex-1">{STEPS[index]}</span>
        {failing > 0 ? <span className="hidden items-center gap-1 font-sans text-xs font-medium text-destructive lg:inline-flex"><CircleAlert className="size-4" aria-hidden />ต้องแก้ {failing} ช่อง</span>
          : done && <span className="hidden items-center gap-1 font-sans text-xs font-medium text-success lg:inline-flex"><Check className="size-4" aria-hidden />ครบแล้ว</span>}
      </h2>{children}</section>;
  };
  return <>{header}
    <div className="border-b bg-card px-4 py-3 lg:hidden"><p className="mb-2 text-xs text-muted-foreground" aria-live="polite">ขั้นที่ {step + 1} จาก 4</p><div className="flex gap-1.5" role="progressbar" aria-label={`ขั้นที่ ${step + 1} จาก 4`} aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={4}>{STEPS.map((_, i) => <span key={i} className={cn("h-1.5 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />)}</div></div>
    <form onSubmit={submit} noValidate className="mx-auto max-w-190 px-4 pt-5 pb-28 lg:max-w-250 lg:px-0 lg:pt-0 lg:pb-0 xl:flex xl:items-start xl:gap-4.5"><div className="min-w-0 flex-1 space-y-5 lg:space-y-3">
      {submitError && <Alert variant="destructive"><AlertCircle /><AlertTitle>{submitError === "ข้อมูลบางอย่างเปลี่ยนไป กรุณาเลือกใหม่" ? submitError : "ส่งไม่สำเร็จ"}</AlertTitle><AlertDescription>{submitError !== "ข้อมูลบางอย่างเปลี่ยนไป กรุณาเลือกใหม่" && submitError}</AlertDescription></Alert>}
      {masterError && <ErrorState variant="inline" onRetry={() => setRevision((r) => r + 1)} />}
      <fieldset disabled={busy || masterReloading} className="min-w-0 space-y-5 disabled:opacity-70">
        {panel(0, <>
          <FormField name="categoryId" label="หมวดงาน" required error={errors.categoryId}><RadioGroup id="categoryId" value={values.categoryId} onValueChange={(v) => update("categoryId", v)} aria-labelledby="categoryId-label" aria-describedby="categoryId-error" aria-invalid={!!errors.categoryId} className="grid grid-cols-2 gap-3 lg:grid-cols-5 lg:gap-2">{categories.map((c) => {
            const Icon = ICONS[c.icon] ?? Wrench; const selected = c.id === values.categoryId;
            return <label key={c.id} className={cn("relative flex min-h-18 cursor-pointer items-center gap-2 rounded-lg border bg-card p-3 focus-within:ring-2 focus-within:ring-ring lg:min-h-21 lg:flex-col lg:justify-center lg:gap-1.5 lg:px-1.5 lg:py-2.5 lg:text-center", selected ? "border-primary bg-secondary ring-1 ring-primary" : errors.categoryId ? "border-destructive" : "border-border")}><RadioGroupItem value={c.id} className="sr-only" /><span className="grid size-10 shrink-0 place-items-center rounded-full bg-svc-repair/10 text-priority-high lg:size-9"><Icon className="size-5" aria-hidden /></span><span className="min-w-0 text-sm leading-5 font-semibold lg:text-xs lg:leading-4">{c.name}</span>{selected && <span className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-primary text-white"><Check className="size-3" aria-hidden /></span>}</label>;
          })}</RadioGroup></FormField>
          <FormField name="symptomIds" label="อาการ" required error={errors.symptomIds}><p className="text-xs text-muted-foreground">เลือกได้หลายข้อ</p>{category ? <ToggleGroup id="symptomIds" type="multiple" value={values.symptomIds} onValueChange={(v) => update("symptomIds", v)} aria-labelledby="symptomIds-label" aria-describedby="symptomIds-error" className="flex w-full flex-wrap justify-start gap-2">{category.symptoms.map((s) => <ToggleGroupItem key={s.id} value={s.id} aria-label={s.name} className="min-h-11 flex-none rounded-full border border-input bg-card px-4 text-sm lg:min-h-10 data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:text-white">{values.symptomIds.includes(s.id) && <Check className="size-4" aria-hidden />}{s.name}</ToggleGroupItem>)}</ToggleGroup> : <p className="rounded-sm bg-muted/60 p-4 text-sm text-muted-foreground">เลือกหมวดงานก่อน แล้วอาการจะแสดงที่นี่</p>}</FormField>
        </>)}
        {panel(1, <>
          <FormField name="buildingId" label="อาคาร" required error={errors.buildingId}><ChoiceField id="buildingId" title="อาคาร" placeholder="เลือกอาคาร" icon={Building2} value={values.buildingId} onValueChange={(v) => update("buildingId", v)}
            options={buildings.map((b) => ({ value: b.id, label: b.name }))} invalid={!!errors.buildingId} aria-labelledby="buildingId-label" aria-describedby="buildingId-error" searchPlaceholder="ค้นหาอาคาร" emptyText="ไม่พบอาคารที่ค้นหา" /></FormField>
          <FormField name="floorId" label="ชั้น" required error={errors.floorId}><ChoiceField id="floorId" title="เลือกชั้น" context={building?.name} placeholder="เลือกชั้น" icon={Layers} value={values.floorId} onValueChange={(v) => update("floorId", v)}
            options={(building?.floors ?? []).map((f) => ({ value: f.id, label: `ชั้น ${f.name}` }))} shortLabel={(o) => o.label.replace(/^ชั้น /, "")} emptyHint="เลือกอาคารก่อน"
            invalid={!!errors.floorId} aria-labelledby="floorId-label" aria-describedby="floorId-error" searchPlaceholder="ค้นหาชั้น" emptyText="ไม่พบชั้นที่ค้นหา" /></FormField>
          <FormField name="locationDetail" label="จุดที่เกิด" error={errors.locationDetail}><Input id="locationDetail" value={values.locationDetail} onChange={(e) => update("locationDetail", e.target.value)} maxLength={100} placeholder="เช่น ห้องประชุม 5B ฝั่งหน้าต่าง" aria-describedby="locationDetail-hint locationDetail-error" aria-invalid={!!errors.locationDetail} className="h-13 rounded-sm bg-card px-4" /><p id="locationDetail-hint" className="text-xs text-muted-foreground">บอกจุดที่ช่างหาเจอง่าย</p></FormField>
        </>)}
        {panel(2, <>
          <FormField name="photoIds" label="รูปภาพ" required error={errors.photoIds}><p id="photo-hint" className="text-xs text-muted-foreground">อย่างน้อย 1 รูป สูงสุด 5 รูป</p><PhotoPicker value={photos} onChange={(value) => { setPhotos(value); setServerErrors((old) => { const next = { ...old }; delete next.photoIds; return next; }); }} disabled={busy} invalid={!!errors.photoIds} /></FormField>
          <FormField name="details" label="รายละเอียด" error={errors.details}><Textarea id="details" value={values.details} onChange={(e) => update("details", e.target.value)} rows={4} maxLength={500} placeholder="เล่าเพิ่มเติม เช่น เริ่มเป็นตั้งแต่เมื่อไร" aria-describedby="details-error details-count" aria-invalid={!!errors.details} className="min-h-28 rounded-sm bg-card p-4 lg:min-h-20" /><p id="details-count" className="text-right text-xs text-muted-foreground">{values.details.length}/500</p></FormField>
        </>)}
        {panel(3, <>
          <FormField name="priority" label="ความเร่งด่วน" required error={errors.priority}><RadioGroup id="priority" value={values.priority} onValueChange={(v) => update("priority", v as Priority)} aria-labelledby="priority-label" aria-describedby="priority-error" className="gap-2 lg:grid-cols-4">{PRIORITIES.map((p) => <label key={p} className={cn("flex min-h-16 cursor-pointer items-center gap-3 rounded-lg border bg-card p-4 focus-within:ring-2 focus-within:ring-ring lg:items-start lg:gap-2 lg:p-3", p === values.priority ? "border-primary ring-1 ring-primary" : "border-border")}><span className="flex-1"><PriorityIndicator priority={p} /><span className="mt-1 block text-xs text-muted-foreground">{HINTS[p]}</span></span><RadioGroupItem value={p} aria-label={p === "critical" ? "ฉุกเฉิน" : p === "high" ? "สูง" : p === "medium" ? "ปกติ" : "ต่ำ"} /></label>)}</RadioGroup></FormField>
          <Card className="gap-3 p-4 shadow-card lg:hidden"><h3 className="font-heading text-base font-semibold">ตรวจสอบก่อนส่ง</h3><dl className="space-y-3 text-sm">{[
            ["หมวดงาน", category?.name, 0], ["อาการ", category?.symptoms.filter((s) => values.symptomIds.includes(s.id)).map((s) => s.name).join(" · "), 0],
            ["สถานที่", `${building?.name ?? ""} ชั้น ${building?.floors.find((f) => f.id === values.floorId)?.name ?? ""}${values.locationDetail ? ` · ${values.locationDetail}` : ""}`, 1],
            ["รูปภาพ", `${photos.length} รูป`, 2],
          ].map(([label, value, target]) => <div key={String(label)} className="flex items-start gap-2"><dt className="w-16 shrink-0 pt-3 text-muted-foreground">{label}</dt><dd className="min-w-0 flex-1 break-words pt-3">{value}</dd><Button type="button" variant="link" className="h-11 px-0" onClick={() => goToStep(Number(target))} aria-label={`แก้ไข${label}`}>แก้ไข</Button></div>)}</dl><PhotoGallery photos={photos.flatMap((p) => p.photo ? [p.photo] : [])} /></Card>
        </>)}
      </fieldset>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 rounded-t-2xl border-t bg-card px-4 py-3 pb-6 shadow-nav lg:hidden">
        <div className="mx-auto w-full max-w-132"><Button type="submit" variant={step === 3 ? "brand" : "default"} disabled={busy || masterReloading} className="w-full">{busy ? <Loader2 className="animate-spin" aria-hidden /> : step === 3 && <Wrench aria-hidden />}{step === 3 ? "ส่งแจ้งซ่อม" : "ถัดไป"}</Button></div>
      </div>
      {/* Desktop below xl: sticky bottom bar instead of the side panel (CR-002). */}
      <div className="sticky bottom-4 z-20 mt-4 hidden items-center gap-3 rounded-xl bg-card p-3 pl-5 shadow-float lg:flex xl:hidden">
        <span className="text-sm text-muted-foreground">ครบ {doneCount} จาก 4</span><span className="flex-1" />
        <Button type="button" variant="ghost" onClick={() => guard.leave()} disabled={busy}>ยกเลิก</Button>
        <Button type="submit" variant="brand" disabled={busy || masterReloading}>{busy ? <Loader2 className="animate-spin" aria-hidden /> : <Wrench aria-hidden />}ส่งแจ้งซ่อม</Button>
      </div>
      <aside aria-label="สรุปการแจ้งซ่อม" className="sticky top-5 hidden w-79 shrink-0 space-y-3 rounded-xl bg-card p-4.5 shadow-float xl:block">
        <h2 className="font-heading text-lg font-semibold">สรุปการแจ้งซ่อม</h2>
        <div className="flex items-center gap-2.5 text-xs text-muted-foreground"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="ความครบของฟอร์ม" aria-valuenow={doneCount} aria-valuemin={0} aria-valuemax={4}><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${doneCount * 25}%` }} /></div>ครบ {doneCount} จาก 4</div>
        <ul className="divide-y">{summaryRows.map((row) => <li key={row.label}><button type="button" onClick={() => goToStep(row.step, row.field)} className="flex w-full items-start gap-2.5 rounded-sm py-2.5 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring">
          <span aria-hidden className={cn("mt-0.5 grid size-5.5 shrink-0 place-items-center rounded-full", row.done ? "bg-success text-white" : row.attempted ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning")}>{row.done ? <Check className="size-3.5" strokeWidth={3} /> : <CircleAlert className="size-3.5" />}</span>
          <span className="min-w-0 flex-1"><span className="block text-xs text-muted-foreground">{row.label}</span><span className={cn("block text-sm leading-5 break-words", !row.done && "font-medium", !row.done && (row.attempted ? "text-destructive" : "text-warning"))}>{row.value}</span></span>
        </button></li>)}</ul>
        {category && <p className="flex gap-2 rounded-sm bg-secondary p-3 text-xs leading-5 text-secondary-foreground"><Info className="mt-0.5 size-4 shrink-0" aria-hidden />ส่งแล้วงานจะถึงช่างทันที ช่างจะประเมินและแจ้งวันที่คาดว่าจะเสร็จ</p>}
        <Button type="submit" variant="brand" disabled={busy || masterReloading} className="w-full">{busy ? <Loader2 className="animate-spin" aria-hidden /> : <Wrench aria-hidden />}ส่งแจ้งซ่อม</Button>
        <Button type="button" variant="ghost" className="w-full" onClick={() => guard.leave()} disabled={busy}>ยกเลิก</Button>
      </aside>
    </form>{discard}
  </>;
}
