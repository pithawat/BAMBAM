import { createElement } from "react";
import { AirVent, Box, Mic, Speaker, Tv, type LucideIcon } from "lucide-react";
import { pointInShape } from "../../plan-geometry";
import type { Asset, OverviewCounts, OverviewFloor, PlanShape, TicketStep, TicketSummary } from "../../types";
import { addDays, dayLabel, todayBangkok } from "../ticket-presentation";

// Shared S29 bits (CR-016): equipment icons, pin colours, sub-line copy (S29 spec "Content").

export const ASSET_ICONS: Record<string, LucideIcon> = { aircon: AirVent, microphone: Mic, speaker: Speaker, tv: Tv };
/** Equipment type icon (unknown keys from the master → a generic box). */
export function AssetIcon({ typeKey, className }: { typeKey: string; className?: string }) {
  return createElement(ASSET_ICONS[typeKey] ?? Box, { className, "aria-hidden": true });
}

/** Short palette label (modern mockup): แอร์ · ไมค์ · ลำโพง · จอทีวี. */
export const ASSET_SHORT: Record<string, string> = { aircon: "แอร์", microphone: "ไมค์", speaker: "ลำโพง", tv: "จอทีวี" };

/** Mount height of a chip over the plan (metres). */
export const MOUNT_Y: Record<string, number> = { floor: 0.9, wall: 1.6, ceiling: 2.4 };

export const assetLabel = (a: Pick<Asset, "code" | "name" | "type">) => `${a.type.name} ${a.code} ${a.name}`;

/** "สวัสดีตอนเช้า / ตอนบ่าย / ตอนเย็น" by the Bangkok hour. */
export function greeting(now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", hourCycle: "h23" }).format(now));
  return hour < 12 ? "สวัสดีตอนเช้า" : hour < 17 ? "สวัสดีตอนบ่าย" : "สวัสดีตอนเย็น";
}

const DAY = 86_400_000;

/** รับเรื่อง sub-line: "รอช่างเริ่มดำเนินการ · เก่าสุด {n} วัน". */
export function oldestText(c: OverviewCounts, now = Date.now()) {
  if (!c.oldestAwaitingAssessmentAt) return "รอช่างเริ่มดำเนินการ";
  const days = Math.floor((now - Date.parse(c.oldestAwaitingAssessmentAt)) / DAY);
  return `รอช่างเริ่มดำเนินการ · เก่าสุด ${days < 1 ? "วันนี้" : `${days} วัน`}`;
}

/** รอประเมินตรวจงาน sub-line: "ปิดอัตโนมัติเร็วสุด{วันนี้ / พรุ่งนี้ / d MMM}". */
export function autoCloseSoonest(c: OverviewCounts) {
  if (!c.nextAutoCloseAt) return null;
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date(c.nextAutoCloseAt));
  const today = todayBangkok();
  const when = day <= today ? "วันนี้" : day === addDays(today, 1) ? "พรุ่งนี้" : dayLabel(day);
  return `ปิดอัตโนมัติเร็วสุด${when}`;
}

export type AttentionReason = "late" | "back" | "critical";

/** Reason chip of an attention row (เลยกำหนด · ส่งกลับ · ฉุกเฉิน), null for a high-priority row. */
export function attentionReason(t: TicketSummary, today = todayBangkok()): AttentionReason | null {
  if (t.status === "in_progress" && t.expectedDoneOn && t.expectedDoneOn < today) return "late";
  if (t.step === "reworking") return "back";
  if (t.priority === "critical") return "critical";
  return null;
}

export const REASON_CHIP: Record<AttentionReason, { label: string; className: string }> = {
  late: { label: "เลยกำหนด", className: "bg-attention/10 text-attention" },
  back: { label: "ส่งกลับ", className: "bg-priority-critical/10 text-priority-critical" },
  critical: { label: "ฉุกเฉิน", className: "bg-priority-critical/10 text-priority-critical" },
};


/** WebGL available? (S29 "No WebGL" state → floor list.) */
export function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

// ---- CR-017: ticket steps on the model (the S11 steps; closed tickets are not shown) ----

export type ModelStepKey = "awaiting_assessment" | "in_repair" | "awaiting_rating";

/** Labels and colours = the app's step tokens (S11 / S06). Order = what needs action first. */
export const MODEL_STEPS: { key: ModelStepKey; label: string; dot: string; text: string; soft: string }[] = [
  { key: "awaiting_assessment", label: "รับเรื่อง", dot: "bg-status-new", text: "text-status-new", soft: "bg-status-new/10" },
  { key: "in_repair", label: "กำลังดำเนินการ", dot: "bg-status-in-progress", text: "text-status-in-progress", soft: "bg-status-in-progress/10" },
  { key: "awaiting_rating", label: "รอประเมินตรวจงาน", dot: "bg-status-resolved", text: "text-status-resolved", soft: "bg-status-resolved/10" },
];
export const MODEL_STEP = Object.fromEntries(MODEL_STEPS.map((s) => [s.key, s])) as Record<ModelStepKey, (typeof MODEL_STEPS)[number]>;

/** Ticket step → model step (`reworking` is part of กำลังดำเนินการ); null for closed. */
export function modelStep(step: TicketStep): ModelStepKey | null {
  if (step === "awaiting_assessment") return "awaiting_assessment";
  if (step === "in_repair" || step === "reworking") return "in_repair";
  if (step === "awaiting_rating") return "awaiting_rating";
  return null;
}

/** Per-floor counts in MODEL_STEPS order. */
export const floorStepCounts = (f: OverviewFloor): [ModelStepKey, number][] => [
  ["awaiting_assessment", f.steps.awaitingAssessment],
  ["in_repair", f.steps.inRepair],
  ["awaiting_rating", f.steps.awaitingRating],
];

/** The floor colour on the model: the first step (in action order) with open tickets. */
export const floorTopStep = (f: OverviewFloor): ModelStepKey | null => floorStepCounts(f).find(([, n]) => n > 0)?.[0] ?? null;

/**
 * `n` points around `center`, 1.3 m apart in a small grid, so each ticket of a room gets its own pin.
 * A point that falls outside the room outline goes back to the centre.
 */
export function spreadInRoom(center: [number, number], shape: PlanShape | null, n: number, spacing = 1.3): [number, number][] {
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  return Array.from({ length: n }, (_, i) => {
    const x = center[0] + ((i % cols) - (cols - 1) / 2) * spacing;
    const z = center[1] + (Math.floor(i / cols) - (rows - 1) / 2) * spacing;
    return shape && !pointInShape(x, z, shape) ? center : [x, z];
  });
}
