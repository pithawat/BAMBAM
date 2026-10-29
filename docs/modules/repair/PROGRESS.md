# ระบบแจ้งซ่อม — Progress

<!-- The module's memory. Agents update it at the end of every task. Keep under ~60 lines. -->

**Phase:** P5 Build   **Stage:** 2M accepted · next 3, of 8   **Updated:** 2026-10-19

## Now

- **Stage 2M (CR-014) accepted 2026-10-19**, tag `repair-stage-2M` (see Stage log)
- **CR-012 APPROVED + built 2026-10-19 (D-067)** inside Stage 2N: S07 heading, reporter review card (star → S08 draft score), white next-action card, ข้อมูลงาน with อาการ tags (priority staff-only, owner), before / after photo sets, blue timeline; S08 rating dialog. **S06 polish (D-068):** rows 69px (was ~90–116), closed caption `ประเมินตรวจงานแล้ว · n/5` without star, folder-check icon, 5px status tags. Waiting for user acceptance (AC8 in `03-plan.md`).
- **Stage 2N (CR-010 + CR-011) built 2026-10-18 — waiting for user acceptance** (`03-plan.md` Stage 2N). CR-010 / CR-011 APPROVED 2026-10-18 (D-064–D-066); owner change: S06 has no status filter
- **Stage 2R (CR-008 + CR-009) built 2026-10-18 — waiting for user acceptance.** CR-009 APPROVED 2026-10-18 (D-060–D-063); S07 follows `changes/CR-008/ticket-detail.html` as on disk (demo-05 layout, D-062)
- `ui/HANDOFF.md`: built by Claude; Codex has nothing to build
- **UI pass 2026-10-18 (Impeccable):** S06 rebuilt as status tiles (filter by status) + one full-width list (preview pane removed, `?status=` replaces `?closed=` / `?id=`); S07 rebuilt as summary card (what · where · step · when · who + next action) + evidence + vertical timeline (timeline.png). Priority hidden from reporter / follower on S06 and S07 (staff / technician still see it). Removed `timeline.tsx`, `TicketProgress`, `TicketStatusBadge`, `PhotoGallery` (unused)
- **CR-004 PROPOSED** (Home: light blocks) — waiting for the user's pick + approval

- **Colour themes 2026-10-19 (D-069):** account menu → ธีมสี: มาตรฐาน / โทนสบายตา (owner palette, contrast-tuned); shared code `app/globals.css`, `app/layout.tsx`, `lib/theme.ts`, `components/shared/app-navbar.tsx`; checked on mock build 390 / 1440 (S06, S07, Home), persists across reloads, no JS errors
- **No purple 2026-10-19 (D-070):** default theme recoloured (tangerine = needs you, emerald = done, slate = waiting, red = sent back, blue = every action); `--violet` token renamed `--attention`

## Next

0. Next stage: **Stage 3** (admin all tickets, priority, close) — `/build-stage repair 3 prepare` in a fresh session. Before it: restart the local API (:8080 runs pre-2M code) and run `npx playwright test e2e/repair` once (F02 spec not run yet)
0. User checks CR-012 / D-068 on `/repair/my` and a ticket (reporter awaiting rating, closed, follower) — mock build `NEXT_PUBLIC_USE_MOCKS=true npx next build && npx next start -p 3100`
0. User runs the 2N demo (`03-plan.md` Stage 2N) on the mock build (`NEXT_PUBLIC_USE_MOCKS=true npm run build && npx next start -p 3100`) or the real API; then the updated `e2e/platform/F01-login-shell.spec.ts` with the backend
1. User runs the 2R demo (`03-plan.md` Stage 2R): apply migration `20261016000001` on a writable DB first (shared DB rejects DDL, Docker was off), then employee → technician → employee on the real API
2. On acceptance: commit, tags `repair-stage-1`, `repair-stage-2`, `repair-stage-2r`, `repair-stage-2n`, update `docs/PROJECT.md`; then Stage 3 (admin all tickets, priority, close)
3. Stage 4 carries the CR-009 duplicate rule (409 on #5, room / spot match) and the team mode switch

## Stage 2N report (summary)

- Built 2026-10-18 / 19: top navbar shell (CR-010), S06 groups + S07 summary (CR-011), CR-012 S07 / S08, D-068 S06 polish. AC1–AC4, AC7 ✅; AC5 follower and AC6 staff S07 / print ❌ not checked on the real API. Shared: `components/shared/{app-shell,app-navbar,role-switcher,page-header,logout-dialog,service-unavailable,mascot}.tsx`

## Stage 2R report (summary)

- Built 2026-10-18: migration `20261016000001_repair_cr008`, priority rule, "อื่นๆ", #9 reason, #28 recent places; S03 wizard, S05, S07, S08 / S17 / S10, tokens + shell. AC1–AC3, AC5 ✅; AC4 technician / follower / print and AC6 (real API) ❌ not checked; AC7 checks pass, Stage 1–2 ACs not re-run on the real API.
- 2R checks: `go vet`, `go test ./...`, `golangci-lint`, `tsc`, `eslint`, `next build` pass; Playwright mock walk-through S03 → S05 → S07 (4 states + rating dialog) at 390 / 1366px. Shared code: `app/globals.css`, `app/layout.tsx`, `components/ui/button.tsx`, `components/shared/*` restyle, new `lib/drafts.ts`

## Open issues / questions

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
- Repair nav "งานทั้งหมด" / "ภาพรวมอาคาร" still point to `/repair/admin/queue`, `/repair/admin/overview` (Stage 3 / 7 pages, not built)
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

- 2026-10-19: Stage 2M (CR-014, D-071–D-075) accepted, tag `repair-stage-2M`: migration `20261019000001_repair_cr014` (rooms, real master, car park) applied on dev DB; S03 3 equal frames + required room; location line on S05–S09; AC1–AC7 ✅, e2e F02 written but not run
- 2026-10-18: CR-010 / CR-011 approved (D-064–D-066) and built as Stage 2N; `output/navbar-redesign/` kept as the visual reference
- P1 approved 2026-10-14 (+CR-001) · P2 approved 2026-10-14 (D-018) · P3 approved 2026-10-14 (D-019, D-020) · P4 approved 2026-10-14 (D-021–D-025) · Stage 0 platform accepted 2026-10-14, tag `platform-stage-0` (D-026–D-031)
- Stage 1 built 2026-10-14 (+CR-002, CR-003) · CR-005 approved + applied 2026-10-15 (D-038–D-041): re-plan, Stage 1 rework + Stage 2 built
- 2026-10-16: CR-008 approved (D-053–D-059), Stage 2R planned · 2026-10-18: CR-009 approved (D-060–D-063), Stage 2R built
- 2026-10-16: docs catch-up — `01-users.md` personas + permission matrix and 3 leftover lines in `02-flows.md` now match the CR-005 / CR-006 code
