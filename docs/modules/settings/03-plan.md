# ตั้งค่าระบบ (Superadmin) — Build plan

Status: DRAFT

<!-- Written by Claude in /stage-plan settings (2026-10-16). Stages are vertical slices that can be demoed.
     Each stage should fit in one focused session (Claude part + Codex part).
     Endpoints: 04-api-contract.md. Repair-side changes: ../repair/changes/CR-007.md (built inside these stages). -->

## Stages

| Stage | Goal (demoable) | Flows | Screens | Status |
|---|---|---|---|---|
| 1 | role เป็นข้อมูลในฐานข้อมูล ทุกระบบเช็คสิทธิ์แทนชื่อ role (ผลเหมือนเดิมทุก role) และ Superadmin จาก env เห็นเมนู "ตั้งค่าระบบ" | F25, F29 (data only) | S19, nav | pending |
| 2 | Superadmin ติ๊กสิทธิ์ใน matrix แล้วผู้ใช้ role นั้นได้/เสียสิทธิ์ทันที; เพิ่ม แก้ ลบ role ได้ | F29 | S24 | pending |
| 3 | ค้นหาผู้ใช้และเปลี่ยน role ได้; ดูประวัติการเปลี่ยนแปลงทั้งหมด | F15, F30 | S25, S26 | pending |
| 4 | ตั้งค่าอาคาร ชั้น ห้อง และรูปผังชั้นได้ ฟอร์มแจ้งซ่อมใช้ข้อมูลใหม่ทันที | F26 | S20, S21 | pending |
| 5 | ตั้งค่าหมวดงาน อาการ และประเภทผู้รับเหมาได้ | F27, F28 | S22, S23 | pending |
| 6 | edge cases, สิทธิ์ทุก role, มือถือ, a11y และความพร้อม UAT | all | all | pending |

Order rationale: everything depends on permission checks (1). The matrix is the user's main ask (2). Changing a person's role is the most frequent job (3) and the audit screen needs Stage 2–3 events. Buildings (4) move tables out of `repair`, so they come after the permission refactor is stable. Categories and contractor types (5) reuse the Stage 4 list pattern. 6 hardens.

## Decisions taken in this plan (DECISIONS.md D-048–D-051)

- D-048: buildings, floors, rooms and floor plans become shared data in `platform` (`ALTER TABLE … SET SCHEMA`, ids kept); categories, symptoms and contractor types stay in `repair`. The `settings` module has no schema: it orchestrates platform services and repair's `SettingsAdmin` service interface (wired in `cmd/api/main.go`).
- D-049: permissions are loaded per request from `platform.role_permissions` (one indexed query, no cache) so changes apply on the next request (BR-F29-7). Modules register their permission keys with Thai labels in Go; `settings.manage` is a pseudo permission of `super_admin`.
- D-050: menu rules without extra permissions: "งานช่าง → งานซ่อม" and the technician bottom-nav slot need `repair.ticket.work`; "งานช่าง → ช่างภายนอก" needs `repair.contractor.manage`; the group "จัดการงานซ่อม" shows when the user has any of `set_priority`, `close_any`, `handover_any`, `overview.view` — its "งานทั้งหมด" and "ช่างภายนอก" items need `view_all`, "ภาพรวมอาคาร" needs `overview.view`. This reproduces today's menus for the six seeded roles.
- D-051: optimistic concurrency by `updatedAt` (items) / `version` (matrix, order) → `409 VERSION_CONFLICT`; floor plans are stored unresized next to photos (`PHOTO_STORAGE_DIR/floor-plans/`), served by `GET /api/v1/floor-plans/{floorId}` to any logged-in user.

---

## Stage 1 — role เป็นข้อมูล + เช็คสิทธิ์ + เมนูตั้งค่าระบบ

**Scope**
- Flows: F25; F29 data model only (no S24 yet)
- Screens: S19, sidebar group "ตั้งค่าระบบ", profile row (`ui/screens/_common.md` §2), forbidden state
- Endpoints: P1–P3 (changed), #1
- Repair CR-007 part A (permission checks, identical behaviour)
- Out of this stage: editing roles / matrix (2), users (3), master data (4–5)

**Backend (Claude)**
- [ ] Migration `…_platform_roles.sql`: `platform.roles` (id, key unique, name, description, is_system, is_locked, sort_order, created_by_id, updated_by_id, timestamps; seed 7 roles with UUIDv5 ids), `platform.role_permissions` (role_id, permission, PK both; seed `01-users.md` defaults), `platform.permission_matrix` (single row: version, updated_by_id, updated_at), `platform.user_roles.role_id` (backfill from `role`, then drop `role` + CHECK), index `audit_log (created_at DESC)`; Down restores the text column
- [ ] `internal/platform/permissions`: registry (module → groups → keys, label, description), base permissions doc, `settings.manage`; repair registers its 8 keys
- [ ] `internal/platform/roles`: repository + service (role of user, permissions of role, list with user counts)
- [ ] Auth middleware loads `role` + `permissions` per request into the request context; `Viewer.Can(key)`; `RequireSuperAdmin` middleware for `/api/v1/settings`
- [ ] Config `SUPER_ADMIN_EMPLOYEE_CODES` (config.go, `.env.example`, architecture.md env table): upsert `super_admin` at API start and at login; `IsEnvSuperAdmin(code)`
- [ ] `/me`: `role` (key), `roleName`, `permissions`; P2 one row per role; P3 any active role key, demo user created on demand (`ผู้ใช้ตัวอย่าง {roleName}`)
- [ ] Repair (CR-007 A): `rules.go` / `service.go` use `Viewer.Can` (view_all, work, contractor.manage, team_handle, …); error codes unchanged
- [ ] `internal/modules/settings`: routes, controller, service; #1 summary (counts via platform + repair interface); audit helper (`platform/audit.Write(ctx, tx, entry)`)
- [ ] Tests: table test "default matrix = old role behaviour" for every repair action × 6 roles; middleware 401/403; env bootstrap; `/me` permissions; Postgres integration for the migration backfill (CI)

**Frontend contract (Claude)**
- [ ] `lib/platform/types.ts` (`Me.role: string`, `roleName`, `permissions`; `DemoUser.roleName`), `lib/platform/permissions.ts` (`can(me, key)`, key constants), mocks per role incl. `super_admin`
- [ ] Shared shell (Claude, shared code): sidebar groups by permission (D-050) + "ตั้งค่าระบบ" group; bottom-nav technician slot by `repair.ticket.work`; role label from `roleName` (sidebar, profile, role switcher); profile row "ตั้งค่าระบบ"
- [ ] Repair FE (CR-007 A): `ticket-detail`, `contractors`, `technician-work`, `profile` use `can()`
- [ ] `modules/settings/{types,mocks,api}.ts` for #1; `ui/HANDOFF.md` → `READY FOR CODEX — Stage 1`

**Frontend UI (Codex)**
- [ ] S19 `/settings` (+ `app/(app)/settings/layout.tsx` with the super_admin guard → forbidden state)

**Wiring + e2e (Claude)**
- [ ] Real API; `e2e/settings/F25-settings-entry.spec.ts` (super_admin sees menu + S19; employee → forbidden; API 403)
- [ ] Existing repair e2e still green with the new `/me`

**Acceptance criteria**
- [ ] AC1: With `SUPER_ADMIN_EMPLOYEE_CODES` set to my code, after SSO login `/me` returns `role: super_admin` and the sidebar shows "ตั้งค่าระบบ"; S19 shows the counts (2 อาคาร · 9 ชั้น, 5 หมวด · 20 อาการ, …)
- [ ] AC2: Every other role: no settings menu, `/settings` shows "คุณไม่มีสิทธิ์เข้าหน้านี้", `GET /api/v1/settings/summary` → 403
- [ ] AC3: Regression — repair Stage 1–2 demo script behaves exactly as before for พนักงาน, ช่างเทคนิค, Admin, ผู้บริหาร (menus, tabs, buttons, 403s)
- [ ] AC4: Deleting the row (`technician`, `repair.contractor.manage`) in the DB → on the next request the technician gets 403 on "เพิ่มช่างภายนอก" and, after reload, the button is gone; re-inserting restores it
- [ ] AC5: Role switcher lists 7 roles incl. Superadmin and switches correctly
- [ ] AC6: `go vet`, `go test ./...`, `tsc`, `eslint`, `next build` pass

**Demo script**
1. Set `SUPER_ADMIN_EMPLOYEE_CODES=<your code>`, restart the API, log in → sidebar "ตั้งค่าระบบ" → S19
2. Role switcher → ช่างเทคนิค → งานซ่อม, ประเมินงาน work as before; → พนักงาน → `/settings` = forbidden
3. psql: delete the technician's `repair.contractor.manage` row → ช่างเทคนิค reloads S18 → no edit button

---

## Stage 2 — Role และสิทธิ์ (S24)

**Scope**
- Flows: F29 · Screens: S24 (both tabs, dialogs, mobile) · Endpoints: #2–#7
- Out of this stage: user role changes (3)

**Backend (Claude)**
- [ ] Roles CRUD (#2–#5): name unique (case-insensitive), copy-from, system / locked rules, delete only with 0 real users (demo users of that role deleted with it)
- [ ] Matrix (#6, #7): catalog + roles + version; diff apply in one transaction with `SELECT … FOR UPDATE` on `permission_matrix`; unknown key / locked role errors; audit `permissions_change` per role with Thai labels
- [ ] Audit rows for role create / update / delete
- [ ] Tests: service rules (system roles, in-use, version conflict, copy-from), controller error mapping

**Frontend contract (Claude)**
- [ ] Types / mocks / api for #2–#7 (mock matrix = defaults); `components/ui/checkbox`, `switch`, `dropdown-menu` via shadcn; HANDOFF → Stage 2

**Frontend UI (Codex)**
- [ ] S24 `/settings/roles` — follow `ui/mockups/S24-roles-permissions.html`

**Wiring + e2e (Claude)**
- [ ] `e2e/settings/F29-roles-matrix.spec.ts`: grant `repair.ticket.view_all` to พนักงานทั่วไป → the employee's `GET /api/v1/repair/tickets?scope=all` returns 200 on the next request; revoke → 403

**Acceptance criteria**
- [ ] AC1: S24 shows three cards under ระบบแจ้งซ่อม with the default ticks from `01-users.md`; Superadmin row ticked and disabled
- [ ] AC2: Untick ช่างเทคนิค → จัดการช่างภายนอก, save → dialog lists "ช่างเทคนิค (1 คน) — ถอด: จัดการช่างภายนอก" → after save the technician (role switcher) cannot add contractors without logging out
- [ ] AC3: Add role "หัวหน้าช่าง" copied from ช่างเทคนิค → new row highlighted with the same ticks; it appears in the role switcher
- [ ] AC4: Delete Admin → "ลบ role นี้ไม่ได้ · มีผู้ใช้ 2 คน…"; delete หัวหน้าช่าง (0 users) works
- [ ] AC5: Two browser tabs: save in tab A, then save in tab B → B shows "สิทธิ์ถูกแก้โดย…" and keeps its changes after "โหลดข้อมูลล่าสุด"
- [ ] AC6: Leaving with unsaved changes asks first; mobile shows per-role switches with the save bar

**Demo script**
1. Superadmin → Role และสิทธิ์ → untick ช่างเทคนิค / จัดการช่างภายนอก → บันทึก
2. Switch to ช่างเทคนิค → ช่างภายนอก has no "เพิ่มช่างภายนอก"
3. Back as Superadmin → เพิ่ม role "หัวหน้าช่าง" (คัดลอกจาก Admin) → tick ประเมินและบันทึกผล → บันทึก → switch to หัวหน้าช่าง → sees งานซ่อม and งานทั้งหมด

---

## Stage 3 — ผู้ใช้และประวัติการเปลี่ยนแปลง (S25, S26)

**Scope**
- Flows: F15, F30 · Screens: S25, S26 · Endpoints: #8–#12

**Backend (Claude)**
- [ ] Users search (#8: name TH/EN, code, email; Thai collation sort; demo users excluded), detail with role history (#9), role change (#10: self, env-locked, same-role no-op, audit `role_change`)
- [ ] Audit list (#11: type / actor / date range / q filters, 50 per page) and actors (#12); `AuditEntry` mapping from `platform.audit_log.data`
- [ ] Tests: role change rules, audit filters, PDPA (no full profile in `data`)

**Frontend contract (Claude)**
- [ ] Types / mocks / api for #8–#12; HANDOFF → Stage 3

**Frontend UI (Codex)**
- [ ] S25 `/settings/users` — `ui/mockups/S25-users.html`
- [ ] S26 `/settings/audit` — spec only (table pattern of S25)

**Wiring + e2e (Claude)**
- [ ] `e2e/settings/F15-change-role.spec.ts`, `F30-audit.spec.ts`

**Acceptance criteria**
- [ ] AC1: Search "EMP0231" or "ธนากร" finds the technician; filter Role: Admin shows 2 people
- [ ] AC2: Change วรรณา from พนักงานทั่วไป to หัวหน้าแม่บ้าน → toast; her next request has `repair.ticket.team_handle`; the sheet history shows the change with my name
- [ ] AC3: My own row and env-defined Superadmins show "เปลี่ยน role" disabled with the reason; the API returns `CANNOT_CHANGE_SELF` / `ROLE_LOCKED`
- [ ] AC4: Picking Superadmin shows the extra warning
- [ ] AC5: S26 lists the Stage 2 matrix change and the AC2 role change with before → after; filters combine and live in the URL

---

## Stage 4 — อาคาร ชั้น ห้อง และผังชั้น (S20, S21)

**Scope**
- Flows: F26 · Screens: S20, S21 · Endpoints: #13–#31, P8; repair CR-007 part B (buildings from platform, S12 contract note)

**Backend (Claude)**
- [ ] Migration `…_platform_locations.sql`: `ALTER TABLE repair.buildings SET SCHEMA platform`, same for `floors` (FKs from `repair.tickets` keep working); add `updated_by_id`, `sort_order` where missing; `platform.rooms` (floor_id, name, sort_order, is_active, updated_by_id); floor plan columns on `platform.floors` (`plan_path`, `plan_file_name`, `plan_size`, `plan_updated_at`, `plan_updated_by_id`); unique (building_id, lower(name)) for floors, (floor_id, lower(name)) for rooms; Down moves them back
- [ ] `internal/platform/locations`: repository (own sqlc queries) + service: CRUD, order with version, bulk floors, level rewrite, floor plan store (`PHOTO_STORAGE_DIR/floor-plans/{floorId}/…`, JPEG / PNG ≤ 10 MB, no resize)
- [ ] Repair: sqlc queries join `platform.floors` / `platform.buildings`; #2 reads through `locations`; implements `FloorUsage` (`inUse`, `openTicketCount`) for the `SettingsAdmin` interface
- [ ] Settings endpoints #13–#31 (+ audit rows, `IN_USE` via repair usage), P8 file route in platform
- [ ] Tests: level rewrite / insert below, bulk names, order version, delete in-use, plan type / size, migration up/down (CI)

**Frontend contract (Claude)**
- [ ] Types / mocks / api for #13–#31; `MasterList` module component skeleton props documented in HANDOFF; HANDOFF → Stage 4

**Frontend UI (Codex)**
- [ ] S20 `/settings/buildings[/[buildingId]]`, S21 `/settings/buildings/[buildingId]/floors/[floorId]` — `ui/mockups/S20-buildings.html`

**Wiring + e2e (Claude)**
- [ ] `e2e/settings/F26-buildings.spec.ts`: add building + 3 floors (bulk) → appears in S03 อาคาร / ชั้น; deactivate a floor → gone from S03

**Acceptance criteria**
- [ ] AC1: เพิ่มหลายชั้น 7 on a new building creates ชั้น 1–7, listed top first; dragging ชั้น 7 under ชั้น 6 persists after reload
- [ ] AC2: The repair form (S03) shows the new building and floors immediately; a deactivated floor disappears from S03 but old tickets still show "อาคารหลัก ชั้น 3"
- [ ] AC3: Delete is disabled for a floor that has tickets ("เคยถูกใช้แล้ว ปิดใช้งานแทน"); the deactivate dialog shows "มีงานที่ยังไม่ปิด {n} งาน" when there are open tickets
- [ ] AC4: Upload a 1.2 MB PNG floor plan to ชั้น 5 → preview, meta line, lightbox; a 12 MB file or a PDF shows "รองรับ JPG, PNG ไม่เกิน 10 MB" and keeps the old plan
- [ ] AC5: Rooms add / rename / reorder / deactivate / delete on S21
- [ ] AC6: Existing repair tickets, S06/S07 locations and repair tests are unchanged after the schema move

---

## Stage 5 — หมวดงาน อาการ และประเภทผู้รับเหมา (S22, S23)

**Scope**
- Flows: F27, F28 · Screens: S22, S23 · Endpoints: #32–#45; repair CR-007 part C (#14 re-activates an inactive type + audit)

**Backend (Claude)**
- [ ] Repair `SettingsAdmin` implementation: categories / symptoms CRUD + order (+ `updated_by_id` columns migration), contractor types admin (count, created by, technician flag), usage (`inUse`)
- [ ] Settings endpoints #32–#45 with audit rows; repair #14 change
- [ ] Tests: last-active-symptom rule data (`activeSymptomCount`), in-use deletes, case-insensitive names

**Frontend contract (Claude)**
- [ ] Types / mocks / api for #32–#45; shared category icon map `components/shared/category-icon.ts` used by S03 and S22 (shared code); HANDOFF → Stage 5

**Frontend UI (Codex)**
- [ ] S22 `/settings/categories[/[categoryId]]` (S20 pattern), S23 `/settings/contractor-types`

**Acceptance criteria**
- [ ] AC1: New category "ลิฟต์และบันไดเลื่อน" (icon `door-open`) with 2 symptoms appears in S03 in the set order
- [ ] AC2: Deactivating the last active symptom warns "หมวดนี้จะไม่แสดงในฟอร์มแจ้งซ่อม"; S03 hides the category
- [ ] AC3: Contractor types show counts and "สร้างโดยช่าง"; deactivate "แอร์" → the technician's S17 picker no longer offers it; typing "แอร์" there re-activates it (audit row by the technician)
- [ ] AC4: Delete is refused for used items with the shared message

---

## Stage 6 — edge cases, สิทธิ์ทุก role, มือถือ, UAT

**Scope**
- All flows / screens; e2e for every BR; mobile pass at 375px; a11y (keyboard matrix, labels); docs

**Tasks**
- [ ] e2e: forbidden for each non-super_admin role on every settings route + API sample; VERSION_CONFLICT for item, order, matrix; leave-unsaved guard; role deleted while S25 dialog open (`ROLE_NOT_FOUND`)
- [ ] Mobile review of S19–S26 against the specs; keyboard-only run through S24 and S20
- [ ] `docs/shared/architecture.md` Roles section rewritten (roles as data, permissions, `super_admin`, env); `PROJECT.md` row; seed notes for UAT (first Superadmin code per environment)
- [ ] Performance check: `/me` + permission load stays one query; audit list with 10k rows < 300 ms (index)

**Acceptance criteria**
- [ ] AC1: Playwright suite for settings green in CI
- [ ] AC2: Every screen shows loading / empty / error / forbidden states with the exact copy
- [ ] AC3: UAT checklist written in `PROGRESS.md` (env codes, sample data, who tests what)

---

## Open questions

- First Superadmin employee code(s) per environment — before UAT (Stage 6)
- Room booking will add usage for rooms and its own permission group — revisit `inUse` for rooms then
