# ตั้งค่าระบบ (Superadmin) — API contract

Status: APPROVED (2026-10-16) — user approved screens + plan; visual style follows the new design direction (repair CR-008, pending) · CR-001 / CR-002 applied 2026-10-26 (delegated master data, plan-owned locations, asset types; see "CR-001 / CR-002 revision")

<!-- Written by Claude in /stage-plan settings (2026-10-16). Single source for backend DTOs and frontend
     modules/settings/types.ts. Conventions (envelope, errors, dates, pagination): docs/shared/architecture.md
     Changes after approval → CR. -->

## Conventions used here (from architecture.md)

- Success `{ "data": … }`, lists add `"meta": { "page", "pageSize", "total" }`. Error `{ "error": { "code", "message", "fields" } }`.
- `camelCase` JSON, RFC 3339 UTC times, UUID ids (D-021), list query `page`, `pageSize` (default 20, max 100), `q`.
- Field errors: `400 VALIDATION_FAILED` with `fields: { "<field>": "<CODE>" }`; codes `REQUIRED`, `TOO_LONG`, `INVALID`, `OUT_OF_RANGE`.
- ~~Every `/api/v1/settings/**` endpoint needs a session (`401 UNAUTHENTICATED`) **and** role `super_admin` (`403 FORBIDDEN` otherwise, BR-ALL-1). The check is one middleware on the route group plus the service layer.~~ (CR-001)
- Every `/api/v1/settings/**` endpoint needs a session (`401 UNAUTHENTICATED`) **and** the `settings.*` permission named in its row of the endpoint table (`403 FORBIDDEN` otherwise, BR-ALL-1). The check is `RequirePermission(key)` on each route plus the service layer. (CR-001)
- **Optimistic concurrency:** every editable item returns `updatedAt` and `updatedBy`. `PATCH` bodies send back the `updatedAt` they were based on; a mismatch → `409 VERSION_CONFLICT`. The FE then re-fetches and shows "ข้อมูลนี้ถูกแก้โดย {updatedBy.name} เมื่อ {updatedAt}" from the fresh item. Order and matrix saves use a version the same way.
- **Audit:** every write in this contract appends a row to `platform.audit_log` in the same transaction (F30). Nothing here deletes audit rows.
- **Data owners** (who stores what; the `settings` module has no tables of its own):

| Data | Schema / package | `settings` reaches it through |
|---|---|---|
| roles, role permissions, user roles, users, audit log | `platform` · `internal/platform/{roles,users,audit}` | platform services |
| buildings, floors, rooms, floor plans | `platform` (moved from `repair`, see `03-plan.md` Stage 4) · `internal/platform/locations` | platform service |
| assets, asset types (CR-002) | `platform.assets`, `platform.asset_types` (repair CR-016) · `internal/platform/assets` (Stage 4 moves the asset queries out of repair) | platform service |
| categories, symptoms, contractor types; floor / category usage | `repair` · `internal/modules/repair` | repair's `SettingsAdmin` service interface, wired in `cmd/api/main.go` |

## Permission keys

Defined in code (BR-F29-1). Each module registers its own list; platform aggregates them. Seed copy and defaults: `01-users.md` → Permission catalog; card / column labels: `ui/screens/S24-roles-permissions.md`.

`repair.ticket.view_all` · `repair.ticket.work` · ~~`repair.ticket.set_priority`~~ (removed by repair CR-015: no ticket-level priority change) · `repair.ticket.close_any` · `repair.ticket.team_handle` · `repair.ticket.handover_any` · `repair.contractor.manage` · `repair.overview.view`

~~`settings.manage` is a pseudo permission: only `super_admin` has it, it never appears in the matrix, and the FE uses it to show the settings menu.~~ (CR-001)

**Settings permissions — fixed (CR-001, D-111).** Registered by `settings` as the group "ตั้งค่าระบบ". They are **not stored** in `platform.role_permissions`: platform grants them from the role key, so the matrix shows them ticked and locked and #7 refuses them (`FIXED_PERMISSION`). Copying a role never copies them; custom roles never have them.

| Key | Label (S24 column) | Granted to |
|---|---|---|
| `settings.locations.manage` | อาคารและห้อง | `admin`, `super_admin` |
| `settings.assets.manage` | อุปกรณ์และประเภทอุปกรณ์ | `admin`, `super_admin` |
| `settings.categories.manage` | หมวดงานและอาการ | `admin`, `super_admin` |
| `settings.contractor_types.manage` | ประเภทผู้รับเหมา | `super_admin` |
| `settings.users.manage` | ผู้ใช้ | `super_admin` |
| `settings.roles.manage` | Role และสิทธิ์ | `super_admin` |
| `settings.audit.view` | ประวัติการเปลี่ยนแปลง | `super_admin` |

The FE shows the administration sidebar entry ("ตั้งค่าระบบ") when `/me.permissions` has any `settings.*` key, and each sidebar item by its key. `super_admin` still has every key.

## Endpoints

Permission column (CR-001): `loc` = `settings.locations.manage` · `asset` = `settings.assets.manage` · `cat` = `settings.categories.manage` · `ctype` = `settings.contractor_types.manage` · `users` = `settings.users.manage` · `roles` = `settings.roles.manage` · `audit` = `settings.audit.view`. ~~Struck~~ rows are removed by the CR named in the row.

| # | Method | Path | Purpose | Permission | Stage |
|---|---|---|---|---|---|
| P1 | GET | `/api/v1/me` | **changed:** + `roleName`, `permissions` | session | 1 |
| P2 | GET | `/api/v1/dev/demo-users` | **changed:** one per active role, + `roleName` | dev | 1 |
| P3 | POST | `/api/v1/dev/role-switch` | **changed:** any active role key; demo user created on demand | dev | 1 |
| ~~1~~ | ~~GET~~ | ~~`/api/v1/settings/summary`~~ | ~~counts for S19~~ — removed with S19 (CR-001) | | |
| 2 | GET | `/api/v1/settings/roles` | roles with user counts | roles · users (filter) | 2 |
| 3 | POST | `/api/v1/settings/roles` | add a role (optionally copy permissions) | roles | 2 |
| 4 | PATCH | `/api/v1/settings/roles/{id}` | rename / describe | roles | 2 |
| 5 | DELETE | `/api/v1/settings/roles/{id}` | delete a role with no users | roles | 2 |
| 6 | GET | `/api/v1/settings/permissions` | the matrix | roles | 2 |
| 7 | PUT | `/api/v1/settings/permissions` | save matrix changes | roles | 2 |
| 8 | GET | `/api/v1/settings/users` | search users | users | 3 |
| 9 | GET | `/api/v1/settings/users/{id}` | user + role history | users | 3 |
| 10 | PUT | `/api/v1/settings/users/{id}/role` | change role | users | 3 |
| 11 | GET | `/api/v1/settings/audit` | audit entries | audit | 3 |
| 12 | GET | `/api/v1/settings/audit/actors` | people who appear as actors (filter) | audit | 3 |
| 13 | GET | `/api/v1/settings/buildings` | **changed (CR-002):** plan structure tree — buildings → floors → rooms, active only | loc · asset | 4 |
| ~~14~~ | ~~POST~~ | ~~`/api/v1/settings/buildings`~~ | ~~add building~~ — structure comes from the plan (CR-002) | | |
| 15 | PATCH | `/api/v1/settings/buildings/{id}` | **changed (CR-002):** rename only | loc | 4 |
| ~~16–31~~ | | ~~building delete / order, floors list / add / bulk / order / get / edit / delete, rooms list / add / delete / order, floor plan upload / delete~~ | removed (CR-002) | | |
| 27 | PATCH | `/api/v1/settings/rooms/{id}` | **changed (CR-002):** rename only | loc | 4 |
| ~~P8~~ | ~~GET~~ | ~~`/api/v1/floor-plans/{floorId}`~~ | ~~floor plan image~~ — removed with the floor plan upload (CR-002) | | |
| 32 | GET | `/api/v1/settings/categories` | categories | cat | 5 |
| 33 | POST | `/api/v1/settings/categories` | add category | cat | 5 |
| 34 | PATCH | `/api/v1/settings/categories/{id}` | edit / (de)activate | cat | 5 |
| 35 | DELETE | `/api/v1/settings/categories/{id}` | delete unused category | cat | 5 |
| 36 | PUT | `/api/v1/settings/categories/order` | reorder categories | cat | 5 |
| 37 | GET | `/api/v1/settings/categories/{id}/symptoms` | symptoms of a category | cat | 5 |
| 38 | POST | `/api/v1/settings/categories/{id}/symptoms` | add symptom | cat | 5 |
| 39 | PATCH | `/api/v1/settings/symptoms/{id}` | edit / (de)activate | cat | 5 |
| 40 | DELETE | `/api/v1/settings/symptoms/{id}` | delete unused symptom | cat | 5 |
| 41 | PUT | `/api/v1/settings/categories/{id}/symptoms/order` | reorder symptoms | cat | 5 |
| 42 | GET | `/api/v1/settings/contractor-types` | contractor types | ctype | 5 |
| 43 | POST | `/api/v1/settings/contractor-types` | add type | ctype | 5 |
| 44 | PATCH | `/api/v1/settings/contractor-types/{id}` | rename / (de)activate | ctype | 5 |
| 45 | DELETE | `/api/v1/settings/contractor-types/{id}` | delete unused type | ctype | 5 |
| 46 | GET | `/api/v1/settings/rooms/{id}/assets` | assets of a room, incl. inactive (CR-001) | asset | 4 |
| 47 | POST | `/api/v1/settings/assets` | add an asset to a room (CR-001) | asset | 4 |
| 48 | PATCH | `/api/v1/settings/assets/{id}` | edit code / name, move room, (de)activate (CR-001) | asset | 4 |
| 49 | GET | `/api/v1/settings/assets/suggest-code?assetTypeId=&roomId=` | next free code for the add dialog (CR-001) | asset | 4 |
| 50 | GET | `/api/v1/settings/asset-types` | asset types with usage counts (CR-002) | asset | 4 |
| 51 | POST | `/api/v1/settings/asset-types` | add an asset type (CR-002) | asset | 4 |
| 52 | PATCH | `/api/v1/settings/asset-types/{id}` | edit an asset type (CR-002) | asset | 4 |
| 53 | GET | `/api/v1/settings/building-types` | building types with usage counts (CR-005) | loc · cat | 4P |
| 54 | POST | `/api/v1/settings/building-types` | add a building type + its categories (CR-005) | loc | 4P |
| 55 | PATCH | `/api/v1/settings/building-types/{id}` | rename / (de)activate a building type (CR-005) | loc | 4P |

---

## Shared objects

### `PersonRef` (same as repair)
```json
{ "id": "5b7e…", "name": "ปวีณา ศรีสุข", "department": "ศูนย์จัดการงานอาคาร" }
```

### `RoleRef`
```json
{ "id": "0d3f…", "key": "technician", "name": "ช่างเทคนิค" }
```
`key`: stable code key. Seeded roles keep the glossary keys (`employee` … `super_admin`); new roles get `r_` + 8 hex characters. The UI never shows `key`.

### `MasterItem` — fields shared by building, floor, room, category, symptom, contractor type
```json
{ "id": "b1…", "name": "อาคารหลัก", "isActive": true, "inUse": true,
  "updatedAt": "2026-10-14T03:20:00Z", "updatedBy": { "id": "5b7e…", "name": "ปวีณา ศรีสุข", "department": "ศูนย์จัดการงานอาคาร" } }
```
`inUse` = referenced by any ticket / contractor ever → delete is refused (BR-ALL-2). `updatedBy` may be `null` (seeded rows).

### `PATCH` body for any `MasterItem`
```json
{ "name": "อาคารหลัก (สำนักงานใหญ่)", "isActive": true, "updatedAt": "2026-10-14T03:20:00Z" }
```
Send only the fields that change plus `updatedAt`. `isActive` alone = (de)activate; activation never asks for confirmation.

### Order body (any `/order` endpoint)
```json
{ "ids": ["f7…", "f6…", "f5…", "f4…", "f3…", "f2…", "f1…"], "version": "2026-10-16T02:11:09Z" }
```
`ids` = **every** item of that list (active and inactive) in display order. `version` = the max `updatedAt` of the list as the client loaded it. Different set or version → `409 VERSION_CONFLICT`. Response = the list as in its GET.

---

## Stage 1 — roles become data, permissions, Superadmin entry

### P1 GET /api/v1/me (changed)
```json
{ "data": {
  "id": "9a1c…", "employeeCode": "EMP0105", "name": "ณัฐพล อินทรวงศ์", "position": "เจ้าหน้าที่ระบบ",
  "department": "ฝ่ายเทคโนโลยีสารสนเทศ", "division": "สายงานบริหารทั่วไป", "email": "nattapon.i@example.co.th",
  "role": "super_admin", "roleName": "Superadmin",
  "permissions": ["repair.ticket.view_all", "repair.ticket.work", "repair.ticket.set_priority", "repair.ticket.close_any",
                  "repair.ticket.team_handle", "repair.ticket.handover_any", "repair.contractor.manage", "repair.overview.view",
                  "settings.locations.manage", "settings.assets.manage", "settings.categories.manage", "settings.contractor_types.manage",
                  "settings.users.manage", "settings.roles.manage", "settings.audit.view"],
  "technicianCategories": [], "isDemoUser": false, "environment": "UAT"
} }
```
`role` is now any role key (string, not an enum). `permissions` excludes the always-on base permissions and includes the fixed `settings.*` keys of the role (CR-001; e.g. `admin` gets `settings.locations.manage`, `settings.assets.manage`, `settings.categories.manage`). The FE builds menus and actions from `permissions`; the backend re-checks every request.

### P2 GET /api/v1/dev/demo-users (changed)
```json
{ "data": [ { "role": "employee", "roleName": "พนักงานทั่วไป", "name": "วรรณา สุขประเสริฐ" },
            { "role": "r_7c21a9f0", "roleName": "หัวหน้าช่าง", "name": "ผู้ใช้ตัวอย่าง หัวหน้าช่าง" },
            { "role": "super_admin", "roleName": "Superadmin", "name": "ณัฐพล อินทรวงศ์" } ] }
```
One row per role in role order. Roles without a demo user yet show the generated name; the user row is created on the first switch.

### P3 POST /api/v1/dev/role-switch (changed)
Request `{ "role": "r_7c21a9f0" }` → 200 `{ "data": <P1> }`. Errors: 400 `VALIDATION_FAILED` (`role: INVALID` — unknown key).

### ~~1. GET /api/v1/settings/summary~~ — removed with S19 (CR-001); kept for history only
```json
{ "data": {
  "buildings": 2, "floors": 9, "categories": 5, "symptoms": 20, "contractorTypes": 5, "roles": 7, "users": 421,
  "lastChange": { "createdAt": "2026-10-16T03:42:00Z", "actor": { "id": "5b7e…", "name": "ปวีณา ศรีสุข", "department": "ศูนย์จัดการงานอาคาร" } }
} }
```
Active items only; `users` excludes demo users. `lastChange` `null` when the audit has no settings entries. Before Stage 3–5 ship, the counts of their sections are still returned (data exists).

---

## Stage 2 — roles and the permission matrix (F29)

### `Role`
```json
{ "id": "0d3f…", "key": "technician", "name": "ช่างเทคนิค", "description": "ประเมินและซ่อมงานทุกงาน",
  "isSystem": false, "isLocked": false, "userCount": 1, "updatedAt": "2026-10-14T02:00:00Z", "updatedBy": null }
```
`isSystem`: `employee`, `super_admin` (no delete). `isLocked`: `super_admin` only (no edit, all permissions). Order: `super_admin`, then the six seeded roles in glossary order, then custom roles by `createdAt`.

### 2. GET /api/v1/settings/roles → `{ "data": [ <Role> ] }`

### 3. POST /api/v1/settings/roles
```json
{ "name": "หัวหน้าช่าง", "description": "ดูแลงานซ่อมทั้งหมด ปรับความเร่งด่วนได้", "copyFromRoleId": "0d3f…" }
```
`copyFromRoleId` optional (`null` = base permissions only). 201 `{ "data": <Role> }`. Errors: 400 `VALIDATION_FAILED` (`name: REQUIRED|TOO_LONG` (50), `description: TOO_LONG` (200), `copyFromRoleId: INVALID`), 409 `NAME_TAKEN`. Copying from `super_admin` copies every editable matrix permission; fixed `settings.*` keys are never copied (CR-001).

### 4. PATCH /api/v1/settings/roles/{id}
`{ "name": "…", "description": "…", "updatedAt": "…" }` → 200 `<Role>`. Errors: 404 `ROLE_NOT_FOUND`, 409 `NAME_TAKEN`, 409 `VERSION_CONFLICT`, 422 `SYSTEM_ROLE` (`super_admin`).

### 5. DELETE /api/v1/settings/roles/{id}
204. Errors: 404 `ROLE_NOT_FOUND`, 409 `ROLE_IN_USE` (userCount > 0; demo users do not count and are deleted with the role), 422 `SYSTEM_ROLE` (`employee`, `super_admin`).

### 6. GET /api/v1/settings/permissions
```json
{ "data": {
  "version": 12, "updatedAt": "2026-10-16T03:42:00Z", "updatedBy": { "id": "5b7e…", "name": "ปวีณา ศรีสุข", "department": "ศูนย์จัดการงานอาคาร" },
  "systems": [ { "key": "repair", "name": "ระบบแจ้งซ่อม", "groups": [
    { "key": "repair.ticket", "name": "งานซ่อม", "permissions": [
      { "key": "repair.ticket.view_all", "label": "ดูทุกงาน", "description": "เห็นงานซ่อมทุกงาน รวมชื่อและคะแนนช่างภายนอก" },
      { "key": "repair.ticket.work", "label": "ประเมินและบันทึกผล", "description": "งานซ่อมทุกงานส่งถึง role นี้ ประเมินวันคาดว่าเสร็จ และบันทึกผลซ่อม" } ] } ] } ],
  "roles": [ { "id": "aa01…", "key": "super_admin", "name": "Superadmin", "userCount": 1, "isLocked": true, "permissions": ["repair.ticket.view_all", "…"] },
             { "id": "0d3f…", "key": "technician", "name": "ช่างเทคนิค", "userCount": 1, "isLocked": false,
               "permissions": ["repair.ticket.view_all", "repair.ticket.work", "repair.contractor.manage"] } ]
} }
```
Labels and descriptions come from the module that registers the permission (Thai copy lives next to the permission key in Go). Roles in `Role` order.

(CR-001) `systems` gains `{ "key": "settings", "name": "ตั้งค่าระบบ", "groups": [ { "key": "settings", "name": "ตั้งค่าระบบ", "isFixed": true, "permissions": [ …the 7 fixed keys… ] } ] }` after `repair`. Every group has `isFixed` (`false` for repair groups). Each role's `permissions` includes its fixed keys so the matrix renders them ticked; the FE disables every cell of a fixed group.

### 7. PUT /api/v1/settings/permissions
```json
{ "version": 12, "changes": [ { "roleId": "0d3f…", "permission": "repair.ticket.set_priority", "granted": true } ] }
```
200 → the new matrix (#6) with `version` + 1. One audit row per changed role (`permissions_change`, `{ added: [labels], removed: [labels] }`). Errors: 400 `VALIDATION_FAILED` (`changes: REQUIRED` when empty), 400 `UNKNOWN_PERMISSION`, 404 `ROLE_NOT_FOUND`, 409 `VERSION_CONFLICT`, 422 `SYSTEM_ROLE` (a change for `super_admin`), 422 `FIXED_PERMISSION` (a `settings.*` key, CR-001).

---

## Stage 3 — users and audit (F15, F30)

### `UserSummary`
```json
{ "id": "7e2a…", "employeeCode": "EMP0231", "name": "ธนากร พึ่งบุญ", "email": "thanakorn.p@example.co.th",
  "department": "ฝ่ายอาคารสถานที่", "position": "ช่างเทคนิคอาวุโส",
  "role": { "id": "0d3f…", "key": "technician", "name": "ช่างเทคนิค" }, "roleLockedByEnv": false,
  "lastLoginAt": "2026-10-16T02:20:00Z" }
```

### 8. GET /api/v1/settings/users?q=&roleId=&page=&pageSize=
`q` (≥ 2 chars) matches Thai / English name, employee code, email (case-insensitive). Sorted by Thai name. Demo users never listed. → `{ "data": [ <UserSummary> ], "meta": {…} }`.

### 9. GET /api/v1/settings/users/{id}
```json
{ "data": { "…<UserSummary>": "", "division": "สายงานบริหารทั่วไป", "firstLoginAt": "2026-10-14T02:10:00Z",
  "canChangeRole": true, "cannotChangeReason": null,
  "roleHistory": [ { "createdAt": "2026-10-15T07:02:00Z", "from": "พนักงานทั่วไป", "to": "ช่างเทคนิค",
                     "actor": { "id": "9a1c…", "name": "ณัฐพล อินทรวงศ์", "department": "ฝ่ายเทคโนโลยีสารสนเทศ" } } ] } }
```
`cannotChangeReason`: `SELF` · `LOCKED_BY_ENV` · `null`. `roleHistory` newest first, from the audit log; the FE adds the "เข้าใช้ครั้งแรก" row from `firstLoginAt`. 404 `USER_NOT_FOUND`.

### 10. PUT /api/v1/settings/users/{id}/role
`{ "roleId": "aa07…" }` → 200 `<UserSummary>`. Takes effect on the user's next request (permissions are loaded per request, BR-F29-7). Errors: 404 `USER_NOT_FOUND`, 422 `ROLE_NOT_FOUND` (deleted meanwhile), 422 `CANNOT_CHANGE_SELF`, 422 `ROLE_LOCKED` (env-defined Superadmin). Same role → 200, no audit row.

### `AuditEntry`
```json
{ "id": "e51b…", "createdAt": "2026-10-16T03:42:00Z",
  "actor": { "id": "5b7e…", "name": "ปวีณา ศรีสุข", "department": "ศูนย์จัดการงานอาคาร" },
  "action": "update", "entityType": "floor", "entityId": "f5…", "entityName": "ชั้น 5", "parentName": "อาคารหลัก", "exists": true,
  "changes": [ { "field": "name", "before": "5", "after": "5 (สำนักงาน)" } ] }
```
- `action`: `create` · `update` · `deactivate` · `activate` · `delete` · `reorder` · `role_change` · `permissions_change` · `floor_plan_upload` · `floor_plan_delete`
- `entityType`: `building` · `floor` · `room` · `category` · `symptom` · `contractor_type` · `role` · `user` · `asset` · `asset_type` (CR-001)
- `changes` by action: `update` → `{field, before, after}` per field (`name`, `icon`, `description`); `role_change` → `[{ "field": "role", "before": "พนักงานทั่วไป", "after": "ช่างเทคนิค" }]`; `permissions_change` → `[{ "field": "permissions", "added": ["ปรับความเร่งด่วน"], "removed": [] }]`; `floor_plan_*` → `[{ "field": "file", "after": "ผังชั้น5.png" }]`; others `[]`.
- Names are stored at write time, so deleted items still read correctly; `exists` tells the FE whether to link.

### 11. GET /api/v1/settings/audit?type=&actorId=&from=&to=&q=&page=&pageSize=50
`type`: `master` (building … contractor_type) · `permissions` (role) · `users` (user) · empty = all. `from` / `to`: RFC 3339. `q` matches `entityName` / `parentName`. Newest first. → `{ "data": [ <AuditEntry> ], "meta": {…} }`.

### 12. GET /api/v1/settings/audit/actors → `{ "data": [ <PersonRef> ] }` (everyone with a settings audit row, by name).

---

## Stage 4 — plan locations, assets, asset types (F26) (CR-001 / CR-002)

Floors and rooms come from the building plan: settings never creates, deletes, reorders or deactivates buildings, floors or rooms, and has no floor-plan upload (CR-002, D-108, D-111). It renames buildings and rooms and manages the equipment in rooms and the equipment types. The original Stage 4 contract (#13–#31, P8) is kept at the end of this section for history.

### `PlanBuilding` (#13)
```json
{ "id": "b1…", "name": "อาคาร 1", "updatedAt": "2026-10-20T03:00:00Z", "updatedBy": null,
  "floors": [ { "id": "f11…", "name": "ชั้น 1", "level": 1,
                "rooms": [ { "id": "r111…", "name": "ห้องประชุม 1A", "areaType": "meeting_room", "isCommonArea": false,
                             "activeAssetCount": 4, "updatedAt": "2026-10-20T03:00:00Z", "updatedBy": null } ] } ] }
```

### 13. GET /api/v1/settings/buildings (changed, CR-002)
(CR-005) `PlanBuilding` + `"buildingType": { "id": "…", "name": "อาคารสำนักงาน" }` (always set).
`{ "data": [ <PlanBuilding> ] }` — active buildings in `sort_order`; floors bottom first (`level` ascending = the order of the floor buttons); active rooms in `sort_order`. Floor names are read-only here.

### 15. PATCH /api/v1/settings/buildings/{id} (changed, CR-002)
`{ "name": "อาคาร 1 (สำนักงานใหญ่)", "updatedAt": "…" }` → 200 `<PlanBuilding>`. Rename only; the id, floors, rooms and assets stay. Errors: 400 `VALIDATION_FAILED` (`name: REQUIRED|TOO_LONG` 100), 404 `BUILDING_NOT_FOUND`, 409 `NAME_TAKEN` (case-insensitive among buildings), 409 `VERSION_CONFLICT`. Audit `update` (`building`).
(CR-005) Body may also carry `"buildingTypeId"` (an active type) → 400 `buildingTypeId: REQUIRED|INVALID`; the S20 dialog sends both fields. Changing the type affects new reports only.

### 27. PATCH /api/v1/settings/rooms/{id} (changed, CR-002)
`{ "name": "ห้องประชุม 1A (ใหญ่)", "updatedAt": "…" }` → 200 room (shape of `PlanBuilding.floors[].rooms[]`). Rename only. Errors: 400 (`name` REQUIRED / TOO_LONG 100), 404 `ROOM_NOT_FOUND`, 409 `NAME_TAKEN` (same floor, case-insensitive), 409 `VERSION_CONFLICT`. The common-area room ("พื้นที่ส่วนกลางชั้น {n}") can be renamed too. Audit `update` (`room`).

### `AssetAdmin`
```json
{ "id": "a1…", "code": "AC-1-001", "name": "แอร์ห้องประชุม 1A", "isActive": true,
  "type": { "id": "c016a700-…-0001", "key": "aircon", "name": "เครื่องปรับอากาศ", "icon": "air-vent" },
  "roomId": "r111…", "placed": true, "openTicketCount": 0,
  "updatedAt": "2026-10-20T03:00:00Z", "updatedBy": null }
```
`placed` = has a position on the 3D floor plan (repair S29 placement mode).

### 46. GET /api/v1/settings/rooms/{id}/assets?q=&assetTypeId=&includeInactive=false
`{ "data": [ <AssetAdmin> ] }` ordered by `code`. `q` matches code / name (case-insensitive). 404 `ROOM_NOT_FOUND`.

### 47. POST /api/v1/settings/assets
`{ "roomId", "assetTypeId", "code", "name" }` → 201 `<AssetAdmin>` (not placed; the position is set in repair S29). Errors: 400 `VALIDATION_FAILED` (`code: REQUIRED|INVALID` — `^[A-Za-z0-9_-]{1,50}$`, `name: REQUIRED|TOO_LONG` 100, `roomId` / `assetTypeId: INVALID` — unknown or inactive), 409 `ASSET_CODE_TAKEN` (any asset, active or not, case-insensitive; repair BR-F31-1).

### 48. PATCH /api/v1/settings/assets/{id}
`{ "code"?, "name"?, "roomId"?, "isActive"?, "updatedAt" }` → 200 `<AssetAdmin>`. The type never changes (repair #32 rule). Moving to another room clears the 3D position. `isActive` alone = (de)activate; a deactivated asset keeps its code taken. Errors: as #47 + 404 `ASSET_NOT_FOUND`, 409 `VERSION_CONFLICT`. Audit `asset.created` / `asset.updated` / `asset.deactivated` / `asset.activated` as repair CR-016.

### 49. GET /api/v1/settings/assets/suggest-code?assetTypeId=&roomId= → `{ "data": { "code": "AC-1-003" } }`
Same rule as repair #34 (`{codePrefix}-{floor name}-{nnn}`), floor taken from the room.

### `AssetTypeAdmin`
```json
{ "id": "c016a700-…-0001", "key": "aircon", "name": "เครื่องปรับอากาศ", "codePrefix": "AC", "icon": "air-vent",
  "mount": "wall", "sortOrder": 1, "activeAssetCount": 3, "updatedAt": "2026-10-20T03:00:00Z", "updatedBy": null }
```
- `icon` ∈ `box` อุปกรณ์ทั่วไป · `air-vent` เครื่องปรับอากาศ · `mic` ไมโครโฟน · `speaker` ลำโพง · `tv` จอภาพ · `plug` อุปกรณ์ไฟฟ้า · `droplets` ระบบน้ำ · `armchair` เฟอร์นิเจอร์ (lucide names; one shared map `components/shared/asset-icon.ts`, also used by repair S29 instead of its key map).
- `mount` ∈ `floor` พื้น · `wall` ผนัง · `ceiling` เพดาน (height of the 3D marker).
- Needs migration: `platform.asset_types` + `updated_by` (D-051 concurrency uses `updated_at`).

### 50. GET /api/v1/settings/asset-types → `{ "data": [ <AssetTypeAdmin> ] }` — active types in `sort_order`.

### 51. POST /api/v1/settings/asset-types
`{ "name": "เครื่องพิมพ์", "codePrefix": "PRN", "icon": "box", "mount": "floor" }` → 201 `<AssetTypeAdmin>` (goes last; `key` = `t_` + 8 hex, stable). `icon` defaults to `box`, `mount` to `floor`. Errors: 400 `VALIDATION_FAILED` (`name: REQUIRED|TOO_LONG` 100, `codePrefix: REQUIRED|INVALID` — `^[A-Z0-9]{2,5}$` after upper-casing, `icon` / `mount: INVALID`), 409 `NAME_TAKEN` (case-insensitive), 409 `CODE_PREFIX_TAKEN`. Audit `create` (`asset_type`).

### 52. PATCH /api/v1/settings/asset-types/{id}
`{ "name"?, "codePrefix"?, "icon"?, "mount"?, "updatedAt" }` → 200 `<AssetTypeAdmin>`. Existing asset codes never change; a new prefix only affects suggestions. Errors: as #51 + 404 `ASSET_TYPE_NOT_FOUND`, 409 `VERSION_CONFLICT`. No deactivate / delete / reorder of types in this release (not in the CR-001 design).

### `BuildingTypeAdmin` (CR-005)
```json
{ "id": "bt1…", "name": "โกดังเก็บของ", "isActive": true, "sortOrder": 2,
  "buildingCount": 1, "categoryIds": ["c014ca70-…-0001", "c014ca70-…-0003", "c014ca70-…-0005"],
  "updatedAt": "2026-10-27T03:00:00Z", "updatedBy": null }
```
`categoryIds` = categories used in this type (`repair.category_building_types`; the `isOther` category is never listed — it is used everywhere).

### 53. GET /api/v1/settings/building-types → `{ "data": [ <BuildingTypeAdmin> ] }` — all types (active first) in `sort_order`.

### 54. POST /api/v1/settings/building-types
`{ "name": "โรงงาน", "categoryIds": ["…"] }` → 201 `<BuildingTypeAdmin>` (goes last). `categoryIds` may be empty (S20 ticks every active category by default). Errors: 400 `VALIDATION_FAILED` (`name: REQUIRED|TOO_LONG` 100, `categoryIds: INVALID` unknown / `isOther` id), 409 `NAME_TAKEN` (case-insensitive). Audit `create` (`building_type`).

### 55. PATCH /api/v1/settings/building-types/{id}
`{ "name"?, "isActive"?, "updatedAt" }` → 200 `<BuildingTypeAdmin>`. Errors: as #54 + 404 `BUILDING_TYPE_NOT_FOUND`, 409 `VERSION_CONFLICT`, 409 `IN_USE` (deactivate while an active building has this type). No delete. Which categories a type uses is edited per category (#33 / #34 `buildingTypeIds`). Audit `update` (`building_type`).

<details><summary>Original Stage 4 contract (2026-10-16) — superseded by CR-002</summary>

### Stage 4 — buildings, floors, rooms, floor plans (F26) [superseded by CR-002]

### 13. GET /api/v1/settings/buildings
`{ "data": [ <MasterItem> + { "floorCount": 7, "activeFloorCount": 7, "sortOrder": 1 } ] }` — all buildings, active and inactive, in order.

### 14. POST /api/v1/settings/buildings
`{ "name": "อาคารหลัก" }` → 201 building. Errors: 400 `VALIDATION_FAILED` (`name: REQUIRED|TOO_LONG` 100), 409 `NAME_TAKEN`. New building goes last.

### 15. PATCH /api/v1/settings/buildings/{id} — `MasterItem` PATCH. Errors: 404 `BUILDING_NOT_FOUND`, 409 `NAME_TAKEN`, 409 `VERSION_CONFLICT`.

### 16. DELETE /api/v1/settings/buildings/{id}
204, deletes its (unused) floors and rooms too. 409 `IN_USE` if any of its floors is in use.

### 17. PUT /api/v1/settings/buildings/order — order body.

### `Floor`
```json
{ "…<MasterItem>": "", "buildingId": "b1…", "buildingName": "อาคารหลัก", "level": 5, "roomCount": 8,
  "openTicketCount": 2, "floorPlan": <FloorPlan|null> }
```
`level`: 1 = bottom; unique per building. `openTicketCount`: tickets not closed on this floor (from repair; drives the deactivate dialog line).

### `FloorPlan`
```json
{ "fileName": "ผังชั้น5.png", "sizeBytes": 1258291, "url": "/api/v1/floor-plans/f5…?v=1760412000",
  "updatedAt": "2026-10-14T03:20:00Z", "updatedBy": { "id": "5b7e…", "name": "ปวีณา ศรีสุข", "department": "ศูนย์จัดการงานอาคาร" } }
```

### 18. GET /api/v1/settings/buildings/{id}/floors → `{ "data": [ <Floor> ] }` top floor first (highest `level`). 404 `BUILDING_NOT_FOUND`.

### 19. POST /api/v1/settings/buildings/{id}/floors
`{ "name": "ดาดฟ้า", "belowFloorId": null }` — `belowFloorId` = put the new floor directly under that floor; `null` = top. Floors above shift up one `level`. 201 `<Floor>`. Errors: 400 (`name: REQUIRED|TOO_LONG` 20), 404 `BUILDING_NOT_FOUND`, 409 `NAME_TAKEN`.

### 20. POST /api/v1/settings/buildings/{id}/floors/bulk
`{ "count": 7 }` → 201 `{ "data": [ <Floor> ] }`, named `{top+1}` … `{top+count}` (1…N on an empty building). Errors: 400 (`count: OUT_OF_RANGE` 1–100), 409 `NAME_TAKEN` (a generated name exists; nothing created).

### 21. PUT /api/v1/settings/buildings/{id}/floors/order — order body, `ids` top → bottom; server rewrites `level` (bottom = 1).

### 22. GET /api/v1/settings/floors/{id} → `{ "data": <Floor> }`. 404 `FLOOR_NOT_FOUND`.

### 23. PATCH /api/v1/settings/floors/{id} — `MasterItem` PATCH. Errors: 404, 409 `NAME_TAKEN`, 409 `VERSION_CONFLICT`.

### 24. DELETE /api/v1/settings/floors/{id} — 204 (deletes its rooms and plan file). 409 `IN_USE`.

### 25. GET /api/v1/settings/floors/{id}/rooms → `{ "data": [ <MasterItem> + { "sortOrder": 1 } ] }`. `inUse` is always `false` until room booking references rooms.

### 26. POST /api/v1/settings/floors/{id}/rooms
`{ "name": "ห้องประชุม 5B" }` → 201. Errors: 400 (`name` 100), 404 `FLOOR_NOT_FOUND`, 409 `NAME_TAKEN`.

### 27. PATCH /api/v1/settings/rooms/{id} · 28. DELETE /api/v1/settings/rooms/{id} · 29. PUT /api/v1/settings/floors/{id}/rooms/order — as above (`ROOM_NOT_FOUND`).

### 30. PUT /api/v1/settings/floors/{id}/plan
`multipart/form-data`, field `file`: `image/jpeg` or `image/png`, ≤ 10 MB, stored as uploaded (no resize). 200 `{ "data": <FloorPlan> }`; replaces the previous file. Errors: 400 `INVALID_FILE`, 400 `FILE_TOO_LARGE`, 404 `FLOOR_NOT_FOUND`.

### 31. DELETE /api/v1/settings/floors/{id}/plan → 204 (404 `FLOOR_PLAN_NOT_FOUND` when none).

### P8 GET /api/v1/floor-plans/{floorId}
Image bytes with its content type, `Cache-Control: private, max-age=86400` (the `v` query busts it). Any logged-in user. 404 when the floor has no plan.

</details>

---

## Stage 5 — categories, symptoms, contractor types (F27, F28)

### `Category`
`<MasterItem>` + `{ "icon": "snowflake", "sortOrder": 1, "symptomCount": 5, "activeSymptomCount": 5 }`. `icon` ∈ `wrench, snowflake, lightbulb, zap, plug, droplets, shower-head, armchair, door-open, sparkles, trash-2, hammer` (S22).

### 32. GET /api/v1/settings/categories → all, in order.
### 33. POST /api/v1/settings/categories
`{ "name": "ระบบปรับอากาศ", "icon": "snowflake" }` → 201. Errors: 400 (`name` REQUIRED / TOO_LONG 100, `icon: INVALID`), 409 `NAME_TAKEN`.
### 34. PATCH /api/v1/settings/categories/{id} — `MasterItem` PATCH + optional `icon`. `CATEGORY_NOT_FOUND`.
(CR-005) `Category` + `"buildingTypeIds": ["…"]` (replaces repair CR-014 `areaTypes`; empty for the `isOther` category = every type). #33 requires `buildingTypeIds` ≥ 1 active type; #34 accepts it optionally (≥ 1 when sent). Errors: 400 `buildingTypeIds: MIN_ITEMS|INVALID`; 400 `buildingTypeIds: NOT_ALLOWED` on the `isOther` category.
### 35. DELETE /api/v1/settings/categories/{id} — 204 with its unused symptoms; 409 `IN_USE`.
### 36. PUT /api/v1/settings/categories/order — order body.

### 37. GET /api/v1/settings/categories/{id}/symptoms → `{ "data": [ <MasterItem> + { "sortOrder": 1 } ] }`
### 38. POST /api/v1/settings/categories/{id}/symptoms — `{ "name": "แอร์ไม่เย็น" }` → 201. 409 `NAME_TAKEN` (same category).
### 39. PATCH /api/v1/settings/symptoms/{id} · 40. DELETE /api/v1/settings/symptoms/{id} · 41. PUT /api/v1/settings/categories/{id}/symptoms/order — as above (`SYMPTOM_NOT_FOUND`). No `categoryId` in PATCH (F27: no move).

### `ContractorTypeAdmin`
`<MasterItem>` + `{ "contractorCount": 3, "createdAt": "2026-10-15T04:00:00Z", "createdBy": <PersonRef|null>, "createdByTechnician": false }`

### 42. GET /api/v1/settings/contractor-types → all, Thai name order.
### 43. POST /api/v1/settings/contractor-types — `{ "name": "ลิฟต์" }` → 201. 409 `NAME_TAKEN` (case-insensitive, D-041).
### 44. PATCH /api/v1/settings/contractor-types/{id} · 45. DELETE /api/v1/settings/contractor-types/{id} — as above (`CONTRACTOR_TYPE_NOT_FOUND`; `inUse` = linked to any contractor).

---

## Changes to repair endpoints (repair CR-007, built in the stages above)

| repair # | Change | Stage |
|---|---|---|
| all | role checks → permission checks with the same defaults; error codes unchanged (`NOT_TECHNICIAN` = lacks `repair.ticket.work`) | 1 |
| 2 `GET /repair/buildings` | reads platform locations; same response | 4 |
| 29–34 assets (CR-016) | write permission `settings.assets.manage` instead of role `admin`; queries move to `internal/platform/assets`, shared with #46–#52; #29 returns `icon` from the type, which S29 renders through `components/shared/asset-icon.ts` (CR-001) | 1 (permission) / 4 (move) |
| 14 `POST /repair/contractor-types` | a name matching an inactive type re-activates it; writes an audit row | 5 |
| ~~27 `GET /repair/admin/overview` (not built yet)~~ | ~~+ `hasFloorPlan` per floor; inactive floors listed while they have open tickets~~ — dropped: floor plans belong to the plan workflow (CR-002) | |

## Error codes (module-wide)

| code | Status | Meaning | Thai message (shown in UI) |
|---|---|---|---|
| `UNAUTHENTICATED` | 401 | no / expired session | (redirect to S01 `?reason=expired`) |
| `FORBIDDEN` | 403 | lacks the route's `settings.*` permission (CR-001) | Forbidden state (`ui/screens/_common.md` §1) |
| `VALIDATION_FAILED` | 400 | field errors | per field (`_common.md` §6, screen specs) |
| `NAME_TAKEN` | 409 | duplicate name in its scope | ชื่อนี้มีอยู่แล้ว |
| `VERSION_CONFLICT` | 409 | changed by someone else | ข้อมูลนี้ถูกแก้โดย {ชื่อ} เมื่อ {เวลา} (S24: สิทธิ์ถูกแก้โดย…) |
| `IN_USE` | 409 | delete of a referenced item | ลบไม่ได้ เพราะเคยถูกใช้แล้ว ปิดใช้งานแทน |
| `ROLE_IN_USE` | 409 | delete role with users | dialog "ลบ role นี้ไม่ได้" (S24) |
| `SYSTEM_ROLE` | 422 | delete / edit a system role | ทำรายการไม่สำเร็จ ลองอีกครั้ง (UI never offers it) |
| `UNKNOWN_PERMISSION` | 400 | permission key not in the catalog | ทำรายการไม่สำเร็จ ลองอีกครั้ง |
| `CANNOT_CHANGE_SELF` | 422 | change own role | เปลี่ยน role ของตัวเองไม่ได้ |
| `ROLE_LOCKED` | 422 | env-defined Superadmin | role นี้กำหนดโดยระบบ (ตั้งค่าใน server) |
| ~~`INVALID_FILE` / `FILE_TOO_LARGE`~~ | | ~~floor plan type / size~~ — removed (CR-002) | |
| `FIXED_PERMISSION` | 422 | matrix change on a `settings.*` key (CR-001) | ทำรายการไม่สำเร็จ ลองอีกครั้ง (UI never offers it) |
| `ASSET_CODE_TAKEN` | 409 | asset code used by any asset (CR-001) | รหัสอุปกรณ์นี้มีอยู่แล้ว กรุณาใช้รหัสอื่น |
| `CODE_PREFIX_TAKEN` | 409 | asset type prefix already used (CR-002) | รหัสนำหน้านี้มีประเภทอื่นใช้แล้ว |
| `ASSET_NOT_FOUND` / `ASSET_TYPE_NOT_FOUND` | 404 | (CR-001 / CR-002) | (refetch the list) |
| `ROLE_NOT_FOUND` | 404 / 422 | | S25: role นี้ถูกลบไปแล้ว เลือกใหม่ · others: not-found state |
| `USER_NOT_FOUND` | 404 | | ไม่พบผู้ใช้นี้ |
| `BUILDING_NOT_FOUND` | 404 | | ไม่พบอาคารนี้ |
| `FLOOR_NOT_FOUND` / `FLOOR_PLAN_NOT_FOUND` | 404 | | ไม่พบชั้นนี้ |
| `ROOM_NOT_FOUND` | 404 | | (refetch the list) |
| `CATEGORY_NOT_FOUND` | 404 | | ไม่พบหมวดงานนี้ |
| `SYMPTOM_NOT_FOUND` / `CONTRACTOR_TYPE_NOT_FOUND` | 404 | | (refetch the list) |
| any other / network | 5xx | | ทำรายการไม่สำเร็จ ลองอีกครั้ง |
