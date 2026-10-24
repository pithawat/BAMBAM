# ระบบแจ้งซ่อม — Progress

<!-- The module's memory. Agents update it at the end of every task. Keep under ~60 lines. -->

**Phase:** P5 Build   **Stage:** 3U accepted 2026-10-24 (`repair-stage-3U`); Stage 3 waiting for acceptance · of 8   **Updated:** 2026-10-24 (Stage 3U accepted)

## Now

- **Stage 3 built 2026-10-19 — waiting for user acceptance** (branch `repair/stage-3`; report below). S11 re-spec (D-077) needs the owner's OK at acceptance
- **Stage 3U accepted 2026-10-24** (owner, CR-019), branch `repair/stage-3U`, tag `repair-stage-3U` (not pushed). Stage 3D accepted 2026-10-20 (`repair-stage-3D`). Next stage: 4
- **CR-017 built 2026-10-20 (S, D-086 / D-087):** ticket status by step on the model, 1 pin per ticket, repair-map lift transition, floors + footprint from #27, no sample numbers; migration `20261020000002` moves sample-building tickets to อาคาร 1 and deletes duplicates
- **CR-018 built 2026-10-20 (S, D-088 / D-089):** รับเรื่อง = deep yellow app-wide; ฉุกเฉิน marker on the model (red halo, ⚠, #27 `criticalCount`); sample buildings off (migration `20261020000003`) and sample seeding removed
- **CR-015 APPROVED 2026-10-19 (M, D-076):** priority is policy only — never changed after creation, lists oldest first; built in Stage 3
- **Still waiting for acceptance (older):** Stage 2R (CR-008 / CR-009), Stage 2N (CR-010 / CR-011 + CR-012 + D-068 S06 polish) — demos in `03-plan.md`; colour themes (D-069) and no-purple palette (D-070) built 2026-10-19. CR-004 (Home blocks) PROPOSED, waiting for a pick
- `ui/HANDOFF.md`: `BUILT BY CLAUDE — Stage 3D`; Codex has nothing to build

## Next

0. User: restart the local API (:8080 runs pre-Stage-3 code), run `npx playwright test e2e/repair` (F02 + F22 not run yet), try the Stage 3 demo, accept → `/accept-stage repair 3`
0. User: try the Stage 3D demo (`03-plan.md` Stage 3D) — the API needs migrations `20261020000001` + `20261020000002` + `20261020000003` (`goose -dir db/migrations postgres "$DATABASE_URL" up`) (shared dev DB still rejects DDL → local / writable DB), then `/accept-stage repair 3D`
0. Owner checks the อาคาร 1 room data (Open issues "3D rooms")
1. User runs the 2R / 2N demos (`03-plan.md`) on the real API (migration `20261016000001` needs a writable DB) and `e2e/platform/F01-login-shell.spec.ts`
2. On acceptance: commit, tags `repair-stage-1`, `-2`, `-2r`, `-2n`, `-3`; update `docs/PROJECT.md`
3. Stage 4 carries the CR-009 duplicate rule (409 on #5, room / spot match) and the team mode switch

## Stage 3D report (2026-10-20)

- Built: migration `20261020000001_repair_cr016` (asset types, assets, floor plans, room outlines, `tickets.asset_id`, อาคาร 1 × 6 floors / 53 rooms); API #27 (+ D-083 counts), #29–#34 with BR-F31-1…6 + audit log; S29 Home for admin / executive (`modules/repair/components/dashboard/**`): band, แจ้งซ่อม rows, attention, sample car / room blocks, the owner's อาคาร 1 model in three.js 0.160.1 (lazy, render on demand) → floor plans from #30, room pins → ticket popover → S07, equipment chips, admin edit mode (drag-add, drag-move + undo, edit, deactivate, add without dragging), phone floor list + sheet; employee / technician Home unchanged
- AC1 ✅ · AC2 ✅ · AC3 ✅ · AC4 ✅ · AC5 ✅ · AC6 ✅ (e2e F23 + F31 on the real API, desktop 1280 + Pixel 7)
- Demo: `03-plan.md` Stage 3D script — admin (ปวีณา) → หน้าแรก → ชั้น 1 → pin HR 3 → ticket; จัดวางอุปกรณ์ → drag แอร์ into HR 1 → save → drag to HR 2 → เลิกทำ → chip → ปิดใช้งาน; role switch to ผู้บริหาร; phone width. Needs a DB with migration `20261020000001`
- Checks: backend `golangci-lint` 0 issues, `go test ./...` pass incl. Postgres integration (`TestPgDashboardAndAssets`); frontend `lint`, `typecheck`, `next build` pass; e2e (one worker, scratch Postgres 5499 / API 8090 / web 3100): F23 + F31 + F01 pass, **F02 AC2 and F22 (Stage 2M / 3 specs, first run ever) fail** — F02: `getByText("ปกติ")` also matches "มีเสียง/กลิ่นผิดปกติ"; F22: phone has cards not table rows, and the closed-tab row check for "Admin ปิดงาน" fails on desktop → fix with Stage 3 acceptance
- Gaps: room names / CCM area / restroom per floor wait for the owner (Open issues "3D rooms"); `tickets.asset_id` is set only from Stage 5 (QR), so chip badges stay 0 until then; S07 does not link to the asset yet (Stage 5)
- Shared code touched: `app/(app)/page.tsx` (role switch), `playwright.config.ts` (E2E_PORT / E2E_API_URL, software WebGL, D-085), `package.json` (`three` 0.160.1, `@types/three`); `components/shared` and `lib` unchanged

## Stage 3 report (2026-10-19)

- Built: #21 `POST /tickets/{id}/close` (admin, any open status, reason 1–500, event `admin_closed`, `allowedActions` `close`); `priority:asc` sort removed (CR-015); S11 งานทั้งหมด `/repair/admin/queue` (tabs by step, filters, search, table / phone rows, page numbers, executive read-only); S07 admin `ปิดงาน` + back to S11; S09 oldest first; close dialog shared by S07 / S11
- AC1 ✅ (mock + unit) · AC2 ✅ mock, ❌ real API not run · AC3 ✅ unit (`TestExecutiveWritesForbidden`) + mock UI
- Demo: admin → งานทั้งหมด → กำลังดำเนินการ → ปิดงาน (empty reason → กรุณาใส่เหตุผล) → ปิดแล้ว + Admin ปิดงาน; switch to ผู้บริหาร (strip, no buttons); employee → forbidden. Mock: `NEXT_PUBLIC_USE_MOCKS=true npx next build && npx next start -p 3100`
- Checks: `go vet`, `golangci-lint`, `go test ./...`, `tsc`, `eslint`, mock `next build` pass; Playwright mock walk-through admin / executive / employee / technician at 1440 + 390, no overflow / JS errors (404 prefetches of `/notifications`, `/repair/admin/overview` = Stage 6 / 7 pages). e2e `F22-admin-tickets.spec.ts` written, not run
- Gaps: close notifications come with Stage 6 (dialog text already promises them); hand over Stage 4. Shared code touched: none (`components/shared` unchanged)

## Open issues / questions

- Stage 3U (D-097): re-run `npx playwright test e2e/repair/F02-report-form.spec.ts e2e/repair/F23-dashboard.spec.ts e2e/platform` on the test stack (not run after the CR-019 relayout)
- CR-019: S07 message box ("การติดตามงาน") and the S02 employee Home layout from the prototype are out of scope (separate CR if wanted); the S03 note says "ติดตามได้ตลอด" without promising notifications (Stage 6)
- Next.js 16.4.0 prints a security-vulnerability notice on `next dev` / `next build` (stops the first run) — upgrade to be planned
- Mock mode (`NEXT_PUBLIC_USE_MOCKS=true`, off by default) still has the old sample buildings in `mocks.ts` — never shown with the real API

- **3D rooms (D-084), owner to check:** names numbered where a floor repeats one (HR 1–3, Call center 1–2, RMC METRO - ท่าหลวง 1–3, RMC Excellence พี่จร 1–3, RMC Network 1–2) · unlabeled 12 m² rooms on floors 1 and 5 = `ห้องย่อย` · floor 2 has both "RMC METRO - ท่าหลวง" and "RRC METRO - ท่าหลวง" (typo?) · floor 5 CCM drawn 6 × 6 m = 36 m² but labelled 48 m² (traced as drawn) · ห้องน้ำ (one room, x 12–16 m) on floors 1–5, gender not recorded, none on floor 6 · is อาคาร 1 the sample "อาคารฝั่ง Office"? (it is a new building; the samples stay for dev)
- Migration `20261020000001` checked on a scratch Postgres 15 (up / down / up, all Pg integration tests pass); the shared dev DB still needs a writable user. Go tests run without `-race` locally (no cgo)

- Building plans (`attachments/building plan/*.pdf`, 4 buildings + meeting rooms) are readable (rendered via PyMuPDF in a scratchpad); candidate source for the real room list (CR-014 open item) and the Stage 7 model
- CR-014: real room list per floor (name + area type) — who supplies it? sample rooms (seed.go) until then; production has no buildings / rooms except the car park until settings Stage 4 (which must also create `พื้นที่ส่วนกลางชั้น {n}` for new floors)
- CR-014: area-type hints for ไฟฟ้า / อาคาร / อื่น ๆ are proposals (D-075) — confirm with the owner; car-park zones unknown
- CR-014: a floor with exactly 10 rooms gets the picker without search (Picker searches at > 10)
- CR-012 checks: Playwright walk-through (mock, 390 / 1440, reporter) S06 → S07 review / closed / in-repair → S08 star + arrow keys, no overflow or JS errors; follower / technician / rework / print views not screenshotted; no unit / e2e tests added
- Location zone: tickets carry no zone / room id — the sub-line uses the free-text `ห้องหรือจุดที่เกิด` (`ชั้น 5 · {จุด}`); a real zone needs the settings `room` master in the report form (BR-F26-2 says not yet) — confirm with the owner

- S06 search covers ticket no / location only (API #6 `q`); the CR-011 preview also searched titles — needs an API change if wanted
- `/repair/scan` (Stage 5) lost its bottom-nav entry with CR-010; Stage 5 must add a scan entry inside the repair screens
- Profile page (S14, `app/(app)/profile/page.tsx`) still shows "หมวดงานที่รับผิดชอบ" for the technician — leftover from before CR-005 (no technician categories, BR-F21-1); remove when touching the profile (settings Stage 1 refactors this page)
- **CR-007 APPROVED 2026-10-16 (M)** with the settings plan from the new `settings` module (D-043–D-051): permission checks instead of role names (built in settings Stage 1), buildings / floors move to `platform` (settings Stage 4), contractor type re-activate + audit (settings Stage 5), S12 floor plan button (repair Stage 7)
- **No tests for CR-005** (assess / resolve / confirm / send back / contractors / auto-close, e2e F02 / F06 / F21 / F07): user skipped them this round — add before UAT (Stage 8 task); existing unit tests were only adjusted
- Mock mode does not cover Stage 2 endpoints (actions, contractors call the API even with `NEXT_PUBLIC_USE_MOCKS=true`); since 2R the mocks compute `allowedActions`, so S07 shows the buttons but submitting them fails in mock mode
- Shared dev DB `bam_workspace` (192.168.1.196) rejects DDL ("read-only transaction") — need a writable user / primary host from the DBA before migrations can run
- RMC SSO server clock ~2m11s ahead of NTP (D-037) — ask the SSO team to fix, then drop `SSO_CLOCK_SKEW`
- Repair nav "ภาพรวมอาคาร" points to `/repair/admin/overview` (not built; Stage 7 or CR-016)
- Postgres integration tests not run locally (Docker Desktop engine returned 500); they run in CI
- `teamHandled` is rejected for everyone (403) until Stage 4; `assetCode` is stored but `asset` stays null until Stage 5
- Photo 10 MB limit is checked on the resized file (client) and on the upload (server); `_common.md` §5 proposed "before resize" — confirm
- HEIC uploads have no server thumbnail (original served as thumb)
- Search `q` uses ILIKE without a trigram index — fine at phase-1 volume
- Persona details (✏️ in 01-users.md) — non-blocking
- S12: confirm floor count / names / rear building before Stage 7 (`attachments/cpac-building.png`)
- Deploy target for UAT / production (persistent volume for `PHOTO_STORAGE_DIR`, backups)
- Stage 5: QR decoder library (BarcodeDetector + fallback proposed)
- Stage 2R gaps: technician + follower S07 views, S17 / S10 / send back and print not verified in a browser; home / profile / login pages still use the old blue header (outside 2R scope)
- Mock photo restore: drafts drop photos with `blob:` URLs (mock uploads), so in mock mode a restored draft needs photos again

## Stage log

- 2026-10-24: Stage 3U accepted (CR-019: S06 / S07 / S03 relayout, S29 polish, tiger mascot, S01 login from `bam-workplace-login-v7.html`, S06 = 10 per page from slim #35 `GET /tickets/mine`), tag `repair-stage-3U`; e2e F01 / F02 / F23 re-run still open (D-097)
- 2026-10-20: Stage 3D accepted (CR-016–CR-018), tag `repair-stage-3D`

- 2026-10-20: CR-017 — e2e F23 (incl. step badges = #27, 1 pin per open ticket → S07) + F31 + F01 pass on the real API; backend lint 0 / tests pass; FE lint / typecheck / build pass

- 2026-10-20: Stage 3D built (S29 + 3D อาคาร 1 + equipment, CR-016) — waiting for acceptance

- 2026-10-19: Stage 3D prepare — backend #27 / #29–#34 + 8 unit tests + `TestPgDashboardAndAssets`; `golangci-lint` 0 issues, `go test ./...` pass (with a scratch Postgres); FE `types` / `mocks` / `api` / `errors` / `plan-geometry` / `service-samples`, `tsc` + `eslint` pass; HANDOFF ready for Codex

- 2026-10-19: S29 modern mockup `ui/mockups/S29-admin-dashboard-modern.html` (owner request) — chosen as the S29 layout (D-082)
- 2026-10-19: standalone `แผนผังงานซ่อมอาคาร.html` redesigned (owner prototype, `output/facility-redesign/README.md`) — its อาคาร 1 model is the Stage 3D source (D-082)
- 2026-10-19: Stage 3 built (S11, #21 close, CR-015 order) — waiting for acceptance
- 2026-10-18/19: Stage 2N built (navbar, S06 groups, S07 summary, CR-012, D-068); AC5 follower / AC6 staff print not checked on the real API
- 2026-10-18: Stage 2R built (migration `20261016000001_repair_cr008`, priority rule, S03 wizard, S05 / S07 / S08 / S17 / S10); AC4 / AC6 not checked on the real API
- 2026-10-19: Stage 2M (CR-014, D-071–D-075) accepted, tag `repair-stage-2M`: migration `20261019000001_repair_cr014` (rooms, real master, car park) applied on dev DB; S03 3 equal frames + required room; location line on S05–S09; AC1–AC7 ✅, e2e F02 written but not run
- 2026-10-18: CR-010 / CR-011 approved (D-064–D-066) and built as Stage 2N; `output/navbar-redesign/` kept as the visual reference
- P1 approved 2026-10-14 (+CR-001) · P2 approved 2026-10-14 (D-018) · P3 approved 2026-10-14 (D-019, D-020) · P4 approved 2026-10-14 (D-021–D-025) · Stage 0 platform accepted 2026-10-14, tag `platform-stage-0` (D-026–D-031)
- Stage 1 built 2026-10-14 (+CR-002, CR-003) · CR-005 approved + applied 2026-10-15 (D-038–D-041): re-plan, Stage 1 rework + Stage 2 built
- 2026-10-16: CR-008 approved (D-053–D-059), Stage 2R planned · 2026-10-18: CR-009 approved (D-060–D-063), Stage 2R built
