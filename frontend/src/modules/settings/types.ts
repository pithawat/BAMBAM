// Mirrors docs/modules/settings/04-api-contract.md. Stage 1: `Role` (#2). Stage 2: roles CRUD + matrix (#3–#7).
// Later stages add their objects here. Stage R1 (CR-006): guard rules G1–G3 → `RoleGuard`, `RoleListItem`,
// `PermissionMatrix.grantable`, `MatrixRole.guard`, `PermissionDef.requires`, #9 reasons, `PERMISSION_GUARD`.

/** `PersonRef` (same as repair). */
export type PersonRef = { id: string; name: string; department: string | null };

/** `Role` — #2 GET /api/v1/settings/roles item. Order: super_admin, the seeded roles, then custom roles by creation. */
export type Role = {
  id: string;
  /** Stable key (`employee` … `super_admin`, custom `r_` + 8 hex). The UI never shows it. */
  key: string;
  name: string;
  description: string;
  /** `employee`, `super_admin`: cannot be deleted. */
  isSystem: boolean;
  /** `super_admin` only: cannot be edited, has every permission. */
  isLocked: boolean;
  /** Users with this role (demo users excluded). */
  userCount: number;
  updatedAt: string;
  updatedBy: PersonRef | null;
};

/**
 * CR-006 guard rule that locks a role for this viewer (never for Superadmin):
 * `OWN_ROLE` — the viewer's own role ("แก้สิทธิ์ของ role ตัวเองไม่ได้"); `SUPER_ADMIN` — the Superadmin role.
 */
export type RoleGuard = "OWN_ROLE" | "SUPER_ADMIN";

/** #2 item (CR-006): `Role` + what this viewer may do with it. */
export type RoleListItem = Role & {
  /** Set → no แก้ไข Role / ลบ Role for this viewer (row menu hidden or disabled with the reason). */
  guard: RoleGuard | null;
  /** The viewer may give this role to someone in S25 (G2 / G3: never `super_admin`, only roles within their own permissions). */
  assignable: boolean;
};

/**
 * `403 PERMISSION_GUARD` `details.rule` (CR-006) on #3 (copy-from), #4, #5, #7, #10: `OWN_ROLE` · `SUPER_ADMIN` ·
 * `ESCALATION` (a key the viewer lacks, or a role beyond their permissions).
 */
export type GuardRule = RoleGuard | "ESCALATION";

// ---- Stage 2: roles and the permission matrix (F29, #3–#7) ----

/** #3 POST /api/v1/settings/roles. `copyFromRoleId` null / omitted = base permissions only. */
export type CreateRoleInput = {
  /** Required, ≤ 50 characters, unique (case-insensitive). */
  name: string;
  /** ≤ 200 characters. */
  description?: string;
  /** Copies the source's permissions. CR-006: a non-Superadmin may only copy a role whose keys are all their own (else ESCALATION). */
  copyFromRoleId?: string | null;
};

/** #4 PATCH /api/v1/settings/roles/{id}: only the fields that change, plus the `updatedAt` they were based on. */
export type UpdateRoleInput = {
  name?: string;
  description?: string;
  updatedAt: string;
};

/** One permission column. Labels and descriptions come from the module that registers the key. */
export type PermissionDef = {
  key: string;
  label: string;
  description: string;
  /**
   * CR-006: the key that must be ticked first (`repair.building3d.view` → `repair.overview.view`). While the role
   * lacks it (incl. pending changes) the cell is disabled; unticking the required key also unticks this one.
   */
  requires: string | null;
};

/** One matrix card. `isFixed`: every cell disabled ("กำหนดโดยระบบ") — no group is fixed since CR-006, keep the branch. */
export type PermissionGroup = { key: string; name: string; isFixed: boolean; permissions: PermissionDef[] };

/** A system heading: "ระบบแจ้งซ่อม", "การเข้าใช้บริการ" (CR-006), "ตั้งค่าระบบ". */
export type PermissionSystem = { key: string; name: string; groups: PermissionGroup[] };

/** One matrix row, in `Role` order. `permissions` = effective keys. */
export type MatrixRole = {
  id: string;
  key: string;
  name: string;
  userCount: number;
  /** `super_admin`: row ticked and disabled. */
  isLocked: boolean;
  /** CR-006: set → the whole row is disabled for this viewer, with the reason (own role / Superadmin). */
  guard: RoleGuard | null;
  permissions: string[];
};

/** #6 GET /api/v1/settings/permissions. `version` goes back in #7. */
export type PermissionMatrix = {
  version: number;
  updatedAt: string;
  /** Who saved the matrix last (`null` = never changed since seeding). Used in the VERSION_CONFLICT copy. */
  updatedBy: PersonRef | null;
  systems: PermissionSystem[];
  roles: MatrixRole[];
  /**
   * CR-006 G3: the keys this viewer may tick or untick (Superadmin: every key). Any other column is disabled in every
   * row with the reason "ให้ได้เฉพาะสิทธิ์ที่คุณมี".
   */
  grantable: string[];
};

/** One changed cell. */
export type PermissionChange = { roleId: string; permission: string; granted: boolean };

/** #7 PUT /api/v1/settings/permissions → the new matrix (`version` + 1). */
export type SavePermissionsInput = { version: number; changes: PermissionChange[] };

// ---- Stage 3: users and audit (F15, F30, #8–#12) ----

/** `RoleRef`. */
export type RoleRef = { id: string; key: string; name: string };

/** `UserSummary` — #8 item, #10 response. Demo users never appear. */
export type UserSummary = {
  id: string;
  employeeCode: string;
  name: string;
  email: string | null;
  department: string | null;
  position: string | null;
  role: RoleRef;
  /** Listed in SUPER_ADMIN_EMPLOYEE_CODES: role shown "กำหนดโดยระบบ", cannot change. */
  roleLockedByEnv: boolean;
  lastLoginAt: string | null;
};

/** #8 query. `q` is sent only with ≥ 2 characters. */
export type UserQuery = { q?: string; roleId?: string; page?: number; pageSize?: number };

/** `ListMeta`-shaped page (#8, #11). */
export type Page<T> = { items: T[]; meta: { page: number; pageSize: number; total: number } };

/** One #9 `roleHistory` row (newest first); the FE adds "เข้าใช้ครั้งแรก" from `firstLoginAt`. */
export type RoleHistoryItem = { createdAt: string; from: string; to: string; actor: PersonRef | null };

/**
 * Why `canChangeRole` is false: `SELF` · `LOCKED_BY_ENV` · (CR-006) `READ_ONLY` — the viewer has `settings.users.view`
 * only · `SUPER_ADMIN` — the user is a Superadmin and the viewer is not.
 */
export type CannotChangeReason = "SELF" | "LOCKED_BY_ENV" | "READ_ONLY" | "SUPER_ADMIN";

/** #9 GET /settings/users/{id}. */
export type UserDetail = UserSummary & {
  division: string | null;
  firstLoginAt: string;
  canChangeRole: boolean;
  cannotChangeReason: CannotChangeReason | null;
  roleHistory: RoleHistoryItem[];
};

export type AuditAction =
  | "create" | "update" | "deactivate" | "activate" | "delete" | "reorder"
  | "role_change" | "permissions_change" | "floor_plan_upload" | "floor_plan_delete";

export type AuditEntityType =
  | "building" | "floor" | "room" | "category" | "symptom" | "contractor_type" | "role" | "user" | "asset" | "asset_type" | "building_type";

/** One `changes` item: `{field, before, after}` or (permissions) `{field, added, removed}`. */
export type AuditChange = { field: string; before?: string; after?: string; added?: string[]; removed?: string[] };

/** `AuditEntry` (#11). `exists` = the item is still there (link it). */
export type AuditEntry = {
  id: string;
  createdAt: string;
  actor: PersonRef | null;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  entityName: string;
  parentName: string | null;
  exists: boolean;
  changes: AuditChange[];
};

/** #11 query. `type` empty = all; `from` / `to` RFC 3339. */
export type AuditQuery = { type?: "master" | "permissions" | "users"; actorId?: string; from?: string; to?: string; q?: string; page?: number; pageSize?: number };

// ---- Stage 4: plan locations, assets, asset types (F26, #13, #15, #27, #46–#52) ----

/** A room of `PlanBuilding` (#13, #27 response). */
export type PlanRoom = {
  id: string;
  name: string;
  areaType: "meeting_room" | "restroom" | "office" | "pantry" | "common_area" | "parking" | "other";
  /** "พื้นที่ส่วนกลางชั้น {n}" (repair CR-014); can be renamed too. */
  isCommonArea: boolean;
  activeAssetCount: number;
  updatedAt: string;
  updatedBy: PersonRef | null;
};

/** Floors are bottom first (`level` ascending = the floor buttons); names are read-only. */
export type PlanFloor = { id: string; name: string; level: number; rooms: PlanRoom[] };

/** `PlanBuilding` (#13, #15 response): active buildings → floors → active rooms. `buildingType` always set (CR-005). */
export type PlanBuilding = {
  id: string;
  name: string;
  buildingType: { id: string; name: string };
  updatedAt: string;
  updatedBy: PersonRef | null;
  floors: PlanFloor[];
};

/** #27 body. */
export type RenameInput = { name: string; updatedAt: string };

/** #15 body: rename + (CR-005) an active building type; the S20 `แก้ไขอาคาร` dialog sends both. */
export type UpdateBuildingInput = { name: string; buildingTypeId?: string; updatedAt: string };

// ---- Stage 4P: building types (CR-005, #53–#55) ----

/**
 * `BuildingTypeAdmin` (#53–#55). `buildingCount` = active buildings of the type; `categoryIds` = categories used in
 * it (the "อื่น ๆ" category is never listed — it is used everywhere).
 */
export type BuildingTypeAdmin = {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  buildingCount: number;
  categoryIds: string[];
  updatedAt: string;
  updatedBy: PersonRef | null;
};

/** #54 body. `categoryIds` may be empty (S20 ticks every active category by default). */
export type CreateBuildingTypeInput = { name: string; categoryIds: string[] };

/** #55 body: rename / (de)activate. Which categories a type uses is edited per category (#34 `buildingTypeIds`). */
export type UpdateBuildingTypeInput = { name?: string; isActive?: boolean; updatedAt: string };

/** Lucide icon names of an asset type (`components/shared/asset-icon.ts`). */
export type AssetIconName = "box" | "air-vent" | "mic" | "speaker" | "tv" | "plug" | "droplets" | "armchair";

/** Height of the 3D marker. */
export type AssetMount = "floor" | "wall" | "ceiling";

/** `AssetAdmin` (#46–#48). `placed` = has a position on the 3D plan (repair S29). */
export type AssetAdmin = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  type: { id: string; key: string; name: string; icon: string };
  roomId: string;
  placed: boolean;
  openTicketCount: number;
  updatedAt: string;
  updatedBy: PersonRef | null;
};

/** #46 query. */
export type RoomAssetsQuery = { q?: string; assetTypeId?: string; includeInactive?: boolean };

/** #47 body. */
export type CreateAssetInput = { roomId: string; assetTypeId: string; code: string; name: string };

/** #48 body: only the changing fields + `updatedAt`. `isActive` alone = (de)activate. The type never changes. */
export type UpdateAssetInput = { code?: string; name?: string; roomId?: string; isActive?: boolean; updatedAt: string };

/** `AssetTypeAdmin` (#50–#52). */
export type AssetTypeAdmin = {
  id: string;
  key: string;
  name: string;
  /** 2–5 A–Z / 0–9, unique. */
  codePrefix: string;
  icon: string;
  mount: AssetMount;
  sortOrder: number;
  activeAssetCount: number;
  updatedAt: string;
  updatedBy: PersonRef | null;
};

/** #51 body (`icon` default `box`, `mount` default `floor`). */
export type CreateAssetTypeInput = { name: string; codePrefix: string; icon?: AssetIconName; mount?: AssetMount };

/** #52 body: only the changing fields + `updatedAt`. */
export type UpdateAssetTypeInput = { name?: string; codePrefix?: string; icon?: AssetIconName; mount?: AssetMount; updatedAt: string };

// ---- Stage 5: categories, symptoms, contractor types (F27, F28, #32–#45) ----

export type Priority = "critical" | "high" | "medium" | "low";

/** `MasterItem`: `inUse` = referenced by a ticket / contractor ever → delete refused (deactivate instead). */
export type MasterItem = { id: string; name: string; isActive: boolean; inUse: boolean; updatedAt: string; updatedBy: PersonRef | null };

/** `Category` (#32–#36; + CR-008 `defaultPriority`, CR-014 `isOther`, CR-005 `buildingTypeIds`). */
export type CategoryAdmin = MasterItem & {
  icon: string;
  sortOrder: number;
  defaultPriority: Priority;
  /** The "อื่น ๆ" category: always active, never deleted. */
  isOther: boolean;
  /** Active building types it is used in (CR-005, replaces `areaTypes`); empty for `isOther` = every type. */
  buildingTypeIds: string[];
  symptomCount: number;
  activeSymptomCount: number;
};

/** #37–#41 item. */
export type SymptomAdmin = MasterItem & { categoryId: string; sortOrder: number; priority: Priority };

/** `ContractorTypeAdmin` (#42–#45). */
export type ContractorTypeAdmin = MasterItem & {
  contractorCount: number;
  createdAt: string;
  createdBy: PersonRef | null;
  /** Created by someone who is not a Superadmin (badge "สร้างโดยช่าง"). */
  createdByTechnician: boolean;
};

/** #33 body. `buildingTypeIds` ≥ 1 active type (400 `buildingTypeIds: MIN_ITEMS|INVALID`). */
export type CreateCategoryInput = { name: string; icon: string; defaultPriority: Priority; buildingTypeIds: string[] };
/**
 * #34 body: only the changing fields + `updatedAt`; `isActive` alone = (de)activate. `buildingTypeIds` ≥ 1 when sent;
 * never on the `isOther` category (400 `buildingTypeIds: NOT_ALLOWED`).
 */
export type UpdateCategoryInput = { name?: string; icon?: string; defaultPriority?: Priority; buildingTypeIds?: string[]; isActive?: boolean; updatedAt: string };
/** #38 body. */
export type CreateSymptomInput = { name: string; priority: Priority };
/** #39 body. */
export type UpdateSymptomInput = { name?: string; priority?: Priority; isActive?: boolean; updatedAt: string };
/** #44 body. */
export type UpdateContractorTypeInput = { name?: string; isActive?: boolean; updatedAt: string };
/** Order body (#36, #41): every item in display order + the max `updatedAt` as loaded. */
export type OrderInput = { ids: string[]; version: string };

/** Error codes of this module (04-api-contract.md → Error codes). */
export type SettingsErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "VALIDATION_FAILED"
  | "NAME_TAKEN"
  | "VERSION_CONFLICT"
  | "IN_USE"
  | "ROLE_IN_USE"
  | "SYSTEM_ROLE"
  | "UNKNOWN_PERMISSION"
  | "CANNOT_CHANGE_SELF"
  | "ROLE_LOCKED"
  | "FIXED_PERMISSION"
  | "ASSET_CODE_TAKEN"
  | "CODE_PREFIX_TAKEN"
  | "ASSET_NOT_FOUND"
  | "ASSET_TYPE_NOT_FOUND"
  | "ROLE_NOT_FOUND"
  | "USER_NOT_FOUND"
  | "BUILDING_NOT_FOUND"
  | "BUILDING_TYPE_NOT_FOUND"
  | "ROOM_NOT_FOUND"
  | "CATEGORY_NOT_FOUND"
  | "SYMPTOM_NOT_FOUND"
  | "CONTRACTOR_TYPE_NOT_FOUND";
