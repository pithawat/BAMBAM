# ตั้งค่าระบบ (Superadmin) — API contract

Status: DRAFT

<!-- Written by Claude in /stage-plan settings (2026-10-16). Single source for backend DTOs and frontend
     modules/settings/types.ts. Conventions (envelope, errors, dates, pagination): docs/shared/architecture.md
     Changes after approval → CR. -->

## Conventions used here (from architecture.md)

- Success `{ "data": … }`, lists add `"meta": { "page", "pageSize", "total" }`. Error `{ "error": { "code", "message", "fields" } }`.
- `camelCase` JSON, RFC 3339 UTC times, UUID ids (D-021), list query `page`, `pageSize` (default 20, max 100), `q`.
- Field errors: `400 VALIDATION_FAILED` with `fields: { "<field>": "<CODE>" }`; codes `REQUIRED`, `TOO_LONG`, `INVALID`, `OUT_OF_RANGE`.
- Every `/api/v1/settings/**` endpoint needs a session (`401 UNAUTHENTICATED`) **and** role `super_admin` (`403 FORBIDDEN` otherwise, BR-ALL-1). The check is one middleware on the route group plus the service layer.
- **Optimistic concurrency:** every editable item returns `updatedAt` and `updatedBy`. `PATCH` bodies send back the `updatedAt` they were based on; a mismatch → `409 VERSION_CONFLICT`. The FE then re-fetches and shows "ข้อมูลนี้ถูกแก้โดย {updatedBy.name} เมื่อ {updatedAt}" from the fresh item. Order and matrix saves use a version the same way.
- **Audit:** every write in this contract appends a row to `platform.audit_log` in the same transaction (F30). Nothing here deletes audit rows.
- **Data owners** (who stores what; the `settings` module has no tables of its own):

| Data | Schema / package | `settings` reaches it through |
|---|---|---|
| roles, role permissions, user roles, users, audit log | `platform` · `internal/platform/{roles,users,audit}` | platform services |
| buildings, floors, rooms, floor plans | `platform` (moved from `repair`, see `03-plan.md` Stage 4) · `internal/platform/locations` | platform service |
| categories, symptoms, contractor types; floor / category usage | `repair` · `internal/modules/repair` | repair's `SettingsAdmin` service interface, wired in `cmd/api/main.go` |

## Permission keys

Defined in code (BR-F29-1). Each module registers its own list; platform aggregates them. Seed copy and defaults: `01-users.md` → Permission catalog; card / column labels: `ui/screens/S24-roles-permissions.md`.

`repair.ticket.view_all` · `repair.ticket.work` · `repair.ticket.set_priority` · `repair.ticket.close_any` · `repair.ticket.team_handle` · `repair.ticket.handover_any` · `repair.contractor.manage` · `repair.overview.view`

`settings.manage` is a pseudo permission: only `super_admin` has it, it never appears in the matrix, and the FE uses it to show the settings menu.

## Endpoints

| # | Method | Path | Purpose | Stage |
|---|---|---|---|---|
| P1 | GET | `/api/v1/me` | **changed:** + `roleName`, `permissions` | 1 |
| P2 | GET | `/api/v1/dev/demo-users` | **changed:** one per active role, + `roleName` | 1 |
| P3 | POST | `/api/v1/dev/role-switch` | **changed:** any active role key; demo user created on demand | 1 |
| 1 | GET | `/api/v1/settings/summary` | counts for S19 | 1 |
| 2 | GET | `/api/v1/settings/roles` | roles with user counts | 2 |
| 3 | POST | `/api/v1/settings/roles` | add a role (optionally copy permissions) | 2 |
| 4 | PATCH | `/api/v1/settings/roles/{id}` | rename / describe | 2 |
| 5 | DELETE | `/api/v1/settings/roles/{id}` | delete a role with no users | 2 |
| 6 | GET | `/api/v1/settings/permissions` | the matrix | 2 |
| 7 | PUT | `/api/v1/settings/permissions` | save matrix changes | 2 |
| 8 | GET | `/api/v1/settings/users` | search users | 3 |
| 9 | GET | `/api/v1/settings/users/{id}` | user + role history | 3 |
| 10 | PUT | `/api/v1/settings/users/{id}/role` | change role | 3 |
| 11 | GET | `/api/v1/settings/audit` | audit entries | 3 |
| 12 | GET | `/api/v1/settings/audit/actors` | people who appear as actors (filter) | 3 |
| 13 | GET | `/api/v1/settings/buildings` | buildings | 4 |
| 14 | POST | `/api/v1/settings/buildings` | add building | 4 |
| 15 | PATCH | `/api/v1/settings/buildings/{id}` | rename / (de)activate | 4 |
| 16 | DELETE | `/api/v1/settings/buildings/{id}` | delete unused building | 4 |
| 17 | PUT | `/api/v1/settings/buildings/order` | reorder buildings | 4 |
| 18 | GET | `/api/v1/settings/buildings/{id}/floors` | floors, top first | 4 |
| 19 | POST | `/api/v1/settings/buildings/{id}/floors` | add a floor at a position | 4 |
| 20 | POST | `/api/v1/settings/buildings/{id}/floors/bulk` | add N floors | 4 |
| 21 | PUT | `/api/v1/settings/buildings/{id}/floors/order` | reorder floors | 4 |
| 22 | GET | `/api/v1/settings/floors/{id}` | one floor (S21 header + plan) | 4 |
| 23 | PATCH | `/api/v1/settings/floors/{id}` | rename / (de)activate | 4 |
| 24 | DELETE | `/api/v1/settings/floors/{id}` | delete unused floor | 4 |
| 25 | GET | `/api/v1/settings/floors/{id}/rooms` | rooms of a floor | 4 |
| 26 | POST | `/api/v1/settings/floors/{id}/rooms` | add room | 4 |
| 27 | PATCH | `/api/v1/settings/rooms/{id}` | rename / (de)activate | 4 |
| 28 | DELETE | `/api/v1/settings/rooms/{id}` | delete unused room | 4 |
| 29 | PUT | `/api/v1/settings/floors/{id}/rooms/order` | reorder rooms | 4 |
| 30 | PUT | `/api/v1/settings/floors/{id}/plan` | upload / replace floor plan | 4 |
| 31 | DELETE | `/api/v1/settings/floors/{id}/plan` | remove floor plan | 4 |
| P8 | GET | `/api/v1/floor-plans/{floorId}` | floor plan image (platform, any logged-in user; S21, repair S12) | 4 |
| 32 | GET | `/api/v1/settings/categories` | categories | 5 |
| 33 | POST | `/api/v1/settings/categories` | add category | 5 |
| 34 | PATCH | `/api/v1/settings/categories/{id}` | edit / (de)activate | 5 |
| 35 | DELETE | `/api/v1/settings/categories/{id}` | delete unused category | 5 |
| 36 | PUT | `/api/v1/settings/categories/order` | reorder categories | 5 |
| 37 | GET | `/api/v1/settings/categories/{id}/symptoms` | symptoms of a category | 5 |
| 38 | POST | `/api/v1/settings/categories/{id}/symptoms` | add symptom | 5 |
| 39 | PATCH | `/api/v1/settings/symptoms/{id}` | edit / (de)activate | 5 |
| 40 | DELETE | `/api/v1/settings/symptoms/{id}` | delete unused symptom | 5 |
| 41 | PUT | `/api/v1/settings/categories/{id}/symptoms/order` | reorder symptoms | 5 |
| 42 | GET | `/api/v1/settings/contractor-types` | contractor types | 5 |
| 43 | POST | `/api/v1/settings/contractor-types` | add type | 5 |
| 44 | PATCH | `/api/v1/settings/contractor-types/{id}` | rename / (de)activate | 5 |
| 45 | DELETE | `/api/v1/settings/contractor-types/{id}` | delete unused type | 5 |

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
                  "repair.ticket.team_handle", "repair.ticket.handover_any", "repair.contractor.manage", "repair.overview.view", "settings.manage"],
  "technicianCategories": [], "isDemoUser": false, "environment": "UAT"
} }
```
`role` is now any role key (string, not an enum). `permissions` excludes the always-on base permissions. The FE builds menus and actions from `permissions`; the backend re-checks every request.

### P2 GET /api/v1/dev/demo-users (changed)
```json
{ "data": [ { "role": "employee", "roleName": "พนักงานทั่วไป", "name": "วรรณา สุขประเสริฐ" },
            { "role": "r_7c21a9f0", "roleName": "หัวหน้าช่าง", "name": "ผู้ใช้ตัวอย่าง หัวหน้าช่าง" },
            { "role": "super_admin", "roleName": "Superadmin", "name": "ณัฐพล อินทรวงศ์" } ] }
```
One row per role in role order. Roles without a demo user yet show the generated name; the user row is created on the first switch.

### P3 POST /api/v1/dev/role-switch (changed)
Request `{ "role": "r_7c21a9f0" }` → 200 `{ "data": <P1> }`. Errors: 400 `VALIDATION_FAILED` (`role: INVALID` — unknown key).

### 1. GET /api/v1/settings/summary
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
`copyFromRoleId` optional (`null` = base permissions only). 201 `{ "data": <Role> }`. Errors: 400 `VALIDATION_FAILED` (`name: REQUIRED|TOO_LONG` (50), `description: TOO_LONG` (200), `copyFromRoleId: INVALID`), 409 `NAME_TAKEN`. Copying from `super_admin` copies every matrix permission (never `settings.manage`).

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

### 7. PUT /api/v1/settings/permissions
```json
{ "version": 12, "changes": [ { "roleId": "0d3f…", "permission": "repair.ticket.set_priority", "granted": true } ] }
```
200 → the new matrix (#6) with `version` + 1. One audit row per changed role (`permissions_change`, `{ added: [labels], removed: [labels] }`). Errors: 400 `VALIDATION_FAILED` (`changes: REQUIRED` when empty), 400 `UNKNOWN_PERMISSION`, 404 `ROLE_NOT_FOUND`, 409 `VERSION_CONFLICT`, 422 `SYSTEM_ROLE` (a change for `super_admin`).

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
- `entityType`: `building` · `floor` · `room` · `category` · `symptom` · `contractor_type` · `role` · `user`
- `changes` by action: `update` → `{field, before, after}` per field (`name`, `icon`, `description`); `role_change` → `[{ "field": "role", "before": "พนักงานทั่วไป", "after": "ช่างเทคนิค" }]`; `permissions_change` → `[{ "field": "permissions", "added": ["ปรับความเร่งด่วน"], "removed": [] }]`; `floor_plan_*` → `[{ "field": "file", "after": "ผังชั้น5.png" }]`; others `[]`.
- Names are stored at write time, so deleted items still read correctly; `exists` tells the FE whether to link.

### 11. GET /api/v1/settings/audit?type=&actorId=&from=&to=&q=&page=&pageSize=50
`type`: `master` (building … contractor_type) · `permissions` (role) · `users` (user) · empty = all. `from` / `to`: RFC 3339. `q` matches `entityName` / `parentName`. Newest first. → `{ "data": [ <AuditEntry> ], "meta": {…} }`.

### 12. GET /api/v1/settings/audit/actors → `{ "data": [ <PersonRef> ] }` (everyone with a settings audit row, by name).

---

## Stage 4 — buildings, floors, rooms, floor plans (F26)

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

---

## Stage 5 — categories, symptoms, contractor types (F27, F28)

### `Category`
`<MasterItem>` + `{ "icon": "snowflake", "sortOrder": 1, "symptomCount": 5, "activeSymptomCount": 5 }`. `icon` ∈ `wrench, snowflake, lightbulb, zap, plug, droplets, shower-head, armchair, door-open, sparkles, trash-2, hammer` (S22).

### 32. GET /api/v1/settings/categories → all, in order.
### 33. POST /api/v1/settings/categories
`{ "name": "ระบบปรับอากาศ", "icon": "snowflake" }` → 201. Errors: 400 (`name` REQUIRED / TOO_LONG 100, `icon: INVALID`), 409 `NAME_TAKEN`.
### 34. PATCH /api/v1/settings/categories/{id} — `MasterItem` PATCH + optional `icon`. `CATEGORY_NOT_FOUND`.
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
| 14 `POST /repair/contractor-types` | a name matching an inactive type re-activates it; writes an audit row | 5 |
| 27 `GET /repair/admin/overview` (not built yet) | + `hasFloorPlan` per floor; inactive floors listed while they have open tickets | 4 (contract) / repair Stage 7 (build) |

## Error codes (module-wide)

| code | Status | Meaning | Thai message (shown in UI) |
|---|---|---|---|
| `UNAUTHENTICATED` | 401 | no / expired session | (redirect to S01 `?reason=expired`) |
| `FORBIDDEN` | 403 | not `super_admin` | Forbidden state: คุณไม่มีสิทธิ์เข้าหน้านี้ · หน้านี้สำหรับ Superadmin เท่านั้น |
| `VALIDATION_FAILED` | 400 | field errors | per field (`_common.md` §6, screen specs) |
| `NAME_TAKEN` | 409 | duplicate name in its scope | ชื่อนี้มีอยู่แล้ว |
| `VERSION_CONFLICT` | 409 | changed by someone else | ข้อมูลนี้ถูกแก้โดย {ชื่อ} เมื่อ {เวลา} (S24: สิทธิ์ถูกแก้โดย…) |
| `IN_USE` | 409 | delete of a referenced item | ลบไม่ได้ เพราะเคยถูกใช้แล้ว ปิดใช้งานแทน |
| `ROLE_IN_USE` | 409 | delete role with users | dialog "ลบ role นี้ไม่ได้" (S24) |
| `SYSTEM_ROLE` | 422 | delete / edit a system role | ทำรายการไม่สำเร็จ ลองอีกครั้ง (UI never offers it) |
| `UNKNOWN_PERMISSION` | 400 | permission key not in the catalog | ทำรายการไม่สำเร็จ ลองอีกครั้ง |
| `CANNOT_CHANGE_SELF` | 422 | change own role | เปลี่ยน role ของตัวเองไม่ได้ |
| `ROLE_LOCKED` | 422 | env-defined Superadmin | role นี้กำหนดโดยระบบ (ตั้งค่าใน server) |
| `INVALID_FILE` / `FILE_TOO_LARGE` | 400 | floor plan type / size | รองรับ JPG, PNG ไม่เกิน 10 MB |
| `ROLE_NOT_FOUND` | 404 / 422 | | S25: role นี้ถูกลบไปแล้ว เลือกใหม่ · others: not-found state |
| `USER_NOT_FOUND` | 404 | | ไม่พบผู้ใช้นี้ |
| `BUILDING_NOT_FOUND` | 404 | | ไม่พบอาคารนี้ |
| `FLOOR_NOT_FOUND` / `FLOOR_PLAN_NOT_FOUND` | 404 | | ไม่พบชั้นนี้ |
| `ROOM_NOT_FOUND` | 404 | | (refetch the list) |
| `CATEGORY_NOT_FOUND` | 404 | | ไม่พบหมวดงานนี้ |
| `SYMPTOM_NOT_FOUND` / `CONTRACTOR_TYPE_NOT_FOUND` | 404 | | (refetch the list) |
| any other / network | 5xx | | ทำรายการไม่สำเร็จ ลองอีกครั้ง |
