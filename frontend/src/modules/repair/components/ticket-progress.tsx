import { Check, CircleCheck, ClipboardCheck, Hourglass, RotateCcw, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TicketStep, TicketSummary } from "../types";
import { dayLabel, listDate, shortDate, STEP } from "./ticket-presentation";

// Progress tracker (CR-005). It only moves forward: after a send back the tracker grows
// "ส่งกลับให้แก้ → แก้ไขเสร็จ" instead of going back to an earlier step.
//   แจ้งแล้ว · ช่างประเมิน · ซ่อมเสร็จ · ปิดงาน
//   แจ้งแล้ว · ช่างประเมิน · ซ่อมเสร็จ · ส่งกลับให้แก้ · แก้ไขเสร็จ · ปิดงาน

type Tone = "new" | "in-progress" | "resolved" | "closed";
const TONE_OF: Record<TicketStep, Tone> = {
  awaiting_assessment: "new", in_repair: "in-progress", reworking: "in-progress", awaiting_rating: "resolved", closed: "closed",
};
const TONE: Record<Tone, { text: string; bg: string; border: string; ring: string }> = {
  new: { text: "text-status-new", bg: "bg-status-new", border: "border-status-new", ring: "ring-status-new/20" },
  "in-progress": { text: "text-status-in-progress", bg: "bg-status-in-progress", border: "border-status-in-progress", ring: "ring-status-in-progress/20" },
  resolved: { text: "text-status-resolved", bg: "bg-status-resolved", border: "border-status-resolved", ring: "ring-status-resolved/20" },
  closed: { text: "text-status-closed", bg: "bg-status-closed", border: "border-status-closed", ring: "ring-status-closed/20" },
};
const ICONS = { awaiting_assessment: Hourglass, in_repair: Wrench, reworking: RotateCcw, awaiting_rating: ClipboardCheck, closed: CircleCheck };

/** Step names and the index of the current one (= steps.length when closed). */
function track(ticket: TicketSummary): { steps: string[]; current: number } {
  const rework = ticket.sendBackCount > 0;
  const steps = rework
    ? ["แจ้งแล้ว", "ช่างประเมิน", "ซ่อมเสร็จ", "ส่งกลับให้แก้", "แก้ไขเสร็จ", "ปิดงาน"]
    : ["แจ้งแล้ว", "ช่างประเมิน", "ซ่อมเสร็จ", "ปิดงาน"];
  const current: Record<TicketStep, number> = rework
    ? { awaiting_assessment: 1, in_repair: 4, reworking: 4, awaiting_rating: 5, closed: 6 }
    : { awaiting_assessment: 1, in_repair: 2, reworking: 2, awaiting_rating: 3, closed: 4 };
  return { steps, current: current[ticket.step] };
}

/** Mini label · caption for list rows. */
export function progressLabel(ticket: TicketSummary): { label: string; caption: string } {
  switch (ticket.step) {
    case "awaiting_assessment": return { label: "รอช่างประเมิน", caption: `แจ้งเมื่อ ${listDate(ticket.createdAt)}` };
    case "in_repair": return { label: "กำลังซ่อม", caption: ticket.expectedDoneOn ? `คาดว่าเสร็จ ${dayLabel(ticket.expectedDoneOn)}` : "" };
    case "reworking": return { label: "กำลังแก้ไข", caption: ticket.expectedDoneOn ? `คาดว่าเสร็จ ${dayLabel(ticket.expectedDoneOn)}` : "ส่งกลับให้แก้แล้ว" };
    case "awaiting_rating": return ticket.awaitingMyConfirmation
      ? { label: "รอคุณประเมิน", caption: ticket.autoCloseAt ? `ปิดอัตโนมัติ ${shortDate(ticket.autoCloseAt)}` : "" }
      : { label: "ซ่อมเสร็จ", caption: "รอผู้แจ้งประเมิน" };
    default: return { label: STEP.closed.label, caption: "" };
  }
}

/** Deadline chip copy: "ปิดอัตโนมัติใน {n} วัน ({d MMM}) หากไม่ประเมิน" / "ปิดอัตโนมัติวันนี้ {HH:mm} หากไม่ประเมิน". */
export function autoCloseText(autoCloseAt: string, now = new Date()) {
  const ms = new Date(autoCloseAt).getTime() - now.getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `ปิดอัตโนมัติใน ${days} วัน (${shortDate(autoCloseAt)}) หากไม่ประเมิน`;
  const time = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(autoCloseAt));
  return `ปิดอัตโนมัติวันนี้ ${time} หากไม่ประเมิน`;
}

/** Segments + current step label (rows). */
export function TicketProgressMini({ ticket, className }: { ticket: TicketSummary; className?: string }) {
  const { steps, current } = track(ticket);
  const tone = TONE[TONE_OF[ticket.step]];
  const { label, caption } = progressLabel(ticket);
  const reached = Math.min(current + (ticket.step === "closed" ? 0 : 1), steps.length);
  return <div className={cn("flex min-w-0 items-center gap-2", className)}>
    <span aria-hidden className="flex shrink-0 gap-0.5">
      {steps.map((_, i) => <span key={i} className={cn("h-1.5 w-3 rounded-full", i < reached ? tone.bg : "bg-muted")} />)}
    </span>
    <span className="sr-only">ขั้นที่ {reached} จาก {steps.length}:</span>
    <span className={cn("shrink-0 text-xs font-semibold", tone.text)}>{label}</span>
    {caption && <span className="min-w-0 truncate text-xs text-muted-foreground">{caption}</span>}
  </div>;
}

/** Full tracker with step captions (detail header, desktop preview). */
export function TicketProgress({ ticket }: { ticket: TicketSummary }) {
  const { steps, current } = track(ticket);
  const tone = TONE[TONE_OF[ticket.step]];
  const closed = ticket.step === "closed";
  const pending = ticket.step === "awaiting_rating" ? (ticket.awaitingMyConfirmation ? "รอคุณประเมิน" : "รอผู้แจ้งประเมิน") : "";
  const captionOf = (name: string) => {
    switch (name) {
      case "แจ้งแล้ว": return listDate(ticket.createdAt);
      case "ช่างประเมิน": return ticket.expectedDoneOn ? `คาดว่าเสร็จ ${dayLabel(ticket.expectedDoneOn)}` : "รอช่างประเมิน";
      case "ซ่อมเสร็จ": return ticket.sendBackCount === 0 && ticket.resolvedAt ? listDate(ticket.resolvedAt) : "";
      case "ส่งกลับให้แก้": return ticket.sendBackCount > 1 ? `${ticket.sendBackCount} ครั้ง` : "";
      case "แก้ไขเสร็จ": return ticket.sendBackCount > 0 && ticket.step !== "reworking" && ticket.resolvedAt ? listDate(ticket.resolvedAt) : "";
      default: return ticket.closedAt ? listDate(ticket.closedAt) : pending;
    }
  };
  return <ol className="grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} aria-label={`ความคืบหน้า ขั้นที่ ${Math.min(current + 1, steps.length)} จาก ${steps.length}`}>
    {steps.map((name, i) => {
      const done = i < current || closed;
      const isCurrent = i === current && !closed;
      return <li key={name} className="relative flex min-w-0 flex-col items-center gap-1 text-center" aria-current={isCurrent ? "step" : undefined}>
        {i < steps.length - 1 && <span aria-hidden className={cn("absolute top-3 left-1/2 h-0.5 w-full", i < current ? tone.bg : "bg-border")} />}
        <span className={cn("relative z-10 grid size-6 place-items-center rounded-full border-2 bg-card",
          done ? cn(tone.bg, tone.border, "text-white") : isCurrent ? cn(tone.border, "ring-4", tone.ring) : "border-border")}>
          {done && <Check aria-hidden className="size-3.5" strokeWidth={3} />}
          {isCurrent && <span className={cn("size-2.5 rounded-full", tone.bg)} />}
        </span>
        <span className={cn("text-xs leading-tight", done || isCurrent ? "font-semibold text-foreground" : "text-muted-foreground")}>{name}</span>
        {captionOf(name) && <span className="text-xs leading-tight text-muted-foreground">{captionOf(name)}</span>}
      </li>;
    })}
  </ol>;
}

/** First report photo, or the step icon when there is none. */
export function TicketThumb({ ticket, size = "md" }: { ticket: TicketSummary; size?: "sm" | "md" }) {
  const box = size === "sm" ? "size-12 rounded-sm" : "size-14 rounded-md";
  if (ticket.thumbUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- same-origin API path or mock data URL (HANDOFF: plain <img>)
    return <img src={ticket.thumbUrl} alt="" className={cn(box, "shrink-0 bg-muted object-cover")} />;
  }
  const Icon = ICONS[ticket.step];
  return <span aria-hidden className={cn(box, "grid shrink-0 place-items-center bg-muted", TONE[TONE_OF[ticket.step]].text)}><Icon className="size-5" /></span>;
}
