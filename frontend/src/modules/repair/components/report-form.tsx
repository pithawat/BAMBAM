"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle, ArrowLeft, Bell, Building2, Camera, Check, ChevronDown, ChevronRight, CircleCheck, ClipboardCheck, DoorOpen, FileText, History, Info, Loader2, MapPin,
  RotateCcw, Send, SquareParking, Upload, Wrench,
} from "lucide-react";
import { MascotPanel } from "@/components/shared/mascot";
import { PriorityBadge } from "@/components/shared/priority-indicator";
import { useCurrentUser } from "@/components/shared/me-provider";
import { can, canReport, PERM, repairHome } from "@/lib/platform/permissions";
import { ErrorState, ForbiddenState } from "@/components/shared/states";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { clearDraftPhotos, purgeExpiredDraftPhotos, readDraftPhotos, saveDraftPhotos } from "@/lib/draft-photos";
import { clearDraft, draftKey, readDraft, writeDraft } from "@/lib/drafts";
import { initials } from "@/lib/platform/roles";
import { cn } from "@/lib/utils";
import { createTicket, followTicket, getDuplicates, getBuildings, getCategories, getRecentPlaces, MAX_PHOTOS } from "../api";
import { createTicketFieldErrors, duplicateMatches, ownTicketAwaitingRating, errorCode, errorMessage } from "../errors";
import { priorityReason, ticketPriority, type PriorityResult } from "../priority";
import { categoryUsedIn } from "../types";
import type { Building, Category, DuplicateTicket, Floor, Photo, RecentPlace, Room } from "../types";
import { DuplicateCard, DuplicateDialog } from "./duplicate-dialog";
import { CategoryTile, categoryIcon } from "./category-icon";
import { forgetUploads, keptPhoto, photoBlocker, PhotoListLightbox, PhotoPicker, PhotoTile, uploadKeptPhotos, usePhotoList, type PhotoItem } from "./photo-picker";
import { floorLabel, listDate, timeOf } from "./ticket-presentation";
import { useDiscardGuard } from "@/components/shared/use-discard-guard";

// S03 แจ้งซ่อมใหม่ — CR-014 wizard (docs/modules/repair/ui/screens/S03-report-form.md CR-014 block, visual
// reference docs/modules/repair/changes/CR-014/form-steps.html), place first since CR-025: 3 steps สถานที่ →
// ปัญหาที่พบ (only the categories of the building's type, BR-F02-8) → รูปภาพและส่ง in one frame. Only the current step is rendered, at its own height (CR-022: no reserved heights, the room
// cards grow with the floor's rooms). Phone / tablet: sticky footer. The system sets the priority (BR-F02-2).
// CR-021: the mode is fixed by the entry point (/repair/new = repair, ?mode=team = team for leads). CR-025: the duplicate
// card sits under the symptoms of step 2 with an inline extra spot; a blocking duplicate stops ถัดไป there.

const MAX_OTHER = 100;
const MAX_LOCATION = 100;
const MAX_DETAILS = 500;
/** Drafts saved before CR-026 A1 kept uploaded photo ids; unattached photos expire after 24 h (D-022), so older ones are dropped. */
const UPLOADED_PHOTO_TTL_MS = 20 * 60 * 60 * 1000;

type Values = {
  categoryId: string;
  /** Typed category name, only under the "อื่น ๆ" category (CR-014, optional). */
  categoryOther: string;
  symptomIds: string[];
  /** "อาการอื่นๆ" ticked → `symptomOther` required. */
  symptomOtherOn: boolean;
  symptomOther: string;
  details: string;
  buildingId: string;
  floorId: string;
  roomId: string;
  /** บอกจุดเพิ่มเติม (optional extra spot). */
  locationDetail: string;
  teamNote: string;
};
const initial: Values = {
  categoryId: "", categoryOther: "", symptomIds: [], symptomOtherOn: false, symptomOther: "", details: "",
  buildingId: "", floorId: "", roomId: "", locationDetail: "", teamNote: "",
};
const SPOT_REQUIRED = "กรุณาระบุจุดที่ต่างจากงานเดิม ก่อนดำเนินการต่อ";
const CATEGORY_CLEARED = "หมวดงานที่เลือกไว้ไม่มีในอาคารประเภทนี้ เลือกใหม่อีกครั้ง";
const NO_CATEGORY: Partial<Values> = { categoryId: "", categoryOther: "", symptomIds: [], symptomOtherOn: false, symptomOther: "" };

type StepKey = "problem" | "location" | "send";
const STEPS: { key: StepKey; label: string }[] = [
  { key: "location", label: "สถานที่" },
  { key: "problem", label: "ปัญหาที่พบ" },
  { key: "send", label: "รูปภาพและส่ง" },
];
const FIELD_STEP: Record<string, StepKey> = {
  categoryId: "problem", categoryOther: "problem", symptomIds: "problem", symptomOther: "problem",
  buildingId: "location", floorId: "location", roomId: "location", locationDetail: "location",
  /** BR-F03-2 block: the inline extra spot in the step-2 duplicate card (CR-025). */
  duplicateSpot: "problem",
  photoIds: "send", details: "send",
  "teamHandled.note": "send", "teamHandled.photoIds": "send",
};

/**
 * v1 drafts (CR-008, 4 steps, no room) are read too; their steps map onto the 3 CR-014 steps. CR-026 A1: the photo
 * files are in IndexedDB (lib/draft-photos.ts); `photoCount` says how many were kept, `photos` / `teamPhotos` only
 * hold uploads of older drafts.
 */
type Draft = { v: 1; savedAt: number; step: string; values: Partial<Values>; photos: Photo[]; teamPhotos?: Photo[]; photoCount?: number };
const draftStep = (s: string): StepKey => (s === "location" ? "location" : s === "photo" || s === "review" || s === "send" ? "send" : "problem");

function validate(values: Values, photos: PhotoItem[], teamPhotos: PhotoItem[] = [], team = false, blocked = false): Record<string, string> {
  const e: Record<string, string> = {};
  if (!values.categoryId) e.categoryId = "กรุณาเลือกหมวดงาน";
  else if (!values.symptomIds.length && !values.symptomOtherOn) e.symptomIds = "เลือกอาการอย่างน้อย 1 ข้อ";
  if (values.symptomOtherOn && !values.symptomOther.trim()) e.symptomOther = "ระบุอาการอื่นๆ";
  if (!values.buildingId) e.buildingId = "กรุณาเลือกอาคาร";
  else if (!values.floorId) e.floorId = "กรุณาเลือกชั้น";
  else if (!values.roomId) e.roomId = "เลือกห้องหรือจุดที่เกิด";
  if (values.locationDetail.length > MAX_LOCATION) e.locationDetail = "ไม่เกิน 100 ตัวอักษร";
  else if (blocked) e.duplicateSpot = SPOT_REQUIRED; // BR-F03-2 (CR-021, CR-025): another spot, or follow the case
  if (values.details.length > MAX_DETAILS) e.details = "ไม่เกิน 500 ตัวอักษร";
  const photoWait = photoBlocker(photos);
  if (photoWait) e.photoIds = photoWait;
  else if (!photos.length) e.photoIds = "ถ่ายหรือแนบรูปปัญหาอย่างน้อย 1 รูป";
  if (team) {
    if (!values.teamNote.trim()) e["teamHandled.note"] = "กรุณาบอกสิ่งที่ทีมทำ";
    else if (values.teamNote.length > MAX_DETAILS) e["teamHandled.note"] = "ไม่เกิน 500 ตัวอักษร";
    const teamWait = photoBlocker(teamPhotos);
    if (teamWait) e["teamHandled.photoIds"] = teamWait;
    else if (!teamPhotos.length) e["teamHandled.photoIds"] = "แนบรูปหลังทำอย่างน้อย 1 รูป";
  }
  return e;
}

const isDirty = (v: Values, photos: PhotoItem[]) =>
  photos.length > 0 || (Object.keys(initial) as (keyof Values)[]).some((k) => JSON.stringify(v[k]) !== JSON.stringify(initial[k]));

/** Keeps only what still exists in the master data (a draft can be days old; the master can change on submit). */
function sanitizeValues(input: Partial<Values>, categories: Category[], buildings: Building[]): Values {
  const v = { ...initial, ...input };
  const category = categories.find((c) => c.id === v.categoryId);
  if (!category) Object.assign(v, { categoryId: "", categoryOther: "", symptomIds: [], symptomOtherOn: false, symptomOther: "" });
  else {
    v.symptomIds = v.symptomIds.filter((id) => category.symptoms.some((s) => s.id === id));
    if (!category.isOther) v.categoryOther = "";
  }
  const building = buildings.find((b) => b.id === v.buildingId);
  const floor = building?.floors.find((f) => f.id === v.floorId);
  if (!building) Object.assign(v, { buildingId: "", floorId: "", roomId: "" });
  else if (!floor) Object.assign(v, { floorId: "", roomId: "" });
  else if (!floor.rooms.some((r) => r.id === v.roomId)) v.roomId = "";
  if (categoryNotUsed(v, categories, buildings)) Object.assign(v, NO_CATEGORY); // BR-F02-8 (CR-025)
  return v;
}

/** The picked category exists but the picked building's type does not use it (CR-025). */
function categoryNotUsed(v: Pick<Values, "categoryId" | "buildingId">, categories: Category[], buildings: Building[]) {
  const category = categories.find((c) => c.id === v.categoryId);
  const building = buildings.find((b) => b.id === v.buildingId);
  return !!category && !!building && !categoryUsedIn(category, building);
}

/** The first step (in wizard order) that still has a problem, or undefined. */
const firstOpenStep = (errors: Record<string, string>) => STEPS.find((s) => Object.keys(errors).some((k) => FIELD_STEP[k] === s.key))?.key;

function sanitizeDraft(d: Draft, categories: Category[], buildings: Building[]): { values: Values; photos: PhotoItem[] } {
  const values = sanitizeValues(d.values, categories, buildings);
  const fresh = Date.now() - d.savedAt < UPLOADED_PHOTO_TTL_MS;
  const photos: PhotoItem[] = fresh
    ? (d.photos ?? []).filter((p) => !p.url.startsWith("blob:")).slice(0, MAX_PHOTOS)
      .map((photo) => ({ key: photo.id, preview: photo.thumbUrl, status: "done", progress: 1, photo }))
    : [];
  return { values, photos };
}

const REPORT_FORBIDDEN = "บัญชีนี้ไม่มีสิทธิ์แจ้งซ่อม กรุณาติดต่อผู้ดูแลระบบ";

/** The route entry: the mode comes from the URL and a new mode mounts a fresh form (no state leaks between modes). */
export function ReportForm() {
  const me = useCurrentUser();
  const mode = useSearchParams().get("mode");
  const canTeam = can(me, PERM.ticketTeamHandle);
  const team = canTeam && mode === "team";
  // settings CR-006: reporting needs `repair.ticket.report`; a lead's team record needs only team_handle (the API agrees)
  if (!team && !canReport(me)) return <ForbiddenState reason={REPORT_FORBIDDEN} action={{ label: "ไปที่งานซ่อม", href: repairHome(me) }} />;
  return <ReportFormBody key={team ? "team" : "repair"} team={team} canTeam={canTeam} />;
}

function ReportFormBody({ team, canTeam }: { team: boolean; canTeam: boolean }) {
  const me = useCurrentUser();
  // Drafts are kept per mode (CR-021).
  const storageKey = draftKey(team ? "repair-team" : "repair-report", me.employeeCode);
  const [values, setValues] = useState<Values>(initial);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [teamPhotos, setTeamPhotos] = useState<PhotoItem[]>([]);
  const [matches, setMatches] = useState<{ key: string; room: string; tickets: DuplicateTicket[] }>({ key: "", room: "", tickets: [] });
  /** CR-034: the room + category for which a blocking duplicate was seen — the extra spot stays required (`*`) for it. */
  const [blockedRoom, setBlockedRoom] = useState("");
  const [duplicateDialog, setDuplicateDialog] = useState<DuplicateTicket[] | null>(null);
  const [following, setFollowing] = useState<string | null>(null);
  const [step, setStep] = useState<StepKey>("location");
  /** A building change (or restore) dropped a category its type does not use: note in step 2 (CR-025). */
  const [categoryCleared, setCategoryCleared] = useState(false);
  const [attempted, setAttempted] = useState<StepKey[]>([]);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [master, setMaster] = useState<{ categories: Category[]; buildings: Building[] }>();
  const [recent, setRecent] = useState<RecentPlace[]>([]);
  const [masterError, setMasterError] = useState(false);
  const [masterReloading, setMasterReloading] = useState(false);
  const [revision, setRevision] = useState(0);
  const [ready, setReady] = useState(false);
  const [restoredAt, setRestoredAt] = useState<number | null>(null);
  /** The draft had photos that could not be restored (storage blocked or older than 24 h): `แนบรูปอีกครั้ง`. */
  const [photosLost, setPhotosLost] = useState(false);
  /** `กำลังส่งรูป {n}/{m}…` while the submit uploads the kept photos (CR-026 A1). */
  const [sending, setSending] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const submitting = useRef(false);
  const frame = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const dirty = isDirty(values, photos) || teamPhotos.length > 0;
  const guard = useDiscardGuard(dirty);
  const roomKey = JSON.stringify([values.categoryId, values.floorId, values.roomId]);
  const duplicateKey = JSON.stringify([roomKey, values.locationDetail]);
  // The card stays while the spot is being typed (no flicker); only the check for the current spot can block.
  const duplicates = matches.room === roomKey ? matches.tickets : [];
  const blocked = matches.key === duplicateKey && duplicates.some((t) => t.blocksReport);
  const spotRequired = blockedRoom === roomKey;
  // The duplicate check for the current room + category + spot has not answered yet (ถัดไป waits for it, CR-034).
  const checkingDuplicates = !!(values.categoryId && values.floorId && values.roomId) && matches.key !== duplicateKey;
  useEffect(() => {
    if (!values.categoryId || !values.floorId || !values.roomId) return;
    let active = true;
    const timer = window.setTimeout(() => {
      getDuplicates({ categoryId: values.categoryId, floorId: values.floorId, roomId: values.roomId, locationDetail: values.locationDetail })
        .then(tickets => {
          if (!active) return;
          setMatches({ key: duplicateKey, room: roomKey, tickets });
          if (tickets.some((t) => t.blocksReport)) setBlockedRoom(roomKey);
        }, () => { if (active) setMatches({ key: duplicateKey, room: roomKey, tickets: [] }); });
    }, 300);
    return () => { active = false; window.clearTimeout(timer); };
  }, [duplicateKey, roomKey, values.categoryId, values.floorId, values.roomId, values.locationDetail]);

  useEffect(() => {
    let active = true;
    Promise.all([getCategories(), getBuildings()]).then(async ([categories, buildings]) => {
      if (!active) return;
      // Restore the local draft once per visit (design-system.md "Draft"); its photo files come from
      // IndexedDB, entries older than 24 h are deleted first (CR-026 A1).
      const draft = readDraft<Draft>(storageKey);
      let kept: { photos: PhotoItem[]; team: PhotoItem[] } | null = null;
      if (draft?.v === 1 && draft.photoCount) {
        await purgeExpiredDraftPhotos();
        const stored = await readDraftPhotos(storageKey).catch(() => null);
        if (stored) kept = { photos: (stored.groups.photos ?? []).map(keptPhoto), team: (stored.groups.team ?? []).map(keptPhoto) };
      }
      if (!active) { kept?.photos.concat(kept.team).forEach((p) => URL.revokeObjectURL(p.preview)); return; }
      setMaster({ categories, buildings }); setMasterError(false);
      if (draft?.v === 1) {
        const restored = sanitizeDraft(draft, categories, buildings);
        const cleared = categoryNotUsed({ ...initial, ...draft.values }, categories, buildings);
        const photos = [...restored.photos, ...(kept?.photos ?? [])].slice(0, MAX_PHOTOS);
        const team = [...sanitizeDraft({ ...draft, photos: draft.teamPhotos ?? [] }, categories, buildings).photos, ...(kept?.team ?? [])].slice(0, MAX_PHOTOS);
        if (isDirty(restored.values, photos) || team.length) {
          // Open on the saved step, or earlier when an earlier step is no longer complete (CR-025 order).
          const saved = draftStep(draft.step);
          const open = firstOpenStep(validate(restored.values, [{ key: "x", preview: "", status: "ready", progress: 0 }]));
          setValues(restored.values); setPhotos(photos); setRestoredAt(draft.savedAt); setCategoryCleared(cleared);
          setStep(open && STEPS.findIndex((x) => x.key === open) < STEPS.findIndex((x) => x.key === saved) ? open : saved);
          setTeamPhotos(team);
          setPhotosLost((draft.photoCount ?? 0) > (kept ? kept.photos.length + kept.team.length : 0));
        }
      }
      setReady(true);
    }, () => { if (active) setMasterError(true); });
    getRecentPlaces().then((list) => { if (active) setRecent(list); }, () => { if (active) setRecent([]); });
    return () => { active = false; };
  }, [revision, storageKey]);

  // cacheComponents keeps a visited route alive (hidden) with its state. Leaving the form means the
  // report was sent or discarded (the draft is already cleared then), so start the next visit fresh.
  useEffect(() => () => {
    setValues(initial); setPhotos([]); setStep("location"); setAttempted([]); setServerErrors({}); setSubmitError(""); setCategoryCleared(false);
    setMasterError(false); setReady(false); setRestoredAt(null); setPhotosLost(false); setSending("");
    setTeamPhotos([]); setDuplicateDialog(null); setFollowing(null); setMatches({ key: "", room: "", tickets: [] });
    submitting.current = false; setBusy(false);
  }, []);

  // Save the draft while typing. CR-026 A1: the photo files go to IndexedDB (24 h); only uploads of a
  // pre-A1 draft (no file) stay referenced by id.
  useEffect(() => {
    if (!ready || submitting.current) return;
    if (!dirty) { clearDraft(storageKey); void clearDraftPhotos(storageKey); return; }
    const uploadedOnly = (items: PhotoItem[]) => items.flatMap((p) => !p.file && p.photo ? [p.photo] : []);
    const files = (items: PhotoItem[]) => items.flatMap((p) => p.file ? [p.file] : []);
    const photoCount = files(photos).length + files(teamPhotos).length;
    writeDraft(storageKey, { v: 1, savedAt: Date.now(), step, values, photos: uploadedOnly(photos), teamPhotos: uploadedOnly(teamPhotos), photoCount } satisfies Draft);
    void saveDraftPhotos(storageKey, { photos: files(photos), team: files(teamPhotos) });
  }, [ready, dirty, values, photos, teamPhotos, step, storageKey]);
  /** Sent, reset, discarded or moved on: the draft and its photos go (CR-026 A1). */
  function dropDraft() {
    clearDraft(storageKey); void clearDraftPhotos(storageKey);
  }

  const categories = master?.categories ?? [];
  const buildings = master?.buildings ?? [];
  const category = categories.find((c) => c.id === values.categoryId);
  const building = buildings.find((b) => b.id === values.buildingId);
  const floor = building?.floors.find((f) => f.id === values.floorId);
  const room = floor?.rooms.find((r) => r.id === values.roomId);
  const checks = validate(values, photos, teamPhotos, team, blocked);
  const shown = { ...Object.fromEntries(Object.entries(checks).filter(([k]) => attempted.includes(FIELD_STEP[k]))), ...serverErrors };
  const stepDone = (key: StepKey) => !Object.keys(checks).some((k) => FIELD_STEP[k] === key);
  // CR-034 (BR-F02-1a): ถัดไป / the final button cannot be pressed while this step has a missing field; the hint says what.
  const missing = Object.entries(checks).find(([k]) => FIELD_STEP[k] === step)?.[1]
    ?? (step === "problem" && checkingDuplicates ? "กำลังตรวจงานที่ตรงกัน…" : "");
  const index = STEPS.findIndex((s) => s.key === step);
  const last = step === "send";
  // BR-F02-2: explain the level as soon as it is known.
  const priority = category && (values.symptomIds.length || (values.symptomOtherOn && values.symptomOther.trim()))
    ? ticketPriority(category, values.symptomIds) : null;

  function update(input: Partial<Values>) {
    let patch = input;
    // BR-F02-8 (CR-025): another building whose type does not use the picked category drops it.
    if (input.buildingId !== undefined && input.buildingId !== values.buildingId && categoryNotUsed({ categoryId: values.categoryId, buildingId: input.buildingId }, categories, buildings)) {
      patch = { ...input, ...NO_CATEGORY }; setCategoryCleared(true);
    }
    setValues((old) => ({ ...old, ...patch }));
    setServerErrors((old) => {
      const next = { ...old };
      for (const k of Object.keys(patch)) delete next[k];
      if ("teamNote" in patch) delete next["teamHandled.note"];
      if ("categoryId" in patch) { delete next.symptomIds; delete next.symptomOther; delete next.categoryOther; }
      if ("symptomIds" in patch || "symptomOtherOn" in patch) delete next.symptomIds;
      if ("buildingId" in patch) { delete next.floorId; delete next.roomId; }
      if ("locationDetail" in patch) delete next.duplicateSpot;
      if ("floorId" in patch) delete next.roomId;
      return next;
    });
  }
  /** Changing the category clears its symptoms and typed text; the room stays (CR-014). */
  function pickCategory(id: string) {
    if (id === values.categoryId) return;
    setCategoryCleared(false);
    update({ categoryId: id, symptomIds: [], symptomOtherOn: false, symptomOther: "", categoryOther: "" });
  }
  function focusStep(next: StepKey, field?: string) {
    window.requestAnimationFrame(() => {
      const panel = frame.current?.querySelector<HTMLElement>(`[data-step="${next}"]`);
      const el = field ? panel?.querySelector<HTMLElement>(`[data-field="${field}"] input:not(:disabled):not([type=file]), [data-field="${field}"] textarea, [data-field="${field}"] button:not(:disabled)`) : null;
      if (el) { el.focus(); el.scrollIntoView({ block: "center", behavior: "smooth" }); return; }
      panel?.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
      document.getElementById("report-progress")?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }
  function go(next: StepKey, field?: string) {
    setStep(next); setSubmitError(""); focusStep(next, field);
  }
  /** ถัดไป checks only this step; the final button re-checks every step and opens the first invalid one. */
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || missing) return;
    const keys: StepKey[] = last ? STEPS.map((s) => s.key) : [step];
    setAttempted((old) => [...new Set([...old, ...keys])]);
    const firstBad = Object.keys(checks).find((k) => keys.includes(FIELD_STEP[k]));
    if (firstBad) { go(FIELD_STEP[firstBad], firstBad); return; }
    if (!last) { go(STEPS[index + 1].key); return; }

    submitting.current = true; setBusy(true); setSubmitError(""); setServerErrors({});
    // CR-026 A1: a blocking duplicate is found before any photo is sent (the server checks again on #5).
    const blocking = await getDuplicates({ categoryId: values.categoryId, floorId: values.floorId, roomId: values.roomId, locationDetail: values.locationDetail })
      .then((list) => list.filter((t) => t.blocksReport), () => []);
    if (blocking.length) { setDuplicateDialog(blocking); submitting.current = false; setBusy(false); return; }
    let photoIds: string[], teamPhotoIds: string[];
    try {
      [photoIds, teamPhotoIds] = await uploadKeptPhotos([{ items: photos, onChange: setPhotos }, { items: team ? teamPhotos : [], onChange: setTeamPhotos }],
        (n, m) => setSending(`กำลังส่งรูป ${n}/${m}…`));
    } catch (err: unknown) {
      const refused = errorCode(err) === "PHOTO_TYPE_NOT_ALLOWED" || errorCode(err) === "PHOTO_TOO_LARGE";
      const field = photos.some((p) => !p.photo) ? "photoIds" : "teamHandled.photoIds";
      if (refused) setServerErrors({ [field]: "มีรูปที่อัปโหลดไม่สำเร็จ ลองใหม่หรือลบรูปนั้น" });
      go("send", field); setSubmitError("ลองอีกครั้ง ข้อมูลและรูปในฟอร์มยังอยู่ครบ"); // go() clears the banner
      setSending(""); submitting.current = false; setBusy(false); return;
    }
    setSending("");
    try {
      const ticket = await createTicket({
        categoryId: values.categoryId,
        ...(category?.isOther && values.categoryOther.trim() ? { categoryOther: values.categoryOther.trim() } : {}),
        symptomIds: values.symptomIds,
        ...(values.symptomOtherOn && values.symptomOther.trim() ? { symptomOther: values.symptomOther.trim() } : {}),
        buildingId: values.buildingId,
        floorId: values.floorId,
        roomId: values.roomId,
        ...(values.locationDetail.trim() ? { locationDetail: values.locationDetail.trim() } : {}),
        ...(values.details.trim() ? { details: values.details.trim() } : {}),
        photoIds,
        teamHandled: team ? { note: values.teamNote.trim(), photoIds: teamPhotoIds } : null,
      });
      dropDraft();
      // Stays busy until the route is hidden; the effect cleanup above resets the form.
      guard.finish(`/repair/new/done?id=${encodeURIComponent(ticket.id)}`);
    } catch (err: unknown) {
      const code = errorCode(err);
      const duplicateTickets = duplicateMatches(err);
      const ownId = ownTicketAwaitingRating(err);
      if (duplicateTickets !== null) {
        setDuplicateDialog(duplicateTickets); submitting.current = false; setBusy(false); return;
      }
      if (ownId) { toast.error(errorMessage(err)); dropDraft(); guard.finish(`/repair/tickets/${encodeURIComponent(ownId)}`); return; }
      if (code === "TEAM_HANDLED_NOT_ALLOWED") { toast.error(errorMessage(err)); submitting.current = false; setBusy(false); return; }
      const fields = createTicketFieldErrors(err);
      setServerErrors(fields);
      setSubmitError(code === "MASTER_DATA_CHANGED" || code === "CATEGORY_NOT_FOR_BUILDING" || code === "PHOTO_NOT_FOUND" || code === "FORBIDDEN" ? errorMessage(err) : "ลองอีกครั้ง ข้อมูลและรูปในฟอร์มยังอยู่ครบ");
      const field = Object.keys(fields)[0];
      if (field && FIELD_STEP[field]) go(FIELD_STEP[field], field);
      // The uploads of this attempt are no longer usable: the next submit sends the kept files again.
      if (code === "PHOTO_NOT_FOUND") { setPhotos(forgetUploads); setTeamPhotos(forgetUploads); setServerErrors({ photoIds: errorMessage(err) }); go("send", "photoIds"); }
      if (code === "MASTER_DATA_CHANGED" || code === "CATEGORY_NOT_FOR_BUILDING") {
        // Reload the master and keep what is still valid; open the first step that needs a new pick.
        // CATEGORY_NOT_FOR_BUILDING (CR-025): the category always goes, even if the reloaded master still lists it.
        setMasterReloading(true);
        try {
          const [cats, blds] = await Promise.all([getCategories(), getBuildings()]);
          setMaster({ categories: cats, buildings: blds });
          let next = sanitizeValues(values, cats, blds);
          if (code === "CATEGORY_NOT_FOR_BUILDING") { next = { ...next, ...NO_CATEGORY }; setCategoryCleared(true); }
          setValues(next);
          setAttempted(STEPS.map((s) => s.key));
          const errors = validate(next, photos);
          const open = firstOpenStep(errors) ?? "problem";
          go(open, Object.keys(errors).find((k) => FIELD_STEP[k] === open));
        } catch { setMasterError(true); }
        finally { setMasterReloading(false); }
      }
      submitting.current = false; setBusy(false);
    }
  }
  function resetForm() {
    dropDraft();
    setValues(initial); setPhotos([]); setStep("location"); setAttempted([]); setServerErrors({}); setSubmitError(""); setCategoryCleared(false);
    setRestoredAt(null); setPhotosLost(false); setResetOpen(false);
    setTeamPhotos([]); setDuplicateDialog(null);
    focusStep("location");
  }

  async function follow(ticket: DuplicateTicket) {
    if (submitting.current) return;
    const wait = photoBlocker(photos);
    if (wait) { toast.error(wait); return; }
    submitting.current = true; setFollowing(ticket.id);
    let photoIds: string[];
    try {
      // CR-026 A1: the photos of the form go up only now (#3), then #23 attaches them.
      [photoIds] = await uploadKeptPhotos([{ items: photos, onChange: setPhotos }]);
    } catch {
      toast.error("ส่งไม่สำเร็จ ลองอีกครั้ง"); submitting.current = false; setFollowing(null); return;
    }
    try {
      const result = await followTicket(ticket.id, { note: values.details.trim() || undefined, photoIds });
      toast.success(`คุณติดตามเคส ${result.ticketNo} แล้ว`);
      dropDraft(); guard.finish(`/repair/tickets/${encodeURIComponent(result.id)}`);
    } catch (err) {
      const code = errorCode(err);
      if (code === "ALREADY_FOLLOWING") {
        toast.error(errorMessage(err)); dropDraft(); guard.finish(`/repair/tickets/${encodeURIComponent(ticket.id)}`); return;
      }
      if (code === "PHOTO_NOT_FOUND") setPhotos(forgetUploads);
      if (code === "TICKET_CLOSED") {
        toast.error(errorMessage(err, { ticketClosed: "follow" }));
        setMatches(old => ({ ...old, tickets: old.tickets.filter(t => t.id !== ticket.id) }));
        setDuplicateDialog(old => old === null ? null : old.filter(t => t.id !== ticket.id));
      } else toast.error("ติดตามเคสไม่สำเร็จ ลองอีกครั้ง");
      submitting.current = false; setFollowing(null);
    }
  }
  const duplicateProps = { category: category?.name ?? "", busyId: following, disabled: busy, onFollow: follow,
    onVisit: (ticket: DuplicateTicket) => guard.leave(`/repair/tickets/${encodeURIComponent(ticket.id)}`) };
  const duplicateCard = duplicates.length > 0 ? <DuplicateCard {...duplicateProps} tickets={duplicates} /> : null;
  // Step 2 (S04 CR-025): the card carries the extra spot, bound to the same value as step 1.
  // CR-034: once a blocking match was seen for this room + category, the spot keeps `*` after it is typed.
  const blockingCard = spotRequired || duplicates.some((t) => t.blocksReport);
  const problemCard = duplicates.length > 0 ? <DuplicateCard {...duplicateProps} tickets={duplicates}>
    <div data-field="duplicateSpot" className="border-t border-primary/15 pt-3.5">
      <Label htmlFor="duplicateSpot" required={blockingCard} help={blockingCard ? "จำเป็นเมื่อพบงานที่ตรงกัน" : undefined} optional={!blockingCard}>บอกจุดเพิ่มเติม</Label>
      <Input id="duplicateSpot" value={values.locationDetail} maxLength={MAX_LOCATION} onChange={(e) => update({ locationDetail: e.target.value })} placeholder="เช่น ฝั่งหน้าต่าง เครื่องที่ 2"
        aria-invalid={!!(shown.duplicateSpot || shown.locationDetail)} aria-describedby="duplicateSpot-error" className="h-11 rounded-sm bg-card px-3.5 text-base" />
      <FieldError id="duplicateSpot-error" message={shown.duplicateSpot ?? shown.locationDetail} />
    </div>
  </DuplicateCard> : null;
  const visibleCategories = building ? categories.filter((c) => categoryUsedIn(c, building)) : categories;
  const teamFields = canTeam ? <section hidden={!team} aria-label="งานที่ทีมทำ" className="space-y-4 rounded-lg border bg-muted/30 p-4">
    <div data-field="teamHandled.note">
      <Label htmlFor="team-note" required>สิ่งที่ทีมทำ</Label>
      <Textarea id="team-note" value={values.teamNote} onChange={e => update({ teamNote: e.target.value })} maxLength={500} rows={4}
        placeholder="เช่น เช็ดพื้นและวางป้ายระวังลื่นแล้ว" aria-invalid={!!shown["teamHandled.note"]} aria-describedby="team-note-error" />
      <FieldError id="team-note-error" message={shown["teamHandled.note"]} />
    </div>
    <div data-field="teamHandled.photoIds" role="group" aria-labelledby="team-photos-label" aria-describedby="team-photos-error">
      <Label id="team-photos-label" required>รูปหลังทำ</Label>
      <PhotoPicker id="team-photoIds" describedBy="team-photos-error" value={teamPhotos} onChange={next => { setTeamPhotos(next); setServerErrors(old => { const result = { ...old }; delete result["teamHandled.photoIds"]; return result; }); }} disabled={busy || following !== null} invalid={!!shown["teamHandled.photoIds"]} />
      <FieldError id="team-photos-error" message={shown["teamHandled.photoIds"]} />
    </div>
  </section> : null;

  // CR-019 heading (prototype v4): breadcrumb, guide mascot, title, ล้างแบบฟอร์ม (CR-035: on the primary mascot panel). Leaving stays guarded
  // (useDiscardGuard catches link clicks); the footer's ยกเลิก on step 1 replaces the old phone top bar.
  const header = <header className="px-4 pt-3 lg:px-0 lg:pt-0">
    <nav aria-label="เส้นทางหน้า">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-muted-foreground">
        <li><Link href="/" className="rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">หน้าแรก</Link></li>
        <li aria-hidden><ChevronRight className="size-3.5" /></li>
        <li><Link href="/repair/my" className="rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">แจ้งซ่อม</Link></li>
        <li aria-hidden><ChevronRight className="size-3.5" /></li>
        <li aria-current="page" className="text-foreground">{team ? "บันทึกงานที่ทีมแก้แล้ว" : "แจ้งซ่อมใหม่"}</li>
      </ol>
    </nav>
    <MascotPanel pose="guide" size={[84, 120]} priority className="mt-3 mb-4 lg:mb-5"
      aside={dirty && master && <Button type="button" variant="link" className="h-9 px-0" disabled={busy || following !== null} onClick={() => setResetOpen(true)}>ล้างแบบฟอร์ม</Button>}>
      <h1 className="text-2xl leading-9 font-semibold tracking-tight lg:text-[28px] lg:leading-10">{team ? "บันทึกงานที่ทีมแก้แล้ว" : "แจ้งซ่อมใหม่"}</h1>
      <p className="mt-0.5 text-sm leading-6 text-primary-foreground/88">{team ? "บันทึกปัญหาที่ทีมแก้ไขแล้ว พร้อมหลักฐานก่อนและหลังดำเนินการ งานจะปิดทันที ไม่ส่งถึงช่าง" : "กรอกทีละขั้น แล้วตรวจข้อมูลก่อนส่งให้ช่าง"} <span className="whitespace-nowrap">· ช่องที่มี <span className="rounded-[4px] bg-card px-1 font-semibold text-destructive">*</span> จำเป็นต้องกรอก</span></p>
    </MascotPanel>
  </header>;
  const discard = <AlertDialog open={guard.open} onOpenChange={guard.setOpen}><AlertDialogContent className="top-auto bottom-0 w-full max-w-none translate-y-0 rounded-b-none rounded-t-xl lg:top-1/2 lg:bottom-auto lg:max-w-lg lg:-translate-y-1/2 lg:rounded-xl"><AlertDialogHeader><AlertDialogTitle>ทิ้งข้อมูลที่กรอกไว้?</AlertDialogTitle><AlertDialogDescription>ข้อมูลและรูปที่แนบในหน้านี้จะหายไป</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>กรอกต่อ</AlertDialogCancel><Button variant="destructive" onClick={() => { dropDraft(); guard.discard(); }}>ทิ้งข้อมูล</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>;

  if (masterError && !master) return <>{header}<ErrorState onRetry={() => { setMasterError(false); setRevision((r) => r + 1); }} />{discard}</>;
  if (!master) return <>{header}<FormSkeleton /></>;
  if (!categories.length) return <>{header}<ForbiddenState title="ยังไม่มีหมวดงานในระบบ ติดต่อ Admin" />{discard}</>;

  const panel = (key: StepKey, content: ReactNode) => {
    const on = step === key;
    // Only the current step shows; the frame follows its height (CR-022).
    return <section key={key} data-step={key} aria-labelledby={`step-${key}-title`} aria-hidden={!on || undefined} inert={!on}
      className={cn("min-w-0", on ? "block" : "hidden")}>
      {content}
    </section>;
  };
  const stepHeading = (key: StepKey, title: ReactNode, sub: string, aside?: ReactNode) => <div className="mb-4 flex flex-wrap items-start gap-x-3 gap-y-2">
    <div className="min-w-0 flex-1">
      <h2 id={`step-${key}-title`} tabIndex={-1} className="text-lg leading-7 font-semibold outline-none sm:text-xl">{title}</h2>
      <p className="text-sm text-muted-foreground">{sub}</p>
    </div>
    {stepDone(key) && <span className="mt-1 inline-flex shrink-0 items-center gap-1 text-sm font-medium text-success"><CircleCheck className="size-4" aria-hidden />ครบแล้ว</span>}
    {aside && <div className="w-full sm:w-auto">{aside}</div>}
  </div>;

  return <>{header}
    <form ref={formRef} onSubmit={submit} noValidate className="grid w-full items-start gap-4 px-3 sm:px-4 lg:grid-cols-[minmax(0,1fr)_24rem] lg:px-0">
      <div className="min-w-0">
      {restoredAt && <div className="mb-3 flex items-center gap-3 rounded-lg border border-primary/15 bg-secondary px-4 py-3 text-sm text-secondary-foreground" role="status">
        <RotateCcw className="size-4.5 shrink-0" aria-hidden />
        <p className="min-w-0 flex-1"><b className="font-semibold">กู้ข้อมูลที่กรอกค้างไว้เมื่อ {timeOf(new Date(restoredAt).toISOString())} น. แล้ว</b><span className="block text-xs">{photosLost ? "รูปที่เลือกไว้กู้คืนไม่ได้ แนบรูปอีกครั้ง" : "เผื่อหน้ารีเฟรชตอนสลับไปเปิดกล้องหรือแอปอื่น"}</span></p>
        <Button type="button" variant="link" className="h-9 shrink-0 px-0" onClick={resetForm}>เริ่มใหม่</Button>
      </div>}

      {submitError && <Alert variant="destructive" className="mb-3"><AlertCircle /><AlertTitle>ส่งไม่สำเร็จ</AlertTitle><AlertDescription>{submitError}</AlertDescription></Alert>}
      {masterError && <div className="mb-3"><ErrorState variant="inline" onRetry={() => setRevision((r) => r + 1)} /></div>}

      <div ref={frame} data-testid="report-frame" className="lg:overflow-hidden lg:rounded-xl lg:border lg:bg-card lg:shadow-card">
        <nav id="report-progress" aria-label="ขั้นตอนแจ้งซ่อม" className="mb-3 scroll-mt-16 rounded-xl border bg-card px-3 py-3 shadow-card lg:mb-0 lg:rounded-none lg:border-0 lg:border-b lg:px-6 lg:py-4 lg:shadow-none">
          <p className="sr-only" aria-live="polite">ขั้นตอน {index + 1} จาก {STEPS.length} · {STEPS[index].label}</p>
          <ol className="grid grid-cols-3 gap-2">{STEPS.map((s, n) => <li key={s.key} className="min-w-0">
            <button type="button" disabled={n > index || busy || following !== null} aria-current={n === index ? "step" : undefined} onClick={() => go(s.key)}
              className="flex w-full min-w-0 items-center gap-2 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default sm:gap-2.5">
              <span aria-hidden className={cn("grid size-8 shrink-0 place-items-center rounded-full border text-sm font-semibold",
                n < index ? "border-primary bg-primary text-primary-foreground" : n === index ? "border-primary bg-primary text-primary-foreground ring-4 ring-primary/15" : "bg-card text-muted-foreground")}>
                {n < index ? <Check className="size-4" /> : n + 1}
              </span>
              <span className="min-w-0 leading-tight">
                <span className={cn("block text-[11px] sm:text-xs", n <= index ? "text-primary" : "text-muted-foreground")}>ขั้นตอนที่ {n + 1}</span>
                <span className={cn("block truncate text-xs sm:text-sm", n === index ? "font-semibold text-foreground" : "text-muted-foreground")}>{s.label}</span>
              </span>
            </button>
          </li>)}</ol>
        </nav>

        <fieldset disabled={busy || following !== null || masterReloading} data-testid="report-body"
          className="grid min-w-0 rounded-xl border bg-card p-4 shadow-card disabled:opacity-70 sm:p-6 lg:rounded-none lg:border-0 lg:px-6 lg:py-5 lg:shadow-none">
          {panel("location", <>
            {stepHeading("location", "ปัญหาเกิดขึ้นที่ไหน", "เลือกอาคาร ชั้น และห้อง", <RecentPlaces recent={recent} buildings={buildings} onPick={update} />)}
            <LocationStep values={values} buildings={buildings} building={building} floor={floor} errors={shown} onChange={update} spotRequired={spotRequired} />
          </>)}
          {panel("problem", <>
            {stepHeading("problem", "ปัญหาที่พบ", "เลือก 1 หมวด แล้วเลือกอาการที่เห็น")}
            <div className="space-y-4">
              <PlaceLine building={building} floor={floor} room={room} onChange={() => go("location")} />
              {categoryCleared && !values.categoryId && <p role="status" className="flex items-start gap-2 rounded-lg border border-primary/15 bg-secondary px-3.5 py-2.5 text-sm text-secondary-foreground">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden />{CATEGORY_CLEARED}</p>}
              <ProblemStep values={values} categories={visibleCategories} category={category} errors={shown}
                priority={priority && { level: priority.priority, reason: priorityReason({ source: priority.source, symptom: priority.symptom, categoryName: category?.name }) }}
                onPickCategory={pickCategory} onChange={update} />
              {problemCard}
            </div>
          </>)}
          {panel("send", <>
            {stepHeading("send", "รูปภาพและตรวจสอบก่อนส่ง", "แนบรูปอย่างน้อย 1 รูป เล่าเพิ่มได้ถ้าต้องการ แล้วตรวจข้อมูลก่อนกดส่ง")}
            <SendStep photos={photos} onPhotosChange={(next) => { setPhotos(next); setServerErrors((old) => { const n = { ...old }; delete n.photoIds; return n; }); }}
              disabled={busy || following !== null} errors={shown} details={values.details} onDetails={(details) => update({ details })} teamFields={teamFields} team={team}
              summary={<><ReviewList category={category} values={values} priority={priority} building={building} floor={floor} room={room} team={team} onEdit={(key) => go(key)} />{duplicateCard && <div className="mt-4">{duplicateCard}</div>}</>} />
          </>)}
        </fieldset>

        <div className="sticky bottom-0 z-20 -mx-3 mt-3 border-t bg-background px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:-mx-4 sm:px-4 lg:static lg:mx-0 lg:mt-0 lg:bg-muted/40 lg:px-6 lg:py-3">
          <div className="flex items-center gap-3">
          <Button type="button" variant="outline" className="h-11 min-w-24 bg-card" disabled={busy || following !== null} onClick={() => index > 0 ? go(STEPS[index - 1].key) : guard.leave()}>
            <ArrowLeft aria-hidden />{index > 0 ? "ย้อนกลับ" : "ยกเลิก"}</Button>
          <span className="flex-1 text-center text-xs text-muted-foreground lg:text-[13px]">ขั้นตอน {index + 1} จาก {STEPS.length}</span>
          {/* aria-disabled keeps the button focusable so the hint is read with it (CR-034). */}
          <Button type="submit" className={cn("h-11 sm:min-w-45", missing && !busy && "cursor-not-allowed opacity-50 active:translate-y-0")}
            disabled={busy || following !== null || masterReloading} aria-disabled={!!missing || undefined} aria-describedby={missing ? "step-missing" : undefined}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {sending || (last ? team ? "ยืนยันบันทึกงานทีม" : "ยืนยันส่งแจ้งซ่อม" : "ถัดไป")}
            {!busy && (last ? <Send aria-hidden /> : <ChevronRight aria-hidden />)}
          </Button>
          </div>
          {missing && !busy && <p id="step-missing" aria-live="polite" className="mt-2 flex items-center justify-end gap-1.5 text-right text-[13px] leading-5 text-muted-foreground">
            <Info className="size-3.5 shrink-0" aria-hidden />{missing}</p>}
        </div>
      </div>
      {canTeam && <p className="mt-3 flex items-start justify-center gap-2 px-1 text-center text-[13px] leading-5 text-muted-foreground lg:mt-4">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />ต้องการเปลี่ยนประเภทงาน? ปิดฟอร์มนี้แล้วเริ่มใหม่ ข้อมูลที่กรอกจะไม่ถูกบันทึก
      </p>}
      </div>
      <Summary category={category} values={values} priority={priority} building={building} floor={floor} room={room} me={me} team={team}
        mode={canTeam} duplicateCard={step === "send" ? duplicateCard : null} onEdit={(key) => go(key)} />
      <div className="h-4 lg:hidden" aria-hidden />
    </form>
    <AlertDialog open={resetOpen} onOpenChange={setResetOpen}><AlertDialogContent className="rounded-xl"><AlertDialogHeader><AlertDialogTitle>ล้างข้อมูลในแบบฟอร์ม?</AlertDialogTitle><AlertDialogDescription>ข้อมูลที่กรอกและรูปที่เลือกจะถูกล้าง</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>เก็บไว้ก่อน</AlertDialogCancel><Button onClick={resetForm}>ล้างแบบฟอร์ม</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
    {discard}
    <DuplicateDialog {...duplicateProps} open={duplicateDialog !== null} tickets={duplicateDialog ?? []} onOpenChange={open => { if (!open) setDuplicateDialog(null); }}
      onCancel={() => guard.leaveBack()} submitLabel={team ? "ยืนยันบันทึกงานทีม" : "ยืนยันส่งแจ้งซ่อม"}
      onRetry={() => { setDuplicateDialog(null); window.requestAnimationFrame(() => formRef.current?.requestSubmit()); }} />
  </>;
}

// ---- pieces ----

/** Loading skeleton in the shape of the 3-step frame. */
export function FormSkeleton() {
  return <div className="mx-auto w-full max-w-220 px-3 pt-3 sm:px-4 lg:px-0 lg:pt-0" aria-busy="true" aria-label="กำลังโหลด">
    <Skeleton className="mb-3 h-5 w-72" />
    <div className="lg:rounded-xl lg:border lg:bg-card">
      <div className="mb-3 space-y-3 lg:mb-0 lg:border-b lg:px-6 lg:pt-4.5 lg:pb-3"><Skeleton className="h-4 w-40" /><div className="flex gap-2">{STEPS.map((s) => <Skeleton key={s.key} className="h-1 flex-1" />)}</div></div>
      <div className="space-y-4 rounded-xl border bg-card p-4 sm:p-6 lg:rounded-none lg:border-0 lg:px-6 lg:py-5">
        <Skeleton className="h-6 w-32" />
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">{Array.from({ length: 7 }, (_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-11 rounded-sm" />)}</div>
        <Skeleton className="h-14 w-full rounded-lg" />
      </div>
      <div className="hidden justify-between border-t px-6 py-3 lg:flex"><Skeleton className="h-11 w-24" /><Skeleton className="h-11 w-45" /></div>
    </div>
  </div>;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return <p id={id} className={cn("mt-2 flex items-start gap-1 text-sm text-destructive", !message && "hidden")} role={message ? "alert" : undefined}>{message && <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />}{message}</p>;
}

function Label({ id, htmlFor, children, required, help, optional }: { id?: string; htmlFor?: string; children: ReactNode; required?: boolean; help?: string; optional?: boolean }) {
  const Tag = htmlFor ? "label" : "div";
  return <Tag id={id} htmlFor={htmlFor} className="mb-2 flex flex-wrap items-baseline gap-x-2 text-sm leading-6 font-semibold">
    <span>{children}{required && <span className="text-destructive"> *</span>}</span>
    {help && <span className="text-xs font-normal text-muted-foreground">{help}</span>}
    {optional && <span className="text-xs font-normal text-muted-foreground">ไม่บังคับ</span>}
  </Tag>;
}

const choiceCard = (on: boolean, invalid?: boolean) => cn(
  "flex cursor-pointer items-center gap-2.5 rounded-lg border bg-card px-3 text-sm leading-5 outline-none focus-within:ring-2 focus-within:ring-ring",
  on ? "border-primary bg-secondary font-semibold ring-1 ring-primary" : invalid ? "border-destructive" : "hover:border-primary/40",
);

/** Step 2 (CR-025): where the problem is, with เปลี่ยน back to step 1. */
function PlaceLine({ building, floor, room, onChange }: { building?: Building; floor?: Floor; room?: Room; onChange: () => void }) {
  if (!building || !floor || !room) return null;
  return <div data-testid="place-line" className="flex min-h-11 items-center gap-2.5 rounded-lg bg-muted px-3.5 py-2 text-sm">
    <MapPin className="size-4 shrink-0 text-primary" aria-hidden />
    <p className="min-w-0 flex-1"><span className="text-muted-foreground">สถานที่:</span> <b className="font-semibold">{[building.name, floorLabel(floor.name), room.name].filter((x, i, all) => all.indexOf(x) === i).join(" · ")}</b></p>
    <Button type="button" variant="link" className="h-8 shrink-0 px-0" onClick={onChange} aria-label="เปลี่ยนสถานที่">เปลี่ยน</Button>
  </div>;
}

function ProblemStep({ values, categories, category, errors, priority, onPickCategory, onChange }: {
  values: Values; categories: Category[]; category?: Category; errors: Record<string, string>;
  priority: { level: Category["defaultPriority"]; reason: string } | null;
  onPickCategory: (id: string) => void; onChange: (patch: Partial<Values>) => void;
}) {
  return <div className="space-y-4">
    <div data-field="categoryId">
      <Label id="category-label" required>เลือกหมวดที่ตรงกับปัญหา</Label>
      <div role="radiogroup" aria-labelledby="category-label" aria-describedby="categoryId-error" aria-invalid={!!errors.categoryId} className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {categories.map((c) => {
          const on = values.categoryId === c.id;
          const Icon = categoryIcon(c);
          return <label key={c.id} className={cn(choiceCard(on, !!errors.categoryId), "min-h-14 py-2")}>
            <input type="radio" name="category" value={c.id} checked={on} onChange={() => onPickCategory(c.id)} className="sr-only" />
            <span className={cn("grid size-8.5 shrink-0 place-items-center rounded-md", on ? "bg-card text-primary" : "bg-svc-repair/10 text-svc-repair")}><Icon className="size-4.5" aria-hidden /></span>
            <span className="min-w-0 flex-1">{c.name}</span>
          </label>;
        })}
      </div>
      <FieldError id="categoryId-error" message={errors.categoryId} />
    </div>

    {category?.isOther && <div data-field="categoryOther">
      <Label htmlFor="categoryOther" optional>ระบุหมวดงาน</Label>
      <Input id="categoryOther" value={values.categoryOther} maxLength={MAX_OTHER} onChange={(e) => onChange({ categoryOther: e.target.value })} placeholder="เช่น ลิฟต์ ระบบเสียง" aria-invalid={!!errors.categoryOther} aria-describedby="categoryOther-error" className="h-11 rounded-sm bg-card px-3.5 text-base" />
      <FieldError id="categoryOther-error" message={errors.categoryOther} />
    </div>}

    <div data-field="symptomIds">
      <Label id="symptom-label" required help="เลือกได้มากกว่า 1 ข้อ">อาการที่พบ</Label>
      <div>
        {category ? <div role="group" aria-labelledby="symptom-label" aria-describedby="symptomIds-error" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {category.symptoms.map((s) => <label key={s.id} className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-sm border bg-card px-3 py-2 text-sm has-checked:border-primary/40 has-checked:bg-secondary/60 focus-within:ring-2 focus-within:ring-ring">
            <input type="checkbox" className="size-4 shrink-0 accent-primary" checked={values.symptomIds.includes(s.id)}
              onChange={(e) => onChange({ symptomIds: e.target.checked ? [...values.symptomIds, s.id] : values.symptomIds.filter((id) => id !== s.id) })} />
            {s.name}
          </label>)}
          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-sm border bg-card px-3 py-2 text-sm has-checked:border-primary/40 has-checked:bg-secondary/60 focus-within:ring-2 focus-within:ring-ring">
            <input type="checkbox" className="size-4 shrink-0 accent-primary" checked={values.symptomOtherOn}
              onChange={(e) => { onChange({ symptomOtherOn: e.target.checked, ...(e.target.checked ? {} : { symptomOther: "" }) }); if (e.target.checked) window.requestAnimationFrame(() => document.getElementById("symptomOther")?.focus()); }} />
            อาการอื่นๆ
          </label>
        </div> : <p className="grid min-h-23 place-items-center rounded-sm border border-dashed bg-muted/40 px-4 py-3 text-center text-sm text-muted-foreground">เลือกหมวดงานก่อน แล้วเลือกอาการที่พบได้ที่นี่</p>}
        <FieldError id="symptomIds-error" message={errors.symptomIds} />
      </div>
      {values.symptomOtherOn && <div className="mt-3" data-field="symptomOther"><Label htmlFor="symptomOther" required>ระบุอาการอื่นๆ</Label>
        <Input id="symptomOther" value={values.symptomOther} maxLength={MAX_OTHER} onChange={(e) => onChange({ symptomOther: e.target.value })} placeholder="อาการที่ไม่อยู่ในรายการ" aria-invalid={!!errors.symptomOther} aria-describedby="symptomOther-error" className="h-11 rounded-sm bg-card px-3.5 text-base" />
        <FieldError id="symptomOther-error" message={errors.symptomOther} /></div>}
    </div>

    <div aria-live="polite" className="flex min-h-12 items-center gap-2.5 rounded-lg bg-muted px-3.5 py-2.5 text-sm">
      {priority ? <p><span className="font-semibold">ความเร่งด่วนของงานนี้:</span> <PriorityBadge priority={priority.level} className="align-middle" /> <span className="text-muted-foreground">· {priority.reason} คุณไม่ต้องเลือกระดับเอง</span></p>
        : <p className="text-muted-foreground">ระบบจะบอกความเร่งด่วนให้เมื่อเลือกอาการแล้ว คุณไม่ต้องเลือกระดับเอง</p>}
    </div>
  </div>;
}

/** ที่เคยแจ้ง (#28): only rooms that still exist; one tap fills building, floor, room and spot — never preselected. */
function RecentPlaces({ recent, buildings, onPick }: { recent: RecentPlace[]; buildings: Building[]; onPick: (patch: Partial<Values>) => void }) {
  const [open, setOpen] = useState(false);
  const places = recent.filter((p) => buildings.some((b) => b.id === p.building.id && b.floors.some((f) => f.id === p.floor.id && f.rooms.some((r) => r.id === p.room.id))));
  if (!places.length) return null;
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <Button type="button" variant="outline" className="h-10 shrink-0 gap-1.5 border-dashed px-3 text-sm font-normal text-muted-foreground"><History className="size-4" aria-hidden />ที่เคยแจ้ง<ChevronDown className="size-4" aria-hidden /></Button>
    </PopoverTrigger>
    <PopoverContent align="end" className="w-80 p-1.5">
      <p className="px-2.5 pt-1.5 pb-1 text-xs text-muted-foreground">แตะเพื่อเติมอาคาร ชั้น และห้องให้</p>
      {places.map((p) => <button key={`${p.floor.id}|${p.room.id}`} type="button"
        onClick={() => { onPick({ buildingId: p.building.id, floorId: p.floor.id, roomId: p.room.id, locationDetail: p.locationDetail ?? "" }); setOpen(false); }}
        className="flex min-h-14 w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-left outline-none hover:bg-muted focus-visible:bg-muted">
        <MapPin className="size-5 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0"><b className="block truncate text-sm font-semibold">{p.room.name}</b>
          <small className="block truncate text-xs text-muted-foreground">{p.building.name} · {floorLabel(p.floor.name)}{p.locationDetail ? ` · ${p.locationDetail}` : ""} · แจ้งล่าสุด {listDate(p.lastReportedAt)}</small></span>
      </button>)}
    </PopoverContent>
  </Popover>;
}

function LocationStep({ values, buildings, building, floor, errors, onChange, spotRequired }: {
  values: Values; buildings: Building[]; building?: Building; floor?: Floor; errors: Record<string, string>;
  onChange: (patch: Partial<Values>) => void; spotRequired: boolean;
}) {
  return <div className="space-y-4">
    <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
      <div data-field="buildingId">
        <Label id="building-label" required>เลือกอาคาร</Label>
        <div role="radiogroup" aria-labelledby="building-label" aria-describedby="buildingId-error" className="grid gap-2 sm:grid-cols-2">
          {buildings.map((b) => {
            const on = values.buildingId === b.id;
            return <label key={b.id} className={cn(choiceCard(on, !!errors.buildingId), "min-h-14 py-2")}>
              <input type="radio" name="building" value={b.id} checked={on} onChange={() => onChange({ buildingId: b.id, floorId: "", roomId: "" })} className="sr-only" />
              <span className={cn("grid size-8.5 shrink-0 place-items-center rounded-md", on ? "bg-card text-primary" : "bg-muted text-muted-foreground")}>
                {b.floors.every((f) => f.rooms.every((r) => r.areaType === "parking")) ? <SquareParking className="size-4.5" aria-hidden /> : <Building2 className="size-4.5" aria-hidden />}
              </span>
              <span className="min-w-0 flex-1">{b.name}</span>
            </label>;
          })}
        </div>
        <FieldError id="buildingId-error" message={errors.buildingId} />
      </div>

      <div data-field="floorId">
        <Label id="floor-label" required>เลือกชั้น</Label>
        {building ? <div role="radiogroup" aria-labelledby="floor-label" aria-describedby="floorId-error" className="flex flex-wrap gap-2">
          {building.floors.map((f) => {
            const on = values.floorId === f.id;
            return <label key={f.id} aria-label={floorLabel(f.name)} className={cn("grid min-h-11 min-w-12 cursor-pointer place-items-center rounded-sm border bg-card px-3 text-sm focus-within:ring-2 focus-within:ring-ring",
              on ? "border-primary bg-secondary font-semibold text-secondary-foreground ring-1 ring-primary" : errors.floorId ? "border-destructive" : "hover:border-primary/40")}>
              <input type="radio" name="floor" value={f.id} checked={on} onChange={() => onChange({ floorId: f.id, roomId: "" })} className="sr-only" />
              {f.name}
            </label>;
          })}
        </div> : <p className="py-2 text-sm text-muted-foreground">เลือกอาคารเพื่อดูชั้นที่แจ้งได้</p>}
        <FieldError id="floorId-error" message={errors.floorId} />
      </div>
    </div>

    <div data-field="roomId">
      <Label id="room-label" required>ห้องหรือจุดที่เกิด</Label>
      <div>
        {floor ? <RoomChoice rooms={floor.rooms} value={values.roomId} invalid={!!errors.roomId} onPick={(roomId) => onChange({ roomId })} />
          : <p className="grid min-h-23 place-items-center rounded-sm border border-dashed bg-muted/40 px-4 py-3 text-center text-sm text-muted-foreground">เลือกอาคารและชั้น แล้วเลือกห้องหรือจุดที่เกิดได้ที่นี่</p>}
        <FieldError id="roomId-error" message={errors.roomId} />
      </div>
    </div>

    <div data-field="locationDetail">
      <Label htmlFor="locationDetail" required={spotRequired} help={spotRequired ? "จำเป็นเมื่อพบงานที่ตรงกัน" : undefined} optional={!spotRequired}>บอกจุดเพิ่มเติม</Label>
      <Input id="locationDetail" value={values.locationDetail} maxLength={MAX_LOCATION} onChange={(e) => onChange({ locationDetail: e.target.value })} placeholder="เช่น ฝั่งหน้าต่าง เครื่องที่ 2" aria-invalid={!!errors.locationDetail} aria-describedby="locationDetail-error" className="h-11 rounded-sm bg-card px-3.5 text-base" />
      <FieldError id="locationDetail-error" message={errors.locationDetail} />
    </div>
  </div>;
}

/** Room cards on every floor (CR-022: no picker for big floors), in their normal order (CR-025: the area-type hint is retired). */
function RoomChoice({ rooms, value, invalid, onPick }: {
  rooms: Room[]; value: string; invalid: boolean; onPick: (id: string) => void;
}) {
  const card = (r: Room) => {
    const on = value === r.id;
    return <label key={r.id} className={cn(choiceCard(on, invalid), "min-h-11 rounded-sm py-1.5")}>
      <input type="radio" name="room" value={r.id} checked={on} onChange={() => onPick(r.id)} className="sr-only" />
      <DoorOpen className={cn("size-4 shrink-0", on ? "text-primary" : "text-muted-foreground")} aria-hidden />
      <span className="min-w-0 flex-1">{r.name}</span>
    </label>;
  };
  return <div role="radiogroup" aria-labelledby="room-label" aria-describedby="roomId-error" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{rooms.map(card)}</div>;
}

function SendStep({ photos, onPhotosChange, disabled, errors, details, onDetails, summary, teamFields, team }: {
  photos: PhotoItem[]; onPhotosChange: React.Dispatch<React.SetStateAction<PhotoItem[]>>; disabled?: boolean; errors: Record<string, string>;
  details: string; onDetails: (value: string) => void; summary: ReactNode; teamFields: ReactNode; team: boolean;
}) {
  const gallery = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const uploads = usePhotoList(photos, onPhotosChange, disabled);
  const [drag, setDrag] = useState(false);
  const [opened, setOpened] = useState<string | null>(null);
  const error = errors.photoIds;
  return <div className="grid items-start gap-5 lg:grid-cols-2">
    <div className="min-w-0" data-field="photoIds">
      <Label id="photo-label" required help={`${photos.length}/${MAX_PHOTOS} รูป`}>รูปภาพ</Label>
      <input type="file" ref={gallery} accept="image/*" multiple className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { uploads.choose(e.target.files); e.target.value = ""; }} disabled={disabled} />
      <input type="file" ref={camera} accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { uploads.choose(e.target.files); e.target.value = ""; }} disabled={disabled} />
      <div className="grid grid-cols-2 gap-2 lg:hidden">
        <Button type="button" className="h-12" disabled={disabled || uploads.full} onClick={() => camera.current?.click()} aria-describedby="photoIds-error photo-hint"><Camera aria-hidden />ถ่ายรูป</Button>
        <Button type="button" variant="outline" className="h-12" disabled={disabled || uploads.full} onClick={() => gallery.current?.click()}><Upload aria-hidden />เลือกจากคลังรูป</Button>
      </div>
      <button type="button" disabled={disabled || uploads.full} onClick={() => gallery.current?.click()} aria-describedby="photoIds-error photo-hint"
        onDragEnter={(e) => { e.preventDefault(); setDrag(true); }} onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDrag(false); }} onDrop={(e) => { e.preventDefault(); setDrag(false); uploads.choose(e.dataTransfer.files); }}
        className={cn("hidden min-h-32 w-full items-center gap-3.5 rounded-lg border-2 border-dashed bg-card px-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 lg:flex",
          drag ? "border-primary bg-secondary" : error ? "border-destructive" : "border-input hover:border-primary/50")}>
        <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-secondary text-primary"><Upload className="size-5.5" aria-hidden /></span>
        <span><b className="block text-sm font-semibold">ลากรูปมาวาง หรือคลิกเพื่อเลือก</b><span className="text-[13px] text-muted-foreground">JPG PNG WebP HEIC ไม่เกิน 10 MB ต่อรูป</span></span>
      </button>
      {photos.length > 0 && <div className="mt-3 grid grid-cols-3 gap-2">{photos.map((item, i) => <PhotoTile key={item.key} item={item} index={i} disabled={disabled} className="aspect-square"
        onOpen={() => setOpened(item.key)} onRetry={() => uploads.retry(item)} onRemove={() => uploads.remove(item)} />)}</div>}
      {uploads.message && <p role="alert" className="mt-2 flex items-center gap-1 text-sm text-destructive"><AlertCircle className="size-4" aria-hidden />{uploads.message}</p>}
      <FieldError id="photoIds-error" message={error} />
      <div id="photo-hint" className="mt-3 space-y-0.5 text-[13px] leading-5 text-muted-foreground">
        <b className="block text-sm font-semibold text-foreground">ถ่ายให้เห็นปัญหาชัดเจน</b>
        <p>มุมใกล้: ให้เห็นอาการ · มุมกว้าง: ให้เห็นตำแหน่ง</p>
        <p>แนบอย่างน้อย 1 รูป สูงสุด 5 รูป</p>
      </div>
      <PhotoListLightbox items={photos} opened={opened} onOpened={setOpened} />
    </div>

    <div className="min-w-0 space-y-4">
      {teamFields}
      <div hidden={team} data-field="details">
        <div className="flex items-baseline justify-between gap-3"><Label htmlFor="details" optional>เล่ารายละเอียดเพิ่ม</Label><span id="details-count" className="text-xs text-muted-foreground">{details.length}/{MAX_DETAILS}</span></div>
        <Textarea id="details" value={details} maxLength={MAX_DETAILS} rows={4} onChange={(e) => onDetails(e.target.value)} placeholder="เช่น เริ่มเป็นตั้งแต่เมื่อไร เป็นตลอดหรือเป็นๆ หายๆ" aria-invalid={!!errors.details} aria-describedby="details-count details-error" className="min-h-30 rounded-sm bg-card px-3.5 py-2.5 text-base" />
        <FieldError id="details-error" message={errors.details} />
      </div>
      <div className="lg:hidden">
        <h3 className="mb-2 text-sm leading-6 font-semibold">ตรวจสอบก่อนส่ง</h3>
        {summary}
      </div>
    </div>
  </div>;
}

/** ตรวจสอบก่อนส่ง: สถานที่ · ปัญหา · ความเร่งด่วน (CR-025 order), each with แก้ไข back to its step (photos are not repeated). */
function ReviewList({ category, values, priority, building, floor, room, onEdit, team }: {
  category?: Category; values: Values; priority: PriorityResult | null; building?: Building; floor?: Floor; room?: Room; onEdit: (step: StepKey) => void; team: boolean;
}) {
  const symptoms = [
    ...(category?.symptoms.filter((s) => values.symptomIds.includes(s.id)).map((s) => s.name) ?? []),
    ...(values.symptomOtherOn && values.symptomOther.trim() ? [values.symptomOther.trim()] : []),
  ];
  const categoryLabel = category ? [category.name, category.isOther ? values.categoryOther.trim() : ""].filter(Boolean).join(" · ") : "";
  const dash = <span className="text-muted-foreground">ยังไม่ได้เลือก</span>;
  const row = (label: string, body: ReactNode, step?: StepKey) => <div className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto] items-start gap-2.5 border-t px-3.5 py-2.5 text-sm first:border-0">
    <dt className="pt-px text-muted-foreground">{label}</dt>
    <dd className="min-w-0 leading-6 wrap-break-word">{body}</dd>
    {step ? <Button type="button" variant="link" className="h-6 px-0 text-sm" onClick={() => onEdit(step)} aria-label={`แก้ไข${label}`}>แก้ไข</Button> : <span />}
  </div>;
  return <dl className="overflow-hidden rounded-lg border bg-card">
    {row("สถานที่", building && floor ? <>{building.name} · {floorLabel(floor.name)}<span className="block">{room ? <b className="font-semibold">{room.name}</b> : dash}{values.locationDetail.trim() && <span className="text-muted-foreground"> · {values.locationDetail.trim()}</span>}</span></> : dash, "location")}
    {row("ปัญหา", category ? <><b className="font-semibold">{categoryLabel}</b>{symptoms.length > 0 && <span className="block">{symptoms.join(" · ")}</span>}</> : dash, "problem")}
    {row("ความเร่งด่วน", priority ? <span className="flex flex-wrap items-center gap-1.5"><PriorityBadge priority={priority.priority} /><span className="text-muted-foreground">{priority.source === "symptom" ? "จากอาการ" : "ระดับเริ่มต้นของหมวด"}</span></span> : dash)}
    {team && row("งานที่ทีมทำ", values.teamNote.trim() || <span className="text-muted-foreground">ยังไม่ได้กรอก</span>, "send")}
  </dl>;
}

/** สรุปการแจ้งซ่อม (CR-019, desktop): live on every step; แก้ไข jumps back to that step. */
function Summary({ category, values, priority, building, floor, room, me, onEdit, team, mode, duplicateCard }: {
  category?: Category; values: Values; priority: PriorityResult | null; building?: Building; floor?: Floor; room?: Room;
  me: { name: string; department: string | null }; onEdit: (step: StepKey) => void;
  /** `mode`: leads see which form they opened (CR-021, the mode is fixed per entry point). */
  team: boolean; mode: boolean; duplicateCard: ReactNode;
}) {
  const symptoms = [
    ...(category?.symptoms.filter((s) => values.symptomIds.includes(s.id)).map((s) => s.name) ?? []),
    ...(values.symptomOtherOn && values.symptomOther.trim() ? [values.symptomOther.trim()] : []),
  ];
  const categoryLabel = category ? [category.name, category.isOther ? values.categoryOther.trim() : ""].filter(Boolean).join(" · ") : "";
  const dash = <span className="text-muted-foreground">ยังไม่ได้เลือก</span>;
  const row = (label: string, tile: ReactNode, body: ReactNode, step?: StepKey) => <div className="flex items-start gap-3 border-t px-5 py-4 first:border-0">
    {tile}
    <div className="min-w-0 flex-1">
      <dt className="text-xs leading-5 text-muted-foreground">{label}</dt>
      <dd className="text-sm leading-6 wrap-break-word">{body}</dd>
    </div>
    {step && <Button type="button" variant="link" className="h-6 px-0 text-[13px]" onClick={() => onEdit(step)} aria-label={`แก้ไข${label}`}>แก้ไข</Button>}
  </div>;
  const soft = "grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-primary";
  return <aside aria-labelledby="summary-title" className="hidden space-y-4 lg:sticky lg:top-26 lg:block">
    <section className="overflow-hidden rounded-xl border bg-card shadow-card">
      <h2 id="summary-title" className="flex items-center justify-between border-b px-5 py-4 text-base leading-6 font-semibold">สรุปการแจ้งซ่อม<FileText className="size-4.5 text-muted-foreground" aria-hidden /></h2>
      {mode && <p className="mx-4 mt-4 flex items-center gap-2 rounded-lg bg-secondary px-3 py-2.5 text-sm font-medium text-secondary-foreground">
        {team ? <ClipboardCheck className="size-4 shrink-0 text-primary" aria-hidden /> : <Wrench className="size-4 shrink-0 text-primary" aria-hidden />}
        {team ? "บันทึกงานที่ทีมแก้แล้ว" : "แจ้งซ่อมใหม่ · เรียกช่าง"}
      </p>}
      <dl>
        {team && row("งานที่ทีมทำ", <span aria-hidden className={soft}><CircleCheck className="size-4" /></span>, values.teamNote.trim() || "ยังไม่ได้กรอก", "send")}
        {row("สถานที่", <span aria-hidden className={soft}><MapPin className="size-4.5" /></span>,
          building && floor ? <><b className="font-semibold">{building.name} · {floorLabel(floor.name)}</b><span className="block text-muted-foreground">{room ? room.name : "ยังไม่ได้เลือกห้อง"}{values.locationDetail.trim() && ` · ${values.locationDetail.trim()}`}</span></> : dash, "location")}
        {row("ปัญหาที่พบ", <CategoryTile icon={category?.icon} />,
          category ? <><b className="font-semibold">{categoryLabel}</b>{symptoms.length > 0 && <span className="block text-muted-foreground">{symptoms.join(" · ")}</span>}</> : dash, "problem")}
        {priority && row("ความเร่งด่วน", <span aria-hidden className={soft}><AlertCircle className="size-4.5" /></span>,
          <span className="flex flex-wrap items-center gap-1.5"><PriorityBadge priority={priority.priority} /><span className="text-muted-foreground">{priority.source === "symptom" ? "จากอาการ" : "ระดับเริ่มต้นของหมวด"}</span></span>)}
        {row("ผู้แจ้ง", <span aria-hidden className={cn(soft, "rounded-full text-xs font-semibold")}>{initials(me.name)}</span>,
          <><b className="font-semibold">{me.name}</b>{me.department && <span className="block text-muted-foreground">{me.department}</span>}</>)}
      </dl>
    </section>
    {duplicateCard}
    <div className="flex gap-3 px-5 text-[13px] leading-5 text-muted-foreground">
      <Bell className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <p><b className="block text-sm font-semibold text-foreground">ส่งแล้วติดตามได้ตลอด</b>ดูความคืบหน้าได้ที่หน้าติดตามงานซ่อม ตั้งแต่รับเรื่องจนปิดงาน</p>
    </div>
  </aside>;
}
