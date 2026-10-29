import { env } from "@/lib/env";
import { http } from "@/lib/http";
import { mockRole } from "@/lib/platform/api";
import { mockMeByRole } from "@/lib/platform/mocks";
import { canAny, PERM, type PermissionKey } from "@/lib/platform/permissions";
import {
  mockCategories,
  mockContractorTypes,
  mockCreateCategory,
  mockCreateContractorType,
  mockCreateSymptom,
  mockDeleteCategory,
  mockDeleteContractorType,
  mockDeleteSymptom,
  mockReorderCategories,
  mockReorderSymptoms,
  mockSymptoms,
  mockUpdateCategory,
  mockUpdateContractorType,
  mockUpdateSymptom,
  mockAssetTypes,
  mockCreateAsset,
  mockCreateAssetType,
  mockPlanBuildings,
  mockUpdateBuilding,
  mockBuildingTypes,
  mockCreateBuildingType,
  mockUpdateBuildingType,
  mockRenameRoom,
  mockRoomAssets,
  mockSuggestCode,
  mockUpdateAsset,
  mockUpdateAssetType,
  mockAudit,
  mockAuditActors,
  mockChangeUserRole,
  mockUser,
  mockUsers,
  mockCreateRole,
  mockDeleteRole,
  mockErrors,
  mockMatrix,
  mockRoleList,
  mockSavePermissions,
  mockScenario,
  mockUpdateRole,
} from "./mocks";
import type {
  CategoryAdmin,
  ContractorTypeAdmin,
  CreateCategoryInput,
  CreateSymptomInput,
  OrderInput,
  SymptomAdmin,
  UpdateCategoryInput,
  UpdateContractorTypeInput,
  UpdateSymptomInput,
  AssetAdmin,
  AssetTypeAdmin,
  CreateAssetInput,
  CreateAssetTypeInput,
  PlanBuilding,
  PlanRoom,
  RenameInput,
  UpdateBuildingInput,
  BuildingTypeAdmin,
  CreateBuildingTypeInput,
  UpdateBuildingTypeInput,
  RoomAssetsQuery,
  UpdateAssetInput,
  UpdateAssetTypeInput,
  AuditEntry,
  AuditQuery,
  CreateRoleInput,
  Page,
  PermissionMatrix,
  PersonRef,
  Role,
  SavePermissionsInput,
  UpdateRoleInput,
  UserDetail,
  UserQuery,
  UserSummary,
} from "./types";

// Settings API (docs/modules/settings/04-api-contract.md). Every call goes through lib/http; with
// NEXT_PUBLIC_USE_MOCKS=true it returns mocks/scenarios and applies the same permission as the route.
// Errors are `ApiError` (`lib/http`); the screen maps `code` / `fields` to the Thai copy of its spec.

const BASE = "/settings";

/** #2 GET /settings/roles — roles with user counts (S24 list, S25 role filter). Needs roles or users. */
export async function getRoles(): Promise<Role[]> {
  if (env.useMocks) return mockRead(mockRoleList, PERM.settingsRoles, PERM.settingsUsers);
  return http.get<Role[]>(`${BASE}/roles`);
}

/** #3 POST /settings/roles → the new role. Errors: VALIDATION_FAILED (name / description / copyFromRoleId), NAME_TAKEN. */
export async function createRole(input: CreateRoleInput): Promise<Role> {
  if (env.useMocks) return mockWrite(() => mockCreateRole(input, mockActor()));
  return http.post<Role>(`${BASE}/roles`, input);
}

/** #4 PATCH /settings/roles/{id}. Errors: ROLE_NOT_FOUND, NAME_TAKEN, VERSION_CONFLICT (refetch the list), SYSTEM_ROLE. */
export async function updateRole(id: string, input: UpdateRoleInput): Promise<Role> {
  if (env.useMocks) return mockWrite(() => mockUpdateRole(id, input, mockActor()));
  return http.patch<Role>(`${BASE}/roles/${id}`, input);
}

/** #5 DELETE /settings/roles/{id}. Errors: ROLE_IN_USE (the "ลบ role นี้ไม่ได้" dialog), ROLE_NOT_FOUND, SYSTEM_ROLE. */
export async function deleteRole(id: string): Promise<void> {
  if (env.useMocks) return mockWrite(() => mockDeleteRole(id));
  await http.delete<void>(`${BASE}/roles/${id}`);
}

/** #6 GET /settings/permissions — the matrix. */
export async function getPermissionMatrix(): Promise<PermissionMatrix> {
  if (env.useMocks) return mockRead(mockMatrix, PERM.settingsRoles);
  return http.get<PermissionMatrix>(`${BASE}/permissions`);
}

/**
 * #7 PUT /settings/permissions → the new matrix. Errors: VERSION_CONFLICT (someone saved first: reload with
 * `getPermissionMatrix`, show its `updatedBy` / `updatedAt`, re-apply the pending changes), ROLE_NOT_FOUND, others generic.
 */
export async function savePermissionMatrix(input: SavePermissionsInput): Promise<PermissionMatrix> {
  if (env.useMocks) return mockWrite(() => mockSavePermissions(input, mockActor(), mockScenario()));
  return http.put<PermissionMatrix>(`${BASE}/permissions`, input);
}

// ---- Stage 3: users and audit (#8–#12) ----

function query(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** #8 GET /settings/users — search (q ≥ 2 characters), role filter, 20 per page by default. */
export async function getUsers(params: UserQuery): Promise<Page<UserSummary>> {
  if (env.useMocks) return mockRead(() => mockUsers(params), PERM.settingsUsers);
  const res = await http.list<UserSummary>(`${BASE}/users${query({ ...params, q: params.q && params.q.trim().length >= 2 ? params.q.trim() : undefined })}`);
  return { items: res.data, meta: res.meta! };
}

/** #9 GET /settings/users/{id} — detail, lock reason, role history (newest first). Errors: USER_NOT_FOUND. */
export async function getUser(id: string): Promise<UserDetail> {
  if (env.useMocks) return mockRead(() => mockUser(id, mockActor().id), PERM.settingsUsers);
  return http.get<UserDetail>(`${BASE}/users/${id}`);
}

/** #10 PUT /settings/users/{id}/role. Errors: USER_NOT_FOUND, ROLE_NOT_FOUND, CANNOT_CHANGE_SELF, ROLE_LOCKED. */
export async function changeUserRole(id: string, roleId: string): Promise<UserSummary> {
  if (env.useMocks) return mockWrite(() => mockChangeUserRole(id, roleId, mockActor()), PERM.settingsUsers);
  return http.put<UserSummary>(`${BASE}/users/${id}/role`, { roleId });
}

/** #11 GET /settings/audit — newest first, 50 per page by default. */
export async function getAuditEntries(params: AuditQuery): Promise<Page<AuditEntry>> {
  if (env.useMocks) return mockRead(() => mockAudit(params), PERM.settingsAudit);
  const res = await http.list<AuditEntry>(`${BASE}/audit${query(params)}`);
  return { items: res.data, meta: res.meta! };
}

/** #12 GET /settings/audit/actors — the ผู้ทำ filter options. */
export async function getAuditActors(): Promise<PersonRef[]> {
  if (env.useMocks) return mockRead(mockAuditActors, PERM.settingsAudit);
  return http.get<PersonRef[]>(`${BASE}/audit/actors`);
}

// ---- Stage 4: plan locations, assets, asset types (#13, #15, #27, #46–#52) ----

/** #13 GET /settings/buildings — the plan tree (active buildings → floors bottom first → active rooms). */
export async function getPlanBuildings(): Promise<PlanBuilding[]> {
  if (env.useMocks) return mockRead(mockPlanBuildings, PERM.settingsLocations, PERM.settingsAssets);
  return http.get<PlanBuilding[]>(`${BASE}/buildings`);
}

/**
 * #15 PATCH /settings/buildings/{id} — rename + (CR-005) building type. Errors: VALIDATION_FAILED (name,
 * buildingTypeId REQUIRED / INVALID), BUILDING_NOT_FOUND, NAME_TAKEN, VERSION_CONFLICT.
 */
export async function updateBuilding(id: string, input: UpdateBuildingInput): Promise<PlanBuilding> {
  if (env.useMocks) return mockWrite(() => mockUpdateBuilding(id, input, mockActor()), PERM.settingsLocations);
  return http.patch<PlanBuilding>(`${BASE}/buildings/${id}`, input);
}

/** #53 GET /settings/building-types — all types (active first) with building counts and their categories. */
export async function getBuildingTypes(): Promise<BuildingTypeAdmin[]> {
  if (env.useMocks) return mockRead(mockBuildingTypes, PERM.settingsLocations, PERM.settingsCategories);
  return http.get<BuildingTypeAdmin[]>(`${BASE}/building-types`);
}

/** #54 POST /settings/building-types. Errors: VALIDATION_FAILED (name, categoryIds INVALID), NAME_TAKEN. */
export async function createBuildingType(input: CreateBuildingTypeInput): Promise<BuildingTypeAdmin> {
  if (env.useMocks) return mockWrite(() => mockCreateBuildingType(input, mockActor()), PERM.settingsLocations);
  return http.post<BuildingTypeAdmin>(`${BASE}/building-types`, input);
}

/** #55 PATCH /settings/building-types/{id}. Errors: as #54 + BUILDING_TYPE_NOT_FOUND, VERSION_CONFLICT, IN_USE (deactivate while an active building has it). */
export async function updateBuildingType(id: string, input: UpdateBuildingTypeInput): Promise<BuildingTypeAdmin> {
  if (env.useMocks) return mockWrite(() => mockUpdateBuildingType(id, input, mockActor()), PERM.settingsLocations);
  return http.patch<BuildingTypeAdmin>(`${BASE}/building-types/${id}`, input);
}

/** #27 PATCH /settings/rooms/{id} — rename. Errors: VALIDATION_FAILED, ROOM_NOT_FOUND, NAME_TAKEN, VERSION_CONFLICT. */
export async function renameRoom(id: string, input: RenameInput): Promise<PlanRoom> {
  if (env.useMocks) return mockWrite(() => mockRenameRoom(id, input, mockActor()), PERM.settingsLocations);
  return http.patch<PlanRoom>(`${BASE}/rooms/${id}`, input);
}

/** #46 GET /settings/rooms/{id}/assets — ordered by code. Errors: ROOM_NOT_FOUND. */
export async function getRoomAssets(roomId: string, params: RoomAssetsQuery = {}): Promise<AssetAdmin[]> {
  if (env.useMocks) return mockRead(() => mockRoomAssets(roomId, params), PERM.settingsAssets);
  return http.get<AssetAdmin[]>(`${BASE}/rooms/${roomId}/assets${query({ q: params.q, assetTypeId: params.assetTypeId, includeInactive: params.includeInactive ? "true" : undefined })}`);
}

/** #47 POST /settings/assets. Errors: VALIDATION_FAILED (code / name / roomId / assetTypeId), ASSET_CODE_TAKEN. */
export async function createAsset(input: CreateAssetInput): Promise<AssetAdmin> {
  if (env.useMocks) return mockWrite(() => mockCreateAsset(input, mockActor()), PERM.settingsAssets);
  return http.post<AssetAdmin>(`${BASE}/assets`, input);
}

/** #48 PATCH /settings/assets/{id}. Errors: as #47 + ASSET_NOT_FOUND, VERSION_CONFLICT. */
export async function updateAsset(id: string, input: UpdateAssetInput): Promise<AssetAdmin> {
  if (env.useMocks) return mockWrite(() => mockUpdateAsset(id, input, mockActor()), PERM.settingsAssets);
  return http.patch<AssetAdmin>(`${BASE}/assets/${id}`, input);
}

/** #49 GET /settings/assets/suggest-code — next free `{prefix}-{floor}-{nnn}`. */
export async function suggestAssetCode(assetTypeId: string, roomId: string): Promise<string> {
  if (env.useMocks) return mockRead(() => mockSuggestCode(assetTypeId, roomId), PERM.settingsAssets).then((r) => r.code);
  return http.get<{ code: string }>(`${BASE}/assets/suggest-code${query({ assetTypeId, roomId })}`).then((r) => r.code);
}

/** #50 GET /settings/asset-types — active types in order with active asset counts. */
export async function getAssetTypes(): Promise<AssetTypeAdmin[]> {
  if (env.useMocks) return mockRead(mockAssetTypes, PERM.settingsAssets);
  return http.get<AssetTypeAdmin[]>(`${BASE}/asset-types`);
}

/** #51 POST /settings/asset-types. Errors: VALIDATION_FAILED (name / codePrefix / icon / mount), NAME_TAKEN, CODE_PREFIX_TAKEN. */
export async function createAssetType(input: CreateAssetTypeInput): Promise<AssetTypeAdmin> {
  if (env.useMocks) return mockWrite(() => mockCreateAssetType(input, mockActor()), PERM.settingsAssets);
  return http.post<AssetTypeAdmin>(`${BASE}/asset-types`, input);
}

/** #52 PATCH /settings/asset-types/{id}. Errors: as #51 + ASSET_TYPE_NOT_FOUND, VERSION_CONFLICT. */
export async function updateAssetType(id: string, input: UpdateAssetTypeInput): Promise<AssetTypeAdmin> {
  if (env.useMocks) return mockWrite(() => mockUpdateAssetType(id, input, mockActor()), PERM.settingsAssets);
  return http.patch<AssetTypeAdmin>(`${BASE}/asset-types/${id}`, input);
}

// ---- Stage 5: categories, symptoms (#32–#41), contractor types (#42–#45) ----

/** #32 GET /settings/categories — all, in order. */
export async function getCategories(): Promise<CategoryAdmin[]> {
  if (env.useMocks) return mockRead(mockCategories, PERM.settingsCategories);
  return http.get<CategoryAdmin[]>(`${BASE}/categories`);
}

/** #33 POST /settings/categories. Errors: VALIDATION_FAILED (name / icon / defaultPriority / buildingTypeIds MIN_ITEMS|INVALID), NAME_TAKEN. */
export async function createCategory(input: CreateCategoryInput): Promise<CategoryAdmin> {
  if (env.useMocks) return mockWrite(() => mockCreateCategory(input, mockActor()), PERM.settingsCategories);
  return http.post<CategoryAdmin>(`${BASE}/categories`, input);
}

/** #34 PATCH /settings/categories/{id}. Errors: as #33 (+ buildingTypeIds NOT_ALLOWED on "อื่น ๆ") + CATEGORY_NOT_FOUND, VERSION_CONFLICT. */
export async function updateCategory(id: string, input: UpdateCategoryInput): Promise<CategoryAdmin> {
  if (env.useMocks) return mockWrite(() => mockUpdateCategory(id, input, mockActor()), PERM.settingsCategories);
  return http.patch<CategoryAdmin>(`${BASE}/categories/${id}`, input);
}

/** #35 DELETE /settings/categories/{id}. Errors: IN_USE, CATEGORY_NOT_FOUND. */
export async function deleteCategory(id: string): Promise<void> {
  if (env.useMocks) return mockWrite(() => mockDeleteCategory(id, mockActor()), PERM.settingsCategories);
  await http.delete<void>(`${BASE}/categories/${id}`);
}

/** #36 PUT /settings/categories/order → the list. Errors: VERSION_CONFLICT. */
export async function reorderCategories(input: OrderInput): Promise<CategoryAdmin[]> {
  if (env.useMocks) return mockWrite(() => mockReorderCategories(input, mockActor()), PERM.settingsCategories);
  return http.put<CategoryAdmin[]>(`${BASE}/categories/order`, input);
}

/** #37 GET /settings/categories/{id}/symptoms. Errors: CATEGORY_NOT_FOUND. */
export async function getSymptoms(categoryId: string): Promise<SymptomAdmin[]> {
  if (env.useMocks) return mockRead(() => mockSymptoms(categoryId), PERM.settingsCategories);
  return http.get<SymptomAdmin[]>(`${BASE}/categories/${categoryId}/symptoms`);
}

/** #38 POST /settings/categories/{id}/symptoms. Errors: VALIDATION_FAILED, NAME_TAKEN (same category). */
export async function createSymptom(categoryId: string, input: CreateSymptomInput): Promise<SymptomAdmin> {
  if (env.useMocks) return mockWrite(() => mockCreateSymptom(categoryId, input, mockActor()), PERM.settingsCategories);
  return http.post<SymptomAdmin>(`${BASE}/categories/${categoryId}/symptoms`, input);
}

/** #39 PATCH /settings/symptoms/{id}. Errors: as #38 + SYMPTOM_NOT_FOUND, VERSION_CONFLICT. */
export async function updateSymptom(id: string, input: UpdateSymptomInput): Promise<SymptomAdmin> {
  if (env.useMocks) return mockWrite(() => mockUpdateSymptom(id, input, mockActor()), PERM.settingsCategories);
  return http.patch<SymptomAdmin>(`${BASE}/symptoms/${id}`, input);
}

/** #40 DELETE /settings/symptoms/{id}. Errors: IN_USE, SYMPTOM_NOT_FOUND. */
export async function deleteSymptom(id: string): Promise<void> {
  if (env.useMocks) return mockWrite(() => mockDeleteSymptom(id, mockActor()), PERM.settingsCategories);
  await http.delete<void>(`${BASE}/symptoms/${id}`);
}

/** #41 PUT /settings/categories/{id}/symptoms/order → the list. Errors: VERSION_CONFLICT. */
export async function reorderSymptoms(categoryId: string, input: OrderInput): Promise<SymptomAdmin[]> {
  if (env.useMocks) return mockWrite(() => mockReorderSymptoms(categoryId, input, mockActor()), PERM.settingsCategories);
  return http.put<SymptomAdmin[]>(`${BASE}/categories/${categoryId}/symptoms/order`, input);
}

/** #42 GET /settings/contractor-types — Thai name order. */
export async function getContractorTypes(): Promise<ContractorTypeAdmin[]> {
  if (env.useMocks) return mockRead(mockContractorTypes, PERM.settingsContractorTypes);
  return http.get<ContractorTypeAdmin[]>(`${BASE}/contractor-types`);
}

/** #43 POST /settings/contractor-types. Errors: VALIDATION_FAILED, NAME_TAKEN (case-insensitive). */
export async function createContractorType(name: string): Promise<ContractorTypeAdmin> {
  if (env.useMocks) return mockWrite(() => mockCreateContractorType(name, mockActor()), PERM.settingsContractorTypes);
  return http.post<ContractorTypeAdmin>(`${BASE}/contractor-types`, { name });
}

/** #44 PATCH /settings/contractor-types/{id}. Errors: as #43 + CONTRACTOR_TYPE_NOT_FOUND, VERSION_CONFLICT. */
export async function updateContractorType(id: string, input: UpdateContractorTypeInput): Promise<ContractorTypeAdmin> {
  if (env.useMocks) return mockWrite(() => mockUpdateContractorType(id, input, mockActor()), PERM.settingsContractorTypes);
  return http.patch<ContractorTypeAdmin>(`${BASE}/contractor-types/${id}`, input);
}

/** #45 DELETE /settings/contractor-types/{id}. Errors: IN_USE, CONTRACTOR_TYPE_NOT_FOUND. */
export async function deleteContractorType(id: string): Promise<void> {
  if (env.useMocks) return mockWrite(() => mockDeleteContractorType(id, mockActor()), PERM.settingsContractorTypes);
  await http.delete<void>(`${BASE}/contractor-types/${id}`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function mockActor(): PersonRef {
  const me = mockMeByRole[mockRole()];
  return { id: me.id, name: me.name, department: me.department };
}

async function mockRead<T>(fn: () => T, ...perms: PermissionKey[]): Promise<T> {
  const scenario = mockScenario();
  await sleep(scenario === "slow" ? 3000 : 300);
  if (scenario === "forbidden" || !canAny(mockMeByRole[mockRole()], ...perms)) throw mockErrors.forbidden();
  if (scenario === "error") throw mockErrors.server();
  const data = fn();
  if (scenario === "empty" && Array.isArray(data)) return [] as T;
  if (scenario === "empty" && data && typeof data === "object" && "items" in data) return { ...data, items: [], meta: { ...(data as unknown as Page<unknown>).meta, total: 0 } } as T;
  return data;
}

/** Writes need the route's permission (Stage 2: `settings.roles.manage`); `error` makes every write fail. */
async function mockWrite<T>(fn: () => T, perm: PermissionKey = PERM.settingsRoles): Promise<T> {
  const scenario = mockScenario();
  await sleep(scenario === "slow" ? 3000 : 500);
  if (scenario === "forbidden" || !canAny(mockMeByRole[mockRole()], perm)) throw mockErrors.forbidden();
  if (scenario === "error") throw mockErrors.server();
  return fn();
}
