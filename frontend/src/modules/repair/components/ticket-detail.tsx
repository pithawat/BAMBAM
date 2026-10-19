"use client";

/* eslint-disable @next/next/no-img-element -- Authenticated API paths and mock data URLs require plain images (HANDOFF). */
import Link from "next/link";
import { useState, type ComponentProps, type ReactNode } from "react";
import {
  ArrowLeft, CalendarClock, Camera, Check, ChevronRight, CircleCheck, ClipboardList, Clock, Copy, FileText, FolderCheck, Hourglass,
  Image as ImageIcon, List, MapPin, Printer, RotateCcw, Star, UserRound, Wrench, X, type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { PriorityBadge } from "@/components/shared/priority-indicator";
import { useCurrentUser } from "@/components/shared/me-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { GENERIC_ERROR } from "../errors";
import type { Photo, TicketDetail, TicketStep } from "../types";
import { PhotoLightbox } from "./photo-gallery";
import { useTicketActions } from "./ticket-actions";
import { ticketReturnHref } from "./ticket-navigation";
import { categoryName, dateTime, dayLabel, PRIORITY_LABELS, RATING_LABELS, shortDate, STEP, stepLabel, ticketTitle, timeOf, workByText } from "./ticket-presentation";
import { storyViewer, ticketStory, type Stage, type Story, type StoryViewer } from "./ticket-story";
import { TicketFailure, TicketSkeleton } from "./ticket-ui";
import { usePriorityReason } from "./use-priority-reason";
import { useTicket } from "./use-ticket";

// S07 ติดตามงานซ่อม (CR-011, CR-012): breadcrumb + back / print, the heading (number, status, what, when it was
// reported), then what happens now (the reporter's rating card, or the next-action card with the actions from
// `allowedActions`), the job facts (where, category, symptoms, date, reporter / fixer), the repair evidence (what
// the technician did, before / after photos, the report) and the blue vertical timeline on the right. Priority,
// contractor and other staff-side facts show for technician / staff only; ticket-story drops staff-only events.

const STEP_ICON: Record<TicketStep, LucideIcon> = {
  awaiting_assessment: Clock, in_repair: Wrench, reworking: RotateCcw, awaiting_rating: Star, closed: FolderCheck,
};

export function TicketDetailScreen({ id }: { id: string }) {
  const me = useCurrentUser();
  const technician = me.role === "technician";
  const [backHref] = useState(() => (technician ? "/repair/work" : ticketReturnHref(id)));
  const { ticket, loading, error, reload, replace } = useTicket(id);
  const listLabel = technician ? "งานซ่อม" : "ติดตามงานซ่อม";
  return <div className="mx-auto w-full max-w-290 px-4 pt-4 pb-8 lg:px-0 lg:pt-1 print:max-w-none print:p-0">
    <nav aria-label="เส้นทางหน้า" className="print:hidden">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-muted-foreground">
        <li><Link href="/" className="rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">หน้าแรก</Link></li>
        <li aria-hidden><ChevronRight className="size-3.5" /></li>
        <li><Link href={backHref} className="rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">แจ้งซ่อม · {listLabel}</Link></li>
        <li aria-hidden><ChevronRight className="size-3.5" /></li>
        <li aria-current="page" className="text-foreground">รายละเอียดงาน</li>
      </ol>
    </nav>
    <div className="mt-2 mb-3 flex items-center gap-2 print:hidden">
      <Link href={backHref} className="mr-auto inline-flex min-h-11 items-center gap-1.5 rounded-sm text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
        <ArrowLeft className="size-4" aria-hidden />กลับไป{listLabel}
      </Link>
      {ticket && <Button type="button" variant="ghost" className="h-11 px-3" onClick={() => window.print()}><Printer aria-hidden />พิมพ์งานนี้</Button>}
    </div>
    {loading ? <TicketSkeleton /> : error ? <TicketFailure error={error} onRetry={reload} /> : ticket && <TicketBody ticket={ticket} onChanged={replace} />}
  </div>;
}

function TicketBody({ ticket, onChanged }: { ticket: TicketDetail; onChanged: (t: TicketDetail) => void }) {
  const me = useCurrentUser();
  const viewer = storyViewer(ticket, me.role);
  const story = ticketStory(ticket, viewer, me.id);
  const actions = useTicketActions(ticket, onChanged, { awaitingReaccept: story.awaitingReaccept });
  // The reporter rates from the card (CR-012); everyone else reads what happens now.
  const review = viewer === "reporter" && ticket.step === "awaiting_rating" && actions.allowed.has("confirm");
  return <>
    <Heading ticket={ticket} />
    <div className="mb-3 lg:mb-5">
      {review ? <ReviewCard ticket={ticket} actions={actions} />
        : <NextAction ticket={ticket} viewer={viewer} story={story} meId={me.id} executive={me.role === "executive"} actions={actions} />}
    </div>
    <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-5 print:block">
      <div className="grid min-w-0 gap-3 lg:gap-5 print:gap-4">
        <JobInfo ticket={ticket} viewer={viewer} story={story} />
        <Evidence ticket={ticket} viewer={viewer} story={story} />
      </div>
      <Progress ticket={ticket} story={story} />
    </div>
    <PrintHistory ticket={ticket} story={story} />
    {actions.dialogs}
  </>;
}

// ---- heading: number · status · what · when it was reported ----

function Heading({ ticket }: { ticket: TicketDetail }) {
  async function copy() {
    try { await navigator.clipboard.writeText(ticket.ticketNo); toast.success("คัดลอกเลขงานแล้ว"); }
    catch { toast.error(GENERIC_ERROR); }
  }
  return <header className="mb-4 sm:mb-5">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="flex items-center text-[13.5px] font-medium tracking-wide text-muted-foreground">{ticket.ticketNo}
        <button type="button" onClick={copy} aria-label="คัดลอกเลขงาน" className="grid size-10 place-items-center rounded-sm outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring print:hidden"><Copy className="size-4" aria-hidden /></button>
      </span>
      <StatusBadge ticket={ticket} />
    </div>
    <h1 id="ticket-title" className="text-2xl leading-9 font-semibold text-balance wrap-break-word sm:text-[28px] sm:leading-10 print:text-[23px]">{ticketTitle(ticket)}</h1>
    <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">แจ้งเมื่อ {shortDate(ticket.createdAt, true)} เวลา {timeOf(ticket.createdAt)} น.</p>
  </header>;
}

function StatusBadge({ ticket }: { ticket: TicketDetail }) {
  const Icon = STEP_ICON[ticket.step];
  return <span className={cn("inline-flex items-center gap-1.5 rounded-[5px] px-2 py-px text-[13px] leading-5 font-semibold", STEP[ticket.step].color)}>
    <Icon className="size-3.5" aria-hidden />{stepLabel(ticket)}
  </span>;
}

function Sub({ children, inline }: { children: ReactNode; inline?: boolean }) {
  return <small className={cn("text-[13px] leading-5 font-normal text-muted-foreground", inline ? "ml-2" : "block")}>{children}</small>;
}

// ---- the reporter's review card (CR-012): a tapped star opens S08 with that draft score; nothing submits here ----

type Actions = ReturnType<typeof useTicketActions>;

function ReviewCard({ ticket, actions }: { ticket: TicketDetail; actions: Actions }) {
  const autoClose = ticket.autoCloseAt ? `${shortDate(ticket.autoCloseAt, true)} เวลา ${timeOf(ticket.autoCloseAt)} น.` : "";
  return <section aria-labelledby="review-title" className="rounded-xl border bg-card px-4 pt-4 shadow-card sm:px-6 sm:pt-5 print:hidden">
    <div className="grid gap-x-8 gap-y-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="flex items-center gap-3.5">
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-lg bg-secondary text-primary"><CircleCheck className="size-5" /></span>
        <div className="min-w-0">
          <h2 id="review-title" className="text-lg leading-7 font-semibold">ซ่อมเสร็จแล้ว งานซ่อมเป็นอย่างไรบ้าง?</h2>
          <p className="text-[13px] leading-5 text-muted-foreground">ตรวจผลซ่อมด้านล่าง แล้วให้คะแนนความพึงพอใจ</p>
        </div>
      </div>
      <div className="flex flex-col items-center">
        <div role="group" aria-label="เลือกคะแนนเพื่อเปิดแบบประเมิน" className="flex gap-2 md:gap-1">
          {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" onClick={() => actions.confirm(n)} aria-label={`ประเมิน ${n} ดาว · ${RATING_LABELS[n]}`}
            className="group grid size-12 place-items-center rounded-sm text-muted-foreground/60 outline-none transition-colors hover:bg-secondary hover:text-primary focus-visible:bg-secondary focus-visible:text-primary focus-visible:ring-2 focus-visible:ring-ring md:size-11">
            <Star className="size-7 group-hover:fill-secondary group-focus-visible:fill-secondary" strokeWidth={1.5} aria-hidden />
          </button>)}
        </div>
        <button type="button" onClick={() => actions.confirm(0)} className="inline-flex min-h-11 items-center gap-0.5 rounded-sm px-2 text-[13px] text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
          ประเมินพร้อมความคิดเห็น<ChevronRight className="size-3.5" aria-hidden />
        </button>
      </div>
    </div>
    <div className="mt-2 flex flex-col gap-1 border-t py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="flex items-start gap-1.5 py-1.5 text-xs leading-5 text-muted-foreground"><Clock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {autoClose ? `ประเมินภายใน ${autoClose} ก่อนระบบปิดงานอัตโนมัติ` : "ตรวจรูปหลังซ่อม แล้วประเมินหรือส่งกลับให้แก้"}</span>
      {actions.allowed.has("send_back") && <button type="button" onClick={actions.sendBack}
        className="-ml-1 inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-sm px-1 text-[13px] font-medium outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring sm:ml-0">
        <RotateCcw className="size-3.5" aria-hidden />ยังไม่เรียบร้อย · ส่งกลับให้แก้</button>}
    </div>
  </section>;
}

// ---- next action (per viewer, actions from allowedActions) ----

function NextAction({ ticket, viewer, story, meId, executive, actions }: { ticket: TicketDetail; viewer: StoryViewer; story: Story; meId: string; executive: boolean; actions: Actions }) {
  const expected = ticket.expectedDoneOn ? dayLabel(ticket.expectedDoneOn, true) : "";
  const autoClose = ticket.autoCloseAt ? `${shortDate(ticket.autoCloseAt, true)} เวลา ${timeOf(ticket.autoCloseAt)} น.` : "";
  const primary = (label: string, Icon: LucideIcon, onClick: () => void) => <Button key={label} type="button" onClick={onClick} className="h-11 max-sm:w-full"><Icon aria-hidden />{label}</Button>;
  const outline = (label: string, Icon: LucideIcon | null, onClick: () => void) => <Button key={label} type="button" variant="outline" onClick={onClick} className="h-11 max-sm:w-full">{Icon && <Icon aria-hidden />}{label}</Button>;
  const closedText = ticket.closedReason === "confirmed" && ticket.rating ? `${ticket.rating}/5 · ${RATING_LABELS[ticket.rating]}` : "";
  const moved = story.dateChange ? `เลื่อนจาก ${dayLabel(story.dateChange.from)} เป็น ${dayLabel(story.dateChange.to)}${story.dateChange.reason ? ` · เหตุผล: ${story.dateChange.reason}` : ""}` : "";

  let icon: LucideIcon = STEP_ICON[ticket.step];
  let title = "";
  let desc = "";
  let note = "";
  const buttons: ReactNode[] = [];
  if (viewer === "technician") {
    const mine = ticket.technician?.id === meId;
    switch (ticket.step) {
      case "awaiting_assessment":
        icon = ClipboardList; title = "งานใหม่ รอคุณเริ่มดำเนินการ";
        desc = `ความเร่งด่วน${PRIORITY_LABELS[ticket.priority]} · กำหนดวันที่คาดว่าจะเสร็จและใครซ่อม แล้วผู้แจ้งจะได้รับแจ้งเตือนทันที`;
        if (actions.allowed.has("assess")) buttons.push(primary("เริ่มดำเนินการ", Check, actions.assess));
        break;
      case "in_repair":
        title = `${mine ? "คุณกำลังซ่อมงานนี้" : `${ticket.technician?.name ?? "ช่าง"} กำลังซ่อมงานนี้`} · คาดว่าจะเสร็จ ${expected}`;
        desc = "ซ่อมเสร็จแล้วถ่ายรูปหลังซ่อมและบันทึกผล ผู้แจ้งจะได้รับแจ้งเตือนให้ประเมินตรวจงาน";
        if (actions.allowed.has("assess")) buttons.push(outline("เลื่อนวันเสร็จ", CalendarClock, actions.assess));
        if (actions.allowed.has("resolve")) buttons.push(primary("บันทึกผลซ่อม", Camera, actions.resolve));
        break;
      case "reworking":
        title = "ผู้แจ้งส่งกลับให้แก้";
        desc = `${story.sendBackReason ? `“${story.sendBackReason}” · ` : ""}${story.awaitingReaccept ? "กำหนดวันเสร็จใหม่ แล้วกลับไปแก้" : `คาดว่าจะเสร็จ ${expected}`}`;
        if (story.awaitingReaccept) {
          if (actions.allowed.has("resolve")) buttons.push(outline("บันทึกผลอีกครั้ง", Camera, actions.resolve));
          if (actions.allowed.has("assess")) buttons.push(primary("กำหนดวันใหม่", CalendarClock, actions.assess));
        } else {
          if (actions.allowed.has("assess")) buttons.push(outline("เลื่อนวันเสร็จ", CalendarClock, actions.assess));
          if (actions.allowed.has("resolve")) buttons.push(primary("บันทึกผลอีกครั้ง", Camera, actions.resolve));
        }
        break;
      case "awaiting_rating":
        icon = Hourglass; title = "ส่งผลแล้ว รอผู้แจ้งประเมินตรวจงาน";
        desc = autoClose ? `ถ้าผู้แจ้งไม่ได้ตอบ ระบบจะปิดงานให้เองวันที่ ${autoClose}` : "ผู้แจ้งจะตรวจรูปหลังซ่อม แล้วประเมินหรือส่งกลับให้แก้";
        break;
      case "closed":
        title = "ปิดงานแล้ว"; desc = closedText ? `ผู้แจ้งประเมิน ${closedText}` : closedLine(ticket);
        break;
    }
  } else if (viewer === "reporter") {
    switch (ticket.step) {
      case "awaiting_assessment":
        title = "รับเรื่องแล้ว รอช่างกำหนดวันเสร็จ"; desc = "ตอนนี้คุณยังไม่ต้องทำอะไร เมื่อช่างกำหนดวันที่คาดว่าจะเสร็จ เราจะแจ้งเตือนคุณทันที"; break;
      case "in_repair":
        title = "ช่างกำลังดำเนินการ"; desc = `คาดว่าจะเสร็จ ${expected} · เมื่อซ่อมเสร็จ เราจะแจ้งเตือนให้คุณมาประเมินตรวจงาน`; note = moved; break;
      case "reworking":
        title = story.awaitingReaccept ? "ส่งกลับให้แก้แล้ว" : "ช่างกำลังแก้ไขตามที่คุณส่งกลับ";
        desc = story.awaitingReaccept
          ? `${story.sendBackReason ? `เหตุผล: ${story.sendBackReason} · ` : ""}รอช่างกำหนดวันเสร็จใหม่ คุณยังไม่ต้องประเมินซ้ำ`
          : `คาดว่าจะเสร็จ ${expected} · เราจะแจ้งเตือนเมื่อแก้ไขเสร็จ`;
        note = story.awaitingReaccept ? "" : moved;
        break;
      case "awaiting_rating":
        title = "ซ่อมเสร็จแล้ว รอคุณตรวจงาน";
        desc = "อ่านผลการซ่อมด้านล่าง แล้วประเมินตรวจงาน หากยังพบปัญหา ส่งกลับให้แก้ได้";
        note = autoClose ? `ถ้าไม่ได้ตอบ ระบบจะปิดงานให้เองวันที่ ${autoClose}` : "";
        if (actions.allowed.has("confirm")) buttons.push(primary("ประเมินตรวจงาน", Star, () => actions.confirm(0)));
        if (actions.allowed.has("send_back")) buttons.push(outline("ส่งกลับให้แก้", RotateCcw, actions.sendBack));
        break;
      case "closed":
        title = "งานนี้ปิดเรียบร้อยแล้ว"; desc = closedText ? `คุณประเมิน ${closedText} · ขอบคุณที่ช่วยดูแลที่ทำงานให้น่าอยู่` : closedLine(ticket);
        break;
    }
  } else {
    // Follower, admin, executive: what is happening (admin actions come with Stage 3).
    const line: Record<TicketStep, string> = {
      awaiting_assessment: "รับเรื่องแล้ว รอช่างกำหนดวันเสร็จ",
      in_repair: `ช่างกำลังดำเนินการ คาดว่าจะเสร็จ ${expected}`,
      reworking: "ผู้แจ้งส่งกลับให้ช่างแก้ไข เราจะแจ้งเตือนเมื่อแก้เสร็จ",
      awaiting_rating: "ซ่อมเสร็จแล้ว รอผู้แจ้งตรวจงาน",
      closed: closedText ? `ปิดงานแล้ว · ผู้แจ้งประเมิน ${closedText}` : `ปิดงานแล้ว · ${closedLine(ticket)}`,
    };
    if (viewer === "follower") {
      title = line[ticket.step]; desc = "คุณติดตามงานนี้ เราจะแจ้งเตือนเมื่อมีความคืบหน้า · ผู้แจ้งเป็นผู้ประเมินตรวจงานหรือส่งกลับให้แก้";
      note = ticket.step === "in_repair" ? moved : "";
    } else { title = stepLabel(ticket); desc = line[ticket.step] + (executive ? " · ผู้บริหารดูได้อย่างเดียว" : ""); }
  }

  const tone = ticket.step === "closed" ? "closed" : ticket.step === "reworking" ? "rework" : "open";
  const Icon = icon;
  return <div aria-live="polite" role="region" aria-label="สิ่งที่เกิดขึ้นตอนนี้"
    className="flex gap-3.5 rounded-xl border bg-card p-4 shadow-card sm:px-6 sm:py-5 print:break-inside-avoid print:shadow-none">
    <span aria-hidden className={cn("grid size-11 shrink-0 place-items-center rounded-lg",
      tone === "closed" ? "bg-success/10 text-success" : tone === "rework" ? "bg-status-rework/10 text-status-rework" : "bg-secondary text-primary")}><Icon className="size-5" /></span>
    <div className="min-w-0 flex-1">
      <h2 className="text-base leading-6 font-semibold">{title}</h2>
      <p className="mt-0.5 max-w-160 text-sm leading-5.5 text-muted-foreground">{desc}</p>
      {note && <p className={cn("mt-1.5 text-[13px] leading-5", note === moved ? "font-medium text-status-rework" : "text-muted-foreground")}>{note}</p>}
      {buttons.length > 0 && <div className="mt-3.5 flex flex-wrap items-center gap-2 print:hidden">{buttons}</div>}
    </div>
  </div>;
}

function closedLine(ticket: TicketDetail) {
  switch (ticket.closedReason) {
    case "auto_closed": return "ระบบปิดงานให้อัตโนมัติ เพราะไม่ได้ประเมินตรวจงานภายใน 3 วัน · ไม่มีคะแนน";
    case "admin_closed": return "Admin ปิดงานนี้";
    case "team_handled": return "ทีมดำเนินการเองแล้ว";
    default: return "ขอบคุณที่ช่วยดูแลที่ทำงานให้น่าอยู่";
  }
}

// ---- ข้อมูลงาน (CR-012): where · category · symptoms · date · reporter / fixer ----

function Panel({ className, children, ...props }: { className?: string; children: ReactNode } & ComponentProps<"section">) {
  return <section {...props} className={cn("min-w-0 overflow-hidden rounded-xl border bg-card shadow-card print:break-inside-avoid print:shadow-none", className)}>{children}</section>;
}

function JobInfo({ ticket, viewer, story }: { ticket: TicketDetail; viewer: StoryViewer; story: Story }) {
  const staff = viewer === "technician" || viewer === "staff";
  const reason = usePriorityReason(ticket);
  const muted = (t: string) => <span className="font-normal text-muted-foreground">{t}</span>;
  // A replaced date never reads as the current promise: after a send back it waits for the new one.
  const when: [string, ReactNode] = ticket.status === "in_progress"
    ? ["คาดว่าจะเสร็จ", ticket.step === "awaiting_assessment" ? muted("รอช่างกำหนด") : story.awaitingReaccept ? muted("รอช่างกำหนดวันใหม่") : ticket.expectedDoneOn ? dayLabel(ticket.expectedDoneOn, true) : muted("—")]
    : ticket.status === "closed" && !ticket.resolvedAt ? ["ปิดงานเมื่อ", ticket.closedAt ? <>{shortDate(ticket.closedAt, true)}<Sub inline>เวลา {timeOf(ticket.closedAt)} น.</Sub></> : muted("—")]
      : ["ซ่อมเสร็จเมื่อ", ticket.resolvedAt ? <>{shortDate(ticket.resolvedAt, true)}<Sub inline>เวลา {timeOf(ticket.resolvedAt)} น.</Sub></> : muted("—")];
  const symptoms = [...ticket.symptoms.map((s) => s.name), ...(ticket.symptomOther ? [ticket.symptomOther] : [])];
  // Priority stays staff-only; everyone sees the symptoms instead (owner, 2026-10-19, CR-012).
  const rows: [string, ReactNode][] = [
    ["หมวดงาน", categoryName(ticket)],
    ["อาการ", symptoms.length ? <span className="flex flex-wrap gap-1.5">{symptoms.map((s) => <span key={s} className="rounded-[5px] bg-muted px-2 text-sm leading-6 font-medium wrap-break-word">{s}</span>)}</span> : muted("—")],
    ...(ticket.asset ? [["อุปกรณ์", <>{ticket.asset.code}<Sub inline>{ticket.asset.name}</Sub></>] as [string, ReactNode]] : []),
    ...(staff ? [["ความเร่งด่วน", <><PriorityBadge priority={ticket.priority} className="align-middle" /><Sub inline>{reason}</Sub></>] as [string, ReactNode]] : []),
    when,
    ...(staff && ticket.result?.contractorRating ? [["คะแนนช่างภายนอก", <>{ticket.result.contractorRating}/5 · {RATING_LABELS[ticket.result.contractorRating]}{ticket.result.contractorRatingComment && <Sub inline>{ticket.result.contractorRatingComment}</Sub>}</>] as [string, ReactNode]] : []),
  ];
  const others = ticket.subscriberCount > 0 ? `ผู้ติดตาม ${ticket.subscriberCount} คน` : "";
  const fixer = ticket.technician && ticket.workBy ? ticket.technician : null;
  return <Panel aria-labelledby="job-title">
    <h2 id="job-title" className="px-4 pt-4 text-lg leading-7 font-semibold sm:px-6 sm:pt-5">ข้อมูลงาน</h2>
    <div className="flex items-center gap-3 px-4 pt-3 pb-4 sm:px-6">
      <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary text-primary"><MapPin className="size-5" /></span>
      <div className="min-w-0">
        <h3 className="text-xl leading-7 font-medium wrap-break-word">{ticket.building.name}</h3>
        <p className="text-sm leading-5.5 text-muted-foreground wrap-break-word">{[`ชั้น ${ticket.floor.name}`, ticket.locationDetail].filter(Boolean).join(" · ")}</p>
      </div>
    </div>
    <dl className="border-t px-4 sm:px-6">
      {rows.map(([k, v]) => <div key={k} className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-baseline gap-3 border-b py-2.5 last:border-0 sm:grid-cols-[7rem_minmax(0,1fr)]">
        <dt className="text-[13px] leading-5 text-muted-foreground">{k}</dt>
        <dd className="min-w-0 text-[15px] leading-6 font-medium wrap-break-word">{v}</dd>
      </div>)}
    </dl>
    <div className="grid gap-4 border-t bg-muted/30 px-4 py-4 sm:grid-cols-2 sm:px-6 print:grid-cols-2">
      <Person label="ผู้แจ้ง" name={viewer === "reporter" ? `${ticket.reporter.name} (คุณ)` : ticket.reporter.name} initialsOf={ticket.reporter.name}
        sub={[ticket.reporter.department, others].filter(Boolean).join(" · ")} />
      {fixer ? <Person label="ผู้ซ่อม" name={fixer.name} initialsOf={fixer.name} sub={workByText(ticket)} />
        : <Person label="ผู้ซ่อม" name={ticket.status === "in_progress" ? "รอช่างรับงาน" : "—"} sub={ticket.status === "in_progress" ? "จะแสดงเมื่อช่างเริ่มดำเนินการ" : ""} />}
    </div>
  </Panel>;
}

/** First letters of the first two words, skipping Thai leading vowels ("วรรณา สุขประเสริฐ" → "วส"). */
function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => [...w].find((c) => !/[เแโใไ]/.test(c)) ?? "").join("");
}

function Person({ label, name, sub, initialsOf }: { label: string; name: string; sub: string; initialsOf?: string }) {
  return <div className="flex min-w-0 items-center gap-2.5">
    <span aria-hidden className={cn("grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold", initialsOf ? "bg-secondary text-primary" : "border border-dashed bg-card text-muted-foreground")}>
      {initialsOf ? initials(initialsOf) : <UserRound className="size-4" />}
    </span>
    <div className="min-w-0">
      <span className="block text-xs leading-4.5 text-muted-foreground">{label}</span>
      <strong className={cn("block truncate text-sm leading-5.5 font-medium", !initialsOf && "text-muted-foreground")}>{name}</strong>
      {sub && <small className="block truncate text-xs leading-4.5 text-muted-foreground">{sub}</small>}
    </div>
  </div>;
}

// ---- รายละเอียดการซ่อม (CR-012): what the technician did → before / after photos → the report ----

function Evidence({ ticket, viewer, story }: { ticket: TicketDetail; viewer: StoryViewer; story: Story }) {
  const you = viewer === "reporter" ? "คุณ" : "ผู้แจ้ง";
  // The previous result stays readable during a rework.
  const result = ticket.result && (ticket.status !== "in_progress" || ticket.step === "reworking") ? ticket.result : null;
  const rework = ticket.step === "reworking";
  const closed = ticket.status === "closed";
  const [StatusIcon, statusText, statusTone] = rework ? [RotateCcw, "อยู่ระหว่างแก้ไข", "text-status-rework"]
    : result ? [CircleCheck, "บันทึกผลแล้ว", "text-success"]
      : closed ? [FolderCheck, "ไม่มีบันทึกผลซ่อม", "text-muted-foreground"] : [Clock, "รอผลการซ่อม", "text-muted-foreground"];
  const waiting = viewer === "technician" ? "ผู้แจ้ง" : you;
  return <Panel aria-labelledby="evidence-title">
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 pt-4 sm:px-6 sm:pt-5">
      <h2 id="evidence-title" className="text-lg leading-7 font-semibold">{rework && result ? "ผลซ่อมครั้งก่อน" : "รายละเอียดการซ่อม"}</h2>
      <span className="inline-flex items-center gap-1.5 text-xs leading-5 text-muted-foreground"><StatusIcon className={cn("size-4", statusTone)} aria-hidden />{statusText}</span>
    </div>
    <div className="mx-4 mt-4 flex items-start gap-3 rounded-lg bg-muted/60 p-4 sm:mx-6">
      <Wrench className="mt-0.5 size-4.5 shrink-0 text-muted-foreground max-sm:hidden" aria-hidden />
      <div className="min-w-0">
        {result ? <>
          <h3 className="text-[13px] leading-5 font-medium text-muted-foreground">สิ่งที่ช่างดำเนินการ</h3>
          <p className="mt-1 text-[15px] leading-relaxed whitespace-pre-wrap wrap-break-word">{result.note}</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{[result.by?.name ?? "ช่าง", result.at && `${shortDate(result.at, true)} เวลา ${timeOf(result.at)} น.`].filter(Boolean).join(" · ")}</p>
        </> : closed ? <>
          <h3 className="text-[13px] leading-5 font-medium text-muted-foreground">งานนี้ปิดโดยไม่มีบันทึกผลซ่อม</h3>
          <p className="mt-1 text-[15px] leading-relaxed">{closedLine(ticket)}</p>
        </> : <>
          <h3 className="text-[13px] leading-5 font-medium text-muted-foreground">{ticket.step === "awaiting_assessment" ? "รอช่างรับเรื่อง" : "ช่างกำลังดูแลงานนี้"}</h3>
          <p className="mt-1 text-[15px] leading-relaxed">เมื่อซ่อมเสร็จ ช่างจะบันทึกรายละเอียดและแนบรูปให้{waiting}ตรวจงานได้ที่นี่</p>
        </>}
      </div>
    </div>
    {rework && story.sendBackReason && <div className="mx-4 mt-3 rounded-lg border border-status-rework/20 bg-status-rework/6 px-4 py-3 text-sm sm:mx-6">
      <b className="font-semibold text-status-rework">เหตุผลที่ส่งกลับให้แก้</b><p className="mt-1 wrap-break-word">{story.sendBackReason}</p>
    </div>}
    <div className="grid gap-5 px-4 py-5 sm:grid-cols-2 sm:gap-4 sm:px-6 print:grid-cols-2">
      <PhotoSet title="ก่อนซ่อม" from={`จาก${you}`} photos={ticket.photos} empty="ไม่มีรูปแนบ" />
      <PhotoSet title={rework ? "หลังซ่อมครั้งก่อน" : "หลังซ่อม"} from="จากช่าง" photos={result?.photos ?? []}
        empty={result || closed ? "ไม่มีรูปหลังซ่อม" : "รอช่างบันทึกผลการซ่อม"} pending={!result && !closed} />
    </div>
    <div className="mx-4 border-t pt-4 pb-5 sm:mx-6">
      <h3 className="flex items-center gap-1.5 text-sm leading-6 font-semibold"><FileText className="size-4 text-muted-foreground" aria-hidden />รายละเอียดที่แจ้ง</h3>
      <p className="mt-1 text-[15px] leading-relaxed whitespace-pre-wrap wrap-break-word">{ticket.details || "ไม่มีรายละเอียดเพิ่มเติม"}</p>
      <p className="mt-1.5 text-xs leading-5 text-muted-foreground">แจ้งโดย{viewer === "reporter" ? "คุณ" : ` ${ticket.reporter.name}`} · {shortDate(ticket.createdAt, true)} เวลา {timeOf(ticket.createdAt)} น.</p>
    </div>
    {closed && ticket.closedReason === "confirmed" && ticket.rating && <div className="mx-4 mb-5 rounded-lg bg-muted/60 px-4 py-3 text-sm sm:mx-6">
      <p className="font-semibold">คะแนนจาก{you} <span className="tabular-nums">{ticket.rating}/5</span> · {RATING_LABELS[ticket.rating]}</p>
      <p className="mt-0.5 text-muted-foreground wrap-break-word">{ticket.ratingComment || "ไม่มีความคิดเห็นเพิ่มเติม"}</p>
    </div>}
  </Panel>;
}

/** One large photo, a thumbnail strip to switch it, and the full-screen lightbox. */
function PhotoSet({ title, from, photos, empty, pending }: { title: string; from: string; photos: Photo[]; empty: string; pending?: boolean }) {
  const [selected, setSelected] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const i = Math.min(selected, Math.max(photos.length - 1, 0));
  const EmptyIcon = pending ? Wrench : ImageIcon;
  return <article className="min-w-0">
    <header className="mb-2 flex items-baseline justify-between gap-2">
      <h3 className="text-sm leading-6 font-semibold">{title}</h3>
      <span className="text-xs text-muted-foreground">{from}</span>
    </header>
    {photos.length === 0
      ? <p className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/40 p-4 text-center text-[13px] text-muted-foreground print:aspect-auto print:py-6">
        <EmptyIcon className="size-5" aria-hidden />{empty}</p>
      : <>
        <button type="button" onClick={() => setLightbox(i)} aria-label={`ขยายรูป${title} ${i + 1} จาก ${photos.length}`}
          className="group relative block aspect-[4/3] w-full cursor-zoom-in overflow-hidden rounded-lg border bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <img src={photos[i].thumbUrl} alt="" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
          <span className="absolute right-2 bottom-2 rounded-[5px] border bg-card/95 px-1.5 text-xs leading-5 tabular-nums print:hidden">{photos.length > 1 ? `${i + 1} / ${photos.length} · ขยายรูป` : "ขยายรูป"}</span>
        </button>
        {photos.length > 1 && <div role="group" aria-label={`รูป${title}`} className="mt-2 flex flex-wrap gap-1.5 print:hidden">
          {photos.map((p, k) => <button key={p.id} type="button" onClick={() => setSelected(k)} aria-pressed={k === i} aria-label={`เลือกรูป${title} ${k + 1}`}
            className={cn("size-11 overflow-hidden rounded-md border bg-card p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring", k === i ? "border-primary ring-1 ring-primary" : "hover:border-primary/40")}>
            <img src={p.thumbUrl} alt="" className="size-full rounded-[4px] object-cover" />
          </button>)}
        </div>}
      </>}
    <PhotoLightbox photos={photos} index={lightbox} onIndexChange={(n) => { setLightbox(n); if (n !== null) setSelected(n); }} />
  </article>;
}

// ---- ความคืบหน้างาน (vertical timeline) ----

function Progress({ ticket, story }: { ticket: TicketDetail; story: Story }) {
  const [history, setHistory] = useState(false);
  // A planned date on the next "เสร็จ" stage tells everyone when to expect it.
  const planned = (s: Stage) => s.key === "done" && s.state === "later" && ticket.expectedDoneOn && !story.awaitingReaccept ? `คาดว่า ${dayLabel(ticket.expectedDoneOn, true)}` : undefined;
  return <Panel aria-labelledby="progress-title" className="p-4 sm:p-5 lg:sticky lg:top-26 print:hidden">
    <h2 id="progress-title" className="text-lg leading-7 font-semibold">ความคืบหน้าของงาน</h2>
    <p className="text-[13px] text-muted-foreground">ตั้งแต่แจ้งเรื่อง จนถึงปิดงาน</p>
    <ol className="mt-5">{story.stages.map((s, i) => <StageItem key={s.key} stage={s} planned={planned(s)} next={story.stages[i + 1]} />)}</ol>
    <Button type="button" variant="outline" className="mt-4 h-11 w-full" onClick={() => setHistory(true)}><List aria-hidden />ดูประวัติทั้งหมด</Button>
    <Dialog open={history} onOpenChange={setHistory}>
      <DialogContent showCloseButton={false} className="max-h-[88dvh] overflow-y-auto sm:max-w-140">
        <DialogHeader className="flex-row items-center justify-between"><DialogTitle>ประวัติทั้งหมด</DialogTitle>
          <DialogClose asChild><Button variant="ghost" size="icon" aria-label="ปิดประวัติ"><X /></Button></DialogClose></DialogHeader>
        <DialogDescription className="sr-only">ทุกเหตุการณ์ของงาน {ticket.ticketNo} เรียงจากเก่าไปใหม่</DialogDescription>
        <HistoryTable story={story} ticketNo={ticket.ticketNo} />
      </DialogContent>
    </Dialog>
  </Panel>;
}

function StageItem({ stage: s, planned, next }: { stage: Stage; planned?: string; next?: Stage }) {
  const rework = s.key === "rework";
  const time = s.time ?? planned;
  return <li aria-current={s.state === "now" ? "step" : undefined} className={cn("relative grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3.5", next && "pb-6")}>
    {/* The line is blue up to the current stage, grey after it. */}
    {next && <span aria-hidden className={cn("absolute top-8 bottom-1 left-[13px] w-0.5 rounded-full", s.state === "done" ? "bg-primary" : "bg-border")} />}
    {/* One SVG per marker: circle, halo and icon share one coordinate system, so they stay concentric at any
        display scaling (separate boxes snapped to device pixels apart at 125% / 150%). */}
    <svg aria-hidden viewBox="0 0 28 28" className={cn("relative size-7 overflow-visible", s.state === "later" ? "text-muted-foreground/70" : "text-primary")}>
      {s.state === "now" && <circle cx={14} cy={14} r={18} className="fill-primary/10" />}
      {s.state === "done"
        ? <circle cx={14} cy={14} r={14} className="fill-primary" />
        : <circle cx={14} cy={14} r={13} strokeWidth={2} className={cn("fill-card", s.state === "now" ? "stroke-primary" : "stroke-border")} />}
      {s.state === "done" ? <Check x={6} y={6} size={16} strokeWidth={3} className="text-white" />
        : rework ? <RotateCcw x={7} y={7} size={14} strokeWidth={2.5} /> : <Clock x={7} y={7} size={14} strokeWidth={2.5} />}
    </svg>
    <div className="min-w-0 pt-0.5">
      {time && <time className="block text-[13px] leading-5 text-muted-foreground">{time}</time>}
      <h3 className={cn("flex flex-wrap items-center gap-x-2 text-base leading-6", s.state === "later" ? "font-medium text-muted-foreground" : "font-semibold")}>
        {s.title}
        {s.state === "now" && <span className="rounded-[5px] bg-secondary px-2 text-xs leading-5 font-semibold text-secondary-foreground">ตอนนี้</span>}
        <span className="sr-only">{s.state === "done" ? " (เสร็จแล้ว)" : s.state === "later" ? " (ยังไม่ถึง)" : ""}</span>
      </h3>
      {s.desc && <p className={cn("mt-0.5 text-sm leading-5.5 wrap-break-word", s.state === "later" ? "text-muted-foreground/90" : "text-muted-foreground")}>{s.desc}</p>}
      {s.sub.length > 0 && <ul className="mt-2 grid gap-1.5 border-l border-border pl-3">{s.sub.map((e) => <li key={e.id} className={cn("text-[13px] leading-5", e.warn ? "text-status-rework" : "text-muted-foreground")}>
        <b className="font-semibold">{e.title}</b>{e.detail && ` · ${e.detail}`}<time className="block text-xs opacity-80">{dateTime(e.at)}</time>
      </li>)}</ul>}
    </div>
  </li>;
}

function HistoryTable({ story, ticketNo }: { story: Story; ticketNo: string }) {
  return <table className="w-full border-collapse text-sm"><caption className="sr-only">ประวัติงาน {ticketNo}</caption><tbody>{story.history.map((e) => <tr key={e.id} className="border-b align-top last:border-0">
    <td className="w-32 py-2.5 pr-3 text-xs text-muted-foreground tabular-nums">{dateTime(e.at, true)}</td>
    <td className="py-2.5"><b className="font-semibold">{e.title}</b>{e.detail && <small className="block text-[13px] text-muted-foreground">{e.detail}</small>}</td>
  </tr>)}</tbody></table>;
}

// ---- print report (A4) ----

function PrintHistory({ ticket, story }: { ticket: TicketDetail; story: Story }) {
  return <section className="hidden print:mt-5 print:block">
    <h2 className="mb-3 text-[15px] font-semibold">ประวัติการดำเนินงาน</h2>
    <HistoryTable story={story} ticketNo={ticket.ticketNo} />
    <div className="mt-12 mb-3 flex justify-around text-center text-[11px]">
      {["ผู้แจ้ง", "ผู้ซ่อม", "ผู้อนุมัติ"].map((r) => <span key={r}>__________________<br />{r}</span>)}
    </div>
    <p className="text-[10px] text-muted-foreground">BAMBAM · CPAC สำนักงานใหญ่ · {ticket.ticketNo} · พิมพ์เมื่อ {dateTime(new Date().toISOString(), true)}</p>
  </section>;
}
