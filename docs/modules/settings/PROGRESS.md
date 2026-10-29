# Settings — Progress

<!-- The module's memory. Agents update it at the end of every task. Keep under ~60 lines. -->

**Phase:** P5 Build   **Stage:** module complete (Stages 1–6 + 4P accepted, 2026-10-29)   **Updated:** 2026-10-29

## Now

- D-115 (owner 2026-10-26): Claude builds the UI of Stages 2–6 back to back; each stage gets its tests + report below; nothing committed / tagged until the owner accepts each stage.
- Module complete: Stages 1–6 accepted (2–6 on 2026-10-27, one commit, tags `settings-stage-2`…`6`). Atlas synced; no settings tours yet.

## Next

0. Module complete. Optional: `/atlas tour settings <flow>` for F26 / F27 (building types now runnable); repair 4R next on the repair side.
1. Before UAT: fill the env codes in the UAT checklist; optional `/atlas tour settings <flow>` for UAT scripts.
2. Owner decisions in Open issues (floor token in suggested asset codes, Next.js upgrade).

## UAT checklist

- Environment: set `SUPER_ADMIN_EMPLOYEE_CODES` per environment (comma-separated employee codes) **before the first login** — dev / test: `EMP0105` is the sample; UAT / prod: owner to give the codes.
- Sample data (migrations): 6 roles, อาคาร 1 (6 floors) + พื้นที่ภายนอกอาคาร, 4 asset types, 6 categories (incl. อื่น ๆ). Users appear after their first SSO login.
- Who tests what: Superadmin — S24 matrix + add / delete Role, S25 change a person's Role, S26 history, S23 types; Admin — S20 rename room / add asset / inline type, S22 category + symptom, Forbidden on S23–S26; ช่างเทคนิค — assess sheet type picker (deactivated type gone, typing re-activates); พนักงาน — Forbidden on every settings URL.
- Dev / UAT only: the role switcher lists custom Roles (demo user created on first switch).

## Done (CR-001 design + apply)

- CR-001…CR-004 records; interactive design `ui/mockups/CR-001-admin-settings.html` (+ CSS/JS, fonts, screenshots, `CR-001-design.md`, Playwright check `CR-001-check.cjs` PASS); two mascot poses in `frontend/public/brand`.
- 2026-10-26 apply: `02-flows.md` (BR-ALL-1, F25, F26 rewritten, F27, F29 BR-F29-8), `01-users.md` (Admin persona, fixed keys, `set_priority` struck per repair CR-015), `_common.md` (§1 access, §2 shell), S20 rewritten, S19/S21 removed, S22–S26 CR blocks, `03-plan.md` rework tasks, `04-api-contract.md` (#46–#52, removals), HANDOFF screens table.
- Owner decisions 2026-10-26: asset type code prefix + mount; S19 removed (both roles land on อาคารและอุปกรณ์; Superadmin Home = S29); floor plans out of settings; S23 + S26 in the sidebar.

## Open issues / questions
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

- 2026-10-29: Stage 4P (CR-005 building types: S20 tab + แก้ไขอาคาร, S22 ใช้กับประเภทอาคาร, #53–#55) built by Claude, accepted, tag `settings-stage-4P`

- 2026-10-27: CR-005 (building types) approved + applied to docs; Stage 4P added
- P1 discovery drafted 2026-10-15 · approved 2026-10-16
- P3 UI spec + P4 plan drafted 2026-10-16 · approved 2026-10-16 (+CR-007, D-052)
- 2026-10-26: CR-001…CR-004 design delivered, approved and applied to the source docs (D-106–D-111); build remains 0 of 6.
- 2026-10-26: repair CR-024 (D-112) — no `executive` role, no notifications; settings docs, seeds and the CR-001 prototype data updated (5 roles + Superadmin).
- 2026-10-27: Stages 2–6 built by Claude (D-115), accepted, one commit, tags `settings-stage-2`…`6` — S24 roles matrix, S25 users + S26 audit, S20 places/assets (buildings/floors → `platform`, D-116), S22 categories + S23 contractor types, Stage 6 access matrix / states / UAT. Stage summaries: that commit's message.
- 2026-10-26: Stage 1 built + wired (roles as data, `Viewer.Can`, `/me` permissions, `SUPER_ADMIN_EMPLOYEE_CODES`, administration shell, e2e F25 + repair regression pass; AC4 checked by hand) · accepted 2026-10-26, tag `settings-stage-1`; Atlas module `settings` added.
