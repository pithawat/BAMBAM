"use client";

/* eslint-disable @next/next/no-img-element -- print report: plain images keep their mm size; photo paths are authenticated API URLs (HANDOFF). */
import { useEffect, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { QrSvg } from "@/components/shared/qr-svg";
import type { Photo, TicketDetail } from "../types";
import { categoryName, dateTime, dayLabel, placeLine, PRIORITY_LABELS, RATING_LABELS, stepLabel, ticketHref, ticketTitle, workByText } from "./ticket-presentation";
import type { Stage, Story, StoryViewer } from "./ticket-story";

// S07 PDF report (CR-039, D-144): what the page prints / saves as PDF, laid out like the owner's sample
// (`changes/CR-039/`): logo · `รายงานการดำเนินงาน` + ticket no · QR to this ticket's S07 page; `ข้อมูลทั่วไป`, then
// one key / value table per job step that has happened (from ticket-story, so the reporter / follower never see
// priority), photos under their step; footer on every page via `@page` margin boxes (Chrome / Edge). Hidden on screen.

const REPORT_CSS = `
.tr { color: #1f2937; font-size: 10.5pt; line-height: 1.5; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
.tr-head { display: flex; align-items: center; gap: 6mm; padding-bottom: 3mm; border-bottom: 1.2mm solid var(--primary); }
.tr-logo { height: 13mm; width: auto; margin-right: auto; }
.tr-title { text-align: right; }
.tr-title h1 { margin: 0; font-size: 17pt; line-height: 1.3; font-weight: 700; color: #1e2a78; }
.tr-title p { margin: 1mm 0 0; font-size: 10.5pt; color: #6b7280; }
.tr-title b { color: #1f2937; font-weight: 700; }
.tr-qr { width: 22mm; height: 22mm; flex: none; }
.tr-qr svg { display: block; width: 100%; height: 100%; }
.tr-sec { margin-top: 6mm; }
.tr-sec h2 { margin: 0 0 2.5mm; padding-bottom: 1.5mm; border-bottom: 0.3mm solid #dbe3f5; font-size: 12.5pt; font-weight: 700; color: #1e2a78; break-after: avoid; }
.tr-table { width: 100%; border-collapse: separate; border-spacing: 0; table-layout: fixed; border: 0.3mm solid #e5e7eb; border-radius: 1.5mm; overflow: hidden; }
.tr-table td { padding: 2mm 3mm; border-top: 0.3mm solid #eef0f3; vertical-align: top; overflow-wrap: anywhere; white-space: pre-wrap; }
.tr-table tr:first-child td { border-top: 0; }
.tr-table tr { break-inside: avoid; }
.tr-k { background: #f8f9fb; color: #6b7280; font-size: 9.5pt; }
.tr-v { font-weight: 600; }
.tr-v.tr-plain { font-weight: 400; }
.tr-pill { display: inline-block; padding: 0.3mm 3mm; border-radius: 99mm; font-size: 9.5pt; font-weight: 700; }
.tr-photos { display: flex; flex-wrap: wrap; gap: 2.5mm; margin-top: 2.5mm; break-inside: avoid; }
.tr-photos figure { margin: 0; width: 38mm; }
.tr-photos img { display: block; width: 38mm; height: 28.5mm; object-fit: cover; border: 0.3mm solid #e5e7eb; border-radius: 1mm; }
.tr-photos figcaption { font-size: 8.5pt; color: #6b7280; }
.tr-muted { color: #9ca3af; font-weight: 400; }
`;

/** CSS string literal for an `@page` margin box. */
const cssText = (s: string) => `"${s.replace(/[\\"]/g, "\\$&").replace(/\n/g, " ")}"`;

/** Whole days from report to close (or now); "11 วัน" as in the sample. */
export function workDuration(ticket: Pick<TicketDetail, "createdAt" | "closedAt">, now = new Date()) {
  const end = ticket.closedAt ? new Date(ticket.closedAt) : now;
  const days = Math.floor((end.getTime() - new Date(ticket.createdAt).getTime()) / 86_400_000);
  return days < 1 ? "น้อยกว่า 1 วัน" : `${days} วัน`;
}

const STEP_PILL: Record<TicketDetail["step"], string> = {
  awaiting_assessment: "--status-new", in_repair: "--status-in-progress", reworking: "--status-rework", awaiting_rating: "--status-resolved", closed: "--status-closed",
};

type Row = [string, ReactNode] | [string, ReactNode, string, ReactNode];

function Table({ rows }: { rows: Row[] }) {
  const v = (x: ReactNode) => (x === "" || x === null || x === undefined ? "-" : x);
  return <table className="tr-table">
    <colgroup><col style={{ width: "19%" }} /><col style={{ width: "31%" }} /><col style={{ width: "19%" }} /><col style={{ width: "31%" }} /></colgroup>
    <tbody>{rows.map((r, i) => <tr key={i}>
    <td className="tr-k">{r[0]}</td>
    {r.length === 4 ? <><td className="tr-v">{v(r[1])}</td><td className="tr-k">{r[2]}</td><td className="tr-v">{r[2] ? v(r[3]) : null}</td></>
      : <td className="tr-v tr-plain" colSpan={3}>{v(r[1])}</td>}
  </tr>)}</tbody></table>;
}

function Photos({ title, photos }: { title: string; photos: Photo[] }) {
  if (!photos.length) return null;
  return <div className="tr-photos" aria-label={title}>{photos.map((p, i) => <figure key={p.id}>
    <img src={p.thumbUrl} alt="" />
    <figcaption>{title} {i + 1}</figcaption>
  </figure>)}</div>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="tr-sec"><h2>{title}</h2>{children}</section>;
}

const subRows = (s: Stage): Row[] => s.sub.map((e) => [`${e.title}\n${dateTime(e.at, true)}`, e.detail]);

export function TicketReport({ ticket, viewer, story }: { ticket: TicketDetail; viewer: StoryViewer; story: Story }) {
  const staff = viewer === "technician" || viewer === "staff";
  const [origin] = useState(() => (typeof window === "undefined" ? "" : window.location.origin));
  const [printedAt, setPrintedAt] = useState(() => new Date().toISOString());
  // The print date is "now" for every print, including Ctrl+P.
  useEffect(() => {
    const onBefore = () => flushSync(() => setPrintedAt(new Date().toISOString()));
    window.addEventListener("beforeprint", onBefore);
    return () => window.removeEventListener("beforeprint", onBefore);
  }, []);

  const symptoms = [...ticket.symptoms.map((s) => s.name), ...(ticket.symptomOther ? [ticket.symptomOther] : [])].join(" · ");
  const place = [ticket.building.name, placeLine(ticket)].filter(Boolean).join(" · ");
  const pill = STEP_PILL[ticket.step];
  const fixer = staff && ticket.workBy === "in_house" && ticket.assignee ? ticket.assignee.name : ticket.technician && ticket.workBy ? ticket.technician.name : "";
  const footer = `@page {
    @bottom-left { content: ${cssText(`เอกสารนี้ถูกสร้างโดยระบบอัตโนมัติ | วันที่พิมพ์: ${dateTime(printedAt, true)}`)}; font-size: 7.5pt; color: #9ca3af; }
    @bottom-center { content: "หน้า " counter(page) "/" counter(pages); font-size: 7.5pt; color: #374151; }
    @bottom-right { content: "BAMBAM · CPAC"; font-size: 7.5pt; color: #9ca3af; }
  }`;

  const sections = story.stages.filter((s) => s.state !== "later" && s.key !== "created").map((s) => {
    const state = s.state === "now" ? "อยู่ในขั้นตอนนี้" : "เสร็จแล้ว";
    switch (s.key) {
      case "work": return <Section key={s.key} title={s.title === "กำลังดำเนินการ" ? "ดำเนินการซ่อม" : s.title}>
        <Table rows={[["วันที่และเวลา", s.time ?? "", "สถานะขั้นตอน", state],
          ...(ticket.workBy ? [["ผู้ดำเนินการซ่อม", [fixer, workByText(ticket)].filter(Boolean).join(" · ")] as Row] : []),
          ...(ticket.expectedDoneOn && ticket.status === "in_progress" ? [["คาดว่าจะเสร็จ", dayLabel(ticket.expectedDoneOn, true)] as Row] : []),
          ["รายละเอียด", s.desc], ...subRows(s)]} />
        <Photos title="รูปประกอบ" photos={s.photos ?? []} />
      </Section>;
      case "done": {
        const r = ticket.result;
        return <Section key={s.key} title="ผลการซ่อม">
          <Table rows={[["วันที่และเวลา", s.time ?? "", "ผู้บันทึก", r?.by?.name ?? ticket.technician?.name ?? ""],
            ["ประเภทผู้ดำเนินการซ่อม", workByText(ticket)],
            ["สิ่งที่ช่างดำเนินการ", r?.note ?? ""],
            ...(staff && r?.contractorRating ? [["คะแนนช่างภายนอก", [`${r.contractorRating}/5 · ${RATING_LABELS[r.contractorRating]}`, r.contractorRatingComment].filter(Boolean).join(" · ")] as Row] : [])]} />
          <Photos title="หลังซ่อม" photos={r?.photos ?? []} />
        </Section>;
      }
      case "review": {
        const rated = ticket.status === "closed" && ticket.closedReason === "confirmed" && ticket.rating;
        return <Section key={s.key} title={rated ? "ประเมินผล" : s.title}>
          <Table rows={[["วันที่และเวลา", s.time ?? "", "สถานะขั้นตอน", state],
            ...(rated ? [["คะแนน", `${ticket.rating}/5 · ${RATING_LABELS[ticket.rating!]}`] as Row, ["ความคิดเห็น", ticket.ratingComment ?? ""] as Row] : [["รายละเอียด", s.desc] as Row])]} />
        </Section>;
      }
      default: return <Section key={s.key} title={s.title}>
        <Table rows={[["วันที่และเวลา", s.time ?? "", "สถานะขั้นตอน", state], ["รายละเอียด", s.desc], ...subRows(s)]} />
      </Section>;
    }
  });
  const created = story.stages.find((s) => s.key === "created");

  return <div className="tr hidden print:block" data-testid="ticket-report">
    <style>{REPORT_CSS}{footer}</style>
    <header className="tr-head">
      <img src="/brand/bam-logo.webp" alt="BAMBAM" className="tr-logo" />
      <div className="tr-title">
        <h1>รายงานการดำเนินงาน</h1>
        <p>หมายเลขรายการ: <b>{ticket.ticketNo}</b></p>
      </div>
      {origin && <div className="tr-qr"><QrSvg text={`${origin}${ticketHref(ticket.id)}`} /></div>}
    </header>

    <Section title="ข้อมูลทั่วไป">
      <Table rows={[
        ["สถานะ", <span key="s" className="tr-pill" style={{ color: `var(${pill})`, background: `color-mix(in srgb, var(${pill}) 12%, #fff)` }}>{stepLabel(ticket)}</span>, "หมายเลขรายการ", ticket.ticketNo],
        ["หมวดงาน", categoryName(ticket), "ผู้แจ้ง", ticket.reporter.name],
        ["แผนกผู้แจ้ง", ticket.reporter.department ?? "", "วันที่แจ้ง", dateTime(ticket.createdAt, true)],
        ["ระยะเวลาดำเนินการ", workDuration(ticket), "", ""],
      ]} />
    </Section>

    <Section title="แจ้งซ่อม">
      <Table rows={[
        ["วันที่และเวลา", dateTime(ticket.createdAt, true), "ผู้บันทึก", ticket.reporter.name],
        ["สถานที่", place],
        ...(ticket.asset ? [["อุปกรณ์", `${ticket.asset.code} · ${ticket.asset.name}`] as Row] : []),
        ["หมวดงาน", categoryName(ticket)],
        ["อาการ", symptoms || ticketTitle(ticket)],
        ...(staff ? [["ความเร่งด่วน", PRIORITY_LABELS[ticket.priority]] as Row] : []),
        ["รายละเอียด", ticket.details ?? ""],
        ...(created ? subRows(created) : []),
      ]} />
      <Photos title="ก่อนซ่อม" photos={ticket.photos} />
    </Section>

    {sections}
  </div>;
}
