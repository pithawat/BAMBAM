import { ApiError } from "@/lib/http";
import { mockMeByRole } from "@/lib/platform/mocks";
import { ticketPriority } from "./priority";
import type { Role } from "@/lib/platform/types";
import type {
  AreaType,
  Building,
  Category,
  Photo,
  PersonRef,
  Priority,
  PrioritySource,
  RecentPlace,
  Ref,
  Room,
  TicketCounts,
  TicketCountsQuery,
  TicketDetail,
  TicketListQuery,
  TicketPage,
  TicketStatus,
  TicketStep,
  TicketSummary,
  TimelineEvent,
} from "./types";

// Mock data for building the UI without the backend (NEXT_PUBLIC_USE_MOCKS=true).
// Categories / symptoms = the real master (CR-014, same ids as migration 20261019000001); buildings,
// rooms and tickets are sample data (_common.md §8, seed.go) — names are fictional.
// Dates are relative to "now" so today / yesterday / this year formats show up.
//
// Scenarios — pick with `?mock=<name>` on any page (remembered in localStorage) or
// `localStorage["bambam.repair.mockScenario"]`; `?mock=normal` resets:
//   normal          sample data (default)
//   empty           no tickets at all (master data still loads, so S03 works)
//   error           every read fails; create and upload fail with a network error
//   forbidden       S07 shows the forbidden state for every ticket
//   slow            normal data after 3 s (loading skeletons)
//   validation      create returns VALIDATION_FAILED for symptoms / room / photos
//   master_changed  create returns MASTER_DATA_CHANGED
//   upload_error    every photo upload fails (tile "ลองใหม่")
// Fixed ids: MOCK_IDS.forbiddenTicket is someone else's ticket (forbidden for the employee in
// `normal`); MOCK_IDS.notFoundTicket does not exist (S07 not-found state).

export const MOCK_SCENARIOS = [
  "normal",
  "empty",
  "error",
  "forbidden",
  "slow",
  "validation",
  "master_changed",
  "upload_error",
] as const;
export type MockScenario = (typeof MOCK_SCENARIOS)[number];

const SCENARIO_KEY = "bambam.repair.mockScenario";

export function mockScenario(): MockScenario {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("mock");
    if (fromUrl && (MOCK_SCENARIOS as readonly string[]).includes(fromUrl)) {
      window.localStorage.setItem(SCENARIO_KEY, fromUrl);
      return fromUrl as MockScenario;
    }
    const saved = window.localStorage.getItem(SCENARIO_KEY);
    if (saved && (MOCK_SCENARIOS as readonly string[]).includes(saved)) return saved as MockScenario;
  } catch {
    // no window / storage — default
  }
  return "normal";
}

export const mockErrors = {
  server: () => new ApiError(500, "INTERNAL", "mock: server error"),
  network: () => new ApiError(0, "NETWORK", "mock: network error"),
  forbidden: () => new ApiError(403, "FORBIDDEN", "mock: not allowed"),
  notFound: () => new ApiError(404, "TICKET_NOT_FOUND", "mock: ticket not found"),
  photoNotFound: () => new ApiError(404, "PHOTO_NOT_FOUND", "mock: photo not found"),
  masterChanged: () => new ApiError(422, "MASTER_DATA_CHANGED", "mock: master data changed"),
  validation: () =>
    new ApiError(400, "VALIDATION_FAILED", "mock: validation failed", {
      symptomIds: "MIN_ITEMS",
      roomId: "REQUIRED",
      photoIds: "MIN_ITEMS",
    }),
};

// ---- time helpers ----

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const later = (ms: number) => new Date(Date.now() + ms).toISOString();

// ---- master data ----

// CR-014 master: ids match the migration, so mock and real data line up.
const catId = (n: number) => `c014ca70-0000-4000-8000-00000000000${n}`;
const symId = (c: number, s: number) => `c0145e00-000${c}-4000-8000-00000000000${s}`;
const bldId = (n: number) => `b1000000-0000-4000-8000-00000000000${n}`;
const floorId = (b: number, level: number) => `f1000000-0000-4000-8000-0000000${b}0${level.toString().padStart(3, "0")}`;
const roomId = (b: number, level: number, k: number) => `e1000000-0000-4000-8000-${b}${level.toString().padStart(3, "0")}${k.toString().padStart(8, "0")}`;

// [name, icon, symptoms with the owner-accepted priorities, area types] — every default is medium.
const categoryData: [string, string, [string, Priority][], AreaType[]][] = [
  ["ไฟฟ้าและแสงสว่าง", "zap", [["ไฟไม่ติด/ไฟกะพริบ", "medium"], ["ปลั๊กไม่มีไฟ/สวิตช์เสีย", "medium"], ["ไฟตกหรือดับ", "high"], ["มีกลิ่นไหม้/ประกายไฟ", "critical"]], ["office", "meeting_room", "common_area"]],
  ["ระบบปรับอากาศ", "snowflake", [["แอร์ไม่เย็น", "medium"], ["น้ำหยด/รั่วซึม", "high"], ["มีเสียงดัง", "medium"], ["มีกลิ่น", "low"], ["เปิดไม่ติด", "high"], ["รีโมทเสีย", "low"]], ["meeting_room", "office"]],
  ["ประปาและสุขาภิบาล", "droplets", [["น้ำไม่ไหล", "high"], ["น้ำรั่วซึม", "high"], ["ท่อตัน", "medium"], ["ก๊อก/วาล์วเสีย", "medium"], ["ชักโครกเสีย", "medium"], ["ที่กดน้ำยาเช็ดฝาชักโครก/กล่องทิชชู่ชำรุด", "low"]], ["restroom", "pantry"]],
  ["ห้องประชุมและโสตทัศนูปกรณ์", "presentation", [["ไมค์ไม่มีเสียง/เสียงขาด", "medium"], ["ลำโพงไม่ดัง", "medium"], ["จอไม่แสดงผล/ไม่ติด", "medium"], ["กล้องไม่ทำงาน", "medium"], ["สายสัญญาณ HDMI เสีย", "medium"]], ["meeting_room"]],
  ["อาคารและพื้นที่ส่วนกลาง", "building-2", [["ฝ้า/ผนังชำรุด", "medium"], ["พื้นแตก/ร่อน", "medium"], ["ประตู/กระจกเสีย", "medium"], ["หลังคารั่ว", "high"], ["สีลอก", "low"], ["เสี่ยงหล่นใส่คน", "critical"]], ["common_area"]],
  ["ลานจอด / ไม้กั้น", "square-parking", [["ไม้กั้นค้าง/ไม่ยกลง", "high"], ["ไม้กั้นไม่ทำงาน", "high"], ["ไม้กั้นหัก/ชำรุด", "medium"], ["ที่จอดรถชำรุด/พื้นแตก", "low"], ["เส้นจราจรลบเลือน", "low"], ["ป้าย/สัญญาณจราจรเสีย", "medium"], ["ไฟส่องสว่างลานจอดดับ", "medium"]], ["parking"]],
  ["อื่น ๆ", "ellipsis", [["ใช้งานไม่ได้", "medium"], ["มีเสียง/กลิ่นผิดปกติ", "medium"], ["รั่วซึมชำรุด", "medium"], ["มีความเสี่ยงอันตราย", "critical"]], []],
];

export const mockCategories: Category[] = categoryData.map(([name, icon, symptoms, areaTypes], i) => ({
  id: catId(i + 1),
  name,
  icon,
  defaultPriority: "medium",
  isOther: i === categoryData.length - 1,
  areaTypes,
  symptoms: symptoms.map(([s, priority], j) => ({ id: symId(i + 1, j + 1), name: s, priority })),
}));

/** Same sample rooms as backend seed.go: floor 2 of the main building has > 9 rooms (S03 picker). */
function sampleRooms(b: number, level: number): Room[] {
  const n = String(level);
  const meetings = b === 1 && level === 2 ? ["A", "B", "C", "D", "E", "F"] : ["A", "B"];
  const rooms: [string, AreaType][] = [
    ...meetings.map((m): [string, AreaType] => [`ห้องประชุม ${n}${m}`, "meeting_room"]),
    [`สำนักงานชั้น ${n}`, "office"],
    ["ห้องน้ำชาย", "restroom"],
    ["ห้องน้ำหญิง", "restroom"],
    ...(b === 1 ? [["Pantry", "pantry"] as [string, AreaType]] : []),
    [`พื้นที่ส่วนกลางชั้น ${n}`, "common_area"],
  ];
  return rooms.map(([name, areaType], k) => ({ id: roomId(b, level, k + 1), name, areaType }));
}

// CR-008 names: อาคารหลัก → อาคารฝั่ง Office, อาคารด้านหลัง → อาคาร Office โรงงานบางซ่อน (ids unchanged).
// CR-014: the car park is an outdoor "building" with one floor and room (migration ids).
export const mockBuildings: Building[] = [
  ...[
    { name: "อาคารฝั่ง Office", floors: 7 },
    { name: "อาคาร Office โรงงานบางซ่อน", floors: 2 },
  ].map((b, i) => ({
    id: bldId(i + 1),
    name: b.name,
    floors: Array.from({ length: b.floors }, (_, k) => ({
      id: floorId(i + 1, k + 1), name: String(k + 1), level: k + 1, rooms: sampleRooms(i + 1, k + 1),
    })),
  })),
  {
    id: "c014b1d0-0000-4000-8000-000000000001",
    name: "พื้นที่ภายนอกอาคาร",
    floors: [{
      id: "c014f100-0000-4000-8000-000000000001", name: "ลานจอดรถ", level: 1,
      rooms: [{ id: "c014e000-0000-4000-8000-000000000001", name: "ลานจอดรถ", areaType: "parking" }],
    }],
  },
];

const cat = (n: number): Ref => ({ id: mockCategories[n - 1].id, name: mockCategories[n - 1].name });
const sym = (c: number, ...s: number[]): Ref[] => s.map((n) => {
  const { id, name } = mockCategories[c - 1].symptoms[n - 1];
  return { id, name };
});
const bld = (n: number): Ref => ({ id: mockBuildings[n - 1].id, name: mockBuildings[n - 1].name });
const flr = (b: number, level: number): Ref => {
  const f = mockBuildings[b - 1].floors[level - 1];
  return { id: f.id, name: f.name };
};
const room = (b: number, level: number, name: string): Ref => {
  const r = mockBuildings[b - 1].floors[level - 1].rooms.find((x) => x.name === name);
  if (!r) throw new Error(`mock room ${name} not on ${b}/${level}`);
  return { id: r.id, name: r.name };
};

/** Sample categories switched off by CR-014 — older tickets still point at them. */
const legacy = {
  furniture: { category: { id: "6f1c2a90-0000-4000-8000-000000000004", name: "อาคารและเฟอร์นิเจอร์" }, symptoms: [{ id: "11a00000-0000-4000-8000-000000040003", name: "เก้าอี้ชำรุด" }] },
  cleaning: { category: { id: "6f1c2a90-0000-4000-8000-000000000005", name: "ความสะอาด" }, symptoms: [{ id: "11a00000-0000-4000-8000-000000050001", name: "พื้นเปียก" }] },
} satisfies Record<string, { category: Ref; symptoms: Ref[] }>;

// ---- people (ids match lib/platform/mocks where the person is a demo user) ----

const person = (role: Role): PersonRef => {
  const m = mockMeByRole[role];
  return { id: m.id, name: m.name, department: m.department };
};

export const mockPeople = {
  wanna: person("employee"),
  kittipat: { id: "a3d9e2b4-0000-4000-8000-000000000012", name: "กิตติพัฒน์ แสงทอง", department: "ฝ่ายจัดซื้อ" },
  malee: person("housekeeper_lead"),
  somsak: person("security_lead"),
  thanakorn: person("technician"),
  weera: { id: "d2e8a1b0-0000-4000-8000-000000000014", name: "วีระ มั่นคง", department: "ฝ่ายอาคารสถานที่" },
  suriya: { id: "d2e8a1b0-0000-4000-8000-000000000024", name: "สุริยา ทองมา", department: "ฝ่ายอาคารสถานที่" },
  anucha: { id: "d2e8a1b0-0000-4000-8000-000000000034", name: "อนุชา ใจกล้า", department: "ฝ่ายอาคารสถานที่" },
  paweena: person("admin"),
} satisfies Record<string, PersonRef>;

// ---- photos: inline SVG placeholders (no backend files in mock mode) ----

function placeholderSvg(hue: number, label: string, size: number): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 400 400">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="hsl(${hue} 55% 78%)"/><stop offset="1" stop-color="hsl(${hue} 45% 52%)"/>` +
    `</linearGradient></defs><rect width="400" height="400" fill="url(#g)"/>` +
    `<circle cx="200" cy="170" r="56" fill="hsl(${hue} 60% 92% / .55)"/>` +
    `<text x="200" y="300" font-family="sans-serif" font-size="30" text-anchor="middle" fill="hsl(${hue} 50% 18%)">${label}</text>` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

let photoSeq = 0;
function mockPhoto(hue: number, label: string): Photo {
  photoSeq += 1;
  return {
    id: `c7e4b1d2-0000-4000-8000-${photoSeq.toString().padStart(12, "0")}`,
    thumbUrl: placeholderSvg(hue, label, 240),
    url: placeholderSvg(hue, label, 1200),
  };
}

const HUE = { ac: 200, electric: 45, water: 190, building: 25, clean: 140, result: 150 };

// ---- tickets ----

type Seed = {
  n: number;
  status: TicketStatus;
  priority: Priority;
  prioritySource?: PrioritySource;
  /** Index in the CR-014 master; 0 = typed category before CR-014 ("อื่นๆ", `category: null`). */
  category: number;
  categoryOther?: string;
  symptoms: number[];
  /** A switched-off sample category (tickets before CR-014). */
  legacy?: { category: Ref; symptoms: Ref[] };
  symptomOther?: string;
  building: number;
  floor: number;
  /** Room name on that floor (CR-014); tickets before CR-014 have none. */
  room?: string;
  location?: string;
  details?: string;
  reporter: PersonRef;
  technician?: PersonRef;
  subscribers?: PersonRef[];
  createdAgo: number;
  assessedAgo?: number;
  resolvedAgo?: number;
  closedAgo?: number;
  closedReason?: TicketSummary["closedReason"];
  photos: Photo[];
  result?: { note: string; photos: Photo[] };
  rating?: number;
  ratingComment?: string;
  sendBackCount?: number;
  /** A later `assessment_changed` (CR-008 reason) that moves the date by `days`. */
  dateChange?: { ago: number; days: number; reason: string };
  extraEvents?: TimelineEvent[];
  ticketNo?: string;
  contractor?: { id: string; name: string; types: string[]; rating?: number };
};

const ticketId = (n: number) => `0b9c6a1e-0000-4000-8000-000000000${n.toString().padStart(3, "0")}`;

export const MOCK_IDS = {
  /** Reported by กิตติพัฒน์, not followed by วรรณา → forbidden for the employee demo user. */
  forbiddenTicket: ticketId(141),
  notFoundTicket: "00000000-0000-4000-8000-000000000404",
  /** Resolved ticket awaiting the employee's confirmation. */
  awaitingTicket: ticketId(148),
};

let eventSeq = 0;
function ev(type: TimelineEvent["type"], actor: PersonRef | null, at: string, extra: Partial<TimelineEvent> = {}): TimelineEvent {
  eventSeq += 1;
  return {
    id: `9a7f0000-0000-4000-8000-${eventSeq.toString().padStart(12, "0")}`,
    type,
    actor,
    at,
    note: null,
    photos: [],
    data: {},
    ...extra,
  };
}

function build(s: Seed): TicketDetail {
  const createdAt = ago(s.createdAgo);
  const assessedAt = s.assessedAgo !== undefined ? ago(s.assessedAgo) : null;
  const firstDoneOn = assessedAt ? new Date(new Date(assessedAt).getTime() + 2 * DAY).toISOString().slice(0, 10) : null;
  const expectedDoneOn = firstDoneOn && s.dateChange
    ? new Date(new Date(firstDoneOn).getTime() + s.dateChange.days * DAY).toISOString().slice(0, 10)
    : firstDoneOn;
  const resolvedAt = s.resolvedAgo !== undefined ? ago(s.resolvedAgo) : null;
  const closedAt = s.closedAgo !== undefined ? ago(s.closedAgo) : null;

  const timeline: TimelineEvent[] = [ev("created", s.reporter, createdAt)];
  for (const sub of s.subscribers ?? []) {
    timeline.push(
      ev("subscribed", sub, ago(s.createdAgo - HOUR / 2), {
        note: "ห้องข้าง ๆ ก็เป็นเหมือนกันค่ะ",
      }),
    );
  }
  const workBy = s.contractor ? "contractor" : "in_house";
  if (assessedAt && s.technician) timeline.push(ev("assessed", s.technician, assessedAt, { data: { expectedDoneOn: firstDoneOn!, workBy } }));
  if (assessedAt && s.technician && s.dateChange) {
    timeline.push(ev("assessment_changed", s.technician, ago(s.dateChange.ago), {
      data: { expectedDoneOn: expectedDoneOn!, workBy, reason: s.dateChange.reason },
    }));
  }
  timeline.push(...(s.extraEvents ?? []));
  if (resolvedAt && s.technician) {
    timeline.push(ev("resolved", s.technician, resolvedAt, { note: s.result?.note ?? null, photos: s.result?.photos ?? [], data: { workBy: s.contractor ? "contractor" : "in_house" } }));
  }
  if (closedAt && s.closedReason === "confirmed") {
    timeline.push(ev("confirmed", s.reporter, closedAt, { data: s.rating ? { rating: s.rating } : {} }));
  }
  if (closedAt && s.closedReason === "auto_closed") timeline.push(ev("auto_closed", null, closedAt));
  if (closedAt && s.closedReason === "admin_closed") {
    timeline.push(ev("admin_closed", mockPeople.paweena, closedAt, { note: "ส่งเรื่องเปลี่ยนเก้าอี้ใหม่ผ่านฝ่ายจัดซื้อแล้ว" }));
  }
  if (closedAt && s.closedReason === "team_handled") {
    timeline.push(ev("team_handled", s.reporter, closedAt, { note: "เช็ดพื้นและวางป้ายระวังลื่นแล้ว" }));
  }
  timeline.sort((a, b) => b.at.localeCompare(a.at));

  const updatedAt = [createdAt, assessedAt, resolvedAt, closedAt, ...timeline.map((e) => e.at)]
    .filter((d): d is string => !!d)
    .sort()
    .at(-1)!;

  return {
    id: ticketId(s.n),
    ticketNo: s.ticketNo ?? `RP-2569-000${s.n}`,
    status: s.status,
    step: stepOf(s.status, !!assessedAt, s.sendBackCount ?? 0),
    closedReason: s.closedReason ?? null,
    priority: s.priority,
    prioritySource: s.prioritySource ?? (s.categoryOther ? "default" : "symptom"),
    category: s.legacy?.category ?? (s.category ? cat(s.category) : null),
    categoryOther: s.categoryOther ?? null,
    symptoms: s.legacy?.symptoms ?? (s.category ? sym(s.category, ...s.symptoms) : []),
    symptomOther: s.symptomOther ?? null,
    building: bld(s.building),
    floor: flr(s.building, s.floor),
    room: s.room ? room(s.building, s.floor, s.room) : null,
    locationDetail: s.location ?? null,
    thumbUrl: s.photos[0]?.thumbUrl ?? null,
    reporter: s.reporter,
    technician: s.technician ?? null,
    viewerRelation: "none",
    awaitingMyConfirmation: false,
    expectedDoneOn,
    workBy: assessedAt ? workBy : null,
    contractor: s.contractor ? { id: s.contractor.id, name: s.contractor.name } : null,
    contractorTypes: s.contractor?.types ?? [],
    autoCloseAt: s.status === "resolved" && s.resolvedAgo !== undefined ? later(3 * DAY - s.resolvedAgo) : null,
    sendBackCount: s.sendBackCount ?? 0,
    rating: s.rating ?? null,
    createdAt,
    assessedAt,
    resolvedAt,
    closedAt,
    updatedAt,
    details: s.details ?? null,
    photos: s.photos,
    asset: null,
    subscriberCount: s.subscribers?.length ?? 0,
    result: s.result
      ? { note: s.result.note, photos: s.result.photos, by: s.technician ?? null, at: resolvedAt, contractorRating: s.contractor?.rating ?? null, contractorRatingComment: null }
      : null,
    ratingComment: s.ratingComment ?? null,
    timeline,
    allowedActions: [],
    blockedActions: {},
  };
}

function stepOf(status: TicketStatus, assessed: boolean, sendBacks: number): TicketStep {
  if (status === "closed") return "closed";
  if (status === "resolved") return "awaiting_rating";
  if (!assessed) return "awaiting_assessment";
  return sendBacks > 0 ? "reworking" : "in_repair";
}

const P = mockPeople;

const seeds: Seed[] = [
  {
    n: 150, status: "in_progress", priority: "high", category: 2, symptoms: [1, 2], building: 1, floor: 5,
    room: "ห้องประชุม 5B", location: "ฝั่งหน้าต่าง", details: "น้ำหยดใส่โต๊ะประชุม เริ่มตั้งแต่เช้า แอร์เปิดแล้วลมไม่เย็น",
    reporter: P.wanna, createdAgo: 50 * 60 * 1000,
    photos: [mockPhoto(HUE.ac, "แอร์ห้อง 5B"), mockPhoto(HUE.ac, "น้ำหยดบนโต๊ะ")],
  },
  {
    n: 149, status: "in_progress", priority: "medium", category: 1, symptoms: [1], building: 1, floor: 3,
    room: "พื้นที่ส่วนกลางชั้น 3", location: "ทางเดินหน้าลิฟต์", reporter: P.wanna, technician: P.thanakorn,
    createdAgo: DAY + 3 * HOUR, assessedAgo: DAY, dateChange: { ago: 2 * HOUR, days: 1, reason: "รออะไหล่บัลลาสต์" },
    photos: [mockPhoto(HUE.electric, "ไฟทางเดิน")],
  },
  {
    n: 148, status: "resolved", priority: "high", category: 3, symptoms: [2], building: 1, floor: 2,
    room: "ห้องน้ำหญิง", location: "ฝั่งทิศเหนือ", details: "น้ำรั่วจากใต้อ่างล้างมือ พื้นเปียกตลอด",
    reporter: P.wanna, technician: P.weera, createdAgo: DAY + 4 * HOUR, assessedAgo: DAY, resolvedAgo: 2 * HOUR,
    contractor: { id: "5c0a7d10-0000-4000-8000-000000000001", name: "ร้านประปาเจริญ", types: ["ประปา"], rating: 4 },
    photos: [mockPhoto(HUE.water, "ใต้อ่างล้างมือ")],
    result: { note: "เปลี่ยนสายน้ำดีและซีลใต้อ่างใหม่ ทดสอบเปิดน้ำ 15 นาที ไม่มีรั่วซึม", photos: [mockPhoto(HUE.result, "หลังซ่อม")] },
  },
  {
    n: 147, status: "in_progress", priority: "critical", category: 1, symptoms: [4], building: 1, floor: 6,
    room: "สำนักงานชั้น 6", location: "ห้องเซิร์ฟเวอร์", details: "เบรกเกอร์ตัดซ้ำทุกครึ่งชั่วโมง",
    reporter: P.kittipat, subscribers: [P.wanna], createdAgo: 2 * HOUR, photos: [mockPhoto(HUE.electric, "ตู้ไฟชั้น 6")],
  },
  {
    n: 146, status: "resolved", priority: "medium", category: 5, symptoms: [1], building: 1, floor: 4,
    room: "สำนักงานชั้น 4", location: "ฝ่ายจัดซื้อ โซน B", reporter: P.kittipat, subscribers: [P.wanna], technician: P.anucha,
    createdAgo: 2 * DAY, assessedAgo: DAY + 6 * HOUR, resolvedAgo: 5 * HOUR,
    photos: [mockPhoto(HUE.building, "ฝ้าเพดาน")],
    result: { note: "อุดรอยรั่วรอบท่อแอร์บนฝ้า เปลี่ยนแผ่นฝ้า 2 แผ่น", photos: [mockPhoto(HUE.result, "ฝ้าใหม่")] },
  },
  {
    n: 143, status: "in_progress", priority: "medium", prioritySource: "default", category: 0, categoryOther: "ลิฟต์", symptoms: [],
    symptomOther: "ลิฟต์ตัวซ้ายค้างระหว่างชั้น 2 กับ 3", building: 1, floor: 2, location: "โถงลิฟต์",
    reporter: P.wanna, createdAgo: 4 * HOUR, photos: [mockPhoto(HUE.building, "ลิฟต์ตัวซ้าย")],
  },
  {
    n: 145, status: "in_progress", priority: "medium", category: 1, symptoms: [1], building: 2, floor: 1,
    room: "สำนักงานชั้น 1", location: "ห้องเก็บเอกสาร", reporter: P.wanna, technician: P.suriya,
    createdAgo: DAY + 2 * HOUR, assessedAgo: 20 * HOUR, photos: [mockPhoto(HUE.electric, "หลอดไฟห้องเอกสาร")],
  },
  {
    n: 144, status: "closed", closedReason: "confirmed", priority: "medium", category: 3, symptoms: [3], building: 1, floor: 7,
    location: "แพนทรี", reporter: P.wanna, technician: P.weera,
    createdAgo: 4 * DAY, assessedAgo: 4 * DAY - 2 * HOUR, resolvedAgo: 3 * DAY, closedAgo: 2 * DAY, rating: 5,
    ratingComment: "ช่างมาเร็ว เก็บงานเรียบร้อยค่ะ",
    photos: [mockPhoto(HUE.water, "อ่างแพนทรี")],
    result: { note: "ล้างท่อน้ำทิ้ง เอาเศษอาหารที่อุดตันออก", photos: [mockPhoto(HUE.result, "ท่อหลังล้าง")] },
  },
  {
    n: 142, status: "closed", closedReason: "auto_closed", priority: "low", prioritySource: "reporter", category: 2, symptoms: [3], building: 1, floor: 5,
    location: "ฝ่ายบัญชี", reporter: P.wanna, technician: P.thanakorn,
    createdAgo: 9 * DAY, assessedAgo: 8 * DAY, resolvedAgo: 8 * DAY - 3 * HOUR, closedAgo: 5 * DAY,
    photos: [mockPhoto(HUE.ac, "แอร์ฝ่ายบัญชี")],
    result: { note: "ขันน็อตยึดพัดลมคอยล์ร้อนที่หลวม เสียงหายแล้ว", photos: [mockPhoto(HUE.result, "คอยล์ร้อน")] },
  },
  {
    n: 141, status: "in_progress", priority: "medium", category: 1, symptoms: [2], building: 1, floor: 4,
    room: "ห้องประชุม 4A", reporter: P.kittipat, createdAgo: 6 * HOUR,
    photos: [mockPhoto(HUE.electric, "ปลั๊กพ่วง")],
  },
  {
    n: 140, status: "closed", closedReason: "admin_closed", priority: "low", category: 0, legacy: legacy.furniture, symptoms: [], building: 1, floor: 5,
    location: "ห้องประชุม 5A", reporter: P.wanna, createdAgo: 12 * DAY, closedAgo: 10 * DAY,
    photos: [mockPhoto(HUE.building, "เก้าอี้ขาหัก")],
  },
  {
    n: 138, status: "closed", closedReason: "confirmed", priority: "high", prioritySource: "reporter", category: 2, symptoms: [1], building: 1, floor: 3,
    location: "ห้องประชุมใหญ่", reporter: P.wanna, technician: P.thanakorn, sendBackCount: 1,
    createdAgo: 22 * DAY, assessedAgo: 22 * DAY - 2 * HOUR, resolvedAgo: 20 * DAY, closedAgo: 20 * DAY - 4 * HOUR, rating: 4,
    photos: [mockPhoto(HUE.ac, "แอร์ห้องประชุมใหญ่")],
    result: { note: "เติมน้ำยาแอร์ และเปลี่ยนคาปาซิเตอร์คอมเพรสเซอร์", photos: [mockPhoto(HUE.result, "เติมน้ำยา")] },
    extraEvents: [
      ev("resolved", P.thanakorn, ago(21 * DAY)),
      ev("sent_back", P.wanna, ago(21 * DAY - 3 * HOUR), {
        note: "เปิดเกิน 1 ชั่วโมงแล้วยังไม่เย็น",
        photos: [mockPhoto(HUE.ac, "อุณหภูมิ 28°")],
      }),
    ],
  },
  {
    n: 135, status: "closed", closedReason: "team_handled", priority: "medium", prioritySource: "reporter", category: 0, legacy: legacy.cleaning, symptoms: [], building: 1, floor: 1,
    location: "ล็อบบี้ หน้าลิฟต์", reporter: P.malee, createdAgo: 25 * DAY, closedAgo: 25 * DAY,
    photos: [mockPhoto(HUE.clean, "พื้นล็อบบี้")],
  },
  {
    n: 981, ticketNo: "RP-2568-000981", status: "closed", closedReason: "confirmed", priority: "medium", category: 3,
    symptoms: [5], building: 2, floor: 2, location: "ห้องน้ำชาย", reporter: P.wanna, technician: P.weera,
    createdAgo: 400 * DAY, assessedAgo: 400 * DAY - HOUR, resolvedAgo: 399 * DAY, closedAgo: 398 * DAY, rating: 5,
    photos: [mockPhoto(HUE.water, "ชักโครก")],
    result: { note: "เปลี่ยนชุดลูกลอยชักโครก", photos: [mockPhoto(HUE.result, "ชุดลูกลอยใหม่")] },
  },
];

/** In-memory store: tickets created in mock mode are added here for the session. */
const store = {
  tickets: seeds.map(build),
  subscribers: new Map<string, string[]>(seeds.map((s) => [ticketId(s.n), (s.subscribers ?? []).map((p) => p.id)])),
  photos: new Map<string, Photo>(),
  nextNo: 151,
};

// ---- visibility + decoration (mirrors the backend rules, BR-F06-1/2/3) ----

type Viewer = { id: string; role: Role };

const seesAll = (v: Viewer) => v.role === "admin" || v.role === "executive" || v.role === "technician";
const isSubscriber = (t: TicketSummary, v: Viewer) => (store.subscribers.get(t.id) ?? []).includes(v.id);

function relation(t: TicketSummary, v: Viewer): TicketSummary["viewerRelation"] {
  if (t.reporter.id === v.id) return "reporter";
  if (isSubscriber(t, v)) return "subscriber";
  if (v.role === "technician") return "technician";
  return "none";
}

function canView(t: TicketSummary, v: Viewer) {
  return seesAll(v) || relation(t, v) !== "none";
}

function decorate<T extends TicketSummary>(t: T, v: Viewer): T {
  return {
    ...t,
    viewerRelation: relation(t, v),
    awaitingMyConfirmation: t.status === "resolved" && t.reporter.id === v.id,
    contractor: seesAll(v) ? t.contractor : null,
  };
}

const DETAIL_ONLY = new Set<string>([
  "details",
  "photos",
  "asset",
  "subscriberCount",
  "result",
  "ratingComment",
  "timeline",
  "allowedActions",
  "blockedActions",
]);

function toSummary(d: TicketDetail): TicketSummary {
  return Object.fromEntries(Object.entries(d).filter(([k]) => !DETAIL_ONLY.has(k))) as TicketSummary;
}

// ---- queries used by api.ts ----

export function mockTicketDetail(id: string, v: Viewer): TicketDetail {
  const t = store.tickets.find((x) => x.id === id);
  if (!t) throw mockErrors.notFound();
  if (!canView(t, v)) throw mockErrors.forbidden();
  return withActions(decorate(t, v), v);
}

/** Same rule as the backend `allowedActions` (rules.go), so S07 shows the right buttons in mock mode. */
function withActions(t: TicketDetail, v: Viewer): TicketDetail {
  const allowedActions: TicketDetail["allowedActions"] = [];
  const blockedActions: TicketDetail["blockedActions"] = {};
  if (t.status === "in_progress" && v.role === "technician") {
    allowedActions.push("assess");
    if (t.expectedDoneOn && t.workBy) allowedActions.push("resolve");
    else blockedActions.resolve = "ASSESSMENT_REQUIRED";
  }
  if (t.status === "resolved" && t.reporter.id === v.id) allowedActions.push("confirm", "send_back");
  return { ...t, allowedActions, blockedActions };
}

function matches(t: TicketSummary, q: TicketCountsQuery, v: Viewer): boolean {
  if (q.scope === "all") {
    if (!seesAll(v)) throw mockErrors.forbidden();
  } else {
    const rel = q.relation ?? "all";
    const reported = t.reporter.id === v.id;
    const following = isSubscriber(t, v);
    if (rel === "reported" ? !reported : rel === "following" ? !following : !(reported || following)) return false;
  }
  if (q.closedReason && t.closedReason !== q.closedReason) return false;
  if (q.q) {
    const needle = q.q.toLowerCase();
    const texts = [t.ticketNo, t.locationDetail ?? "", t.room?.name ?? ""];
    if (!texts.some((x) => x.toLowerCase().includes(needle))) return false;
  }
  if (q.createdFrom && t.createdAt < new Date(q.createdFrom).toISOString()) return false;
  if (q.createdTo && t.createdAt > new Date(q.createdTo).toISOString()) return false;
  if (q.categoryId && t.category?.id !== q.categoryId) return false;
  if (q.buildingId && t.building.id !== q.buildingId) return false;
  if (q.floorId && t.floor.id !== q.floorId) return false;
  if (q.priority && t.priority !== q.priority) return false;
  return true;
}

export function mockListTickets(q: TicketListQuery, v: Viewer): TicketPage {
  const page = Math.max(1, q.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, q.pageSize ?? 20));
  const status = q.status ?? [];
  const sort = q.sort ?? (status.length === 1 && status[0] === "closed" ? "closedAt:desc" : "updatedAt:desc");

  const key = (t: TicketSummary) =>
    sort === "closedAt:desc" ? (t.closedAt ?? "") : sort.startsWith("createdAt") ? t.createdAt : t.updatedAt;
  const all = store.tickets
    .map(toSummary)
    .filter((t) => matches(t, q, v) && (status.length === 0 || status.includes(t.status)) && (!q.step?.length || q.step.includes(t.step)))
    .map((t) => decorate(t, v))
    .sort((a, b) => {
      if (a.awaitingMyConfirmation !== b.awaitingMyConfirmation) return a.awaitingMyConfirmation ? -1 : 1;
      return sort === "createdAt:asc" ? key(a).localeCompare(key(b)) : key(b).localeCompare(key(a));
    });

  return { items: all.slice((page - 1) * pageSize, page * pageSize), meta: { page, pageSize, total: all.length } };
}

export function mockTicketCounts(q: TicketCountsQuery, v: Viewer): TicketCounts {
  const list = store.tickets.map(toSummary).filter((t) => matches(t, q, v));
  const count = (s: TicketStatus) => list.filter((t) => t.status === s).length;
  return {
    inProgress: count("in_progress"),
    resolved: count("resolved"),
    closed: count("closed"),
    awaitingAssessment: list.filter((t) => t.step === "awaiting_assessment").length,
    inRepair: list.filter((t) => t.step === "in_repair" || t.step === "reworking").length,
    awaitingMyConfirmation: list.filter((t) => t.status === "resolved" && t.reporter.id === v.id).length,
  };
}

export function mockRememberPhoto(p: Photo) {
  store.photos.set(p.id, p);
}

/** #28 (CR-014): the viewer's last 3 distinct rooms, newest first; tickets without a room are skipped. */
export function mockRecentPlaces(v: Viewer): RecentPlace[] {
  const seen = new Set<string>();
  const out: RecentPlace[] = [];
  for (const t of [...store.tickets].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    if (t.reporter.id !== v.id || !t.room) continue;
    const key = `${t.building.id}|${t.floor.id}|${t.room.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ building: t.building, floor: t.floor, room: t.room, locationDetail: t.locationDetail, lastReportedAt: t.createdAt });
    if (out.length === 3) break;
  }
  return out;
}

/** Adds a ticket the way the backend would (`in_progress` awaiting assessment, next number, `created` event). */
export function mockCreateTicket(
  req: {
    categoryId: string;
    categoryOther?: string;
    symptomIds: string[];
    symptomOther?: string;
    buildingId: string;
    floorId: string;
    roomId: string;
    locationDetail?: string;
    details?: string;
    photoIds: string[];
  },
  reporter: PersonRef,
  v: Viewer,
): TicketDetail {
  const category = mockCategories.find((c) => c.id === req.categoryId);
  const building = mockBuildings.find((b) => b.id === req.buildingId);
  const floor = building?.floors.find((f) => f.id === req.floorId);
  const picked = floor?.rooms.find((r) => r.id === req.roomId);
  const symptoms = (category?.symptoms ?? []).filter((s) => req.symptomIds.includes(s.id)).map(({ id, name }) => ({ id, name }));
  if (!category || !building || !floor || !picked || symptoms.length !== req.symptomIds.length) throw mockErrors.masterChanged();
  if (req.categoryOther?.trim() && !category.isOther) {
    throw new ApiError(400, "VALIDATION_FAILED", "mock: categoryOther not allowed", { categoryOther: "NOT_ALLOWED" });
  }
  const { priority, source } = ticketPriority(category, req.symptomIds);
  const photos = req.photoIds.map((id) => store.photos.get(id));
  if (photos.some((p) => !p)) throw new ApiError(422, "PHOTO_NOT_FOUND", "mock: photo not uploaded in this session");

  const now = new Date().toISOString();
  const n = store.nextNo++;
  const detail: TicketDetail = {
    id: crypto.randomUUID(),
    ticketNo: `RP-2569-${n.toString().padStart(6, "0")}`,
    status: "in_progress",
    step: "awaiting_assessment",
    closedReason: null,
    priority,
    prioritySource: source,
    category: { id: category.id, name: category.name },
    categoryOther: req.categoryOther?.trim() || null,
    symptoms,
    symptomOther: req.symptomOther?.trim() || null,
    building: { id: building.id, name: building.name },
    floor: { id: floor.id, name: floor.name },
    room: { id: picked.id, name: picked.name },
    locationDetail: req.locationDetail?.trim() || null,
    thumbUrl: photos[0]!.thumbUrl,
    reporter,
    technician: null,
    viewerRelation: "reporter",
    awaitingMyConfirmation: false,
    expectedDoneOn: null,
    workBy: null,
    contractor: null,
    contractorTypes: [],
    autoCloseAt: null,
    sendBackCount: 0,
    rating: null,
    createdAt: now,
    assessedAt: null,
    resolvedAt: null,
    closedAt: null,
    updatedAt: now,
    details: req.details?.trim() || null,
    photos: photos as Photo[],
    asset: null,
    subscriberCount: 0,
    result: null,
    ratingComment: null,
    timeline: [ev("created", reporter, now)],
    allowedActions: [],
    blockedActions: {},
  };
  store.tickets.unshift(detail);
  store.subscribers.set(detail.id, []);
  return withActions(decorate(detail, v), v);
}
