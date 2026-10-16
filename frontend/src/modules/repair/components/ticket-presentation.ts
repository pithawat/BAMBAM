import type { ClosedReason, Priority, TicketStep, TicketSummary, WorkBy } from "../types";

/** Badge per step (CR-005). Reporters see "กำลังดำเนินการ" while the technician works. */
export const STEP = {
  awaiting_assessment: { label: "กำลังดำเนินการ · รอช่างประเมิน", color: "bg-status-new/10 text-status-new" },
  in_repair: { label: "กำลังดำเนินการ · กำลังซ่อม", color: "bg-status-in-progress/10 text-status-in-progress" },
  reworking: { label: "กำลังดำเนินการ · แก้ไขตามที่ส่งกลับ", color: "bg-status-in-progress/10 text-status-in-progress" },
  awaiting_rating: { label: "ซ่อมเสร็จ รอประเมิน", color: "bg-status-resolved/10 text-status-resolved" },
  closed: { label: "ปิดงานแล้ว", color: "bg-status-closed/10 text-status-closed" },
} as const satisfies Record<TicketStep, { label: string; color: string }>;

export const CLOSED_LABELS: Record<ClosedReason, string> = {
  confirmed: "ประเมินแล้ว", auto_closed: "ปิดอัตโนมัติ", team_handled: "ทีมดำเนินการเอง", admin_closed: "Admin ปิดงาน",
};
export const PRIORITY_LABELS: Record<Priority, string> = { critical: "ฉุกเฉิน", high: "สูง", medium: "ปกติ", low: "ต่ำ" };
export const RATING_LABELS = ["", "ต้องปรับปรุง", "พอใช้", "ดี", "ดีมาก", "ยอดเยี่ยม"];
export const ticketTitle = (ticket: TicketSummary) => ticket.symptoms.map((s) => s.name).join(" · ");
export const ticketLocation = (ticket: TicketSummary) =>
  `${ticket.building.name} ชั้น ${ticket.floor.name}${ticket.locationDetail ? ` · ${ticket.locationDetail}` : ""}`;
export const ticketHref = (id: string) => `/repair/tickets/${encodeURIComponent(id)}`;

/** "ช่างในระบบ" / "ช่างภายนอก · แอร์, ไฟฟ้า" (+ contractor name for staff). */
export function workByText(ticket: Pick<TicketSummary, "workBy" | "contractor" | "contractorTypes">) {
  const by: WorkBy | null = ticket.workBy;
  if (!by) return "";
  if (by === "in_house") return "ช่างในระบบ";
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
/** `YYYY-MM-DD` (a Bangkok calendar day) → "20 ต.ค." */
export function dayLabel(day: string, withYear = false) {
  return shortDate(`${day}T12:00:00+07:00`, withYear);
}
/** Today in Asia/Bangkok as `YYYY-MM-DD`. */
export function todayBangkok(now = new Date()) {
  return dayFormatter.format(now);
}
export function listDate(value: string, now = new Date()) {
  const date = new Date(value);
  const day = dayFormatter.format(date);
  if (day === dayFormatter.format(now)) return thaiTime.format(date);
  if (day === dayFormatter.format(new Date(now.getTime() - 86_400_000))) return `เมื่อวาน ${thaiTime.format(date)}`;
  const year = (d: Date) => dayFormatter.formatToParts(d).find((p) => p.type === "year")?.value;
  return year(date) === year(now) ? `${shortDate(value)} ${thaiTime.format(date)}` : shortDate(value, true);
}
