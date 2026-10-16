"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, CalendarClock, ClipboardCheck, HardHat, Loader2, Plus, RotateCcw, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Picker } from "@/components/shared/picker";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { assessTicket, confirmTicket, getContractors, sendBackTicket } from "../api";
import { assessFieldMessages, errorCode, errorMessage, fieldErrors, reviewFieldMessages } from "../errors";
import type { Contractor, TicketDetail, WorkBy } from "../types";
import { ContractorFormDialog } from "./contractors";
import { PhotoPicker, type PhotoItem } from "./photo-picker";
import { dayLabel, RATING_LABELS, ticketHref, todayBangkok } from "./ticket-presentation";

// S07 action bar (CR-005). The server decides the actions (`allowedActions`); the UI renders them.
//   technician: assess (S17), resolve (→ S10 page)   ·   reporter: confirm with stars / send back (S08)

type Dialogs = "assess" | "confirm" | "send_back" | null;

/** The action bar can be placed twice (desktop aside + mobile bottom bar); the dialogs render once. */
export function useTicketActions(ticket: TicketDetail, onChanged: (t: TicketDetail) => void) {
  const [open, setOpen] = useState<Dialogs>(null);
  const search = useSearchParams();
  // Deep links from S06: ?action=confirm | sendback opens the dialog once.
  useEffect(() => {
    const action = search.get("action");
    if (!action) return;
    const want = action === "sendback" ? "send_back" : action === "confirm" ? "confirm" : null;
    const url = new URL(window.location.href); url.searchParams.delete("action");
    window.history.replaceState(null, "", url.pathname + url.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot: open the dialog the link asked for
    if (want && ticket.allowedActions.includes(want)) setOpen(want);
  }, [search, ticket.allowedActions]);

  const allowed = new Set(ticket.allowedActions);
  const buttons: ReactNode[] = [];
  if (allowed.has("assess")) {
    buttons.push(<Button key="assess" variant={ticket.expectedDoneOn ? "outline" : "default"} className="flex-1" onClick={() => setOpen("assess")}>
      <CalendarClock aria-hidden />{ticket.expectedDoneOn && ticket.workBy ? "แก้การประเมิน" : "ประเมินงาน"}</Button>);
  }
  if (allowed.has("resolve")) {
    buttons.push(<Button key="resolve" asChild className="flex-1"><Link href={`${ticketHref(ticket.id)}/resolve`}><ClipboardCheck aria-hidden />บันทึกผลซ่อม</Link></Button>);
  } else if (ticket.blockedActions.resolve) {
    buttons.push(<div key="resolve" className="w-full space-y-1"><Button disabled className="w-full"><ClipboardCheck aria-hidden />บันทึกผลซ่อม</Button>
      <p className="text-center text-xs text-muted-foreground">ประเมินงาน (วันที่คาดว่าจะเสร็จ และผู้ดำเนินการ) ก่อนบันทึกผล</p></div>);
  }
  if (allowed.has("send_back")) {
    buttons.push(<Button key="send_back" variant="outline" className="flex-1" onClick={() => setOpen("send_back")}><RotateCcw aria-hidden />ส่งกลับให้แก้</Button>);
  }
  if (allowed.has("confirm")) {
    buttons.push(<Button key="confirm" className="flex-1" onClick={() => setOpen("confirm")}><Star aria-hidden />ประเมินงาน</Button>);
  }
  const done = (t: TicketDetail, message: string) => { setOpen(null); onChanged(t); toast.success(message); };
  const bar = (className?: string) => buttons.length > 0
    ? <div aria-label="การดำเนินการ" className={cn("flex flex-wrap gap-2 rounded-xl bg-card p-4 shadow-card", className)}>{buttons}</div>
    : null;
  const dialogs = <>
    {allowed.has("assess") && <AssessDialog ticket={ticket} open={open === "assess"} onOpenChange={(o) => setOpen(o ? "assess" : null)} onDone={(t) => done(t, "บันทึกการประเมินแล้ว")} />}
    {allowed.has("confirm") && <ConfirmDialog ticket={ticket} open={open === "confirm"} onOpenChange={(o) => setOpen(o ? "confirm" : null)} onDone={(t) => done(t, "ขอบคุณสำหรับการประเมิน")} />}
    {allowed.has("send_back") && <SendBackDialog ticket={ticket} open={open === "send_back"} onOpenChange={(o) => setOpen(o ? "send_back" : null)} onDone={(t) => done(t, "ส่งกลับให้ช่างแก้แล้ว")} />}
  </>;
  return { bar, dialogs, hasActions: buttons.length > 0 };
}

type DialogProps = { ticket: TicketDetail; open: boolean; onOpenChange: (open: boolean) => void; onDone: (t: TicketDetail) => void };

const sheetLike = "top-auto bottom-0 w-full max-w-none translate-y-0 rounded-b-none rounded-t-2xl sm:top-1/2 sm:bottom-auto sm:max-w-lg sm:-translate-y-1/2 sm:rounded-xl";

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

// ---- S17 assess: expected finish date + who does the work (CR-005, CR-006) ----

const WORK_BY = [{ value: "in_house", label: "ช่างในระบบ" }, { value: "contractor", label: "ช่างภายนอก" }];

function AssessDialog({ ticket, open, onOpenChange, onDone }: DialogProps) {
  const today = todayBangkok();
  const [day, setDay] = useState(ticket.expectedDoneOn ?? "");
  const [workBy, setWorkBy] = useState<WorkBy>(ticket.workBy ?? "in_house");
  const [contractorId, setContractorId] = useState(ticket.contractor?.id ?? "");
  const [contractors, setContractors] = useState<Contractor[]>();
  const [adding, setAdding] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    getContractors({ pageSize: 100 }).then((p) => setContractors(p.items), () => setContractors([]));
  }, [open]);
  const clear = (name: string) => setErrors((e) => { const n = { ...e }; delete n[name]; return n; });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!day) local.expectedDoneOn = "เลือกวันที่คาดว่าจะเสร็จ";
    else if (day < today) local.expectedDoneOn = "เลือกวันนี้หรือหลังจากนี้";
    if (workBy === "contractor" && !contractorId) local.contractorId = "เลือกช่างภายนอก";
    if (Object.keys(local).length) { setErrors(local); return; }
    setBusy(true); setErrors({});
    try { onDone(await assessTicket(ticket.id, { expectedDoneOn: day, workBy, ...(workBy === "contractor" ? { contractorId } : {}) })); }
    catch (err) { setErrors(handleError(err, () => onOpenChange(false))); if (errorCode(err) === "CONTRACTOR_NOT_FOUND") setContractorId(""); }
    finally { setBusy(false); }
  }
  const options = (contractors ?? []).filter((c) => c.isActive).map((c) => ({ value: c.id, label: c.name, description: c.types.map((t) => t.name).join(", ") }));
  const fieldError = (name: string) => <FieldError id={`${name}-error`} message={errors[name]} />;
  // The contractor form is a sibling of this dialog (not inside its <form>): submit events bubble through portals.
  return <>
    <Dialog open={open} onOpenChange={(o) => { if (o) { setDay(ticket.expectedDoneOn ?? ""); setWorkBy(ticket.workBy ?? "in_house"); setContractorId(ticket.contractor?.id ?? ""); setErrors({}); } onOpenChange(o); }}>
      <DialogContent className={cn(sheetLike, "max-h-[90dvh] overflow-y-auto")}>
        <form onSubmit={submit} noValidate className="space-y-4">
          <DialogHeader><DialogTitle>{ticket.expectedDoneOn && ticket.workBy ? "แก้การประเมิน" : "ประเมินงาน"}</DialogTitle>
            <DialogDescription>ผู้แจ้งจะเห็นวันที่คาดว่าจะเสร็จและผู้ดำเนินการในหน้าติดตามงาน{ticket.expectedDoneOn && ` (เดิม ${dayLabel(ticket.expectedDoneOn, true)})`}</DialogDescription></DialogHeader>
          <div className="space-y-2"><label htmlFor="expectedDoneOn" className="text-sm font-medium">วันที่คาดว่าจะเสร็จ<span className="text-destructive">*</span></label>
            <Input id="expectedDoneOn" type="date" min={today} value={day} onChange={(e) => { setDay(e.target.value); clear("expectedDoneOn"); }} aria-invalid={!!errors.expectedDoneOn} aria-describedby="expectedDoneOn-error" className="h-12" />
            {fieldError("expectedDoneOn")}</div>
          <div className="space-y-2"><p className="text-sm font-medium">ผู้ดำเนินการ<span className="text-destructive">*</span></p>
            <SegmentedControl label="ผู้ดำเนินการ" value={workBy} options={WORK_BY} onValueChange={(v) => { setWorkBy(v as WorkBy); clear("workBy"); clear("contractorId"); }} />
            {fieldError("workBy")}</div>
          {workBy === "contractor" && <div className="space-y-2"><label id="contractorId-label" className="text-sm font-medium">ช่างภายนอก<span className="text-destructive">*</span></label>
            <div className="flex gap-2"><div className="min-w-0 flex-1"><Picker id="contractorId" title="ช่างภายนอก" placeholder={contractors ? "เลือกช่างภายนอก" : "กำลังโหลด…"} icon={HardHat} value={contractorId}
              onValueChange={(v) => { setContractorId(v); clear("contractorId"); }} options={options} invalid={!!errors.contractorId} disabled={!contractors}
              searchPlaceholder="ค้นหาชื่อร้าน" emptyText="ยังไม่มีช่างภายนอก กด เพิ่มใหม่" aria-labelledby="contractorId-label" aria-describedby="contractorId-error" /></div>
              <Button type="button" variant="outline" onClick={() => setAdding(true)}><Plus aria-hidden />เพิ่มใหม่</Button></div>
            {fieldError("contractorId")}</div>}
          <DialogFooter className="gap-2"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>ยกเลิก</Button>
            <Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" aria-hidden />}บันทึก</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    <ContractorFormDialog open={adding} onOpenChange={setAdding} onSaved={(c) => {
      setAdding(false); setContractors((old) => [c, ...(old ?? [])]); setContractorId(c.id); clear("contractorId"); toast.success("เพิ่มช่างภายนอกแล้ว");
    }} />
  </>;
}

// ---- S08 confirm: stars required (BR-F07-2, CR-005) ----

export function StarInput({ id, value, onChange, invalid, describedBy }: { id: string; value: number; onChange: (n: number) => void; invalid?: boolean; describedBy?: string }) {
  return <div>
    <div id={id} role="radiogroup" aria-label="คะแนน 1 ถึง 5 ดาว" aria-invalid={invalid} aria-describedby={describedBy} className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} ดาว ${RATING_LABELS[n]}`} onClick={() => onChange(n)}
        className="grid size-11 place-items-center rounded-full text-warning outline-none hover:bg-warning/10 focus-visible:ring-2 focus-visible:ring-ring">
        <Star className={cn("size-8", n <= value ? "fill-current" : "opacity-30")} aria-hidden /></button>)}
    </div>
    <p className="mt-1 h-5 text-sm text-muted-foreground">{value ? RATING_LABELS[value] : "แตะดาวเพื่อให้คะแนน"}</p>
  </div>;
}

function ConfirmDialog({ ticket, open, onOpenChange, onDone }: DialogProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) { setErrors({ rating: "กรุณาให้คะแนน" }); return; }
    setBusy(true); setErrors({});
    try { onDone(await confirmTicket(ticket.id, { rating, comment: comment.trim() || undefined })); }
    catch (err) { setErrors(handleError(err, () => onOpenChange(false))); }
    finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={(o) => { if (o) { setRating(0); setComment(""); setErrors({}); } onOpenChange(o); }}>
    <DialogContent className={sheetLike}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <DialogHeader><DialogTitle>ประเมินงานซ่อม</DialogTitle><DialogDescription>คะแนนของคุณช่วยให้งานซ่อมครั้งต่อไปดีขึ้น</DialogDescription></DialogHeader>
        <div className="space-y-1"><p className="text-sm font-medium">ความพึงพอใจ<span className="text-destructive">*</span></p>
          <StarInput id="rating" value={rating} onChange={(n) => { setRating(n); setErrors({}); }} invalid={!!errors.rating} describedBy="rating-error" />
          <FieldError id="rating-error" message={errors.rating} /></div>
        <div className="space-y-2"><label htmlFor="rating-comment" className="text-sm font-medium">ความเห็นเพิ่มเติม</label>
          <Textarea id="rating-comment" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} rows={3} placeholder="เช่น ช่างมาเร็ว เก็บงานเรียบร้อย" aria-describedby="comment-error" />
          <FieldError id="comment-error" message={errors.comment} /></div>
        <DialogFooter className="gap-2"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>ไว้ทีหลัง</Button>
          <Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" aria-hidden />}ส่งคะแนน</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

// ---- S08 send back: reason required, photos optional ----

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
  return <Dialog open={open} onOpenChange={(o) => { if (o) { setReason(""); setErrors({}); } onOpenChange(o); }}>
    <DialogContent className={cn(sheetLike, "max-h-[90dvh] overflow-y-auto")}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <DialogHeader><DialogTitle>ส่งกลับให้ช่างแก้</DialogTitle><DialogDescription>ช่างจะได้รับงานนี้กลับไปแก้ต่อทันที</DialogDescription></DialogHeader>
        <div className="space-y-2"><label htmlFor="reason" className="text-sm font-medium">สิ่งที่ยังไม่เรียบร้อย<span className="text-destructive">*</span></label>
          <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={3} placeholder="เช่น เปิดแอร์เกิน 1 ชั่วโมงแล้วยังไม่เย็น" aria-invalid={!!errors.reason} aria-describedby="reason-error" />
          <FieldError id="reason-error" message={errors.reason} /></div>
        <div className="space-y-2"><p className="text-sm font-medium">รูปประกอบ <span className="font-normal text-muted-foreground">(ไม่บังคับ)</span></p>
          <PhotoPicker value={photos} onChange={setPhotos} disabled={busy} invalid={!!errors.photoIds} />
          <FieldError id="photoIds-error" message={errors.photoIds} /></div>
        <DialogFooter className="gap-2"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>ยกเลิก</Button>
          <Button type="submit" variant="destructive" disabled={busy}>{busy && <Loader2 className="animate-spin" aria-hidden />}ส่งกลับให้แก้</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
