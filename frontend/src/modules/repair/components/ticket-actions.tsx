"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, ArrowRight, HardHat, Info, Loader2, Plus, Star, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Picker } from "@/components/shared/picker";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { assessTicket, closeTicket, confirmTicket, getContractors, sendBackTicket } from "../api";
import { assessFieldMessages, errorCode, errorMessage, fieldErrors, reviewFieldMessages } from "../errors";
import type { Contractor, TicketDetail, WorkBy } from "../types";
import { ContractorFormDialog } from "./contractors";
import { PhotoPicker, type PhotoItem } from "./photo-picker";
import { RESOLVED_TOAST, ResolveFields } from "./resolve-form";
import { addDays, dayLabel, RATING_LABELS, shortDate, ticketLocation, ticketTitle, todayBangkok } from "./ticket-presentation";

// S07 dialogs (CR-005, CR-008, wording CR-009). The server decides the actions (`allowedActions`); the S07
// next-action card opens these: technician → เริ่มดำเนินการ / เลื่อนวันเสร็จ (S17), บันทึกผลซ่อม (S10 sheet)
//                               reporter   → ประเมินตรวจงาน (S08, empty stars or the star tapped) / ส่งกลับให้แก้
//                               admin      → ปิดงาน (F08-B, Stage 3; also on S11)

type Open = { kind: "assess" } | { kind: "confirm"; score: number } | { kind: "send_back" } | { kind: "resolve" } | { kind: "close" } | null;

export function useTicketActions(ticket: TicketDetail, onChanged: (t: TicketDetail) => void, opts: { awaitingReaccept: boolean }) {
  const [open, setOpen] = useState<Open>(null);
  const search = useSearchParams();
  const allowed = new Set(ticket.allowedActions);
  // Deep links from S06: ?action=confirm | sendback opens the dialog once.
  useEffect(() => {
    const action = search.get("action");
    if (!action) return;
    const url = new URL(window.location.href); url.searchParams.delete("action");
    window.history.replaceState(null, "", url.pathname + url.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot: open the dialog the link asked for
    if (action === "confirm" && ticket.allowedActions.includes("confirm")) setOpen({ kind: "confirm", score: 0 });
    else if (action === "sendback" && ticket.allowedActions.includes("send_back")) setOpen({ kind: "send_back" });
  }, [search, ticket.allowedActions]);

  const done = (t: TicketDetail, message: string) => { setOpen(null); onChanged(t); toast.success(message); };
  const close = (o: boolean) => { if (!o) setOpen(null); };
  const firstAssess = !ticket.expectedDoneOn || !ticket.workBy;
  const dialogs = <>
    {allowed.has("assess") && <AssessDialog ticket={ticket} open={open?.kind === "assess"} onOpenChange={close} reaccept={opts.awaitingReaccept}
      onDone={(t) => done(t, firstAssess ? "เริ่มดำเนินการแล้ว ผู้แจ้งจะได้รับแจ้งเตือนวันที่คาดว่าจะเสร็จ" : "บันทึกวันใหม่แล้ว ผู้แจ้งจะได้รับแจ้งเตือน")} />}
    {allowed.has("resolve") && <ResolveDialog ticket={ticket} open={open?.kind === "resolve"} onOpenChange={close} onDone={(t) => done(t, RESOLVED_TOAST)} />}
    {allowed.has("confirm") && <ConfirmDialog ticket={ticket} open={open?.kind === "confirm"} initial={open?.kind === "confirm" ? open.score : 0} onOpenChange={close}
      onSendBack={() => setOpen({ kind: "send_back" })} onDone={(t) => done(t, "ขอบคุณที่ประเมินตรวจงาน งานนี้ปิดแล้ว")} />}
    {allowed.has("send_back") && <SendBackDialog ticket={ticket} open={open?.kind === "send_back"} onOpenChange={close} onDone={(t) => done(t, "ส่งกลับให้ช่างแล้ว ช่างจะได้รับแจ้งเตือน")} />}
    {allowed.has("close") && <CloseTicketDialog ticket={ticket} open={open?.kind === "close"} onOpenChange={close} onDone={(t) => done(t, CLOSED_TOAST)} />}
  </>;
  return {
    allowed,
    assess: () => setOpen({ kind: "assess" }),
    resolve: () => setOpen({ kind: "resolve" }),
    confirm: (score = 0) => setOpen({ kind: "confirm", score }),
    sendBack: () => setOpen({ kind: "send_back" }),
    close: () => setOpen({ kind: "close" }),
    dialogs,
  };
}

type DialogProps = { ticket: TicketDetail; open: boolean; onOpenChange: (open: boolean) => void; onDone: (t: TicketDetail) => void };

/** Bottom sheet on phones, centred dialog from `sm` (design-system.md "Dialog / sheet"). */
const sheetLike = "top-auto bottom-0 max-h-[92dvh] w-full max-w-none translate-y-0 overflow-y-auto rounded-b-none rounded-t-xl sm:top-1/2 sm:bottom-auto sm:max-w-lg sm:-translate-y-1/2 sm:rounded-xl";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} role="alert" className="flex items-start gap-1 text-sm text-destructive"><AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />{message}</p>;
}

/** Thrown action errors other than field errors → toast; returns field errors to show. */
function handleError(err: unknown, onStale: () => void): Record<string, string> {
  const fields = fieldErrors(err, { ...reviewFieldMessages, ...assessFieldMessages });
  if (Object.keys(fields).length) return fields;
  const code = errorCode(err);
  toast.error(errorMessage(err));
  if (code === "TICKET_CLOSED" || code === "INVALID_STATE") onStale();
  return {};
}

// ---- S17 เริ่มดำเนินการ / เลื่อนวันเสร็จ (CR-005, CR-006, CR-008 date chips + reason, CR-009 wording) ----

const WORK_BY = [{ value: "in_house", label: "ช่างของบริษัท" }, { value: "contractor", label: "ช่างภายนอก" }];

function AssessDialog({ ticket, open, onOpenChange, onDone, reaccept }: DialogProps & { reaccept: boolean }) {
  const today = todayBangkok();
  const first = !ticket.expectedDoneOn || !ticket.workBy;
  const chips = [
    { key: "today", label: "วันนี้", day: today },
    { key: "tomorrow", label: "พรุ่งนี้", day: addDays(today, 1) },
    { key: "plus3", label: "อีก 3 วัน", day: addDays(today, 3) },
  ];
  const [chip, setChip] = useState("");
  const [picked, setPicked] = useState("");
  const [workBy, setWorkBy] = useState<WorkBy>(ticket.workBy ?? "in_house");
  const [contractorId, setContractorId] = useState(ticket.contractor?.id ?? "");
  const [reason, setReason] = useState("");
  const [contractors, setContractors] = useState<Contractor[]>();
  const [adding, setAdding] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    getContractors({ pageSize: 100 }).then((p) => setContractors(p.items), () => setContractors([]));
  }, [open]);
  const day = chip === "pick" ? picked : chips.find((c) => c.key === chip)?.day ?? "";
  const clear = (name: string) => setErrors((e) => { const n = { ...e }; delete n[name]; return n; });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    const local: Record<string, string> = {};
    if (!day) local.expectedDoneOn = "เลือกวันที่คาดว่าจะเสร็จ";
    else if (day < today) local.expectedDoneOn = "เลือกวันนี้หรือหลังจากนี้";
    if (workBy === "contractor" && !contractorId) local.contractorId = "เลือกช่างภายนอก";
    if (Object.keys(local).length) { setErrors(local); return; }
    setBusy(true); setErrors({});
    try {
      onDone(await assessTicket(ticket.id, {
        expectedDoneOn: day, workBy, ...(workBy === "contractor" ? { contractorId } : {}),
        ...(!first && reason.trim() ? { reason: reason.trim() } : {}),
      }));
    } catch (err) { setErrors(handleError(err, () => onOpenChange(false))); if (errorCode(err) === "CONTRACTOR_NOT_FOUND") setContractorId(""); }
    finally { setBusy(false); }
  }
  const options = (contractors ?? []).filter((c) => c.isActive).map((c) => ({ value: c.id, label: c.name, description: c.types.map((t) => t.name).join(", ") }));
  const title = first ? "เริ่มดำเนินการ" : reaccept ? "รับแก้ไขและกำหนดวันเสร็จใหม่" : "เลื่อนวันที่คาดว่าจะเสร็จ";
  // The contractor form is a sibling of this dialog (not inside its <form>): submit events bubble through portals.
  return <>
    <Dialog open={open} onOpenChange={(o) => { if (o) { setChip(""); setPicked(""); setReason(""); setWorkBy(ticket.workBy ?? "in_house"); setContractorId(ticket.contractor?.id ?? ""); setErrors({}); } onOpenChange(o); }}>
      <DialogContent className={sheetLike}>
        <form onSubmit={submit} noValidate className="space-y-5">
          <DialogHeader><DialogTitle className="text-lg">{title}</DialogTitle>
            <DialogDescription>{first ? "กำหนดวันที่คาดว่าจะเสร็จและใครซ่อม ผู้แจ้งจะเห็นวันที่นี้และได้รับแจ้งเตือนทันที" : `เดิม ${ticket.expectedDoneOn ? dayLabel(ticket.expectedDoneOn, true) : "—"} · ผู้แจ้งจะได้รับแจ้งเตือนวันใหม่`}</DialogDescription></DialogHeader>
          <div className="space-y-2">
            <p id="expectedDoneOn-label" className="text-[15px] font-semibold">คาดว่าจะเสร็จ <span className="text-destructive">*</span></p>
            <div role="radiogroup" aria-labelledby="expectedDoneOn-label" aria-describedby="expectedDoneOn-error" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[...chips, { key: "pick", label: "เลือกวัน", day: picked }].map((c) => <button key={c.key} type="button" role="radio" aria-checked={chip === c.key}
                onClick={() => { setChip(c.key); clear("expectedDoneOn"); if (c.key === "pick") window.requestAnimationFrame(() => document.getElementById("expectedDoneOn")?.focus()); }}
                className={cn("min-h-15 rounded-lg border bg-card px-1 py-2 text-center leading-snug outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  chip === c.key ? "border-primary bg-secondary/60 ring-1 ring-primary" : errors.expectedDoneOn ? "border-destructive" : "hover:border-primary/40")}>
                <b className="block text-[15px] font-semibold">{c.label}</b>
                <small className="text-[13px] text-muted-foreground">{c.key === "pick" ? (picked ? dayLabel(picked) : "จากปฏิทิน") : dayLabel(c.day)}</small>
              </button>)}
            </div>
            {chip === "pick" && <Input id="expectedDoneOn" type="date" min={today} value={picked} onChange={(e) => { setPicked(e.target.value); clear("expectedDoneOn"); }} aria-label="เลือกวันที่คาดว่าจะเสร็จ" aria-invalid={!!errors.expectedDoneOn} className="h-12 rounded-sm bg-card text-base" />}
            <FieldError id="expectedDoneOn-error" message={errors.expectedDoneOn} />
          </div>
          <div className="space-y-2"><p className="text-[15px] font-semibold">ใครซ่อม <span className="text-destructive">*</span></p>
            <SegmentedControl label="ใครซ่อม" value={workBy} options={WORK_BY} onValueChange={(v) => { setWorkBy(v as WorkBy); clear("workBy"); clear("contractorId"); }} />
            <FieldError id="workBy-error" message={errors.workBy} />
            {workBy === "contractor" && <div className="space-y-2 pt-1"><label id="contractorId-label" className="text-sm font-medium">ช่างภายนอก <span className="text-destructive">*</span></label>
              <Picker id="contractorId" title="ช่างภายนอก" placeholder={contractors ? "เลือกช่างภายนอก" : "กำลังโหลด…"} icon={HardHat} value={contractorId}
                onValueChange={(v) => { setContractorId(v); clear("contractorId"); }} options={options} invalid={!!errors.contractorId} disabled={!contractors}
                searchPlaceholder="ค้นหาชื่อร้าน" emptyText="ยังไม่มีช่างภายนอก กด เพิ่มช่างภายนอกใหม่" aria-labelledby="contractorId-label" aria-describedby="contractorId-error" />
              <Button type="button" variant="link" className="h-10 px-0" onClick={() => setAdding(true)}><Plus aria-hidden />เพิ่มช่างภายนอกใหม่</Button>
              <FieldError id="contractorId-error" message={errors.contractorId} /></div>}
          </div>
          {!first && <div className="space-y-2"><label htmlFor="assess-reason" className="text-[15px] font-semibold">เหตุผลที่เลื่อน <span className="text-xs font-normal text-muted-foreground">ไม่บังคับ · ผู้แจ้งเห็นข้อความนี้</span></label>
            <Input id="assess-reason" value={reason} onChange={(e) => { setReason(e.target.value); clear("reason"); }} maxLength={100} placeholder="เช่น รออะไหล่" aria-describedby="reason-error" className="h-12 rounded-sm bg-card text-base" />
            <FieldError id="reason-error" message={errors.reason} /></div>}
          <DialogFooter className="gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>ยกเลิก</Button>
            <Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" aria-hidden />}{first ? "เริ่มดำเนินการ" : "บันทึกวันใหม่"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    <ContractorFormDialog open={adding} onOpenChange={setAdding} onSaved={(c) => {
      setAdding(false); setContractors((old) => [c, ...(old ?? [])]); setContractorId(c.id); clear("contractorId"); toast.success("เพิ่มช่างภายนอกแล้ว");
    }} />
  </>;
}

// ---- S10 as a sheet (CR-008) ----

function ResolveDialog({ ticket, open, onOpenChange, onDone }: DialogProps) {
  const rework = ticket.step === "reworking";
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className={sheetLike}>
      <DialogHeader><DialogTitle className="text-lg">{rework ? "บันทึกผลการแก้ไข" : "บันทึกผลซ่อม"}</DialogTitle>
        <DialogDescription>ผู้แจ้งจะเห็นรูปหลังซ่อมต่อจากรูปก่อนซ่อม แล้วประเมินตรวจงานเพื่อปิดงาน</DialogDescription></DialogHeader>
      {open && <ResolveFields ticket={ticket} onDone={onDone} onStale={() => onOpenChange(false)}
        cancel={<Button type="button" variant="outline" className="h-12" onClick={() => onOpenChange(false)}>ยกเลิก</Button>} />}
    </DialogContent>
  </Dialog>;
}

// ---- S08 ประเมินงานซ่อม (CR-012): stars start empty or at the star tapped on S07 (BR-F07-7); only the button submits ----

function ConfirmDialog({ ticket, open, initial, onOpenChange, onDone, onSendBack }: DialogProps & { initial: number; onSendBack: () => void }) {
  const [rating, setRating] = useState(initial);
  const [comment, setComment] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  // Reset each time the dialog opens (with the star tapped on the review card, if any).
  const [seen, setSeen] = useState({ open, initial });
  if (open !== seen.open || initial !== seen.initial) {
    setSeen({ open, initial });
    if (open) { setRating(initial); setComment(""); setErrors({}); }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) { setErrors({ rating: "เลือกคะแนน 1–5 ดาวก่อน" }); return; }
    setBusy(true); setErrors({});
    try { onDone(await confirmTicket(ticket.id, { rating, comment: comment.trim() || undefined })); }
    catch (err) { setErrors(handleError(err, () => onOpenChange(false))); }
    finally { setBusy(false); }
  }
  const place = ticketLocation(ticket);
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className={cn(sheetLike, "sm:max-w-120")}>
      <form onSubmit={submit} noValidate>
        <DialogHeader><DialogTitle className="text-lg">ประเมินงานซ่อม</DialogTitle>
          <DialogDescription className="sr-only">เลือกคะแนน 1–5 ดาว แล้วกดยืนยันผลประเมิน งานนี้จะปิด</DialogDescription></DialogHeader>
        <div className="mt-4 flex items-center gap-2.5 rounded-lg bg-muted/60 p-3">
          <Wrench className="size-4.5 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0">
            <b className="block truncate text-sm leading-5.5 font-medium">{ticketTitle(ticket)}</b>
            <span className="block truncate text-xs leading-5 text-muted-foreground">{place}{ticket.resolvedAt && ` · ซ่อมเสร็จ ${shortDate(ticket.resolvedAt, true)}`}</span>
          </div>
        </div>
        <div className="mt-6 text-center">
          <h3 id="rating-question" className="text-[17px] leading-6 font-semibold">คุณพอใจกับงานซ่อมครั้งนี้แค่ไหน?</h3>
          <p className="mt-1 text-[13px] text-muted-foreground">เลือกคะแนนที่ตรงกับประสบการณ์ของคุณ</p>
        </div>
        <RatingScale value={rating} onChange={(n) => { setRating(n); setErrors({}); }} labelledBy="rating-question" describedBy="rating-feedback rating-error" />
        <p id="rating-feedback" aria-live="polite" className="mt-2 min-h-6 text-center text-sm leading-6">
          {rating ? <><b className="font-semibold tabular-nums">{rating} / 5</b> · {RATING_LABELS[rating]}</> : <span className="text-muted-foreground">ยังไม่ได้เลือกคะแนน</span>}
        </p>
        <div className="flex justify-center"><FieldError id="rating-error" message={errors.rating} /></div>
        {rating > 0 && rating <= 2 && <div className="mt-3 flex gap-2.5 rounded-lg border border-warning/25 bg-warning/10 px-3.5 py-3 text-sm leading-6 text-warning">
          <Info className="mt-1 size-4 shrink-0" aria-hidden />
          <p>ยังไม่เรียบร้อยใช่ไหม? ถ้ายังมีปัญหา ส่งกลับให้แก้แทนได้ ช่างจะกลับมาแก้ในงานเดิม<br />
            <Button type="button" variant="link" className="h-9 px-0 font-semibold" onClick={onSendBack}>ส่งกลับให้แก้แทน</Button></p>
        </div>}
        <div className="mt-5 space-y-2">
          <label htmlFor="rating-comment" className="flex items-baseline justify-between gap-2 text-sm font-medium">มีอะไรอยากบอกเราเพิ่มเติม? <span className="text-xs font-normal text-muted-foreground">ไม่บังคับ</span></label>
          <Textarea id="rating-comment" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} rows={3} placeholder="เช่น ซ่อมเรียบร้อย ช่างอธิบายวิธีดูแลได้ชัดเจน" aria-describedby="comment-error" className="min-h-24 rounded-sm bg-card px-3.5 py-2.5 text-base" />
          <FieldError id="comment-error" message={errors.comment} />
        </div>
        <div className="mt-5">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Info className="size-3.5 shrink-0" aria-hidden />เมื่อยืนยันผลประเมิน งานนี้จะถูกปิด</p>
          <Button type="submit" disabled={busy || !rating} className="mt-3 h-12 w-full">{busy && <Loader2 className="animate-spin" aria-hidden />}ยืนยันผลประเมิน{!busy && <ArrowRight aria-hidden />}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}

/** 1–5 radio group with a roving tab stop (arrows / Home / End). Never preselected (BR-F07-7). */
function RatingScale({ value, onChange, labelledBy, describedBy }: { value: number; onChange: (n: number) => void; labelledBy: string; describedBy: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  function onKey(e: React.KeyboardEvent, n: number) {
    const next = e.key === "Home" ? 1 : e.key === "End" ? 5
      : e.key === "ArrowRight" || e.key === "ArrowUp" ? Math.min(5, n + 1) : e.key === "ArrowLeft" || e.key === "ArrowDown" ? Math.max(1, n - 1) : 0;
    if (!next) return;
    e.preventDefault(); onChange(next); refs.current[next - 1]?.focus();
  }
  return <div role="radiogroup" aria-labelledby={labelledBy} aria-describedby={describedBy} className="mt-4 flex justify-center gap-1 sm:gap-2.5">
    {[1, 2, 3, 4, 5].map((n) => <button key={n} ref={(el) => { refs.current[n - 1] = el; }} type="button" role="radio" aria-checked={value === n}
      aria-label={`${n} ดาว · ${RATING_LABELS[n]}`} tabIndex={n === (value || 1) ? 0 : -1} onClick={() => onChange(n)} onKeyDown={(e) => onKey(e, n)}
      className={cn("flex min-h-17.5 w-13 flex-col items-center justify-center gap-1 rounded-lg border outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring sm:w-14",
        value === n ? "border-border bg-muted" : "border-transparent")}>
      <Star className={cn("size-7.5 transition-colors", n <= value ? "fill-gold text-gold" : "text-muted-foreground/60")} strokeWidth={1.5} aria-hidden />
      <span className="text-xs text-muted-foreground tabular-nums">{n}</span>
    </button>)}
  </div>;
}

// ---- S08 ส่งกลับให้แก้: reason required, photos optional ----

function SendBackDialog({ ticket, open, onOpenChange, onDone }: DialogProps) {
  const [reason, setReason] = useState("");
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) { setErrors({ reason: "กรุณาบอกสิ่งที่ยังไม่เรียบร้อย" }); return; }
    if (photos.some((p) => p.status === "uploading")) { setErrors({ photoIds: "รอให้รูปอัปโหลดเสร็จก่อน" }); return; }
    if (photos.some((p) => p.status === "failed")) { setErrors({ photoIds: "มีรูปที่อัปโหลดไม่สำเร็จ ลองใหม่หรือลบรูปนั้น" }); return; }
    setBusy(true); setErrors({});
    try { onDone(await sendBackTicket(ticket.id, { reason: reason.trim(), photoIds: photos.map((p) => p.photo!.id) })); setPhotos([]); }
    catch (err) { setErrors(handleError(err, () => onOpenChange(false))); }
    finally { setBusy(false); }
  }
  const tech = ticket.technician?.name;
  return <Dialog open={open} onOpenChange={(o) => { if (o) { setReason(""); setErrors({}); } onOpenChange(o); }}>
    <DialogContent className={sheetLike}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <DialogHeader><DialogTitle className="text-lg">ส่งกลับให้ช่างแก้ไข</DialogTitle>
          <DialogDescription>{tech ? `ช่าง${tech}` : "ช่าง"}จะได้รับแจ้งเตือน และกลับมาแก้ในงานเดิม ไม่ต้องแจ้งใหม่</DialogDescription></DialogHeader>
        <div className="space-y-2"><label htmlFor="reason" className="text-[15px] font-semibold">ยังพบปัญหาอะไร <span className="text-destructive">*</span></label>
          <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={3} placeholder="เช่น ยังมีน้ำหยดเมื่อเปิดแอร์นานๆ" aria-invalid={!!errors.reason} aria-describedby="reason-error" className="rounded-sm bg-card px-3.5 py-2.5 text-base" />
          <FieldError id="reason-error" message={errors.reason} /></div>
        <div className="space-y-2"><p className="text-[15px] font-semibold">รูปประกอบ <span className="text-xs font-normal text-muted-foreground">ไม่บังคับ</span></p>
          <PhotoPicker value={photos} onChange={setPhotos} disabled={busy} invalid={!!errors.photoIds} />
          <FieldError id="photoIds-error" message={errors.photoIds} /></div>
        <DialogFooter className="gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>ยกเลิก</Button>
          <Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" aria-hidden />}ส่งกลับให้แก้</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

// ---- ปิดงาน (F08-B, _common.md §7) — admin, from S07 and S11 ----

export const CLOSED_TOAST = "ปิดงานแล้ว";

/** Admin closes any open ticket with a reason (1–500). Stale ticket (already closed) → toast + close the dialog. */
export function CloseTicketDialog({ ticket, open, onOpenChange, onDone }: { ticket: { id: string; ticketNo: string }; open: boolean; onOpenChange: (open: boolean) => void; onDone: (t: TicketDetail) => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!reason.trim()) { setError("กรุณาใส่เหตุผล"); return; }
    setBusy(true); setError("");
    try { onDone(await closeTicket(ticket.id, { reason: reason.trim() })); }
    catch (err) {
      const fields = fieldErrors(err, { reason: { REQUIRED: "กรุณาใส่เหตุผล", TOO_LONG: "ไม่เกิน 500 ตัวอักษร" } });
      if (fields.reason) setError(fields.reason);
      else { toast.error(errorMessage(err)); if (errorCode(err) === "TICKET_CLOSED") onOpenChange(false); }
    } finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={(o) => { if (o) { setReason(""); setError(""); } if (!busy) onOpenChange(o); }}>
    <DialogContent className={sheetLike}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <DialogHeader><DialogTitle className="text-lg">ปิดงาน {ticket.ticketNo}?</DialogTitle>
          <DialogDescription>งานจะปิดทันทีโดยไม่ต้องรอตรวจรับ ผู้แจ้ง ผู้ติดตาม และช่างที่ถืองานจะได้รับแจ้งเตือน</DialogDescription></DialogHeader>
        <div className="space-y-2"><label htmlFor="close-reason" className="text-[15px] font-semibold">เหตุผลที่ปิดงาน <span className="text-destructive">*</span></label>
          <Textarea id="close-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={3} placeholder="เช่น ส่งเรื่องเปลี่ยนเครื่องใหม่ผ่านฝ่ายจัดซื้อแล้ว"
            aria-invalid={!!error} aria-describedby="close-reason-error" className="rounded-sm bg-card px-3.5 py-2.5 text-base" />
          <FieldError id="close-reason-error" message={error} /></div>
        <DialogFooter className="gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>ยกเลิก</Button>
          <Button type="submit" variant="destructive" disabled={busy}>{busy && <Loader2 className="animate-spin" aria-hidden />}ปิดงาน</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
