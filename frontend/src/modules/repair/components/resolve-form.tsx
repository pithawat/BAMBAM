"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CalendarClock, ClipboardCheck, HardHat, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { ForbiddenState } from "@/components/shared/states";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { resolveTicket } from "../api";
import { errorCode, errorMessage, fieldErrors, resolveFieldMessages } from "../errors";
import type { TicketDetail } from "../types";
import { PhotoPicker, type PhotoItem } from "./photo-picker";
import { StarInput } from "./ticket-actions";
import { dayLabel, ticketHref, ticketLocation, ticketTitle, workByText } from "./ticket-presentation";
import { CopyTicketNumber, TicketFailure, TicketSkeleton } from "./ticket-ui";
import { useTicket } from "./use-ticket";

// S10 บันทึกผลซ่อม (CR-005, CR-006): what was done + result photos. Who does the work was decided
// in the assessment (S17); for a contractor job the technician rates the contractor here
// (BR-F21-4, BR-F24-3) — once per job, a second resolve after a send back keeps the first rating.

export function ResolveScreen({ id }: { id: string }) {
  const { ticket, loading, error, reload } = useTicket(id);
  return <>
    <PageHeader title="บันทึกผลซ่อม" variant="bar" backHref={ticketHref(id)} />
    {loading ? <TicketSkeleton /> : error ? <TicketFailure error={error} onRetry={reload} /> : ticket && (ticket.allowedActions.includes("resolve")
      ? <ResolveForm ticket={ticket} />
      : <ForbiddenState title="บันทึกผลงานนี้ไม่ได้ตอนนี้" reason={ticket.blockedActions.resolve ? "ประเมินงาน (วันที่คาดว่าจะเสร็จ และผู้ดำเนินการ) ก่อนบันทึกผล" : "งานนี้ไม่ได้อยู่ระหว่างซ่อม หรือคุณไม่ใช่ช่าง"} />)}
  </>;
}

function ResolveForm({ ticket }: { ticket: TicketDetail }) {
  const router = useRouter();
  const contractorJob = ticket.workBy === "contractor";
  const alreadyRated = !!ticket.result?.contractorRating;
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [busy, setBusy] = useState(false);
  function validate() {
    const e: Record<string, string> = {};
    if (!note.trim()) e.note = "กรุณาบอกสิ่งที่ทำ";
    if (photos.some((p) => p.status === "uploading")) e.photoIds = "รอให้รูปอัปโหลดเสร็จก่อน";
    else if (photos.some((p) => p.status === "failed")) e.photoIds = "มีรูปที่อัปโหลดไม่สำเร็จ ลองใหม่หรือลบรูปนั้น";
    else if (!photos.length) e.photoIds = "แนบรูปหลังซ่อมอย่างน้อย 1 รูป";
    if (contractorJob && !alreadyRated && !rating) e.contractorRating = "ให้คะแนนช่างภายนอก";
    return e;
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const e = validate();
    setErrors(e); setSubmitError("");
    if (Object.keys(e).length) { document.querySelector<HTMLElement>(`[data-field="${Object.keys(e)[0]}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }); return; }
    setBusy(true);
    try {
      await resolveTicket(ticket.id, {
        note: note.trim(), photoIds: photos.map((p) => p.photo!.id),
        ...(contractorJob && rating ? { contractorRating: rating, contractorRatingComment: comment.trim() || undefined } : {}),
      });
      toast.success("บันทึกผลซ่อมแล้ว ผู้แจ้งจะได้รับแจ้งให้ประเมิน");
      router.replace(ticketHref(ticket.id));
    } catch (err) {
      const fields = fieldErrors(err, resolveFieldMessages);
      setErrors(fields);
      setSubmitError(Object.keys(fields).length ? "" : errorMessage(err, { ticketClosed: "resolve" }));
      if (errorCode(err) === "TICKET_CLOSED" || errorCode(err) === "INVALID_STATE") setTimeout(() => router.replace(ticketHref(ticket.id)), 1500);
      setBusy(false);
    }
  }
  const err = (name: string) => errors[name] && <p id={`${name}-error`} role="alert" className="flex items-start gap-1 text-sm text-destructive"><AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />{errors[name]}</p>;
  return <form onSubmit={submit} noValidate className="mx-auto max-w-190 space-y-3 px-4 py-4 pb-28 lg:px-0 lg:py-0 lg:pb-0">
    <Card className="gap-1 p-4 shadow-card"><CopyTicketNumber value={ticket.ticketNo} /><h2 className="font-heading text-base font-semibold">{ticketTitle(ticket)}</h2>
      <p className="flex items-start gap-1.5 text-sm text-muted-foreground"><MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />{ticketLocation(ticket)}</p>
      <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {ticket.expectedDoneOn && <span className="inline-flex items-center gap-1.5 text-status-in-progress"><CalendarClock className="size-4" aria-hidden />คาดว่าจะเสร็จ {dayLabel(ticket.expectedDoneOn, true)}</span>}
        <span className="inline-flex items-center gap-1.5"><HardHat className="size-4 text-muted-foreground" aria-hidden />{workByText(ticket)}</span></p>
      <p className="text-xs text-muted-foreground">เปลี่ยนผู้ดำเนินการได้ที่ปุ่ม แก้การประเมิน ในหน้ารายละเอียดงาน</p></Card>
    {submitError && <Alert variant="destructive"><AlertCircle /><AlertTitle>บันทึกไม่สำเร็จ</AlertTitle><AlertDescription>{submitError}</AlertDescription></Alert>}
    <fieldset disabled={busy} className="space-y-3 disabled:opacity-70">
      <Card className="gap-4 p-4 shadow-card lg:p-5">
        <div data-field="note" className="space-y-2"><label htmlFor="note" className="text-sm font-medium">สิ่งที่ทำ<span className="text-destructive">*</span></label>
          <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={4} placeholder="เช่น เปลี่ยนคาปาซิเตอร์คอมเพรสเซอร์ ทดสอบเปิด 30 นาที เย็นปกติ" aria-invalid={!!errors.note} aria-describedby="note-error" />
          <p className="text-right text-xs text-muted-foreground">{note.length}/500</p>{err("note")}</div>
        <div data-field="photoIds" className="space-y-2"><p className="text-sm font-medium">รูปหลังซ่อม<span className="text-destructive">*</span> <span className="font-normal text-muted-foreground">อย่างน้อย 1 รูป สูงสุด 5 รูป</span></p>
          <PhotoPicker value={photos} onChange={setPhotos} disabled={busy} invalid={!!errors.photoIds} />{err("photoIds")}</div>
      </Card>
      {contractorJob && <Card className="gap-4 p-4 shadow-card lg:p-5">
        <div data-field="contractorRating" className="space-y-1"><p className="text-sm font-medium">คะแนนช่างภายนอก{!alreadyRated && <span className="text-destructive">*</span>} <span className="font-normal text-muted-foreground">เห็นเฉพาะช่าง Admin และผู้บริหาร</span></p>
          {alreadyRated && <p className="text-xs text-muted-foreground">ให้คะแนนไว้แล้ว {ticket.result?.contractorRating} ดาว — ให้ใหม่เพื่อแทนที่ หรือปล่อยว่างเพื่อใช้คะแนนเดิม</p>}
          <StarInput id="contractorRating" value={rating} onChange={(n) => { setRating(n); setErrors((e) => { const x = { ...e }; delete x.contractorRating; return x; }); }} invalid={!!errors.contractorRating} describedBy="contractorRating-error" />
          {err("contractorRating")}</div>
        <div className="space-y-2"><label htmlFor="contractorRatingComment" className="text-sm font-medium">ความเห็นต่อช่างภายนอก</label>
          <Textarea id="contractorRatingComment" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} rows={2} placeholder="เช่น มาตรงเวลา งานเรียบร้อย" />{err("contractorRatingComment")}</div>
      </Card>}
    </fieldset>
    <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card px-4 py-3 pb-6 shadow-nav lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
      <div className="mx-auto flex max-w-190 gap-2"><Button asChild variant="ghost" className="hidden lg:inline-flex"><Link href={ticketHref(ticket.id)}>ยกเลิก</Link></Button><span className="hidden flex-1 lg:block" />
        <Button type="submit" disabled={busy} className="w-full lg:w-auto">{busy ? <Loader2 className="animate-spin" aria-hidden /> : <ClipboardCheck aria-hidden />}บันทึกผลซ่อม</Button></div>
    </div>
  </form>;
}
