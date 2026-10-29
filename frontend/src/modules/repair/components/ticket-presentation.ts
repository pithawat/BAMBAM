import type { ClosedReason, Priority, TicketStep, TicketSummary, WorkBy } from "../types";

/**
 * Per step (CR-005, wording CR-009 / D-060): แจ้งงาน → รับเรื่อง → กำลังดำเนินการ → (ส่งกลับให้แก้) → เสร็จ →
 * ประเมินตรวจงาน. Badge label + soft colours; `awaiting_rating` reads "รอคุณประเมินตรวจงาน" for the reporter.
 */
export const STEP = {
  awaiting_assessment: { label: "รับเรื่อง", color: "bg-status-new/10 text-status-new", solid: "bg-status-new", ring: "ring-status-new/15" },
  in_repair: { label: "กำลังดำเนินการ", color: "bg-status-in-progress/10 text-status-in-progress", solid: "bg-status-in-progress", ring: "ring-status-in-progress/15" },
  reworking: { label: "ส่งกลับให้แก้", color: "bg-status-rework/10 text-status-rework", solid: "bg-status-rework", ring: "ring-status-rework/15" },
  awaiting_rating: { label: "เสร็จ · รอประเมินตรวจงาน", color: "bg-status-resolved/10 text-status-resolved", solid: "bg-status-resolved", ring: "ring-status-resolved/15" },
  closed: { label: "ปิดงานแล้ว", color: "bg-status-closed/10 text-status-closed", solid: "bg-status-closed", ring: "ring-status-closed/15" },
} as const satisfies Record<TicketStep, { label: string; color: string; solid: string; ring: string }>;

/** Badge text for this viewer: the reporter is asked directly while it waits for the rating. */
export function stepLabel(ticket: Pick<TicketSummary, "step" | "awaitingMyConfirmation">) {
  return ticket.step === "awaiting_rating" && ticket.awaitingMyConfirmation ? "เสร็จ · รอคุณประเมินตรวจงาน" : STEP[ticket.step].label;
}

export const CLOSED_LABELS: Record<ClosedReason, string> = {
  confirmed: "ประเมินตรวจงานแล้ว", auto_closed: "ปิดอัตโนมัติ", team_handled: "ทีมดำเนินการเอง", admin_closed: "Admin ปิดงาน",
};
export const PRIORITY_LABELS: Record<Priority, string> = { critical: "ฉุกเฉิน", high: "สูง", medium: "ปกติ", low: "ต่ำ" };
export const RATING_LABELS = ["", "ต้องปรับปรุง", "พอใช้", "ดี", "ดีมาก", "ยอดเยี่ยม"];

/** Symptom names, then the typed symptom (CR-008). */
export const ticketTitle = (ticket: Pick<TicketSummary, "symptoms" | "symptomOther">) =>
  [...ticket.symptoms.map((s) => s.name), ...(ticket.symptomOther ? [ticket.symptomOther] : [])].join(" · ");
/** The listed category, or the name the reporter typed for "อื่นๆ" (CR-008). */
export const categoryName = (ticket: Pick<TicketSummary, "category" | "categoryOther">) =>
  ticket.category?.name ?? ticket.categoryOther ?? "อื่นๆ";
export const ticketLocation = (ticket: TicketSummary) =>
  `${ticket.building.name} ชั้น ${ticket.floor.name}${ticket.locationDetail ? ` · ${ticket.locationDetail}` : ""}`;
export const ticketHref = (id: string) => `/repair/tickets/${encodeURIComponent(id)}`;

/** "ช่างของบริษัท" / "ช่างภายนอก · แอร์, ไฟฟ้า" (+ contractor name for staff). */
export function workByText(ticket: Pick<TicketSummary, "workBy" | "contractor" | "contractorTypes">) {
  const by: WorkBy | null = ticket.workBy;
  if (!by) return "";
  if (by === "in_house") return "ช่างของบริษัท";
  const types = ticket.contractorTypes.join(", ");
  return ["ช่างภายนอก", ticket.contractor?.name, types].filter(Boolean).join(" · ");
}

const dayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" });
const thaiDate = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric" });
const thaiTime = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
export function shortDate(value: string, withYear = false) {
  const parts = thaiDate.formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")} ${get("month")}${withYear ? ` ${get("year")}` : ""}`;
}
/** "14 ต.ค. 08:40" */
export function dateTime(value: string, withYear = false) {
  return `${shortDate(value, withYear)} ${thaiTime.format(new Date(value))}`;
}
/** "08:40" (Asia/Bangkok) */
export function timeOf(value: string) {
  return thaiTime.format(new Date(value));
}
/** `YYYY-MM-DD` (a Bangkok calendar day) → "20 ต.ค." */
export function dayLabel(day: string, withYear = false) {
  return shortDate(`${day}T12:00:00+07:00`, withYear);
}
/** Today in Asia/Bangkok as `YYYY-MM-DD`. */
export function todayBangkok(now = new Date()) {
  return dayFormatter.format(now);
}
/** `YYYY-MM-DD` plus `days` calendar days. */
export function addDays(day: string, days: number) {
  const d = new Date(`${day}T12:00:00+07:00`);
  d.setUTCDate(d.getUTCDate() + days);
  return dayFormatter.format(d);
}
export function listDate(value: string, now = new Date()) {
  const date = new Date(value);
  const day = dayFormatter.format(date);
  if (day === dayFormatter.format(now)) return thaiTime.format(date);
  if (day === dayFormatter.format(new Date(now.getTime() - 86_400_000))) return `เมื่อวาน ${thaiTime.format(date)}`;
  const year = (d: Date) => dayFormatter.formatToParts(d).find((p) => p.type === "year")?.value;
  return year(date) === year(now) ? `${shortDate(value)} ${thaiTime.format(date)}` : shortDate(value, true);
}
