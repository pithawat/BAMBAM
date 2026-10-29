"use client";

/* eslint-disable @next/next/no-img-element -- Authenticated API paths and blob previews require plain images (HANDOFF). */
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Camera, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { ForbiddenState } from "@/components/shared/states";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MAX_PHOTOS, resolveTicket } from "../api";
import { errorCode, errorMessage, fieldErrors, resolveFieldMessages } from "../errors";
import type { TicketDetail } from "../types";
import { PhotoLightbox } from "./photo-gallery";
import { PhotoTile, usePhotoUploads, type PhotoItem } from "./photo-picker";
import { StarInput } from "./star-input";
import { ticketHref, ticketTitle } from "./ticket-presentation";
import { TicketFailure, TicketSkeleton } from "./ticket-ui";
import { useTicket } from "./use-ticket";

// S10 บันทึกผลซ่อม (CR-005, CR-006, CR-008): after photos + what was done. Opened as a sheet from the
// S07 action card; this page stays for direct links. Who does the work was set in S17; for a
// contractor job the technician rates the contractor here (BR-F21-4, BR-F24-3).

export const RESOLVED_TOAST = "ส่งผลแล้ว ผู้แจ้งจะได้รับแจ้งเตือนให้ประเมินตรวจงาน";

export function ResolveScreen({ id }: { id: string }) {
  const router = useRouter();
  const { ticket, loading, error, reload } = useTicket(id);
  const rework = ticket?.step === "reworking";
  return <>
    <PageHeader title={rework ? "บันทึกผลการแก้ไข" : "บันทึกผลซ่อม"} variant="bar" backHref={ticketHref(id)} />
    {loading ? <TicketSkeleton /> : error ? <TicketFailure error={error} onRetry={reload} /> : ticket && (ticket.allowedActions.includes("resolve")
      ? <div className="mx-auto max-w-170 px-3 py-4 sm:px-4 lg:px-0 lg:py-0"><div className="rounded-xl border bg-card p-4 shadow-card sm:p-6">
        <p className="mb-1 text-xs text-muted-foreground">{ticket.ticketNo}</p><h2 className="mb-3 text-lg font-semibold">{ticketTitle(ticket)}</h2>
        <ResolveFields ticket={ticket} onDone={() => { toast.success(RESOLVED_TOAST); router.replace(ticketHref(ticket.id)); }} cancel={<Button asChild variant="outline" className="h-12"><Link href={ticketHref(ticket.id)}>ยกเลิก</Link></Button>} />
      </div></div>
      : <ForbiddenState title="บันทึกผลงานนี้ไม่ได้ตอนนี้" reason={ticket.blockedActions.resolve ? "กดเริ่มดำเนินการ (กำหนดวันที่คาดว่าจะเสร็จ และใครซ่อม) ก่อนบันทึกผล" : "งานนี้ไม่ได้อยู่ระหว่างซ่อม หรือคุณไม่ใช่ช่าง"} />)}
  </>;
}

/** The S10 fields + submit, shared by the sheet (ticket-actions) and the page. */
export function ResolveFields({ ticket, onDone, cancel, onStale }: { ticket: TicketDetail; onDone: (t: TicketDetail) => void; cancel: React.ReactNode; onStale?: () => void }) {
  const contractorJob = ticket.workBy === "contractor";
  const alreadyRated = !!ticket.result?.contractorRating;
  const camera = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState<{ list: "before" | "after"; index: number } | null>(null);
  const uploads = usePhotoUploads(photos, (next) => { setPhotos(next); setErrors((e) => { const x = { ...e }; delete x.photoIds; return x; }); }, busy);
  const before = ticket.photos[0];
  const after = photos.filter((p) => p.status === "done" && p.photo).map((p) => p.photo!);

  function validate() {
    const e: Record<string, string> = {};
    if (photos.some((p) => p.status === "uploading")) e.photoIds = "รอให้รูปอัปโหลดเสร็จก่อน";
    else if (photos.some((p) => p.status === "failed")) e.photoIds = "มีรูปที่อัปโหลดไม่สำเร็จ ลองใหม่หรือลบรูปนั้น";
    else if (!photos.length) e.photoIds = "ถ่ายหรือแนบรูปหลังซ่อมอย่างน้อย 1 รูป";
    if (!note.trim()) e.note = "บอกสิ่งที่ทำ";
    if (contractorJob && !alreadyRated && !rating) e.contractorRating = "ให้คะแนนช่างภายนอก";
    return e;
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    const e = validate();
    setErrors(e); setSubmitError("");
    if (Object.keys(e).length) { document.querySelector<HTMLElement>(`[data-resolve-field="${Object.keys(e)[0]}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }); return; }
    setBusy(true);
    try {
      onDone(await resolveTicket(ticket.id, {
        note: note.trim(), photoIds: after.map((p) => p.id),
        ...(contractorJob && rating ? { contractorRating: rating, contractorRatingComment: comment.trim() || undefined } : {}),
      }));
    } catch (err) {
      const fields = fieldErrors(err, resolveFieldMessages);
      setErrors(fields);
      setSubmitError(Object.keys(fields).length ? "" : errorMessage(err, { ticketClosed: "resolve" }));
      if (errorCode(err) === "TICKET_CLOSED" || errorCode(err) === "INVALID_STATE") onStale?.();
    } finally { setBusy(false); }
  }
  const err = (name: string) => errors[name] && <p id={`${name}-error`} role="alert" className="mt-1.5 flex items-start gap-1 text-sm text-destructive"><AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />{errors[name]}</p>;
  return <form onSubmit={submit} noValidate className="space-y-4">
    {submitError && <Alert variant="destructive"><AlertCircle /><AlertTitle>บันทึกไม่สำเร็จ</AlertTitle><AlertDescription>{submitError}</AlertDescription></Alert>}
    <fieldset disabled={busy} className="space-y-4 disabled:opacity-70">
      <div className="grid gap-3 sm:grid-cols-2">
        {before && <div><p className="mb-1.5 text-[13.5px] font-medium text-muted-foreground">ก่อนซ่อม · จากผู้แจ้ง</p>
          <button type="button" onClick={() => setOpened({ list: "before", index: 0 })} className="block aspect-2/1 w-full overflow-hidden rounded-lg border bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="ดูรูปก่อนซ่อม"><img src={before.thumbUrl} alt="รูปก่อนซ่อม" className="size-full object-cover" /></button></div>}
        <div data-resolve-field="photoIds">
          <p className="mb-1.5 text-[13.5px] font-medium text-muted-foreground">หลังซ่อม <span className="text-destructive">*</span>{photos.length > 0 && <span className="font-normal"> {photos.length}/{MAX_PHOTOS} รูป</span>}</p>
          <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { uploads.choose(e.target.files); e.target.value = ""; }} />
          {photos.length === 0
            ? <button type="button" onClick={() => camera.current?.click()} aria-describedby="photoIds-error resolve-photo-hint"
              className={cn("flex aspect-2/1 w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed bg-secondary/50 text-[15px] font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring", errors.photoIds ? "border-destructive" : "border-primary/30")}>
              <Camera className="size-7" aria-hidden />ถ่ายรูปหลังซ่อม</button>
            : <>
              <div className="grid grid-cols-3 gap-2">{photos.map((item, i) => <PhotoTile key={item.key} item={item} index={i} className="aspect-square" onOpen={() => setOpened({ list: "after", index: after.findIndex((p) => p.id === item.photo?.id) })} onRetry={() => uploads.retry(item)} onRemove={() => uploads.remove(item)} />)}</div>
              {!uploads.full && <Button type="button" variant="link" className="h-11 px-0" onClick={() => camera.current?.click()}><Camera aria-hidden />ถ่ายเพิ่ม</Button>}
            </>}
          <p id="resolve-photo-hint" className="mt-1.5 text-[13.5px] text-muted-foreground">ถ่ายมุมเดียวกับรูปก่อนซ่อม ผู้แจ้งจะเทียบได้ทันที</p>
          {uploads.message && <p role="alert" className="mt-1.5 text-sm text-destructive">{uploads.message}</p>}
          {err("photoIds")}
        </div>
      </div>
      <div data-resolve-field="note"><label htmlFor="resolve-note" className="mb-1.5 block text-[15px] font-semibold">ทำอะไรไป <span className="text-destructive">*</span></label>
        <Textarea id="resolve-note" value={note} onChange={(e) => { setNote(e.target.value); setErrors((x) => { const n = { ...x }; delete n.note; return n; }); }} maxLength={500} rows={3} placeholder="เช่น ล้างแผงคอยล์เย็น เปลี่ยนท่อน้ำทิ้งที่แตก" aria-invalid={!!errors.note} aria-describedby="note-error" className="rounded-sm bg-card px-3.5 py-2.5 text-base" />
        {err("note")}</div>
      {contractorJob && <div data-resolve-field="contractorRating" className="space-y-2">
        <p className="text-[15px] font-semibold">คะแนนช่างภายนอก{!alreadyRated && <span className="text-destructive"> *</span>} <span className="text-xs font-normal text-muted-foreground">เห็นเฉพาะช่าง Admin และผู้บริหาร</span></p>
        {alreadyRated && <p className="text-xs text-muted-foreground">ให้คะแนนไว้แล้ว {ticket.result?.contractorRating} ดาว — ให้ใหม่เพื่อแทนที่ หรือปล่อยว่างเพื่อใช้คะแนนเดิม</p>}
        <StarInput id="contractorRating" value={rating} onChange={(n) => { setRating(n); setErrors((e) => { const x = { ...e }; delete x.contractorRating; return x; }); }} invalid={!!errors.contractorRating} describedBy="contractorRating-error" size="sm" />
        {err("contractorRating")}
        <Textarea aria-label="ความเห็นต่อช่างภายนอก" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} rows={2} placeholder="ความเห็นต่อช่างภายนอก (ไม่บังคับ) เช่น มาตรงเวลา งานเรียบร้อย" className="rounded-sm bg-card px-3.5 py-2.5 text-base" />
        {err("contractorRatingComment")}
      </div>}
    </fieldset>
    <div className="flex justify-end gap-2 pt-1">{cancel}<Button type="submit" className="h-12 min-w-40" disabled={busy}>{busy ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}ส่งผลการซ่อม</Button></div>
    <PhotoLightbox photos={opened?.list === "before" ? ticket.photos : after} index={opened && opened.index >= 0 ? opened.index : null} onIndexChange={(i) => setOpened(i === null ? null : { list: opened?.list ?? "after", index: i })} />
  </form>;
}
