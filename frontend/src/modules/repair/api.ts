import { env } from "@/lib/env";
import { ApiError, http, type UploadOptions } from "@/lib/http";
import { mockRole } from "@/lib/platform/api";
import { mockMeByRole } from "@/lib/platform/mocks";
import {
  mockBuildings,
  mockCategories,
  mockCloseTicket,
  mockCreateAsset,
  mockCreateTicket,
  mockDeactivateAsset,
  mockDuplicates,
  mockErrors,
  mockFollowTicket,
  mockFloorPlan,
  mockGetAssetTypes,
  mockHandoverTicket,
  mockListMyTickets,
  mockLookupAsset,
  mockTechnicians,
  mockListTickets,
  mockOverview,
  mockRecentPlaces,
  mockRememberPhoto,
  mockScenario,
  mockSuggestAssetCode,
  mockTicketCounts,
  mockTicketDetail,
  mockUpdateAsset,
} from "./mocks";
import type {
  AssessRequest,
  Asset,
  AssetLookup,
  AssetType,
  Building,
  Category,
  CloseRequest,
  ConfirmRequest,
  Contractor,
  ContractorJobPage,
  ContractorPage,
  ContractorQuery,
  ContractorRequest,
  CreateAssetRequest,
  CreateTicketRequest,
  DuplicatesQuery,
  DuplicateTicket,
  FloorPlan,
  FollowRequest,
  HandoverRequest,
  MyTicketPage,
  MyTicketsQuery,
  Overview,
  Photo,
  RecentPlace,
  Ref,
  ResolveRequest,
  SendBackRequest,
  StaffRef,
  TicketCounts,
  TicketCountsQuery,
  TicketDetail,
  TicketListQuery,
  TicketPage,
  UpdateAssetRequest,
} from "./types";

// Repair API client — endpoint numbers from docs/modules/repair/04-api-contract.md.
// Components call only these functions. With NEXT_PUBLIC_USE_MOCKS=true they return
// mocks (see mocks.ts for the scenarios). Errors are `ApiError`; map them with errors.ts.

const BASE = "/repair";

/** D-022: limit per uploaded file and the client resize target; JPEG quality 0.25 since CR-026 (D-119). */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_PHOTOS = 5;
const RESIZE_LONG_EDGE = 1920;
const RESIZE_QUALITY = 0.25;

// ---- #1, #2 master data ----

export async function getCategories(): Promise<Category[]> {
  if (env.useMocks) return mock(() => mockCategories, { read: true, needsData: false });
  return http.get<Category[]>(`${BASE}/categories`);
}

export async function getBuildings(): Promise<Building[]> {
  if (env.useMocks) return mock(() => mockBuildings, { read: true, needsData: false });
  return http.get<Building[]>(`${BASE}/buildings`);
}

// ---- #28 recent places (CR-008) ----

/** S03 "ที่เคยแจ้ง": the caller's last 3 distinct places; empty for a first-time reporter. */
export async function getRecentPlaces(): Promise<RecentPlace[]> {
  if (env.useMocks) return mock(() => mockRecentPlaces(mockViewer()), { read: true });
  return http.get<RecentPlace[]>(`${BASE}/me/recent-places`);
}

// ---- #3 photo upload ----

/**
 * Prepares a picked photo for the form (PhotoPicker, CR-026 A1): resizes it to a 1920px JPEG at quality 0.25
 * (D-022 / D-119; also drops EXIF/GPS). Files the browser cannot decode (e.g. HEIC outside Safari) stay as
 * they are. Nothing is sent. Rejects with ApiError `PHOTO_TYPE_NOT_ALLOWED` / `PHOTO_TOO_LARGE`.
 */
export async function preparePhoto(file: File): Promise<File> {
  if (!file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name)) {
    throw new ApiError(400, "PHOTO_TYPE_NOT_ALLOWED", "not an image");
  }
  const blob = await resizeForUpload(file);
  if (blob.size > MAX_PHOTO_BYTES) throw new ApiError(400, "PHOTO_TOO_LARGE", "photo over 10 MB");
  return blob === file ? file : new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg", lastModified: file.lastModified });
}

/**
 * #3: uploads one prepared photo (`preparePhoto`). Called only when the user sends a form (CR-026 A1), right
 * before the action that attaches the ids; see `uploadKeptPhotos` in components/photo-picker.tsx.
 */
export async function uploadPhoto(file: File, opts: UploadOptions = {}): Promise<Photo> {
  if (env.useMocks) return mockUpload(file, opts);
  const form = new FormData();
  form.append("file", file, file.name);
  return http.upload<Photo>(`${BASE}/photos`, form, opts);
}

async function resizeForUpload(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file; // not decodable here — the server validates it
  }
  try {
    const scale = Math.min(1, RESIZE_LONG_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "white"; // transparent PNG → white, like the server thumbnail
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", RESIZE_QUALITY));
    return out ?? file;
  } finally {
    bitmap.close();
  }
}

// ---- #5 create ticket ----

/**
 * S03 send (normal or team mode). The server refuses a duplicate (CR-009): 409 `DUPLICATE_FOUND` →
 * `duplicateMatches(err)` (S04 dialog) · 409 `OWN_TICKET_AWAITING_RATING` → `ownTicketAwaitingRating(err)`
 * (go to S07 of that ticket) · 403 `TEAM_HANDLED_NOT_ALLOWED` for a non-lead in team mode.
 */
export async function createTicket(req: CreateTicketRequest): Promise<TicketDetail> {
  if (env.useMocks) {
    const scenario = mockScenario();
    if (scenario === "validation") return mockFail(mockErrors.validation());
    if (scenario === "master_changed") return mockFail(mockErrors.masterChanged());
    if (scenario === "error") return mockFail(mockErrors.network());
    return mock(() => {
      const me = mockMeByRole[mockRole()];
      return mockCreateTicket(req, { id: me.id, name: me.name, department: me.department }, mockViewer());
    }, { delayMs: 700 });
  }
  return http.post<TicketDetail>(`${BASE}/tickets`, req);
}

// ---- #6, #7 lists ----

/** S06 (scope=mine); S09 / S11 work lists (scope=all, step filter, sort=createdAt:asc — CR-015). */
export async function getTickets(query: TicketListQuery = {}): Promise<TicketPage> {
  if (env.useMocks) return mock(() => mockListTickets(query, mockViewer()), { read: true });
  const res = await http.list<TicketPage["items"][number]>(`${BASE}/tickets${toQuery(query)}`);
  return { items: res.data, meta: res.meta ?? { page: 1, pageSize: res.data.length, total: res.data.length } };
}

/** #35 S06 table (CR-019): one page of slim rows — only the columns S06 shows. */
export async function getMyTickets(query: MyTicketsQuery = {}): Promise<MyTicketPage> {
  if (env.useMocks) return mock(() => mockListMyTickets(query, mockViewer()), { read: true });
  const res = await http.list<MyTicketPage["items"][number]>(`${BASE}/tickets/mine${toQuery(query)}`);
  return { items: res.data, meta: res.meta ?? { page: 1, pageSize: res.data.length, total: res.data.length } };
}

export async function getTicketCounts(query: TicketCountsQuery = {}): Promise<TicketCounts> {
  if (env.useMocks) return mock(() => mockTicketCounts(query, mockViewer()), { read: true });
  return http.get<TicketCounts>(`${BASE}/tickets/counts${toQuery(query)}`);
}

// ---- #8 detail ----

/** S05 and S07. Rejects with `TICKET_NOT_FOUND` (404) or `FORBIDDEN` (403) → page states. */
export async function getTicket(id: string): Promise<TicketDetail> {
  if (env.useMocks) {
    if (mockScenario() === "forbidden") return mockFail(mockErrors.forbidden());
    return mock(() => mockTicketDetail(id, mockViewer()), { read: true });
  }
  return http.get<TicketDetail>(`${BASE}/tickets/${encodeURIComponent(id)}`);
}

// ---- #9–#12 ticket actions (CR-005) ----
// Mock mode does not cover Stage 2 endpoints; they always call the API (PROGRESS.md Open issues).

const ticketPath = (id: string) => `${BASE}/tickets/${encodeURIComponent(id)}`;

/** S17: technician รับเรื่อง (sets the expected finish date) or changes it with an optional reason. */
export function assessTicket(id: string, req: AssessRequest): Promise<TicketDetail> {
  return http.post<TicketDetail>(`${ticketPath(id)}/assess`, req);
}

/** #36 (CR-034): the S17 `ช่างผู้รับผิดชอบ` picker — active users with `repair.ticket.work`. */
export async function getTechnicians(): Promise<StaffRef[]> {
  if (env.useMocks) return mock(() => mockTechnicians, { read: true });
  return http.get<StaffRef[]>(`${BASE}/technicians`);
}

/** S10: result note + photos, who did the work, contractor rating. */
export function resolveTicket(id: string, req: ResolveRequest): Promise<TicketDetail> {
  return http.post<TicketDetail>(`${ticketPath(id)}/resolve`, req);
}

/** S08: reporter ประเมินตรวจงาน 1–5 (required) → closed. */
export function confirmTicket(id: string, req: ConfirmRequest): Promise<TicketDetail> {
  return http.post<TicketDetail>(`${ticketPath(id)}/confirm`, req);
}

/** S08: reporter sends the work back with a reason → reworking. */
export function sendBackTicket(id: string, req: SendBackRequest): Promise<TicketDetail> {
  return http.post<TicketDetail>(`${ticketPath(id)}/send-back`, req);
}

// ---- #21 admin close (Stage 3, F08-B) ----

/** S07 / S11: admin closes any open ticket with a reason → `closed` / `admin_closed`. 409 `TICKET_CLOSED` when already closed. */
export async function closeTicket(id: string, req: CloseRequest): Promise<TicketDetail> {
  if (env.useMocks) {
    if (mockScenario() === "error") return mockFail(mockErrors.network());
    return mock(() => mockCloseTicket(id, req.reason, mockViewer()), { delayMs: 500 });
  }
  return http.post<TicketDetail>(`${ticketPath(id)}/close`, req);
}

// ---- #22–#24 duplicates, follow, hand over (Stage 4, F03 / F05) ----

/**
 * #22 S03 duplicate card (สถานที่ step, once category + floor + room are known; send the extra spot too
 * and refetch when it changes): open tickets on the same category + floor + room, blocking ones first
 * (BR-F03-1, CR-020). Empty = no card · any `blocksReport` = duplicate card · none = "similar" card.
 */
export async function getDuplicates(query: DuplicatesQuery): Promise<DuplicateTicket[]> {
  if (env.useMocks) return mock(() => mockDuplicates(query, mockViewer()), { read: true });
  return http.get<DuplicateTicket[]>(`${BASE}/tickets/duplicates${toQuery(query)}`);
}

/**
 * #23 S04 ติดตามเคสนี้: the viewer follows the open case; the form's details and photos go into its
 * timeline (`subscribed`). 409 `TICKET_CLOSED` (errorMessage ctx `follow` → เคสนี้ปิดไปแล้ว) · 409 `ALREADY_FOLLOWING`.
 */
export async function followTicket(id: string, req: FollowRequest): Promise<TicketDetail> {
  if (env.useMocks) {
    if (mockScenario() === "error") return mockFail(mockErrors.network());
    return mock(() => mockFollowTicket(id, req, mockViewer()), { delayMs: 500 });
  }
  return http.post<TicketDetail>(`${ticketPath(id)}/follow`, req);
}

/**
 * #24 S07 / S11 ส่งต่อให้ช่าง (`allowedActions` has `handover`): the same team-handled ticket goes back
 * to the technician (`in_progress`, awaiting assessment). 403 `FORBIDDEN` · 422 `NOT_TEAM_HANDLED` (refetch).
 */
export async function handoverTicket(id: string, req: HandoverRequest): Promise<TicketDetail> {
  if (env.useMocks) {
    if (mockScenario() === "error") return mockFail(mockErrors.network());
    return mock(() => mockHandoverTicket(id, req.reason, mockViewer()), { delayMs: 500 });
  }
  return http.post<TicketDetail>(`${ticketPath(id)}/handover`, req);
}

// ---- #25 asset lookup (Stage 5 QR, F13-B) ----

/**
 * #25 S03 `?asset=` prefill and S16 manual code. 404 `ASSET_NOT_FOUND` → S03 "ไม่พบอุปกรณ์นี้" (form
 * stays empty and usable) / S16 "ไม่พบอุปกรณ์รหัสนี้" under the field · 403 without `repair.ticket.report`.
 * Any other failure: S03 treats it as not found, S16 shows the generic toast. The code is matched
 * ignoring case; send it trimmed.
 */
export async function lookupAsset(code: string): Promise<AssetLookup> {
  if (env.useMocks) return mock(() => mockLookupAsset(code, mockViewer()), { read: true, needsData: false });
  return http.get<AssetLookup>(`${BASE}/assets/${encodeURIComponent(code.trim())}`);
}

// ---- #13–#19 contractors (F24) ----

export function getContractorTypes(): Promise<Ref[]> {
  return http.get<Ref[]>(`${BASE}/contractor-types`);
}

/** Returns the existing type when the name exists (any case). */
export function createContractorType(name: string): Promise<Ref> {
  return http.post<Ref>(`${BASE}/contractor-types`, { name });
}

export async function getContractors(query: ContractorQuery = {}): Promise<ContractorPage> {
  const res = await http.list<Contractor>(`${BASE}/contractors${toQuery(query)}`);
  return { items: res.data, meta: res.meta ?? { page: 1, pageSize: res.data.length, total: res.data.length } };
}

export function getContractor(id: string): Promise<Contractor> {
  return http.get<Contractor>(`${BASE}/contractors/${encodeURIComponent(id)}`);
}

export function createContractor(req: ContractorRequest): Promise<Contractor> {
  return http.post<Contractor>(`${BASE}/contractors`, req);
}

export function updateContractor(id: string, req: ContractorRequest): Promise<Contractor> {
  return http.put<Contractor>(`${BASE}/contractors/${encodeURIComponent(id)}`, req);
}

export async function getContractorJobs(id: string, page = 1, pageSize = 20): Promise<ContractorJobPage> {
  const res = await http.list<ContractorJobPage["items"][number]>(`${BASE}/contractors/${encodeURIComponent(id)}/jobs${toQuery({ page, pageSize })}`);
  return { items: res.data, meta: res.meta ?? { page, pageSize, total: res.data.length } };
}
// ---- Stage 3D (CR-016): S29 dashboard, floor plans, equipment ----

/** #27 S29: key numbers, buildings → floors with open counts, attention list. 403 without `repair.overview.view` (Admin, Superadmin). */
export async function getOverview(): Promise<Overview> {
  if (env.useMocks) return mock(() => mockOverview(mockViewer()), { read: true });
  return http.get<Overview>(`${BASE}/admin/overview`);
}

/** #29 equipment types for the palette and the add dialog. */
export async function getAssetTypes(): Promise<AssetType[]> {
  if (env.useMocks) return mock(() => mockGetAssetTypes(mockViewer()), { read: true, needsData: false });
  return http.get<AssetType[]>(`${BASE}/asset-types`);
}

/** #30 one floor: plan size, rooms with outlines + open counts, active equipment. 404 `FLOOR_NOT_FOUND`. */
export async function getFloorPlan(floorId: string): Promise<FloorPlan> {
  if (env.useMocks) return mock(() => mockFloorPlan(floorId, mockViewer()), { read: true, needsData: false });
  return http.get<FloorPlan>(`${BASE}/floors/${encodeURIComponent(floorId)}/plan`);
}

/** #31 admin adds equipment. 409 `ASSET_CODE_TAKEN` · 422 `POINT_OUTSIDE_ROOM` / `MASTER_DATA_CHANGED` · 400 fields (assetFieldMessages). */
export async function createAsset(req: CreateAssetRequest): Promise<Asset> {
  if (env.useMocks) {
    if (mockScenario() === "error") return mockFail(mockErrors.network());
    return mock(() => mockCreateAsset(req, mockViewer()), { delayMs: 400 });
  }
  return http.post<Asset>(`${BASE}/assets`, req);
}

/** #32 admin edits / moves equipment (same errors as #31, plus 404 `ASSET_NOT_FOUND`). */
export async function updateAsset(id: string, req: UpdateAssetRequest): Promise<Asset> {
  if (env.useMocks) {
    if (mockScenario() === "error") return mockFail(mockErrors.network());
    return mock(() => mockUpdateAsset(id, req, mockViewer()), { delayMs: 400 });
  }
  return http.put<Asset>(`${BASE}/assets/${encodeURIComponent(id)}`, req);
}

/** #33 admin removes equipment = deactivate (the code stays taken). 404 `ASSET_NOT_FOUND`. */
export async function deactivateAsset(id: string): Promise<void> {
  if (env.useMocks) {
    if (mockScenario() === "error") return mockFail(mockErrors.network());
    return mock(() => mockDeactivateAsset(id, mockViewer()), { delayMs: 400 });
  }
  await http.post<void>(`${BASE}/assets/${encodeURIComponent(id)}/deactivate`);
}

/** #34 next free code for the add dialog (`AC-1-003`); the user may type any free code. */
export async function suggestAssetCode(assetTypeId: string, floorId: string): Promise<string> {
  if (env.useMocks) return mock(() => mockSuggestAssetCode(assetTypeId, floorId, mockViewer()), { delayMs: 150 });
  const res = await http.get<{ code: string }>(`${BASE}/assets/suggest-code${toQuery({ assetTypeId, floorId })}`);
  return res.code;
}

// ---- helpers ----

function toQuery(q: Record<string, unknown>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) {
      if (v.length) p.set(k, v.join(","));
    } else {
      p.set(k, String(v));
    }
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

function mockViewer() {
  const me = mockMeByRole[mockRole()];
  return { id: me.id, role: me.role, permissions: me.permissions };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Runs a mock with latency and the active scenario. `read` calls fail in `error`;
 * `needsData: false` keeps master data available in `empty`.
 */
async function mock<T>(fn: () => T, opts: { read?: boolean; needsData?: boolean; delayMs?: number } = {}): Promise<T> {
  const scenario = mockScenario();
  await sleep(scenario === "slow" ? 3000 : (opts.delayMs ?? 300));
  if (opts.read && scenario === "error") throw mockErrors.server();
  if (scenario === "empty" && opts.read && opts.needsData !== false) {
    const empty = emptyLike(fn());
    if (empty !== undefined) return empty as T;
  }
  return fn();
}

async function mockFail<T>(err: ApiError): Promise<T> {
  await sleep(mockScenario() === "slow" ? 3000 : 500);
  throw err;
}

/** `empty` scenario: lists become empty, counts zero; a detail stays (S05 after a create). */
function emptyLike(v: unknown): unknown {
  if (Array.isArray(v)) return [];
  if (v && typeof v === "object" && "items" in v && "meta" in v) {
    const page = v as TicketPage;
    return { items: [], meta: { ...page.meta, total: 0 } };
  }
  if (v && typeof v === "object" && "awaitingMyConfirmation" in v && "inProgress" in v) {
    return { inProgress: 0, resolved: 0, closed: 0, awaitingAssessment: 0, inRepair: 0, awaitingMyConfirmation: 0 } satisfies TicketCounts;
  }
  return undefined;
}

async function mockUpload(blob: Blob, opts: UploadOptions): Promise<Photo> {
  const scenario = mockScenario();
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    if (opts.signal?.aborted) throw new DOMException("upload aborted", "AbortError");
    await sleep(scenario === "slow" ? 400 : 120);
    opts.onProgress?.(i / steps);
  }
  if (scenario === "upload_error" || scenario === "error") throw mockErrors.network();
  const url = URL.createObjectURL(blob);
  const photo: Photo = { id: crypto.randomUUID(), thumbUrl: url, url };
  mockRememberPhoto(photo);
  return photo;
}
