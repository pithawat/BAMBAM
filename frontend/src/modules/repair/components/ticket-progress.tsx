import { CircleCheck, ClipboardCheck, Hourglass, RotateCcw, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TicketStep, TicketSummary } from "../types";
import { dayLabel, listDate, shortDate, STEP } from "./ticket-presentation";

// Progress tracker (CR-005, CR-009 wording): แจ้งงาน · รับเรื่อง · กำลังดำเนินการ · เสร็จ · ประเมินตรวจงาน.
// The current stage is the ticket's status; a send back keeps it in "กำลังดำเนินการ" (orange).

type Tone = "new" | "in-progress" | "rework" | "resolved" | "closed";
const TONE_OF: Record<TicketStep, Tone> = {
  awaiting_assessment: "new", in_repair: "in-progress", reworking: "rework", awaiting_rating: "resolved", closed: "closed",
};
const TONE: Record<Tone, { text: string; bg: string; border: string; ring: string }> = {
  new: { text: "text-status-new", bg: "bg-status-new", border: "border-status-new", ring: "ring-status-new/20" },
  "in-progress": { text: "text-status-in-progress", bg: "bg-status-in-progress", border: "border-status-in-progress", ring: "ring-status-in-progress/20" },
  rework: { text: "text-status-rework", bg: "bg-status-rework", border: "border-status-rework", ring: "ring-status-rework/20" },
  resolved: { text: "text-status-resolved", bg: "bg-status-resolved", border: "border-status-resolved", ring: "ring-status-resolved/20" },
  closed: { text: "text-status-closed", bg: "bg-status-closed", border: "border-status-closed", ring: "ring-status-closed/20" },
};
const ICONS = { awaiting_assessment: Hourglass, in_repair: Wrench, reworking: RotateCcw, awaiting_rating: ClipboardCheck, closed: CircleCheck };

/** Step names and the index of the current one (= steps.length when closed). */
const STAGES = ["แจ้งงาน", "รับเรื่อง", "กำลังดำเนินการ", "เสร็จ", "ประเมินตรวจงาน"];
const CURRENT: Record<TicketStep, number> = { awaiting_assessment: 1, in_repair: 2, reworking: 2, awaiting_rating: 4, closed: 5 };
function track(ticket: TicketSummary): { steps: string[]; current: number } {
  return { steps: STAGES, current: CURRENT[ticket.step] };
}

/** Mini label · caption for list rows. */
export function progressLabel(ticket: TicketSummary): { label: string; caption: string } {
  switch (ticket.step) {
    case "awaiting_assessment": return { label: "รับเรื่อง", caption: `แจ้งเมื่อ ${listDate(ticket.createdAt)}` };
    case "in_repair": return { label: "กำลังดำเนินการ", caption: ticket.expectedDoneOn ? `คาดว่าเสร็จ ${dayLabel(ticket.expectedDoneOn)}` : "" };
    case "reworking": return { label: "ส่งกลับให้แก้", caption: ticket.expectedDoneOn ? `คาดว่าเสร็จ ${dayLabel(ticket.expectedDoneOn)}` : "ส่งกลับให้แก้แล้ว" };
    case "awaiting_rating": return ticket.awaitingMyConfirmation
      ? { label: "รอคุณประเมินตรวจงาน", caption: ticket.autoCloseAt ? `ปิดอัตโนมัติ ${shortDate(ticket.autoCloseAt)}` : "" }
      : { label: "เสร็จ", caption: "รอผู้แจ้งประเมินตรวจงาน" };
    default: return { label: STEP.closed.label, caption: "" };
  }
}

/** Deadline chip copy: "ปิดอัตโนมัติใน {n} วัน ({d MMM}) ถ้าไม่ได้ประเมินตรวจงาน" / "ปิดอัตโนมัติวันนี้ {HH:mm} ถ้าไม่ได้ประเมินตรวจงาน". */
export function autoCloseText(autoCloseAt: string, now = new Date()) {
  const ms = new Date(autoCloseAt).getTime() - now.getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `ปิดอัตโนมัติใน ${days} วัน (${shortDate(autoCloseAt)}) ถ้าไม่ได้ประเมินตรวจงาน`;
  const time = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(autoCloseAt));
  return `ปิดอัตโนมัติวันนี้ ${time} ถ้าไม่ได้ประเมินตรวจงาน`;
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
