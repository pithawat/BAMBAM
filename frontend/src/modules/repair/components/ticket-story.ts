import type { TicketDetail, TimelineEvent, WorkBy } from "../types";
import { CLOSED_LABELS, dateTime, dayLabel, PRIORITY_LABELS, RATING_LABELS } from "./ticket-presentation";

// S07 (CR-009 / D-060) reads the ticket as stages — แจ้งงาน · รับเรื่อง · กำลังดำเนินการ · (ส่งกลับให้แก้) · เสร็จ ·
// ประเมินตรวจงาน — with the smaller events (follower added, date moved with its reason, send backs, an earlier
// resolve) nested under the stage they belong to. `history` lists every event (dialog + print report).

/** Who is looking: drives the wording ("คุณ" vs "ผู้แจ้ง") and the next-action card. */
export type StoryViewer = "reporter" | "follower" | "technician" | "staff";

export function storyViewer(ticket: Pick<TicketDetail, "viewerRelation">, role: string): StoryViewer {
  if (ticket.viewerRelation === "reporter") return "reporter";
  if (ticket.viewerRelation === "subscriber") return "follower";
  if (role === "technician") return "technician";
  return "staff";
}

export type StoryItem = { id: string; at: string; title: string; detail: string; warn?: boolean };
export type Stage = { key: string; state: "done" | "now" | "later"; title: string; time?: string; desc: string; sub: StoryItem[] };

export type Story = {
  stages: Stage[];
  /** Every event, oldest first. */
  history: StoryItem[];
  /** Sent back and the technician has not set a new date since. */
  awaitingReaccept: boolean;
  /** Latest send-back reason. */
  sendBackReason: string | null;
  /** The last date change while the work is still going on. */
  dateChange: { from: string; to: string; reason?: string } | null;
};

const workByLabel = (w?: WorkBy | null) => (w === "contractor" ? "ช่างภายนอก" : w === "in_house" ? "ช่างของบริษัท" : "");

export function ticketStory(ticket: TicketDetail, viewer: StoryViewer, meId: string): Story {
  // Priority is staff-side (CR-011): its events never reach the reporter or a follower, on screen or in print.
  const general = viewer === "reporter" || viewer === "follower";
  const events = ticket.timeline.filter((e) => !(general && e.type === "priority_changed")).sort((a, b) => a.at.localeCompare(b.at));
  const you = viewer === "reporter" ? "คุณ" : "ผู้แจ้ง";
  const reporterName = viewer === "reporter" ? "คุณ" : ticket.reporter.name;

  // Walk the events once: label each, remember the dates and the last send back.
  let lastDate: string | undefined;
  let afterSendBack = false;
  let dateChange: Story["dateChange"] = null;
  let sendBackReason: string | null = null;
  const items = new Map<string, StoryItem>();
  const reaccepts = new Set<string>();
  for (const e of events) {
    const actor = e.actor?.name ?? "";
    let title = "";
    let detail = "";
    let warn = false;
    switch (e.type) {
      case "created":
        title = "แจ้งงาน"; detail = `${ticket.reporter.name} · แนบรูป ${ticket.photos.length} รูป`; break;
      case "subscribed":
        title = e.actor?.id === meId ? "คุณติดตามงานนี้" : `${actor} ติดตามงานนี้`;
        detail = [e.note, e.photos.length ? `แนบรูปเพิ่ม ${e.photos.length} รูป` : ""].filter(Boolean).join(" · ") || "แจ้งเรื่องเดียวกัน";
        break;
      case "assessed":
        title = "เริ่มดำเนินการ";
        detail = [actor, e.data.expectedDoneOn && `คาดว่าจะเสร็จ ${dayLabel(e.data.expectedDoneOn)}`, workByLabel(e.data.workBy)].filter(Boolean).join(" · ");
        lastDate = e.data.expectedDoneOn ?? lastDate;
        break;
      case "assessment_changed": {
        const to = e.data.expectedDoneOn;
        const reason = e.data.reason;
        if (afterSendBack) {
          title = "ช่างรับแก้ไข"; reaccepts.add(e.id);
          detail = [to && `กำหนดวันเสร็จใหม่เป็น ${dayLabel(to)}`, reason].filter(Boolean).join(" · ");
        } else if (to && lastDate && to !== lastDate) {
          title = "เลื่อนวันเสร็จ"; warn = true;
          detail = [`จาก ${dayLabel(lastDate)} เป็น ${dayLabel(to)}`, reason].filter(Boolean).join(" · ");
          dateChange = { from: lastDate, to, reason };
        } else {
          title = "เปลี่ยนผู้ซ่อม";
          detail = [workByLabel(e.data.workBy), reason].filter(Boolean).join(" · ");
        }
        afterSendBack = false;
        lastDate = to ?? lastDate;
        break;
      }
      case "resolved":
        title = "ช่างแจ้งว่าซ่อมเสร็จ";
        detail = [e.note, e.photos.length ? `แนบรูป ${e.photos.length} รูป` : ""].filter(Boolean).join(" · ");
        dateChange = null;
        break;
      case "sent_back":
        title = `${you}ส่งกลับให้แก้`; warn = true; detail = e.note ? `“${e.note}”` : "";
        afterSendBack = true; sendBackReason = e.note; dateChange = null;
        break;
      case "confirmed":
        title = `${you}ประเมินตรวจงานและปิดงาน`;
        detail = [e.data.rating && `${e.data.rating}/5 · ${RATING_LABELS[e.data.rating]}`, ticket.ratingComment].filter(Boolean).join(" · ");
        break;
      case "auto_closed":
        title = "ระบบปิดงานอัตโนมัติ"; detail = "ไม่ได้ประเมินตรวจงานภายใน 3 วัน"; break;
      case "team_handled":
        title = "ทีมดำเนินการเอง"; detail = e.note ?? ""; break;
      case "handed_over":
        title = "ส่งต่อให้ช่าง"; detail = e.note ?? ""; break;
      case "admin_closed":
        title = "Admin ปิดงาน"; detail = e.note ?? ""; break;
      case "priority_changed":
        title = "ปรับความเร่งด่วน";
        detail = e.data.from && e.data.to ? `จาก ${PRIORITY_LABELS[e.data.from]} เป็น ${PRIORITY_LABELS[e.data.to]}` : "";
        break;
    }
    items.set(e.id, { id: e.id, at: e.at, title, detail, warn });
  }
  const item = (e: TimelineEvent) => items.get(e.id)!;
  const of = (...types: TimelineEvent["type"][]) => events.filter((e) => types.includes(e.type));

  const resolves = of("resolved");
  const finalResolve = ticket.status === "resolved" || ticket.status === "closed" ? resolves.at(-1) : undefined;
  const firstAssess = of("assessed")[0];
  const sentBacks = of("sent_back");
  const awaitingReaccept = ticket.step === "reworking" && afterSendBack;
  const technician = ticket.technician?.name ?? "ช่าง";
  const expected = ticket.expectedDoneOn ? dayLabel(ticket.expectedDoneOn, true) : "";
  const closedNoRepair = ticket.status === "closed" && !finalResolve;
  const teamOrAdmin = of("admin_closed", "team_handled").at(-1);

  const stages: Stage[] = [{
    key: "created", state: "done", title: "แจ้งงาน", time: dateTime(ticket.createdAt),
    desc: `${reporterName} ส่งรายละเอียดและรูป ${ticket.photos.length} รูป`, sub: of("subscribed").map(item),
  }];

  // รับเรื่อง happens on send (D-060); the technician then sets the date (เริ่มดำเนินการ).
  stages.push(ticket.step === "awaiting_assessment"
    ? { key: "received", state: "now", title: "รับเรื่อง", time: dateTime(ticket.createdAt), desc: viewer === "technician" ? "รอคุณกำหนดวันเสร็จและกดเริ่มดำเนินการ" : "รอช่างกำหนดวันที่คาดว่าจะเสร็จ", sub: [] }
    : { key: "received", state: "done", title: "รับเรื่อง", time: dateTime(ticket.createdAt), desc: "งานถึงช่างแล้ว", sub: [] });

  const workSub = of("assessment_changed", "priority_changed", "handed_over").filter((e) => !reaccepts.has(e.id) && (!sentBacks.length || e.at < sentBacks[0].at)).map(item);
  if (ticket.step === "awaiting_assessment") {
    stages.push({ key: "work", state: "later", title: "กำลังดำเนินการ", desc: "ช่างกำหนดวันเสร็จและใครซ่อม แล้วเริ่มซ่อม", sub: [] });
  } else if (ticket.step === "in_repair") {
    stages.push({ key: "work", state: "now", title: "กำลังดำเนินการ", desc: [`คาดว่าจะเสร็จ ${expected}`, ticket.technician?.name].filter(Boolean).join(" · "), sub: workSub });
  } else if (firstAssess || ticket.assessedAt) {
    stages.push({
      key: "work", state: "done", title: "กำลังดำเนินการ", time: dateTime(firstAssess?.at ?? ticket.assessedAt!),
      desc: [firstAssess?.actor?.name ?? technician, firstAssess?.data.expectedDoneOn && `คาดว่าจะเสร็จ ${dayLabel(firstAssess.data.expectedDoneOn)}`, workByLabel(firstAssess?.data.workBy ?? ticket.workBy)].filter(Boolean).join(" · "),
      sub: workSub,
    });
  } else if (closedNoRepair) {
    stages.push({ key: "work", state: "done", title: ticket.closedReason ? CLOSED_LABELS[ticket.closedReason] : "ปิดงานแล้ว", time: teamOrAdmin ? dateTime(teamOrAdmin.at) : undefined, desc: teamOrAdmin?.note ?? "", sub: [] });
  }

  // ส่งกลับให้แก้ appears only after a send back (CR-009).
  if (sentBacks.length) {
    const sub = events.filter((e) => e.at >= sentBacks[0].at && (e.type === "sent_back" || reaccepts.has(e.id) || (e.type === "resolved" && e !== finalResolve) || e.type === "assessment_changed")).map(item);
    stages.push(ticket.step === "reworking"
      ? { key: "rework", state: "now", title: "ส่งกลับให้แก้", time: dateTime(sentBacks.at(-1)!.at), desc: awaitingReaccept ? "รอช่างกำหนดวันเสร็จใหม่" : `ช่างกำลังแก้ไข คาดว่าจะเสร็จ ${expected}`, sub }
      : { key: "rework", state: "done", title: "ส่งกลับให้แก้", time: dateTime(sentBacks.at(-1)!.at), desc: `${you}ส่งกลับ ${sentBacks.length} ครั้ง · ช่างแก้ไขแล้ว`, sub });
  }

  if (finalResolve) {
    stages.push({ key: "done", state: "done", title: "เสร็จ", time: dateTime(finalResolve.at), desc: `${finalResolve.actor?.name ?? technician} แนบรูปหลังซ่อม`, sub: [] });
  } else if (!closedNoRepair) {
    stages.push({ key: "done", state: "later", title: "เสร็จ", desc: `ช่างแนบรูปหลังซ่อมให้${you}ดู`, sub: [] });
  }

  if (ticket.status === "closed") {
    const closing = of("confirmed", "auto_closed", "admin_closed", "team_handled").at(-1);
    const desc = ticket.closedReason === "confirmed" && ticket.rating
      ? `${you}ให้ ${ticket.rating} ดาว · ${RATING_LABELS[ticket.rating]}`
      : ticket.closedReason === "auto_closed" ? "ไม่ได้ประเมินภายใน 3 วัน ระบบจึงปิดงานให้" : ticket.closedReason ? CLOSED_LABELS[ticket.closedReason] : "";
    stages.push({ key: "review", state: "done", title: ticket.closedReason === "auto_closed" ? "ปิดงานอัตโนมัติ" : "ประเมินตรวจงาน", time: closing ? dateTime(closing.at) : ticket.closedAt ? dateTime(ticket.closedAt) : undefined, desc, sub: [] });
  } else if (ticket.step === "awaiting_rating") {
    stages.push({
      key: "review", state: "now", title: viewer === "reporter" ? "รอคุณประเมินตรวจงาน" : "รอผู้แจ้งประเมินตรวจงาน",
      desc: ticket.autoCloseAt ? `ปิดเองอัตโนมัติ ${dateTime(ticket.autoCloseAt)} ถ้าไม่ได้ตอบ` : "ดูผลซ่อม แล้วประเมินหรือส่งกลับให้แก้", sub: [],
    });
  } else {
    stages.push({ key: "review", state: "later", title: "ประเมินตรวจงาน", desc: `${you}ดูผลแล้วให้ 1–5 ดาว งานจึงปิด`, sub: [] });
  }

  return {
    stages,
    history: events.map(item),
    awaitingReaccept,
    sendBackReason,
    dateChange: ticket.step === "in_repair" || ticket.step === "reworking" ? dateChange : null,
  };
}
