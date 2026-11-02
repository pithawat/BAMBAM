# Settings — Progress

<!-- The module's memory. Agents update it at the end of every task. Keep under ~60 lines. -->

**Phase:** P5 Build   **Stage:** R1 accepted — next R2 (CR-006; Stages 1–6 + 4P accepted)   **Updated:** 2026-11-01

## Now

- Stage R1 accepted 2026-11-01 (tag `settings-stage-R1`). Nothing in progress; next is R2.
- 2026-11-01 CR-007 APPROVED (mirror of repair CR-036, D-140): new S30 พิมพ์ป้าย QR, S20 print actions / label badge / code lock, #56 / #57 — built in **repair Stage 5B**, not a settings stage. R2 and repair 5B both touch S20: the later one keeps the other's changes.

## Next

- `/clear`, then `/build-stage settings R2 prepare` (owner picks Codex or Claude as the UI builder at prepare). R2 keeps the page frame (breadcrumb, intro, sub-menu card) and the restyle of S20 / S22–S26 + S26 pagination; the navbar and the S24 table are already done (D-134).
- Owner: migrate the dev DB (Claude cannot read `backend/.env`): repair CR-030 / CR-031 + `20261030000002_settings_cr006_permissions`; if permissions were edited there before, `reset-role-permissions.sql` (scratchpad of the R1 session) restores the seed defaults.
- Before UAT: fill the env codes in the UAT checklist; optional `/atlas tour settings <flow>`.

## UAT checklist

- Environment: set `SUPER_ADMIN_EMPLOYEE_CODES` per environment (comma-separated employee codes) **before the first login** — dev / test: `EMP0105` is the sample; UAT / prod: owner to give the codes.
- Sample data (migrations): 6 roles, อาคาร 1 (6 floors) + พื้นที่ภายนอกอาคาร, 4 asset types, 6 categories (incl. อื่น ๆ). Users appear after their first SSO login.
- Who tests what: Superadmin — S24 matrix + add / delete Role, S25 change a person's Role, S26 history, S23 types; Admin — S20 rename room / add asset / inline type, S22 category + symptom, (CR-006) every settings page by default but never own role / Superadmin; ช่างเทคนิค — assess sheet type picker (deactivated type gone, typing re-activates), (CR-006) no แจ้งซ่อม / bookings; พนักงาน — Forbidden on every settings URL.
- Dev / UAT only: the role switcher lists custom Roles (demo user created on first switch).

## Open issues / questions
- **R1 — owner decision needed:** with G3 and the seeded defaults, Admin lacks `work`, `team_handle`, `contractor.manage`, so Admin can assign only พนักงานทั่วไป / Admin (not ช่างเทคนิค, หัวหน้าแม่บ้าน, หัวหน้ารปภ., custom roles) and cannot tick those three keys. Built as approved; options: keep (Superadmin assigns those), give Admin those keys by default, or relax G3 for assigning seeded roles.
- R1: a new role made with "สิทธิ์พื้นฐานเท่านั้น" cannot report (reporting left the base rights); the migration gave report to every existing role except technician, custom ones included.
- R1: copy written by Claude — owner to confirm: Home no-report CTA, S25 READ_ONLY / SUPER_ADMIN reasons, report / booking Forbidden reasons, S06 empty "ยังไม่มีงานที่คุณติดตาม", and (D-133) the new S24 info strip + copy-from hint.
- D-134: group name "งานทีม ช่างภายนอก และภาพรวมอาคาร" chosen by Claude — owner to confirm; dropdown sub-menu labels follow `_common.md` §2 (ผู้ใช้งาน / บทบาทและสิทธิ์) while page headings stay ผู้ใช้ / Role และสิทธิ์ until R2.
- R1: Home without any repair key (e.g. a พนักงาน role with แจ้งซ่อม unticked) shows no repair service and no "งานของฉัน" entry, though CR-006 keeps "งานของฉัน" a base right — confirm whether a ไปที่งานซ่อม → `/repair/my` link should stay.
- R1: QR prefill (F13-B) has no endpoint yet — repair Stage 5 checks `repair.ticket.report`.
- CR-006: `App.tsx` / `index.css` at the repo root are the owner's originals (untracked); a copy lives in `ui/mockups/CR-006-design/` — owner to decide whether the root copies can be removed.
- CR-006 R1: `car_booking.use` / `room_booking.use` are declared by platform until those modules exist; their detailed permissions come with each module's discovery.
- CR-006 R2: the design has no phone layout; `_common.md` §2 CR-006 block proposes navbar sheet → group → sub-menus — confirm at R2 review.
- Stage 4P e2e: the reused e2e dev server on :3100 crashes on direct loads of `/settings/categories/[id]` ("Jest worker … child process exceptions") — also without the 4P changes; F26-building-types AC4 + F27 AC4 fail there until that server is restarted. F29 AC2 / repair F02 AC7 flaky under full-suite load (pass alone).
- Stage 4P: e2e AC3 switches the mock warehouse's type for a few seconds; repair F02 (warehouse hides ระบบปรับอากาศ) running in parallel could see it.
- Stage 4P: #54 is two writes (platform type, then repair links) — not one transaction; categoryIds are checked first, so only a DB failure between them leaves a type with no categories (fixable in S22).
- Stage 4P: replacing a category's types keeps its links to inactive types (they come back if the type is re-activated).

- Stage 2: deleting a role deletes its demo users, except a demo user that tickets / photos still reference (repair FKs); that one only loses the role (becomes employee). Contract says "deleted with it" — fine for dev/UAT, confirm at wire.
- Stage 2: role audit rows store `data = { entityName, changes }` (AuditEntry shape) for Stage 3 S26; actor = the session user (demo user when role-switched).

- FE executive copy / bell / toasts stay for repair 4R (e2e executive blocks already removed in Stage 1 wire).
- e2e F06 (mobile) can race with desktop: both projects share the demo employee, so another "รอตรวจรับ" ticket may sort first. Flaky under full-suite load; per-project demo users would fix it (repair test-stack item).
- Next 16.4.0 prints a security-advisory notice and stops `next dev` / `next build` once (retry continues) — upgrade decision for the owner.
- `DEMO-EXECUTIVE` user row kept as an employee demo (may own sample tickets); 4R may delete it if unreferenced (D-113 vs D-112 "demo user deleted").
- Plan text says "seed 7 roles" / AC5 "7 roles": after CR-024 it is 6 (5 + Superadmin); custom roles add to the switcher.

- The building-plan workflow (create / import floors, rooms, area types, floor plans) has no owner module; until then structure changes are migrations.
- Asset type deactivate / reorder not in the design (add / edit only this release).
- Saving a contractor (repair #16 / #18) still accepts the id of a deactivated contractor type; only the pickers hide it (settings F28).
- Keyboard-only walkthrough of S24 and S20 not run by hand (all controls are native / Radix, Tab order unverified).
- Suggested asset codes use the floor name; a non-numeric floor name ("ลานจอดรถ") gives a code the pattern refuses (repair #34 and settings #49) — owner to decide the floor token.
- Sidebar beyond administration pages (employee navigation) — not decided; employee pages keep the D-064 navbar.
- Baseline reporting/following stays available to every role; per-ticket priority override stays removed (CR-015).
- First Superadmin employee code(s) for `SUPER_ADMIN_EMPLOYEE_CODES` per environment — before UAT (Stage 6).
- Shared dev DB DDL access needs checking when settings migrations begin.

## Stage log

- 2026-11-01: Stage R1 (CR-006 permissions, guards G1–G3, CR-006 navbar on every page, one repair permission table) built by Claude (D-133, D-134), accepted, tag `settings-stage-R1`; e2e AC1–AC5 pass. Stage report: that commit's message.

- 2026-10-29: Stage 4P (CR-005 building types: S20 tab + แก้ไขอาคาร, S22 ใช้กับประเภทอาคาร, #53–#55) built by Claude, accepted, tag `settings-stage-4P`

- 2026-10-27: CR-005 (building types) approved + applied to docs; Stage 4P added
- P1 discovery drafted 2026-10-15 · approved 2026-10-16
- P3 UI spec + P4 plan drafted 2026-10-16 · approved 2026-10-16 (+CR-007, D-052)
- 2026-10-26: CR-001…CR-004 design delivered, approved and applied to the source docs (D-106–D-111); build remains 0 of 6.
- 2026-10-26: repair CR-024 (D-112) — no `executive` role, no notifications; settings docs, seeds and the CR-001 prototype data updated (5 roles + Superadmin).
- 2026-10-27: Stages 2–6 built by Claude (D-115), accepted, one commit, tags `settings-stage-2`…`6` — S24 roles matrix, S25 users + S26 audit, S20 places/assets (buildings/floors → `platform`, D-116), S22 categories + S23 contractor types, Stage 6 access matrix / states / UAT. Stage summaries: that commit's message.
- 2026-10-26: Stage 1 built + wired (roles as data, `Viewer.Can`, `/me` permissions, `SUPER_ADMIN_EMPLOYEE_CODES`, administration shell, e2e F25 + repair regression pass; AC4 checked by hand) · accepted 2026-10-26, tag `settings-stage-1`; Atlas module `settings` added.
