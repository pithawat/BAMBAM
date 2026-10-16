import { Bookmark, CalendarClock, CalendarSync, CircleCheck, CircleX, ClipboardCheck, Clock, Forward, Gauge, Plus, RotateCcw, Star, Users } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TimelineEvent, TimelineEventType } from "../types";
import { PhotoGallery } from "./photo-gallery";
import { dayLabel, PRIORITY_LABELS } from "./ticket-presentation";

const EVENTS = {
  created: ["แจ้งซ่อม", Plus, "text-primary bg-primary/10"],
  subscribed: ["ติดตามเคสนี้", Bookmark, "text-muted-foreground bg-muted"],
  assessed: ["ช่างประเมินงาน", CalendarClock, "text-status-in-progress bg-status-in-progress/10"],
  assessment_changed: ["ช่างเลื่อนวันคาดว่าเสร็จ", CalendarSync, "text-status-in-progress bg-status-in-progress/10"],
  resolved: ["ช่างบันทึกผล", ClipboardCheck, "text-status-resolved bg-status-resolved/10"],
  sent_back: ["ส่งกลับให้แก้", RotateCcw, "text-status-resolved bg-status-resolved/10"],
  confirmed: ["ผู้แจ้งประเมินแล้ว", CircleCheck, "text-status-closed bg-status-closed/10"],
  auto_closed: ["ปิดอัตโนมัติ", Clock, "text-status-closed bg-status-closed/10"],
  team_handled: ["ทีมดำเนินการเอง", Users, "text-status-closed bg-status-closed/10"],
  handed_over: ["ส่งต่อให้ช่าง", Forward, "text-status-new bg-status-new/10"],
  admin_closed: ["Admin ปิดงาน", CircleX, "text-destructive bg-destructive/10"],
  priority_changed: ["เปลี่ยนความเร่งด่วน", Gauge, "text-muted-foreground bg-muted"],
} as const;
const reasonTypes: TimelineEventType[] = ["sent_back", "handed_over", "admin_closed"];

export function Timeline({ events }: { events: TimelineEvent[] }) {
  return <ol className="mt-4">{events.map((event, i) => {
    const [label, Icon, color] = EVENTS[event.type];
    return <li key={event.id} className="relative flex gap-3 pb-5 last:pb-0">
      {i < events.length - 1 && <span aria-hidden className="absolute top-8 bottom-0 left-4 border-l-2 border-border" />}
      <span className={cn("relative grid size-8 shrink-0 place-items-center rounded-full", color)}><Icon className="size-4" aria-hidden /></span>
      <div className="min-w-0 flex-1 space-y-1 pt-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3"><p className="text-sm font-semibold">{event.type === "subscribed" ? `${event.actor?.name ?? ""} ${label}` : label}</p><time dateTime={event.at} className="text-xs text-muted-foreground">{formatDateTime(event.at)}</time></div>
        {event.actor && <p className="text-sm text-muted-foreground">{["assessed", "assessment_changed", "resolved"].includes(event.type) ? "ช่าง" : ""}{event.actor.name}</p>}
        {event.note && <p className="whitespace-pre-wrap break-words text-sm">{reasonTypes.includes(event.type) ? "เหตุผล: " : ""}{event.note}</p>}
        {event.type === "auto_closed" && <p className="text-sm text-muted-foreground">ไม่ได้ประเมินภายใน 3 วัน</p>}
        {event.data.expectedDoneOn && <p className="text-sm">คาดว่าจะเสร็จ {dayLabel(event.data.expectedDoneOn, true)}</p>}
        {event.data.workBy && <p className="text-sm text-muted-foreground">{event.data.workBy === "contractor" ? "ดำเนินการโดยช่างภายนอก" : "ดำเนินการโดยช่างในระบบ"}</p>}
        {event.type === "priority_changed" && event.data.from && event.data.to && <p className="text-sm">{PRIORITY_LABELS[event.data.from]} → {PRIORITY_LABELS[event.data.to]} โดย {event.actor?.name}</p>}
        {event.data.rating != null && <p className="flex items-center gap-1 text-sm text-warning"><Star className="size-4 fill-current" aria-hidden />{event.data.rating}</p>}
        <PhotoGallery photos={event.photos} label={label} />
      </div>
    </li>;
  })}</ol>;
}
