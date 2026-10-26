# Settings — Progress

<!-- The module's memory. Agents update it at the end of every task. Keep under ~60 lines. -->

**Phase:** P5 Build   **Stage:** 1 of 6 done — next: 2   **Updated:** 2026-10-26

## Now

- Stage 1 accepted 2026-10-26 (tag `settings-stage-1`). Nothing in progress.

## Next

1. `/build-stage settings 2 prepare` (fresh session): S24 Role และสิทธิ์ — #2–#7, matrix save, role add / edit / delete (F29).

## Done (CR-001 design + apply)

- CR-001…CR-004 records; interactive design `ui/mockups/CR-001-admin-settings.html` (+ CSS/JS, fonts, screenshots, `CR-001-design.md`, Playwright check `CR-001-check.cjs` PASS); two mascot poses in `frontend/public/brand`.
- 2026-10-26 apply: `02-flows.md` (BR-ALL-1, F25, F26 rewritten, F27, F29 BR-F29-8), `01-users.md` (Admin persona, fixed keys, `set_priority` struck per repair CR-015), `_common.md` (§1 access, §2 shell), S20 rewritten, S19/S21 removed, S22–S26 CR blocks, `03-plan.md` rework tasks, `04-api-contract.md` (#46–#52, removals), HANDOFF screens table.
- Owner decisions 2026-10-26: asset type code prefix + mount; S19 removed (both roles land on อาคารและอุปกรณ์; Superadmin Home = S29); floor plans out of settings; S23 + S26 in the sidebar.

## Open issues / questions

- FE executive copy / bell / toasts stay for repair 4R (e2e executive blocks already removed in Stage 1 wire).
- e2e F06 (mobile) can race with desktop: both projects share the demo employee, so another "รอตรวจรับ" ticket may sort first. Flaky under full-suite load; per-project demo users would fix it (repair test-stack item).
- Next 16.4.0 prints a security-advisory notice and stops `next dev` / `next build` once (retry continues) — upgrade decision for the owner.
- `DEMO-EXECUTIVE` user row kept as an employee demo (may own sample tickets); 4R may delete it if unreferenced (D-113 vs D-112 "demo user deleted").
- Placeholder copy for not-yet-built settings pages ("ส่วนนี้กำลังพัฒนา" / "เปิดใช้ได้ในรอบถัดไป") is temporary, replaced stage by stage.
- Plan text says "seed 7 roles" / AC5 "7 roles": after CR-024 it is 6 (5 + Superadmin); custom roles add to the switcher.

- The building-plan workflow (create / import floors, rooms, area types, floor plans) has no owner module; until then structure changes are migrations.
- Asset type deactivate / reorder not in the design (add / edit only this release).
- Sidebar beyond administration pages (employee navigation) — not decided; employee pages keep the D-064 navbar.
- Baseline reporting/following stays available to every role; per-ticket priority override stays removed (CR-015).
- First Superadmin employee code(s) for `SUPER_ADMIN_EMPLOYEE_CODES` per environment — before UAT (Stage 6).
- Shared dev DB DDL access needs checking when settings migrations begin.

## Stage log

- P1 discovery drafted 2026-10-15 · approved 2026-10-16
- P3 UI spec + P4 plan drafted 2026-10-16 · approved 2026-10-16 (+CR-007, D-052)
- 2026-10-26: CR-001…CR-004 design delivered, approved and applied to the source docs (D-106–D-111); build remains 0 of 6.
- 2026-10-26: repair CR-024 (D-112) — no `executive` role, no notifications; settings docs, seeds and the CR-001 prototype data updated (5 roles + Superadmin).
- 2026-10-26: Stage 1 built + wired (roles as data, `Viewer.Can`, `/me` permissions, `SUPER_ADMIN_EMPLOYEE_CODES`, administration shell, e2e F25 + repair regression pass; AC4 checked by hand) · accepted 2026-10-26, tag `settings-stage-1`; Atlas module `settings` added.
