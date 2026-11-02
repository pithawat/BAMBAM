import { ApiError } from "@/lib/http";
import { MOCK_CUSTOM_ROLE } from "@/lib/platform/mocks";
import type { Me } from "@/lib/platform/types";
import type {
  CategoryAdmin,
  ContractorTypeAdmin,
  CreateCategoryInput,
  CreateSymptomInput,
  OrderInput,
  Priority,
  SymptomAdmin,
  UpdateCategoryInput,
  UpdateContractorTypeInput,
  UpdateSymptomInput,
  AssetAdmin,
  AssetTypeAdmin,
  CreateAssetInput,
  CreateAssetTypeInput,
  PlanBuilding,
  PlanFloor,
  PlanRoom,
  RenameInput,
  UpdateBuildingInput,
  AuditChange,
  BuildingTypeAdmin,
  CreateBuildingTypeInput,
  UpdateBuildingTypeInput,
  LabelAsset,
  LabelAssetsQuery,
  LabelStatus,
  RoomAssetsQuery,
  UpdateAssetInput,
  UpdateAssetTypeInput,
  AuditEntry,
  AuditQuery,
  Page,
  RoleHistoryItem,
  RoleRef,
  UserDetail,
  UserQuery,
  UserSummary,
  CannotChangeReason,
  CreateRoleInput,
  GuardRule,
  MatrixRole,
  PermissionMatrix,
  PermissionSystem,
  PersonRef,
  Role,
  RoleGuard,
  RoleListItem,
  SavePermissionsInput,
  UpdateRoleInput,
} from "./types";

// Mock data for settings (settings _common.md §7, fictional). Scenarios: `?mock=<name>` in the URL (kept in
// localStorage) — normal · empty · error · forbidden · slow · conflict (S24: the first matrix save gets
// VERSION_CONFLICT, as if another Superadmin saved first). The viewer's own permissions also apply, as on the API.
// Writes change an in-memory copy (reset on reload) and follow the API rules, so dialogs and errors can be tried.

export const MOCK_SCENARIOS = ["normal", "empty", "error", "forbidden", "slow", "conflict"] as const;
export type MockScenario = (typeof MOCK_SCENARIOS)[number];

const SCENARIO_KEY = "bambam.settings.mockScenario";

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
  forbidden: () => new ApiError(403, "FORBIDDEN", "mock: not allowed"),
  code: (status: number, code: string, fields: Record<string, string> = {}, details?: unknown) => new ApiError(status, code, `mock: ${code}`, fields, details),
};

export const mockPeople = {
  nattapon: { id: "9a1c7e20-0000-4000-8000-000000000007", name: "ณัฐพล อินทรวงศ์", department: "ฝ่ายเทคโนโลยีสารสนเทศ" },
  paweena: { id: "b1c2d3e4-0000-4000-8000-000000000005", name: "ปวีณา ศรีสุข", department: "ศูนย์จัดการงานอาคาร" },
} satisfies Record<string, PersonRef>;

const SEEDED_AT = "2026-10-14T02:00:00Z";

/** #2 — ids of the seeded roles are the migration's UUIDv5 ids. */
export const mockRoles: Role[] = [
  { id: "7f35e48b-245b-5d5c-a1af-eb43d9181a3c", key: "super_admin", name: "Superadmin", description: "ดูแลระบบทั้งหมด รวมผู้ใช้และสิทธิ์", isSystem: true, isLocked: true, userCount: 1, updatedAt: SEEDED_AT, updatedBy: null },
  { id: "5f75bf9d-49de-5619-af0a-53b0d96f5058", key: "employee", name: "พนักงานทั่วไป", description: "แจ้งซ่อมและติดตามงานของตัวเอง", isSystem: true, isLocked: false, userCount: 412, updatedAt: SEEDED_AT, updatedBy: null },
  { id: "b1c735a0-4a1e-5e0a-af94-f8c879af66eb", key: "housekeeper_lead", name: "หัวหน้าแม่บ้าน", description: "บันทึกและติดตามงานที่ทีมดำเนินการเอง", isSystem: false, isLocked: false, userCount: 1, updatedAt: SEEDED_AT, updatedBy: null },
  { id: "1b93abea-52ba-5e69-92d0-46d66c9689ec", key: "security_lead", name: "หัวหน้ารปภ.", description: "บันทึกและติดตามงานที่ทีมดำเนินการเอง", isSystem: false, isLocked: false, userCount: 1, updatedAt: SEEDED_AT, updatedBy: null },
  { id: "3c83d3f8-f274-599c-ae39-111c9e23defa", key: "technician", name: "ช่างเทคนิค", description: "รับเรื่อง ดำเนินการ และบันทึกผลซ่อม", isSystem: false, isLocked: false, userCount: 1, updatedAt: SEEDED_AT, updatedBy: null },
  { id: "b736a006-ba77-5545-90ac-9f5387f981ba", key: "admin", name: "Admin", description: "จัดการงานซ่อม สถานที่ อุปกรณ์ และหมวดงาน", isSystem: false, isLocked: false, userCount: 2, updatedAt: SEEDED_AT, updatedBy: null },
  { id: "0d3f6a2c-0000-4000-8000-0000000000c1", key: MOCK_CUSTOM_ROLE, name: "หัวหน้าช่าง", description: "ดูแลงานซ่อมทั้งหมด", isSystem: false, isLocked: false, userCount: 0, updatedAt: "2026-10-26T03:42:00Z", updatedBy: mockPeople.nattapon },
];

// ---- Stage 2: permission catalog and matrix (#6) — same copy and order as the Go catalog ----

const P = {
  report: "repair.ticket.report",
  viewAll: "repair.ticket.view_all",
  work: "repair.ticket.work",
  closeAny: "repair.ticket.close_any",
  teamHandle: "repair.ticket.team_handle",
  handoverAny: "repair.ticket.handover_any",
  contractor: "repair.contractor.manage",
  overview: "repair.overview.view",
  building3d: "repair.building3d.view",
  car: "car_booking.use",
  room: "room_booking.use",
  locations: "settings.locations.manage",
  assets: "settings.assets.manage",
  categories: "settings.categories.manage",
  contractorTypes: "settings.contractor_types.manage",
  usersView: "settings.users.view",
  users: "settings.users.manage",
  roles: "settings.roles.manage",
  audit: "settings.audit.view",
} as const;

export const mockPermissionSystems: PermissionSystem[] = [
  {
    key: "repair",
    name: "ระบบแจ้งซ่อม",
    groups: [
      {
        key: "repair.access",
        name: "การใช้บริการแจ้งซ่อม",
        isFixed: false,
        permissions: [
          { key: P.report, label: "แจ้งซ่อม", description: "แจ้งงานใหม่ สแกน QR แจ้ง และติดตามเคสเดิม", requires: null },
        ],
      },
      {
        key: "repair.ticket",
        name: "งานแจ้งซ่อม",
        isFixed: false,
        permissions: [
          { key: P.viewAll, label: "ดูทุกงาน", description: "เห็นงานซ่อมทุกงาน รวมชื่อและคะแนนช่างภายนอก", requires: null },
          { key: P.work, label: "ดำเนินการและบันทึกผลซ่อม", description: "งานซ่อมทุกงานส่งถึง role นี้ ประเมินวันคาดว่าเสร็จ และบันทึกผลซ่อม", requires: null },
          { key: P.closeAny, label: "ปิดงานใดก็ได้", description: "ปิดงานได้โดยไม่ต้องรอผู้แจ้งตรวจรับ", requires: null },
        ],
      },
      {
        key: "repair.team",
        name: "งานทีม ช่างภายนอก และภาพรวมอาคาร",
        isFixed: false,
        permissions: [
          { key: P.teamHandle, label: "บันทึกงานทีมทำเอง", description: "บันทึกงานที่ทีมทำเอง และส่งต่องานที่ตัวเองบันทึกให้ช่าง", requires: null },
          { key: P.handoverAny, label: "ส่งต่องานทีมทุกงาน", description: "ส่งต่องานทีมทำเองของทุกคนให้ช่าง", requires: null },
          { key: P.contractor, label: "จัดการช่างภายนอก", description: "เพิ่มและแก้ไขข้อมูลช่างภายนอก", requires: null },
          { key: P.overview, label: "ดูภาพรวมอาคาร", description: "ดู dashboard อาคารและงานที่ยังไม่ปิด", requires: null },
          { key: P.building3d, label: "ดูโมเดล 3D อาคาร", description: "ดูโมเดล 3 มิติของอาคารและภาพรวมพื้นที่ใน dashboard (ต้องมีสิทธิ์ดูภาพรวมอาคาร)", requires: P.overview },
        ],
      },
    ],
  },
  {
    key: "services",
    name: "การเข้าใช้บริการ",
    groups: [
      {
        key: "services.booking",
        name: "ระบบจองรถและห้องประชุม",
        isFixed: false,
        permissions: [
          { key: P.car, label: "ใช้ระบบจองรถ", description: "เห็นบริการจองรถในหน้าแรกและเมนู", requires: null },
          { key: P.room, label: "ใช้ระบบจองห้องประชุม", description: "เห็นบริการจองห้องประชุมในหน้าแรกและเมนู", requires: null },
        ],
      },
    ],
  },
  {
    key: "settings",
    name: "ตั้งค่าระบบ",
    groups: [
      {
        key: "settings",
        name: "ตั้งค่าระบบ",
        isFixed: false,
        permissions: [
          { key: P.locations, label: "อาคารและห้อง", description: "แก้ชื่ออาคาร ห้อง และประเภทอาคาร", requires: null },
          { key: P.assets, label: "อุปกรณ์และประเภทอุปกรณ์", description: "เพิ่ม ย้าย แก้ไขอุปกรณ์ในห้องและประเภทอุปกรณ์ รวมการจัดวางใน dashboard", requires: null },
          { key: P.categories, label: "หมวดงานและอาการ", description: "ตั้งค่าหมวดงาน อาการ และความเร่งด่วน", requires: null },
          { key: P.contractorTypes, label: "ประเภทผู้รับเหมา", description: "ตั้งค่าประเภทผู้รับเหมา", requires: null },
          { key: P.usersView, label: "ดูรายชื่อผู้ใช้", description: "ดูรายชื่อผู้ใช้และ role ของแต่ละคน (อ่านอย่างเดียว)", requires: null },
          { key: P.users, label: "เปลี่ยน role ผู้ใช้", description: "เปลี่ยน role ของผู้ใช้ (รวมการดูรายชื่อ)", requires: null },
          { key: P.roles, label: "Role และสิทธิ์", description: "เพิ่ม แก้ ลบ role และติ๊กสิทธิ์", requires: null },
          { key: P.audit, label: "ประวัติการเปลี่ยนแปลง", description: "ดูว่าใครเปลี่ยนอะไรในตั้งค่าระบบ", requires: null },
        ],
      },
    ],
  },
];

const CATALOG = mockPermissionSystems.flatMap((s) => s.groups.flatMap((g) => g.permissions.map((p) => ({ ...p, isFixed: g.isFixed }))));
const CATALOG_KEYS = CATALOG.map((p) => p.key);
const isFixedKey = (k: string) => CATALOG.some((p) => p.key === k && p.isFixed);

const SERVICES = [P.report, P.car, P.room];
const SETTINGS = [P.locations, P.assets, P.categories, P.contractorTypes, P.usersView, P.users, P.roles, P.audit];

/** Seeded matrix = `01-users.md` defaults + the CR-006 migration; the custom role matches its mock `Me`. */
const SEEDED_STORED: Record<string, string[]> = {
  employee: [...SERVICES],
  housekeeper_lead: [...SERVICES, P.teamHandle],
  security_lead: [...SERVICES, P.teamHandle],
  technician: [P.viewAll, P.work, P.contractor],
  admin: [...SERVICES, P.viewAll, P.closeAny, P.handoverAny, P.overview, P.building3d, ...SETTINGS],
  [MOCK_CUSTOM_ROLE]: [...SERVICES, P.viewAll, P.work, P.closeAny],
};

/** Effective keys in catalog order: super_admin all; others their stored keys (no group is fixed since CR-006). */
function effective(roleKey: string, stored: string[]): string[] {
  return CATALOG.filter((p) => roleKey === "super_admin" || (!p.isFixed && stored.includes(p.key))).map((p) => p.key);
}

// ---- CR-006 guard rules G1–G3, same as the API (backend settings/guards.go) ----

/** Who calls (the mock `Me` of the role switcher). */
export type MockViewer = Pick<Me, "id" | "role" | "permissions">;

const isSuper = (v: MockViewer) => v.role === "super_admin";

/** G1 / G2: the rule that stops the viewer from touching the role with this key. */
function roleGuard(v: MockViewer, roleKey: string): RoleGuard | null {
  if (isSuper(v)) return null;
  if (roleKey === "super_admin") return "SUPER_ADMIN";
  if (roleKey === v.role) return "OWN_ROLE";
  return null;
}

/** G3: the viewer holds every key. */
const holdsAll = (v: MockViewer, keys: string[]) => isSuper(v) || keys.every((k) => v.permissions.includes(k));

const guardError = (rule: GuardRule) => mockErrors.code(403, "PERMISSION_GUARD", undefined, { rule });

function assignGuard(v: MockViewer, roleKey: string, perms: string[]): GuardRule | null {
  if (isSuper(v)) return null;
  if (roleKey === "super_admin") return "SUPER_ADMIN";
  return holdsAll(v, perms) ? null : "ESCALATION";
}

// ---- in-memory store for #2–#7 (reset on reload) ----

const store = {
  roles: mockRoles.map((r) => ({ ...r })),
  stored: new Map<string, string[]>(mockRoles.map((r) => [r.id, [...(SEEDED_STORED[r.key] ?? [])]])),
  version: 12,
  updatedAt: "2026-10-26T03:42:00Z",
  updatedBy: mockPeople.nattapon as PersonRef | null,
  conflictPending: true,
};

const now = () => new Date().toISOString();
const randomHex = () =>
  Math.floor(Math.random() * 0xffffffff)
    .toString(16)
    .padStart(8, "0");

const permsOf = (r: Role) => effective(r.key, store.stored.get(r.id) ?? []);

/** #2 — with this viewer's guard / assignable (CR-006). */
export function mockRoleList(viewer: MockViewer): RoleListItem[] {
  return store.roles.map((r) => ({ ...r, guard: roleGuard(viewer, r.key), assignable: assignGuard(viewer, r.key, permsOf(r)) === null }));
}

/** #6 — with this viewer's row guards and grantable keys (CR-006). */
export function mockMatrix(viewer: MockViewer): PermissionMatrix {
  const roles: MatrixRole[] = store.roles.map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    userCount: r.userCount,
    isLocked: r.isLocked,
    guard: roleGuard(viewer, r.key),
    permissions: permsOf(r),
  }));
  return {
    version: store.version, updatedAt: store.updatedAt, updatedBy: store.updatedBy, systems: mockPermissionSystems, roles,
    grantable: CATALOG_KEYS.filter((k) => holdsAll(viewer, [k])),
  };
}

function validateRole(name: string | undefined, description: string | undefined, selfId?: string) {
  const fields: Record<string, string> = {};
  if (name !== undefined) {
    if (name.trim() === "") fields.name = "REQUIRED";
    else if ([...name.trim()].length > 50) fields.name = "TOO_LONG";
  }
  if (description !== undefined && [...description.trim()].length > 200) fields.description = "TOO_LONG";
  if (Object.keys(fields).length > 0) throw mockErrors.code(400, "VALIDATION_FAILED", fields);
  const lower = name?.trim().toLowerCase();
  if (lower && store.roles.some((r) => r.id !== selfId && r.name.toLowerCase() === lower)) throw mockErrors.code(409, "NAME_TAKEN");
}

function findRole(id: string): Role {
  const r = store.roles.find((x) => x.id === id);
  if (!r) throw mockErrors.code(404, "ROLE_NOT_FOUND");
  return r;
}

/** #3 — copy-from takes the source's keys; a non-Superadmin may only copy a role within their own keys (G3). */
export function mockCreateRole(input: CreateRoleInput, actor: PersonRef, viewer: MockViewer): Role {
  let copied: string[] = [];
  if (input.copyFromRoleId) {
    const src = store.roles.find((r) => r.id === input.copyFromRoleId);
    if (src && !holdsAll(viewer, permsOf(src))) throw guardError("ESCALATION");
    validateRole(input.name, input.description ?? "");
    if (!src) throw mockErrors.code(400, "VALIDATION_FAILED", { copyFromRoleId: "INVALID" });
    copied = permsOf(src).filter((k) => !isFixedKey(k));
  } else {
    validateRole(input.name, input.description ?? "");
  }
  const role: Role = {
    id: crypto.randomUUID(),
    key: `r_${randomHex()}`,
    name: input.name.trim(),
    description: (input.description ?? "").trim(),
    isSystem: false,
    isLocked: false,
    userCount: 0,
    updatedAt: now(),
    updatedBy: actor,
  };
  store.roles.push(role);
  store.stored.set(role.id, copied);
  return { ...role };
}

/** #4 — G1 / G2 first. */
export function mockUpdateRole(id: string, input: UpdateRoleInput, actor: PersonRef, viewer: MockViewer): Role {
  const r = findRole(id);
  const rule = roleGuard(viewer, r.key);
  if (rule) throw guardError(rule);
  if (r.isLocked) throw mockErrors.code(422, "SYSTEM_ROLE");
  validateRole(input.name, input.description, id);
  if (r.updatedAt !== input.updatedAt) throw mockErrors.code(409, "VERSION_CONFLICT");
  const name = input.name?.trim() ?? r.name;
  const description = input.description?.trim() ?? r.description;
  if (name !== r.name || description !== r.description) Object.assign(r, { name, description, updatedAt: now(), updatedBy: actor });
  return { ...r };
}

/** #5 — G1 / G2 first; demo users never count, so Admin (2 users) gives ROLE_IN_USE and หัวหน้าช่าง (0) can go. */
export function mockDeleteRole(id: string, viewer: MockViewer): void {
  const r = findRole(id);
  const rule = roleGuard(viewer, r.key);
  if (rule) throw guardError(rule);
  if (r.isSystem || r.isLocked) throw mockErrors.code(422, "SYSTEM_ROLE");
  if (r.userCount > 0) throw mockErrors.code(409, "ROLE_IN_USE");
  store.roles = store.roles.filter((x) => x.id !== id);
  store.stored.delete(id);
}

/**
 * #7 — G1–G3 on every cell first. Scenario `conflict`: the first save is refused as if ปวีณา saved first; the reload
 * then shows her change.
 */
export function mockSavePermissions(input: SavePermissionsInput, actor: PersonRef, scenario: MockScenario, viewer: MockViewer): PermissionMatrix {
  if (input.changes.length === 0) throw mockErrors.code(400, "VALIDATION_FAILED", { changes: "REQUIRED" });
  for (const c of input.changes) {
    const r = store.roles.find((x) => x.id === c.roleId);
    if (!r || !CATALOG_KEYS.includes(c.permission)) continue;
    const rule = roleGuard(viewer, r.key) ?? (holdsAll(viewer, [c.permission]) ? null : "ESCALATION");
    if (rule) throw guardError(rule);
  }
  for (const c of input.changes) {
    if (!CATALOG_KEYS.includes(c.permission)) throw mockErrors.code(400, "UNKNOWN_PERMISSION");
    if (isFixedKey(c.permission)) throw mockErrors.code(422, "FIXED_PERMISSION");
  }
  if (scenario === "conflict" && store.conflictPending) {
    store.conflictPending = false;
    store.version += 1;
    store.updatedAt = now();
    store.updatedBy = mockPeople.paweena;
  }
  if (input.version !== store.version) throw mockErrors.code(409, "VERSION_CONFLICT");
  for (const c of input.changes) if (findRole(c.roleId).isLocked) throw mockErrors.code(422, "SYSTEM_ROLE");
  for (const c of input.changes) {
    const keys = store.stored.get(c.roleId) ?? [];
    store.stored.set(c.roleId, c.granted ? [...new Set([...keys, c.permission])] : keys.filter((k) => k !== c.permission));
  }
  store.version += 1;
  store.updatedAt = now();
  store.updatedBy = actor;
  return mockMatrix(viewer);
}

// ---- Stage 3: users (#8–#10) and audit (#11, #12) ----

type MockPerson = Omit<UserSummary, "role" | "roleLockedByEnv"> & { roleKey: string; division: string | null; firstLoginAt: string; envLocked?: boolean };

const personId = (n: number) => `5e0c0000-0000-4000-8000-${String(n).padStart(12, "0")}`;

/** Fictional people (repair _common.md §8 + settings §7); ณัฐพล = the mock Superadmin viewer, env-defined. */
const mockPeopleList: MockPerson[] = [
  { id: "9a1c7e20-0000-4000-8000-000000000007", employeeCode: "EMP0105", name: "ณัฐพล อินทรวงศ์", email: "nattapon.i@example.co.th", department: "ฝ่ายเทคโนโลยีสารสนเทศ", position: "เจ้าหน้าที่ระบบ", roleKey: "super_admin", envLocked: true, lastLoginAt: "2026-10-26T03:24:00Z", division: "สายงานบริหารทั่วไป", firstLoginAt: "2026-10-14T02:05:00Z" },
  { id: personId(118), employeeCode: "EMP0118", name: "ปวีณา ศรีสุข", email: "paweena.s@example.co.th", department: "ศูนย์จัดการงานอาคาร", position: "ผู้จัดการอาคาร", roleKey: "admin", lastLoginAt: "2026-10-26T02:51:00Z", division: "สายงานบริหารทั่วไป", firstLoginAt: "2026-10-14T02:30:00Z" },
  { id: personId(122), employeeCode: "EMP0122", name: "ชไมพร รัตนพันธ์", email: "chamaiporn.r@example.co.th", department: "ศูนย์จัดการงานอาคาร", position: "เจ้าหน้าที่อาคาร", roleKey: "admin", lastLoginAt: "2026-10-25T09:12:00Z", division: null, firstLoginAt: "2026-10-15T01:10:00Z" },
  { id: personId(231), employeeCode: "EMP0231", name: "ธนากร พึ่งบุญ", email: "thanakorn.p@example.co.th", department: "ฝ่ายอาคารสถานที่", position: "ช่างเทคนิคอาวุโส", roleKey: "technician", lastLoginAt: "2026-10-26T03:15:00Z", division: "สายงานบริหารทั่วไป", firstLoginAt: "2026-10-14T02:10:00Z" },
  { id: personId(310), employeeCode: "EMP0310", name: "มาลี ทองดี", email: "malee.t@example.co.th", department: "ฝ่ายอาคารสถานที่", position: "หัวหน้าแม่บ้าน", roleKey: "housekeeper_lead", lastLoginAt: "2026-10-26T01:40:00Z", division: null, firstLoginAt: "2026-10-14T03:00:00Z" },
  { id: personId(311), employeeCode: "EMP0311", name: "สมศักดิ์ แก้วกล้า", email: "somsak.k@example.co.th", department: "ฝ่ายอาคารสถานที่", position: "หัวหน้ารักษาความปลอดภัย", roleKey: "security_lead", lastLoginAt: "2026-10-24T23:02:00Z", division: null, firstLoginAt: "2026-10-14T03:20:00Z" },
  { id: personId(412), employeeCode: "EMP0412", name: "วรรณา สุขประเสริฐ", email: "wanna.s@example.co.th", department: "ฝ่ายบัญชี", position: "พนักงานบัญชีอาวุโส", roleKey: "employee", lastLoginAt: "2026-10-26T02:12:00Z", division: "แผนกบัญชีทั่วไป", firstLoginAt: "2026-10-14T04:00:00Z" },
  { id: personId(413), employeeCode: "EMP0413", name: "กิตติพัฒน์ แสงทอง", email: "kittipat.s@example.co.th", department: "ฝ่ายจัดซื้อ", position: "เจ้าหน้าที่จัดซื้อ", roleKey: "employee", lastLoginAt: "2026-10-25T07:31:00Z", division: null, firstLoginAt: "2026-10-15T02:00:00Z" },
  { id: personId(108), employeeCode: "EMP0108", name: "กานดา สุขสวัสดิ์", email: "kanda.s@example.co.th", department: "ฝ่ายทรัพยากรบุคคล", position: "เจ้าหน้าที่บุคคล", roleKey: "employee", lastLoginAt: "2026-10-26T02:12:00Z", division: null, firstLoginAt: "2026-10-16T02:00:00Z" },
  { id: personId(112), employeeCode: "EMP0112", name: "จิราพร วัฒนกุล", email: "jiraporn.w@example.co.th", department: "ฝ่ายบัญชี", position: "เจ้าหน้าที่บัญชี", roleKey: "employee", lastLoginAt: "2026-10-26T01:56:00Z", division: null, firstLoginAt: "2026-10-16T03:00:00Z" },
  { id: personId(109), employeeCode: "EMP0109", name: "นภัสสร ใจมั่น", email: "napatsorn.j@example.co.th", department: "ฝ่ายจัดซื้อ", position: "เจ้าหน้าที่จัดซื้อ", roleKey: "employee", lastLoginAt: null, division: null, firstLoginAt: "2026-10-17T02:00:00Z" },
  { id: personId(232), employeeCode: "EMP0232", name: "วีระ มั่นคง", email: "weera.m@example.co.th", department: "ฝ่ายอาคารสถานที่", position: "ช่างประปา", roleKey: "employee", lastLoginAt: "2026-10-22T06:00:00Z", division: null, firstLoginAt: "2026-10-18T02:00:00Z" },
];

function roleRefOf(key: string): RoleRef {
  const r = store.roles.find((x) => x.key === key) ?? store.roles.find((x) => x.key === "employee")!;
  return { id: r.id, key: r.key, name: r.name };
}

const userStore = {
  people: mockPeopleList.map((p) => ({ ...p })),
  history: new Map<string, RoleHistoryItem[]>([
    [personId(231), [{ createdAt: "2026-10-15T07:02:00Z", from: "พนักงานทั่วไป", to: "ช่างเทคนิค", actor: mockPeople.nattapon }]],
  ]),
  audit: [] as AuditEntry[],
};

const toSummary = (p: MockPerson): UserSummary => ({
  id: p.id, employeeCode: p.employeeCode, name: p.name, email: p.email, department: p.department, position: p.position,
  role: roleRefOf(p.roleKey), roleLockedByEnv: !!p.envLocked, lastLoginAt: p.lastLoginAt,
});

/** #8 — Thai name order; q ≥ 2 chars on name / code / email. */
export function mockUsers(query: UserQuery): Page<UserSummary> {
  const q = (query.q ?? "").trim().toLowerCase();
  const page = query.page ?? 1;
  const size = query.pageSize ?? 20;
  const all = userStore.people
    .filter((p) => q.length < 2 || [p.name, p.employeeCode, p.email ?? ""].some((v) => v.toLowerCase().includes(q)))
    .filter((p) => !query.roleId || roleRefOf(p.roleKey).id === query.roleId)
    .sort((a, b) => a.name.localeCompare(b.name, "th"));
  return { items: all.slice((page - 1) * size, page * size).map(toSummary), meta: { page, pageSize: size, total: all.length } };
}

/** #9 — CR-006 adds READ_ONLY (viewer has users.view only) and SUPER_ADMIN (G2). */
export function mockUser(id: string, viewer: MockViewer): UserDetail {
  const p = userStore.people.find((x) => x.id === id);
  if (!p) throw mockErrors.code(404, "USER_NOT_FOUND");
  const reason: CannotChangeReason | null = p.id === viewer.id ? "SELF"
    : p.envLocked ? "LOCKED_BY_ENV"
    : !viewer.permissions.includes(P.users) ? "READ_ONLY"
    : roleGuard(viewer, p.roleKey) === "SUPER_ADMIN" ? "SUPER_ADMIN"
    : null;
  return { ...toSummary(p), division: p.division, firstLoginAt: p.firstLoginAt, canChangeRole: reason === null, cannotChangeReason: reason, roleHistory: [...(userStore.history.get(id) ?? [])] };
}

/** #10 — same rules as the API: G2 / G3 (CR-006), then self / env lock / role. */
export function mockChangeUserRole(id: string, roleId: string, actor: PersonRef, viewer: MockViewer): UserSummary {
  const p = userStore.people.find((x) => x.id === id);
  if (!p) throw mockErrors.code(404, "USER_NOT_FOUND");
  if (p.id !== viewer.id && !isSuper(viewer)) {
    if (p.roleKey === "super_admin") throw guardError("SUPER_ADMIN");
    const target = store.roles.find((r) => r.id === roleId);
    const rule = target && assignGuard(viewer, target.key, permsOf(target));
    if (rule) throw guardError(rule);
  }
  if (p.id === actor.id) throw mockErrors.code(422, "CANNOT_CHANGE_SELF");
  if (p.envLocked) throw mockErrors.code(422, "ROLE_LOCKED");
  const role = store.roles.find((r) => r.id === roleId);
  if (!role) throw mockErrors.code(422, "ROLE_NOT_FOUND");
  if (role.key === p.roleKey) return toSummary(p);
  const from = roleRefOf(p.roleKey).name;
  p.roleKey = role.key;
  userStore.history.set(id, [{ createdAt: now(), from, to: role.name, actor }, ...(userStore.history.get(id) ?? [])]);
  mockAuditAppend({ action: "role_change", entityType: "user", entityId: id, entityName: p.name, changes: [{ field: "role", before: from, after: role.name }] }, actor);
  return toSummary(p);
}

userStore.audit = [
  { id: "a0000000-0000-4000-8000-000000000006", createdAt: "2026-10-26T03:42:00Z", actor: mockPeople.nattapon, action: "permissions_change", entityType: "role", entityId: mockRoles[4].id, entityName: "ช่างเทคนิค", parentName: null, exists: true, changes: [{ field: "permissions", added: ["จัดการช่างภายนอก"], removed: [] }] },
  { id: "a0000000-0000-4000-8000-000000000005", createdAt: "2026-10-26T03:40:00Z", actor: mockPeople.nattapon, action: "create", entityType: "role", entityId: mockRoles[6].id, entityName: "หัวหน้าช่าง", parentName: null, exists: true, changes: [] },
  { id: "a0000000-0000-4000-8000-000000000004", createdAt: "2026-10-25T08:15:00Z", actor: mockPeople.paweena, action: "update", entityType: "room", entityId: "r-1a", entityName: "ห้องประชุม 1A", parentName: "อาคาร 1 ชั้น 1", exists: true, changes: [{ field: "name", before: "ห้องประชุมใหญ่", after: "ห้องประชุม 1A" }] },
  { id: "a0000000-0000-4000-8000-000000000003", createdAt: "2026-10-24T04:00:00Z", actor: mockPeople.paweena, action: "deactivate", entityType: "contractor_type", entityId: "ct-air", entityName: "แอร์", parentName: null, exists: true, changes: [] },
  { id: "a0000000-0000-4000-8000-000000000002", createdAt: "2026-10-15T07:02:00Z", actor: mockPeople.nattapon, action: "role_change", entityType: "user", entityId: personId(231), entityName: "ธนากร พึ่งบุญ", parentName: null, exists: true, changes: [{ field: "role", before: "พนักงานทั่วไป", after: "ช่างเทคนิค" }] },
  { id: "a0000000-0000-4000-8000-000000000001", createdAt: "2026-10-14T03:00:00Z", actor: mockPeople.nattapon, action: "delete", entityType: "role", entityId: "deleted-role", entityName: "ผู้ตรวจสอบ", parentName: null, exists: false, changes: [] },
];

/** Settings writes in mock mode add audit rows, so S26 shows what was just done. */
export function mockAuditAppend(e: Pick<AuditEntry, "action" | "entityType" | "entityId" | "entityName" | "changes"> & { parentName?: string | null }, actor: PersonRef) {
  userStore.audit.unshift({ id: crypto.randomUUID(), createdAt: now(), actor, parentName: e.parentName ?? null, exists: true, ...e });
}

const TYPE_FILTER: Record<NonNullable<AuditQuery["type"]>, AuditEntry["entityType"][]> = {
  master: ["building", "floor", "room", "category", "symptom", "contractor_type", "asset", "asset_type", "building_type"],
  permissions: ["role"],
  users: ["user"],
};

/** #11 */
export function mockAudit(query: AuditQuery): Page<AuditEntry> {
  const page = query.page ?? 1;
  const size = query.pageSize ?? 50;
  const q = (query.q ?? "").trim().toLowerCase();
  const all = userStore.audit.filter((a) =>
    (!query.type || TYPE_FILTER[query.type].includes(a.entityType)) &&
    (!query.actorId || a.actor?.id === query.actorId) &&
    (!query.from || a.createdAt >= new Date(query.from).toISOString()) &&
    (!query.to || a.createdAt <= new Date(query.to).toISOString()) &&
    (!q || a.entityName.toLowerCase().includes(q) || (a.parentName ?? "").toLowerCase().includes(q)),
  );
  return { items: all.slice((page - 1) * size, page * size), meta: { page, pageSize: size, total: all.length } };
}

/** #12 */
export function mockAuditActors(): PersonRef[] {
  const seen = new Map<string, PersonRef>();
  for (const a of userStore.audit) if (a.actor) seen.set(a.actor.id, a.actor);
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, "th"));
}

// ---- Stage 4: plan locations (#13, #15, #27), assets (#46–#49), asset types (#50–#52) ----
// Data = the CR-001 prototype (settings _common.md §7): อาคาร 1 (3 floors) · อาคาร 2; asset types = repair CR-016 seed.

const SEED_AT = "2026-10-20T03:00:00Z";
const placeId = (s: string) => `9c4d0000-0000-4000-8000-${s.padStart(12, "0")}`;

const room = (id: string, name: string, areaType: PlanRoom["areaType"] = "meeting_room"): PlanRoom => ({
  id: placeId(id), name, areaType, isCommonArea: areaType === "common_area", activeAssetCount: 0, updatedAt: SEED_AT, updatedBy: null,
});

// Building types (CR-005) = the repair CR-025 seed ids.
const BT_OFFICE = "c025b700-0000-4000-8000-000000000001";
const BT_STORE = "c025b700-0000-4000-8000-000000000002";
const BT_OUTDOOR = "c025b700-0000-4000-8000-000000000003";

const placeStore = {
  buildings: [
    {
      id: placeId("b1"), name: "อาคาร 1", buildingType: { id: BT_OFFICE, name: "อาคารสำนักงาน" }, updatedAt: SEED_AT, updatedBy: null,
      floors: [
        { id: placeId("f11"), name: "1", level: 1, rooms: [room("r111", "ห้องประชุม 1A"), room("r112", "ห้องประชุม 1B"), room("r113", "พื้นที่ส่วนกลางชั้น 1", "common_area")] },
        { id: placeId("f12"), name: "2", level: 2, rooms: [room("r121", "ฝ่ายบัญชี", "office"), room("r122", "ฝ่ายจัดซื้อ", "office"), room("r123", "พื้นที่ส่วนกลางชั้น 2", "common_area")] },
        { id: placeId("f13"), name: "3", level: 3, rooms: [room("r131", "ห้องประชุม 3A"), room("r132", "พื้นที่ส่วนกลางชั้น 3", "common_area")] },
      ],
    },
    {
      id: placeId("b2"), name: "อาคาร 2", buildingType: { id: BT_OFFICE, name: "อาคารสำนักงาน" }, updatedAt: SEED_AT, updatedBy: null,
      floors: [{ id: placeId("f21"), name: "1", level: 1, rooms: [room("r211", "ห้องประชุม 1A"), room("r212", "พื้นที่ส่วนกลางชั้น 1", "common_area")] }],
    },
    {
      id: placeId("b3"), name: "โกดังเก็บของ 1 (ตัวอย่าง)", buildingType: { id: BT_STORE, name: "โกดังเก็บของ" }, updatedAt: SEED_AT, updatedBy: null,
      floors: [{ id: placeId("f31"), name: "1", level: 1, rooms: [room("r311", "พื้นที่เก็บสินค้า", "other"), room("r312", "พื้นที่ส่วนกลางชั้น 1", "common_area")] }],
    },
    {
      id: placeId("b4"), name: "พื้นที่ภายนอกอาคาร", buildingType: { id: BT_OUTDOOR, name: "พื้นที่ภายนอกอาคาร" }, updatedAt: SEED_AT, updatedBy: null,
      floors: [{ id: placeId("f41"), name: "G", level: 0, rooms: [room("r411", "ลานจอดรถ", "parking")] }],
    },
  ] as PlanBuilding[],
  types: [
    { id: "c016a700-0000-4000-8000-000000000001", key: "aircon", name: "เครื่องปรับอากาศ", codePrefix: "AC", icon: "air-vent", mount: "wall", sortOrder: 1, activeAssetCount: 0, updatedAt: SEED_AT, updatedBy: null },
    { id: "c016a700-0000-4000-8000-000000000002", key: "microphone", name: "ไมโครโฟน", codePrefix: "MIC", icon: "mic", mount: "floor", sortOrder: 2, activeAssetCount: 0, updatedAt: SEED_AT, updatedBy: null },
    { id: "c016a700-0000-4000-8000-000000000003", key: "speaker", name: "ลำโพง", codePrefix: "SPK", icon: "speaker", mount: "ceiling", sortOrder: 3, activeAssetCount: 0, updatedAt: SEED_AT, updatedBy: null },
    { id: "c016a700-0000-4000-8000-000000000004", key: "tv", name: "จอทีวี", codePrefix: "TV", icon: "tv", mount: "wall", sortOrder: 4, activeAssetCount: 0, updatedAt: SEED_AT, updatedBy: null },
  ] as AssetTypeAdmin[],
  assets: [] as AssetAdmin[],
};

function seedAsset(id: string, code: string, name: string, typeIndex: number, roomKey: string, placed = true): AssetAdmin {
  const t = placeStore.types[typeIndex];
  return {
    id: placeId(id), code, name, isActive: true, type: { id: t.id, key: t.key, name: t.name, icon: t.icon }, roomId: placeId(roomKey), placed,
    openTicketCount: 0, labelStatus: "never", labelPrintedAt: null, updatedAt: SEED_AT, updatedBy: null,
  };
}
placeStore.assets = [
  seedAsset("a1", "AC-1-001", "แอร์ห้องประชุม 1A", 0, "r111"),
  seedAsset("a2", "MIC-1-001", "ไมโครโฟนไร้สาย ตัวที่ 1", 1, "r111"),
  seedAsset("a3", "SPK-1-001", "ลำโพงห้องประชุม 1A", 2, "r111"),
  seedAsset("a4", "TV-1-001", "จอทีวีห้องประชุม 1A", 3, "r111"),
  seedAsset("a5", "AC-1-002", "แอร์ห้องประชุม 1B", 0, "r112"),
  seedAsset("a6", "AC-2-001", "แอร์ฝ่ายบัญชี", 0, "r121", false),
  seedAsset("a7", "AC-2-002", "แอร์ฝ่ายจัดซื้อ ตัวซ้าย", 0, "r122"),
  seedAsset("a8", "AC-2-003", "แอร์ฝ่ายจัดซื้อ ตัวขวา", 0, "r122"),
  seedAsset("a9", "TV-2-001", "จอแสดงผลหน้าลิฟต์ ชั้น 2", 3, "r123"),
  seedAsset("a10", "AC-3-001", "แอร์ห้องประชุม 3A", 0, "r131"),
  seedAsset("a11", "MIC-3-001", "ไมโครโฟนตั้งโต๊ะ ห้องประชุม 3A", 1, "r131"),
  seedAsset("a12", "SPK-3-001", "ลำโพงเพดาน ห้องประชุม 3A ตัวหน้าเวที", 2, "r131"),
  seedAsset("a13", "TV-3-001", "จอทีวีห้องประชุม 3A", 3, "r131"),
  seedAsset("a14", "AC-1-101", "แอร์ห้องประชุม อาคาร 2", 0, "r211"),
];

// QR labels (CR-007): what each printed label says, by asset id. a1 / a4 current, a2 renamed since (changed),
// a5 printed in ห้องประชุม 1A then moved to 1B (moved); the rest never printed.
type LabelSnap = { code: string; name: string; buildingName: string; floorName: string; roomId: string; roomName: string; printedAt: string };
const labelStore = new Map<string, LabelSnap>();

function snapOf(a: AssetAdmin): Omit<LabelSnap, "printedAt"> {
  const p = allRooms().find((x) => x.room.id === a.roomId)!;
  return { code: a.code, name: a.name, buildingName: p.building.name, floorName: p.floor.name, roomId: p.room.id, roomName: p.room.name };
}

function labelOf(a: AssetAdmin): { labelStatus: LabelStatus; labelPrintedAt: string | null } {
  const s = labelStore.get(a.id);
  if (!s) return { labelStatus: "never", labelPrintedAt: null };
  const cur = snapOf(a);
  const status: LabelStatus =
    s.roomId !== cur.roomId ? "moved"
    : s.code !== cur.code || s.name !== cur.name || s.buildingName !== cur.buildingName || s.floorName !== cur.floorName || s.roomName !== cur.roomName ? "changed"
    : "current";
  return { labelStatus: status, labelPrintedAt: s.printedAt };
}

/** An asset as the API returns it: a copy with `labelStatus` computed now. */
function assetOut(a: AssetAdmin): AssetAdmin {
  return { ...structuredClone(a), ...labelOf(a) };
}

function allRooms(): { room: PlanRoom; floor: PlanFloor; building: PlanBuilding }[] {
  return placeStore.buildings.flatMap((b) => b.floors.flatMap((f) => f.rooms.map((r) => ({ room: r, floor: f, building: b }))));
}

function withCounts<T>(value: T): T {
  for (const { room: r } of allRooms()) r.activeAssetCount = placeStore.assets.filter((a) => a.roomId === r.id && a.isActive).length;
  for (const t of placeStore.types) t.activeAssetCount = placeStore.assets.filter((a) => a.type.id === t.id && a.isActive).length;
  return structuredClone(value);
}

for (const [key, patch] of [
  ["a1", {}],
  ["a4", {}],
  ["a2", { name: "ไมโครโฟนไร้สาย" }],
  ["a5", { roomId: placeId("r111"), roomName: "ห้องประชุม 1A" }],
] as const) {
  const a = placeStore.assets.find((x) => x.id === placeId(key))!;
  labelStore.set(a.id, { ...snapOf(a), ...patch, printedAt: "2026-10-28T03:00:00Z" });
}

const placeText = (p: { floor: PlanFloor; building: PlanBuilding; room: PlanRoom }) => `${p.building.name} ชั้น ${p.floor.name} · ${p.room.name}`;

/** #13 */
export function mockPlanBuildings(): PlanBuilding[] {
  return withCounts(placeStore.buildings);
}

function checkName(name: string) {
  const n = name.trim();
  if (!n) throw mockErrors.code(400, "VALIDATION_FAILED", { name: "REQUIRED" });
  if ([...n].length > 100) throw mockErrors.code(400, "VALIDATION_FAILED", { name: "TOO_LONG" });
  return n;
}

/** #15 (rename + CR-005 building type) */
export function mockUpdateBuilding(id: string, input: UpdateBuildingInput, actor: PersonRef): PlanBuilding {
  const b = placeStore.buildings.find((x) => x.id === id);
  if (!b) throw mockErrors.code(404, "BUILDING_NOT_FOUND");
  const name = checkName(input.name);
  if (input.buildingTypeId === "") throw mockErrors.code(400, "VALIDATION_FAILED", { buildingTypeId: "REQUIRED" });
  if (b.updatedAt !== input.updatedAt) throw mockErrors.code(409, "VERSION_CONFLICT");
  let type = b.buildingType;
  if (input.buildingTypeId !== undefined && input.buildingTypeId !== type.id) {
    const t = typeStore.find((x) => x.id === input.buildingTypeId && x.isActive);
    if (!t) throw mockErrors.code(400, "VALIDATION_FAILED", { buildingTypeId: "INVALID" });
    type = { id: t.id, name: t.name };
  }
  if (name !== b.name && placeStore.buildings.some((x) => x.id !== id && x.name.toLowerCase() === name.toLowerCase())) throw mockErrors.code(409, "NAME_TAKEN");
  const changes = [
    ...(name !== b.name ? [{ field: "name", before: b.name, after: name }] : []),
    ...(type.id !== b.buildingType.id ? [{ field: "buildingType", before: b.buildingType.name, after: type.name }] : []),
  ];
  if (changes.length) {
    mockAuditAppend({ action: "update", entityType: "building", entityId: id, entityName: name, changes }, actor);
    Object.assign(b, { name, buildingType: type, updatedAt: now(), updatedBy: actor });
  }
  return withCounts(b);
}

// ---- Stage 4P: building types (#53–#55, CR-005) ----

const typeStore: Omit<BuildingTypeAdmin, "buildingCount" | "categoryIds">[] = [
  { id: BT_OFFICE, name: "อาคารสำนักงาน", isActive: true, sortOrder: 1, updatedAt: SEED_AT, updatedBy: null },
  { id: BT_STORE, name: "โกดังเก็บของ", isActive: true, sortOrder: 2, updatedAt: SEED_AT, updatedBy: null },
  { id: BT_OUTDOOR, name: "พื้นที่ภายนอกอาคาร", isActive: true, sortOrder: 3, updatedAt: SEED_AT, updatedBy: null },
];

function typeAdmin(t: (typeof typeStore)[number]): BuildingTypeAdmin {
  return structuredClone({
    ...t,
    buildingCount: placeStore.buildings.filter((b) => b.buildingType.id === t.id).length,
    categoryIds: masterStore.categories.filter((c) => !c.isOther && c.buildingTypeIds.includes(t.id)).map((c) => c.id),
  });
}

/** #53 — active first, in order. */
export function mockBuildingTypes(): BuildingTypeAdmin[] {
  return [...typeStore].sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.sortOrder - b.sortOrder).map(typeAdmin);
}

/** #54 */
export function mockCreateBuildingType(input: CreateBuildingTypeInput, actor: PersonRef): BuildingTypeAdmin {
  const name = checkName(input.name);
  const ids = input.categoryIds ?? [];
  if (ids.some((id) => !masterStore.categories.some((c) => c.id === id && !c.isOther))) throw mockErrors.code(400, "VALIDATION_FAILED", { categoryIds: "INVALID" });
  if (typeStore.some((x) => x.name.toLowerCase() === name.toLowerCase())) throw mockErrors.code(409, "NAME_TAKEN");
  const t = { id: crypto.randomUUID(), name, isActive: true, sortOrder: Math.max(0, ...typeStore.map((x) => x.sortOrder)) + 1, updatedAt: now(), updatedBy: actor };
  typeStore.push(t);
  for (const c of masterStore.categories) if (ids.includes(c.id)) c.buildingTypeIds = [...c.buildingTypeIds, t.id];
  mockAuditAppend({ action: "create", entityType: "building_type", entityId: t.id, entityName: name, changes: [] }, actor);
  return typeAdmin(t);
}

/** #55 */
export function mockUpdateBuildingType(id: string, input: UpdateBuildingTypeInput, actor: PersonRef): BuildingTypeAdmin {
  const t = typeStore.find((x) => x.id === id);
  if (!t) throw mockErrors.code(404, "BUILDING_TYPE_NOT_FOUND");
  const name = input.name !== undefined ? checkName(input.name) : t.name;
  if (t.updatedAt !== input.updatedAt) throw mockErrors.code(409, "VERSION_CONFLICT");
  const active = input.isActive ?? t.isActive;
  if (t.isActive && !active && placeStore.buildings.some((b) => b.buildingType.id === id)) throw mockErrors.code(409, "IN_USE");
  if (name !== t.name && typeStore.some((x) => x.id !== id && x.name.toLowerCase() === name.toLowerCase())) throw mockErrors.code(409, "NAME_TAKEN");
  const changes = name !== t.name ? [{ field: "name", before: t.name, after: name }] : [];
  const action = changes.length ? "update" : active === t.isActive ? null : active ? "activate" : "deactivate";
  if (action) {
    Object.assign(t, { name, isActive: active, updatedAt: now(), updatedBy: actor });
    for (const b of placeStore.buildings) if (b.buildingType.id === id) b.buildingType = { id, name };
    mockAuditAppend({ action, entityType: "building_type", entityId: id, entityName: name, changes }, actor);
  }
  return typeAdmin(t);
}

const typeLabel = (ids: string[]) => typeStore.filter((t) => ids.includes(t.id)).sort((a, b) => a.sortOrder - b.sortOrder).map((t) => t.name).join(", ");

function checkTypeIds(ids: string[] | undefined, required: boolean): string[] | undefined {
  if (ids === undefined && !required) return undefined;
  if (!ids || ids.length === 0) throw mockErrors.code(400, "VALIDATION_FAILED", { buildingTypeIds: "MIN_ITEMS" });
  if (ids.some((id) => !typeStore.some((t) => t.id === id && t.isActive))) throw mockErrors.code(400, "VALIDATION_FAILED", { buildingTypeIds: "INVALID" });
  return [...new Set(ids)];
}

/** #27 */
export function mockRenameRoom(id: string, input: RenameInput, actor: PersonRef): PlanRoom {
  const found = allRooms().find((x) => x.room.id === id);
  if (!found) throw mockErrors.code(404, "ROOM_NOT_FOUND");
  const name = checkName(input.name);
  if (found.room.updatedAt !== input.updatedAt) throw mockErrors.code(409, "VERSION_CONFLICT");
  if (found.floor.rooms.some((x) => x.id !== id && x.name.toLowerCase() === name.toLowerCase())) throw mockErrors.code(409, "NAME_TAKEN");
  if (name !== found.room.name) {
    mockAuditAppend({ action: "update", entityType: "room", entityId: id, entityName: name, parentName: `${found.building.name} ชั้น ${found.floor.name}`, changes: [{ field: "name", before: found.room.name, after: name }] }, actor);
    Object.assign(found.room, { name, updatedAt: now(), updatedBy: actor });
  }
  return withCounts(found.room);
}

/** #46 */
export function mockRoomAssets(roomId: string, query: RoomAssetsQuery): AssetAdmin[] {
  if (!allRooms().some((x) => x.room.id === roomId)) throw mockErrors.code(404, "ROOM_NOT_FOUND");
  const q = (query.q ?? "").trim().toLowerCase();
  return structuredClone(
    placeStore.assets
      .filter((a) => a.roomId === roomId && (query.includeInactive || a.isActive))
      .filter((a) => !query.assetTypeId || a.type.id === query.assetTypeId)
      .filter((a) => !q || a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q))
      .sort((a, b) => a.code.localeCompare(b.code)),
  ).map(assetOut);
}

const CODE_RE = /^[A-Za-z0-9_-]{1,50}$/;

function checkAssetFields(code: string | undefined, name: string | undefined) {
  const fields: Record<string, string> = {};
  if (code !== undefined) {
    if (!code.trim()) fields.code = "REQUIRED";
    else if (!CODE_RE.test(code.trim())) fields.code = "INVALID";
  }
  if (name !== undefined) {
    if (!name.trim()) fields.name = "REQUIRED";
    else if ([...name.trim()].length > 100) fields.name = "TOO_LONG";
  }
  return fields;
}

function codeTaken(code: string, self?: string) {
  return placeStore.assets.some((a) => a.id !== self && a.code.toLowerCase() === code.trim().toLowerCase());
}

/** #47 */
export function mockCreateAsset(input: CreateAssetInput, actor: PersonRef): AssetAdmin {
  const fields = checkAssetFields(input.code, input.name);
  const place = allRooms().find((x) => x.room.id === input.roomId);
  const type = placeStore.types.find((t) => t.id === input.assetTypeId);
  if (!place) fields.roomId = "INVALID";
  if (!type) fields.assetTypeId = "INVALID";
  if (Object.keys(fields).length) throw mockErrors.code(400, "VALIDATION_FAILED", fields);
  if (codeTaken(input.code)) throw mockErrors.code(409, "ASSET_CODE_TAKEN");
  const a: AssetAdmin = {
    id: crypto.randomUUID(), code: input.code.trim(), name: input.name.trim(), isActive: true,
    type: { id: type!.id, key: type!.key, name: type!.name, icon: type!.icon }, roomId: input.roomId, placed: false, openTicketCount: 0,
    labelStatus: "never", labelPrintedAt: null, updatedAt: now(), updatedBy: actor,
  };
  placeStore.assets.push(a);
  mockAuditAppend({ action: "create", entityType: "asset", entityId: a.id, entityName: a.name, parentName: placeText(place!), changes: [] }, actor);
  return assetOut(a);
}

/** #48 */
export function mockUpdateAsset(id: string, input: UpdateAssetInput, actor: PersonRef): AssetAdmin {
  const a = placeStore.assets.find((x) => x.id === id);
  if (!a) throw mockErrors.code(404, "ASSET_NOT_FOUND");
  const fields = checkAssetFields(input.code, input.name);
  const target = input.roomId ? allRooms().find((x) => x.room.id === input.roomId) : undefined;
  if (input.roomId && !target) fields.roomId = "INVALID";
  if (Object.keys(fields).length) throw mockErrors.code(400, "VALIDATION_FAILED", fields);
  if (a.updatedAt !== input.updatedAt) throw mockErrors.code(409, "VERSION_CONFLICT");
  const editing = input.code !== undefined || input.name !== undefined || input.roomId !== undefined;
  if (editing && !a.isActive) throw mockErrors.code(404, "ASSET_NOT_FOUND");
  if (input.code !== undefined && input.code.trim() !== a.code && labelStore.has(id)) throw mockErrors.code(422, "ASSET_CODE_LOCKED");
  if (input.code !== undefined && codeTaken(input.code, id)) throw mockErrors.code(409, "ASSET_CODE_TAKEN");
  const before = { ...a };
  if (input.code !== undefined) a.code = input.code.trim();
  if (input.name !== undefined) a.name = input.name.trim();
  if (input.roomId && input.roomId !== a.roomId) Object.assign(a, { roomId: input.roomId, placed: false });
  if (input.isActive !== undefined) a.isActive = input.isActive;
  Object.assign(a, { updatedAt: now(), updatedBy: actor });
  const place = allRooms().find((x) => x.room.id === a.roomId)!;
  const changes = [
    ...(before.code !== a.code ? [{ field: "code", before: before.code, after: a.code }] : []),
    ...(before.name !== a.name ? [{ field: "name", before: before.name, after: a.name }] : []),
    ...(before.roomId !== a.roomId ? [{ field: "room", before: placeText(allRooms().find((x) => x.room.id === before.roomId)!), after: placeText(place) }] : []),
  ];
  const action = changes.length ? "update" : a.isActive ? "activate" : "deactivate";
  mockAuditAppend({ action, entityType: "asset", entityId: id, entityName: a.name, parentName: placeText(place), changes }, actor);
  return assetOut(a);
}

/** #56 — active assets of one building, floor level → room name → code. */
export function mockLabelAssets(query: LabelAssetsQuery): LabelAsset[] {
  if (!query.buildingId) throw mockErrors.code(400, "VALIDATION_FAILED", { buildingId: "REQUIRED" });
  if (!placeStore.buildings.some((b) => b.id === query.buildingId)) throw mockErrors.code(404, "BUILDING_NOT_FOUND");
  const rows: LabelAsset[] = [];
  for (const a of placeStore.assets) {
    const p = a.isActive ? allRooms().find((x) => x.room.id === a.roomId) : undefined;
    if (!p || p.building.id !== query.buildingId) continue;
    if ((query.floorId && p.floor.id !== query.floorId) || (query.roomId && p.room.id !== query.roomId)) continue;
    rows.push({
      id: a.id, code: a.code, name: a.name,
      building: { id: p.building.id, name: p.building.name }, floor: { id: p.floor.id, name: p.floor.name, level: p.floor.level },
      room: { id: p.room.id, name: p.room.name }, ...labelOf(a),
    });
  }
  rows.sort((x, y) => x.floor.level - y.floor.level || x.room.name.localeCompare(y.room.name, "th") || x.code.toLowerCase().localeCompare(y.code.toLowerCase()));
  return structuredClone(rows);
}

/** #57 — every id active, or nothing is saved (422 ASSET_NOT_ACTIVE). The API also writes one audit row (not listed in S26). */
export function mockMarkLabelsPrinted(assetIds: string[]): AssetAdmin[] {
  const ids = [...new Set(assetIds)];
  if (ids.length === 0) throw mockErrors.code(400, "VALIDATION_FAILED", { assetIds: "REQUIRED" });
  if (ids.length > 500) throw mockErrors.code(400, "VALIDATION_FAILED", { assetIds: "TOO_MANY" });
  const list = ids.map((id) => placeStore.assets.find((a) => a.id === id && a.isActive));
  if (list.some((a) => !a)) throw mockErrors.code(422, "ASSET_NOT_ACTIVE");
  const at = now();
  for (const a of list) labelStore.set(a!.id, { ...snapOf(a!), printedAt: at });
  return list.map((a) => assetOut(a!));
}

/** #49 */
export function mockSuggestCode(assetTypeId: string, roomId: string): { code: string } {
  const type = placeStore.types.find((t) => t.id === assetTypeId);
  const place = allRooms().find((x) => x.room.id === roomId);
  if (!type || !place) throw mockErrors.code(400, "VALIDATION_FAILED", { ...(type ? {} : { assetTypeId: "INVALID" }), ...(place ? {} : { roomId: "INVALID" }) });
  const base = `${type.codePrefix}-${place.floor.name}-`;
  for (let n = 1; ; n++) {
    const code = `${base}${String(n).padStart(3, "0")}`;
    if (!codeTaken(code)) return { code };
  }
}

/** #50 */
export function mockAssetTypes(): AssetTypeAdmin[] {
  return withCounts(placeStore.types);
}

const PREFIX_RE = /^[A-Z0-9]{2,5}$/;

function checkType(name: string | undefined, prefix: string | undefined, selfId?: string) {
  const fields: Record<string, string> = {};
  if (name !== undefined) {
    if (!name.trim()) fields.name = "REQUIRED";
    else if ([...name.trim()].length > 100) fields.name = "TOO_LONG";
  }
  if (prefix !== undefined) {
    if (!prefix.trim()) fields.codePrefix = "REQUIRED";
    else if (!PREFIX_RE.test(prefix.trim().toUpperCase())) fields.codePrefix = "INVALID";
  }
  if (Object.keys(fields).length) throw mockErrors.code(400, "VALIDATION_FAILED", fields);
  if (name !== undefined && placeStore.types.some((t) => t.id !== selfId && t.name.toLowerCase() === name.trim().toLowerCase())) throw mockErrors.code(409, "NAME_TAKEN");
  if (prefix !== undefined && placeStore.types.some((t) => t.id !== selfId && t.codePrefix === prefix.trim().toUpperCase())) throw mockErrors.code(409, "CODE_PREFIX_TAKEN");
}

/** #51 */
export function mockCreateAssetType(input: CreateAssetTypeInput, actor: PersonRef): AssetTypeAdmin {
  checkType(input.name, input.codePrefix);
  const t: AssetTypeAdmin = {
    id: crypto.randomUUID(), key: `t_${randomHex()}`, name: input.name.trim(), codePrefix: input.codePrefix.trim().toUpperCase(),
    icon: input.icon ?? "box", mount: input.mount ?? "floor", sortOrder: placeStore.types.length + 1, activeAssetCount: 0, updatedAt: now(), updatedBy: actor,
  };
  placeStore.types.push(t);
  mockAuditAppend({ action: "create", entityType: "asset_type", entityId: t.id, entityName: t.name, changes: [] }, actor);
  return withCounts(t);
}

/** #52 */
export function mockUpdateAssetType(id: string, input: UpdateAssetTypeInput, actor: PersonRef): AssetTypeAdmin {
  const t = placeStore.types.find((x) => x.id === id);
  if (!t) throw mockErrors.code(404, "ASSET_TYPE_NOT_FOUND");
  checkType(input.name, input.codePrefix, id);
  if (t.updatedAt !== input.updatedAt) throw mockErrors.code(409, "VERSION_CONFLICT");
  const before = { ...t };
  if (input.name !== undefined) t.name = input.name.trim();
  if (input.codePrefix !== undefined) t.codePrefix = input.codePrefix.trim().toUpperCase();
  if (input.icon !== undefined) t.icon = input.icon;
  if (input.mount !== undefined) t.mount = input.mount;
  Object.assign(t, { updatedAt: now(), updatedBy: actor });
  for (const a of placeStore.assets) if (a.type.id === id) a.type = { id, key: t.key, name: t.name, icon: t.icon };
  const changes = (["name", "codePrefix", "icon", "mount"] as const).filter((f) => before[f] !== t[f]).map((f) => ({ field: f, before: before[f], after: t[f] }));
  if (changes.length) mockAuditAppend({ action: "update", entityType: "asset_type", entityId: id, entityName: t.name, changes }, actor);
  return withCounts(t);
}

// ---- Stage 5: categories / symptoms (#32–#41) and contractor types (#42–#45) ----
// Categories = repair _common.md §8 (5) + the CR-014 "อื่น ๆ"; contractor types = settings _common.md §7.

const masterId = (s: string) => `7a5e0000-0000-4000-8000-${s.padStart(12, "0")}`;
const meta = (id: string, name: string, extra: Partial<{ isActive: boolean; inUse: boolean }> = {}) => ({
  id: masterId(id), name, isActive: true, inUse: false, updatedAt: SEED_AT, updatedBy: null as PersonRef | null, ...extra,
});

const masterStore = {
  categories: [
    { ...meta("c1", "ระบบปรับอากาศ", { inUse: true }), icon: "snowflake", sortOrder: 1, defaultPriority: "medium", isOther: false, buildingTypeIds: [BT_OFFICE], symptomCount: 0, activeSymptomCount: 0 },
    { ...meta("c2", "ไฟฟ้าและแสงสว่าง", { inUse: true }), icon: "zap", sortOrder: 2, defaultPriority: "high", isOther: false, buildingTypeIds: [BT_OFFICE, BT_STORE, BT_OUTDOOR], symptomCount: 0, activeSymptomCount: 0 },
    { ...meta("c3", "ประปาและสุขภัณฑ์"), icon: "droplets", sortOrder: 3, defaultPriority: "medium", isOther: false, buildingTypeIds: [BT_OFFICE, BT_STORE, BT_OUTDOOR], symptomCount: 0, activeSymptomCount: 0 },
    { ...meta("c4", "อาคารและเฟอร์นิเจอร์"), icon: "armchair", sortOrder: 4, defaultPriority: "low", isOther: false, buildingTypeIds: [BT_OFFICE, BT_STORE], symptomCount: 0, activeSymptomCount: 0 },
    { ...meta("c5", "ห้องประชุมและโสตทัศนูปกรณ์"), icon: "presentation", sortOrder: 5, defaultPriority: "medium", isOther: false, buildingTypeIds: [BT_OFFICE], symptomCount: 0, activeSymptomCount: 0 },
    { ...meta("c6", "อื่น ๆ"), icon: "ellipsis", sortOrder: 6, defaultPriority: "medium", isOther: true, buildingTypeIds: [], symptomCount: 0, activeSymptomCount: 0 },
  ] as CategoryAdmin[],
  symptoms: [] as SymptomAdmin[],
  types: [
    { ...meta("t1", "ไฟฟ้า", { inUse: true }), contractorCount: 3, createdAt: SEED_AT, createdBy: null, createdByTechnician: false },
    { ...meta("t2", "ประปา", { inUse: true }), contractorCount: 2, createdAt: SEED_AT, createdBy: null, createdByTechnician: false },
    { ...meta("t3", "เครื่องปรับอากาศ", { inUse: true }), contractorCount: 2, createdAt: SEED_AT, createdBy: null, createdByTechnician: false },
    { ...meta("t4", "ลิฟต์", { inUse: true }), contractorCount: 1, createdAt: SEED_AT, createdBy: null, createdByTechnician: false },
    { ...meta("t5", "งานโครงสร้าง"), contractorCount: 0, createdAt: "2026-10-22T04:00:00Z", createdBy: { id: personId(231), name: "ธนากร พึ่งบุญ", department: "ฝ่ายอาคารสถานที่" }, createdByTechnician: true },
    { ...meta("t6", "แอร์", { isActive: false }), contractorCount: 0, createdAt: "2026-10-23T04:00:00Z", createdBy: { id: personId(231), name: "ธนากร พึ่งบุญ", department: "ฝ่ายอาคารสถานที่" }, createdByTechnician: true },
  ] as ContractorTypeAdmin[],
};

const seedSymptoms: [string, string, Priority, boolean?][] = [
  ["c1", "แอร์ไม่เย็น", "medium", true], ["c1", "มีน้ำหยด", "high"], ["c1", "เปิดเครื่องไม่ติด", "medium"], ["c1", "มีกลิ่นไหม้หรือควัน", "critical"], ["c1", "มีเสียงดังผิดปกติ", "low"],
  ["c2", "ไฟไม่ติด", "medium", true], ["c2", "ไฟกะพริบ", "low"], ["c2", "เบรกเกอร์ตัด", "critical"],
  ["c3", "น้ำรั่ว", "high"], ["c3", "ท่อตัน", "medium"], ["c3", "ชักโครกกดไม่ลง", "medium"],
  ["c4", "ประตูปิดไม่สนิท", "low"], ["c4", "เก้าอี้ชำรุด", "low"],
  ["c5", "โปรเจกเตอร์ไม่ติด", "high"], ["c5", "ไมค์ไม่มีเสียง", "medium"],
];
masterStore.symptoms = seedSymptoms.map(([c, name, priority, inUse], i) => ({
  ...meta(`s${i + 1}`, name, { inUse: !!inUse }), categoryId: masterId(c), sortOrder: i + 1, priority,
}));

function masterCounts<T>(value: T): T {
  for (const c of masterStore.categories) {
    const own = masterStore.symptoms.filter((s) => s.categoryId === c.id);
    c.symptomCount = own.length;
    c.activeSymptomCount = own.filter((s) => s.isActive).length;
  }
  return structuredClone(value);
}

const PRIORITIES: Priority[] = ["critical", "high", "medium", "low"];
const CAT_ICONS = ["wrench", "snowflake", "lightbulb", "zap", "plug", "droplets", "shower-head", "armchair", "door-open", "sparkles", "trash-2", "hammer", "presentation", "building-2", "square-parking", "ellipsis"];

function masterName(name: string | undefined, max: number, required: boolean) {
  if (name === undefined) {
    if (required) throw mockErrors.code(400, "VALIDATION_FAILED", { name: "REQUIRED" });
    return undefined;
  }
  const n = name.trim().replace(/\s+/g, " ");
  if (!n) throw mockErrors.code(400, "VALIDATION_FAILED", { name: "REQUIRED" });
  if ([...n].length > max) throw mockErrors.code(400, "VALIDATION_FAILED", { name: "TOO_LONG" });
  return n;
}

const versionOf = (items: { updatedAt: string }[]) => items.reduce((m, x) => (x.updatedAt > m ? x.updatedAt : m), "");

/** #32 */
export function mockCategories(): CategoryAdmin[] {
  return masterCounts([...masterStore.categories].sort((a, b) => a.sortOrder - b.sortOrder));
}

/** #33 */
export function mockCreateCategory(input: CreateCategoryInput, actor: PersonRef): CategoryAdmin {
  const name = masterName(input.name, 100, true)!;
  if (!CAT_ICONS.includes(input.icon)) throw mockErrors.code(400, "VALIDATION_FAILED", { icon: "INVALID" });
  if (!PRIORITIES.includes(input.defaultPriority)) throw mockErrors.code(400, "VALIDATION_FAILED", { defaultPriority: "INVALID" });
  const types = checkTypeIds(input.buildingTypeIds, true)!;
  if (masterStore.categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) throw mockErrors.code(409, "NAME_TAKEN");
  const c: CategoryAdmin = {
    id: crypto.randomUUID(), name, isActive: true, inUse: false, updatedAt: now(), updatedBy: actor, icon: input.icon, defaultPriority: input.defaultPriority,
    sortOrder: Math.max(0, ...masterStore.categories.map((x) => x.sortOrder)) + 1, isOther: false, buildingTypeIds: types, symptomCount: 0, activeSymptomCount: 0,
  };
  masterStore.categories.push(c);
  mockAuditAppend({ action: "create", entityType: "category", entityId: c.id, entityName: name, changes: [{ field: "buildingTypes", after: typeLabel(types) }] }, actor);
  return masterCounts(c);
}

/** #34 */
export function mockUpdateCategory(id: string, input: UpdateCategoryInput, actor: PersonRef): CategoryAdmin {
  const c = masterStore.categories.find((x) => x.id === id);
  if (!c) throw mockErrors.code(404, "CATEGORY_NOT_FOUND");
  const name = masterName(input.name, 100, false);
  if (input.icon !== undefined && !CAT_ICONS.includes(input.icon)) throw mockErrors.code(400, "VALIDATION_FAILED", { icon: "INVALID" });
  if (c.updatedAt !== input.updatedAt) throw mockErrors.code(409, "VERSION_CONFLICT");
  if (c.isOther && input.isActive === false) throw mockErrors.code(400, "VALIDATION_FAILED", { isActive: "INVALID" });
  if (c.isOther && input.buildingTypeIds !== undefined) throw mockErrors.code(400, "VALIDATION_FAILED", { buildingTypeIds: "NOT_ALLOWED" });
  const types = checkTypeIds(input.buildingTypeIds, false);
  if (name && masterStore.categories.some((x) => x.id !== id && x.name.toLowerCase() === name.toLowerCase())) throw mockErrors.code(409, "NAME_TAKEN");
  const before = { ...c };
  Object.assign(c, {
    ...(name !== undefined ? { name } : {}), ...(input.icon !== undefined ? { icon: input.icon } : {}),
    ...(input.defaultPriority !== undefined ? { defaultPriority: input.defaultPriority } : {}), ...(types !== undefined ? { buildingTypeIds: types } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}), updatedAt: now(), updatedBy: actor,
  });
  const changes: AuditChange[] = (["name", "icon", "defaultPriority"] as const).filter((f) => before[f] !== c[f]).map((f) => ({ field: f, before: String(before[f]), after: String(c[f]) }));
  if (typeLabel(before.buildingTypeIds) !== typeLabel(c.buildingTypeIds)) changes.push({ field: "buildingTypes", before: typeLabel(before.buildingTypeIds), after: typeLabel(c.buildingTypeIds) });
  mockAuditAppend({ action: changes.length ? "update" : c.isActive ? "activate" : "deactivate", entityType: "category", entityId: id, entityName: c.name, changes }, actor);
  return masterCounts(c);
}

/** #35 */
export function mockDeleteCategory(id: string, actor: PersonRef): void {
  const c = masterStore.categories.find((x) => x.id === id);
  if (!c) throw mockErrors.code(404, "CATEGORY_NOT_FOUND");
  if (c.inUse || c.isOther || masterStore.symptoms.some((s) => s.categoryId === id && s.inUse)) throw mockErrors.code(409, "IN_USE");
  masterStore.categories = masterStore.categories.filter((x) => x.id !== id);
  masterStore.symptoms = masterStore.symptoms.filter((s) => s.categoryId !== id);
  mockAuditAppend({ action: "delete", entityType: "category", entityId: id, entityName: c.name, changes: [] }, actor);
}

function applyOrder<T extends { id: string; sortOrder: number; updatedAt: string; updatedBy: PersonRef | null }>(list: T[], input: OrderInput, actor: PersonRef) {
  const ids = new Set(list.map((x) => x.id));
  if (input.ids.length !== list.length || input.ids.some((id) => !ids.has(id)) || versionOf(list) !== input.version) throw mockErrors.code(409, "VERSION_CONFLICT");
  const at = now();
  input.ids.forEach((id, i) => Object.assign(list.find((x) => x.id === id)!, { sortOrder: i + 1, updatedAt: at, updatedBy: actor }));
}

/** #36 */
export function mockReorderCategories(input: OrderInput, actor: PersonRef): CategoryAdmin[] {
  applyOrder(masterStore.categories, input, actor);
  mockAuditAppend({ action: "reorder", entityType: "category", entityId: input.ids[0], entityName: "หมวดงาน", changes: [] }, actor);
  return mockCategories();
}

/** #37 */
export function mockSymptoms(categoryId: string): SymptomAdmin[] {
  if (!masterStore.categories.some((c) => c.id === categoryId)) throw mockErrors.code(404, "CATEGORY_NOT_FOUND");
  return structuredClone(masterStore.symptoms.filter((s) => s.categoryId === categoryId).sort((a, b) => a.sortOrder - b.sortOrder));
}

/** #38 */
export function mockCreateSymptom(categoryId: string, input: CreateSymptomInput, actor: PersonRef): SymptomAdmin {
  const c = masterStore.categories.find((x) => x.id === categoryId);
  if (!c) throw mockErrors.code(404, "CATEGORY_NOT_FOUND");
  const name = masterName(input.name, 100, true)!;
  if (!PRIORITIES.includes(input.priority)) throw mockErrors.code(400, "VALIDATION_FAILED", { priority: "INVALID" });
  if (masterStore.symptoms.some((s) => s.categoryId === categoryId && s.name.toLowerCase() === name.toLowerCase())) throw mockErrors.code(409, "NAME_TAKEN");
  const s: SymptomAdmin = {
    id: crypto.randomUUID(), name, isActive: true, inUse: false, updatedAt: now(), updatedBy: actor, categoryId, priority: input.priority,
    sortOrder: Math.max(0, ...masterStore.symptoms.filter((x) => x.categoryId === categoryId).map((x) => x.sortOrder)) + 1,
  };
  masterStore.symptoms.push(s);
  mockAuditAppend({ action: "create", entityType: "symptom", entityId: s.id, entityName: name, parentName: c.name, changes: [] }, actor);
  return structuredClone(s);
}

/** #39 */
export function mockUpdateSymptom(id: string, input: UpdateSymptomInput, actor: PersonRef): SymptomAdmin {
  const s = masterStore.symptoms.find((x) => x.id === id);
  if (!s) throw mockErrors.code(404, "SYMPTOM_NOT_FOUND");
  const name = masterName(input.name, 100, false);
  if (s.updatedAt !== input.updatedAt) throw mockErrors.code(409, "VERSION_CONFLICT");
  if (name && masterStore.symptoms.some((x) => x.id !== id && x.categoryId === s.categoryId && x.name.toLowerCase() === name.toLowerCase())) throw mockErrors.code(409, "NAME_TAKEN");
  const before = { ...s };
  Object.assign(s, {
    ...(name !== undefined ? { name } : {}), ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}), updatedAt: now(), updatedBy: actor,
  });
  const changes = (["name", "priority"] as const).filter((f) => before[f] !== s[f]).map((f) => ({ field: f, before: before[f], after: s[f] }));
  const cat = masterStore.categories.find((c) => c.id === s.categoryId)!;
  mockAuditAppend({ action: changes.length ? "update" : s.isActive ? "activate" : "deactivate", entityType: "symptom", entityId: id, entityName: s.name, parentName: cat.name, changes }, actor);
  return structuredClone(s);
}

/** #40 */
export function mockDeleteSymptom(id: string, actor: PersonRef): void {
  const s = masterStore.symptoms.find((x) => x.id === id);
  if (!s) throw mockErrors.code(404, "SYMPTOM_NOT_FOUND");
  if (s.inUse) throw mockErrors.code(409, "IN_USE");
  masterStore.symptoms = masterStore.symptoms.filter((x) => x.id !== id);
  const cat = masterStore.categories.find((c) => c.id === s.categoryId);
  mockAuditAppend({ action: "delete", entityType: "symptom", entityId: id, entityName: s.name, parentName: cat?.name ?? null, changes: [] }, actor);
}

/** #41 */
export function mockReorderSymptoms(categoryId: string, input: OrderInput, actor: PersonRef): SymptomAdmin[] {
  applyOrder(masterStore.symptoms.filter((s) => s.categoryId === categoryId), input, actor);
  return mockSymptoms(categoryId);
}

/** #42 */
export function mockContractorTypes(): ContractorTypeAdmin[] {
  return structuredClone([...masterStore.types].sort((a, b) => a.name.localeCompare(b.name, "th")));
}

/** #43 */
export function mockCreateContractorType(name: string, actor: PersonRef): ContractorTypeAdmin {
  const n = masterName(name, 50, true)!;
  if (masterStore.types.some((t) => t.name.toLowerCase() === n.toLowerCase())) throw mockErrors.code(409, "NAME_TAKEN");
  const t: ContractorTypeAdmin = { id: crypto.randomUUID(), name: n, isActive: true, inUse: false, updatedAt: now(), updatedBy: actor, contractorCount: 0, createdAt: now(), createdBy: actor, createdByTechnician: false };
  masterStore.types.push(t);
  mockAuditAppend({ action: "create", entityType: "contractor_type", entityId: t.id, entityName: n, changes: [] }, actor);
  return structuredClone(t);
}

/** #44 */
export function mockUpdateContractorType(id: string, input: UpdateContractorTypeInput, actor: PersonRef): ContractorTypeAdmin {
  const t = masterStore.types.find((x) => x.id === id);
  if (!t) throw mockErrors.code(404, "CONTRACTOR_TYPE_NOT_FOUND");
  const name = masterName(input.name, 50, false);
  if (t.updatedAt !== input.updatedAt) throw mockErrors.code(409, "VERSION_CONFLICT");
  if (name && masterStore.types.some((x) => x.id !== id && x.name.toLowerCase() === name.toLowerCase())) throw mockErrors.code(409, "NAME_TAKEN");
  const before = t.name;
  Object.assign(t, { ...(name !== undefined ? { name } : {}), ...(input.isActive !== undefined ? { isActive: input.isActive } : {}), updatedAt: now(), updatedBy: actor });
  const changes = before !== t.name ? [{ field: "name", before, after: t.name }] : [];
  mockAuditAppend({ action: changes.length ? "update" : t.isActive ? "activate" : "deactivate", entityType: "contractor_type", entityId: id, entityName: t.name, changes }, actor);
  return structuredClone(t);
}

/** #45 */
export function mockDeleteContractorType(id: string, actor: PersonRef): void {
  const t = masterStore.types.find((x) => x.id === id);
  if (!t) throw mockErrors.code(404, "CONTRACTOR_TYPE_NOT_FOUND");
  if (t.inUse) throw mockErrors.code(409, "IN_USE");
  masterStore.types = masterStore.types.filter((x) => x.id !== id);
  mockAuditAppend({ action: "delete", entityType: "contractor_type", entityId: id, entityName: t.name, changes: [] }, actor);
}
