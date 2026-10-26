# ระบบแจ้งซ่อม — Progress

<!-- The module's memory. Agents update it at the end of every task. Keep under ~60 lines. -->

**Phase:** P5 Build   **Stage:** 1 / 2 / 2R / 2N / 3 / 4 accepted (2026-10-26); next: 4R (CR-024), then 5 · of 8   **Updated:** 2026-10-26 (stages accepted, CR-023 done)

## Now

- **CR-024 approved + applied to docs 2026-10-26 (M, D-112):** remove the `executive` role (existing users → `employee`) and the whole notification system (F19-B, S13, bell, P4–P7); new copy in `ui/screens/_common.md` §9. Code, unit / e2e tests and System Atlas = Stage 4R (Claude only)

- **Stages 1 / 2 / 2R / 2N / 3 accepted 2026-10-26** (owner, on the e2e results), tags `repair-stage-1`, `-2`, `-2R`, `-2N`, `-3`; Stage 4 accepted 2026-10-26 (`repair-stage-4`), 3U 2026-10-24, 3D 2026-10-20, 2M 2026-10-19 — every stage up to 4 is accepted. Next stage: 5
- **CR-023 done 2026-10-26 (M, D-105):** contractor names unique ignoring case / spaces, inactive included (re-activate instead); branch typed into the name; migration `20261026000001` (stops on existing duplicates); 409 `CONTRACTOR_NAME_TAKEN`; S18 `ดูร้านนี้` / S17 `เลือกร้านนี้`; Go unit + Pg + e2e F24 AC8
- **e2e coverage round 2026-10-26:** specs F06 / F07 / F21 / F24 (+ F02 draft restore) — full run 118 passed, 0 failed (before CR-023's case); fixed S18 / S09 desktop header buttons and the empty S18 edit form; D-103 (no software WebGL on desktop, fixed the F03 AC1 "33 s" issue); Atlas `upload` action (D-104); tours F03 / F04 / F05, every runnable tour passes
- **Atlas tours 2026-10-26:** 12 runnable flows have tours and pass `cli verify` — F01-B, F02, F03, F04, F05, F06, F08-B, F21, F22, F23, F24, F31; F07 has none (F07-2 auto-close has no e2e — owner: no test case); OV (overview path) has no tour of its own. Full e2e after CR-023: 120 passed, 0 failed, 6 skipped
- CR-004 (Home blocks) PROPOSED, waiting for a pick · `ui/HANDOFF.md`: Stage 4 built and accepted; Stage 5 not prepared yet

## Next

0. **Next: Stage 4R (CR-024)** — `/build-stage repair 4R` (Claude builds: migration executive → employee, remove role + bell + notification copy, Go / e2e tests, `/atlas sync repair` + `verify`); start in a fresh session
   - (D-113, 2026-10-26) the backend part is done in settings Stage 1 (migration executive → employee, no executive role, `Viewer.Can`, Go tests); 4R keeps FE copy / bell / toasts, e2e and the Atlas
0. Then `/build-stage repair 5 prepare` (QR scan → prefilled S03, F13-B; `03-plan.md` Stage 5) — start in a fresh session
0. Shared dev DB: run migrations up to `20261026000001` once a writable user exists (dev DB still rejects DDL)
0. Owner checks the อาคาร 1 room data (Open issues "3D rooms")

## Open issues / questions

- F07-2 auto-close (BR-F07-4) has no e2e (owner 2026-10-26: no test case) — so Atlas has no F07 tour (`check` needs every feature of a flow at e2e `pass`)
- Test data: specs that leave open tickets in อ.1 ห้อง 401 (F03 / F05 / F22) keep piling up in `bambam_e2e`; reset with `test-stack.md` §1 when lists get long
- Stage 4: migration `20261024000001` must run on the dev DB before the demo (shared dev DB still read-only) 
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
- **CR-005 unit tests still missing** (Go: assess / resolve / confirm / send back / contractors / auto-close); e2e for F02 / F06 / F07 / F21 / F24 added 2026-10-26 (incl. API rule checks)
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

- 2026-10-26: Atlas tours F02 / F06 / F08-B / F21 / F22 / F24 (all 12 tours pass); e2e 120 passed
- 2026-10-26: Stages 1 / 2 / 2R / 2N / 3 accepted (owner, e2e all pass), tags `repair-stage-1` `-2` `-2R` `-2N` `-3`; CR-023 approved + built (D-105)
- 2026-10-26: e2e coverage round — F06 / F07 / F21 / F24 specs + F02 draft, 118 passed; fixes S18 / S09 desktop header buttons, S18 edit form reset; D-103 (no swiftshader on desktop), D-104 (Atlas `upload`); tours F03 / F04 / F05; CR-023 proposed
- 2026-10-26: **Stage 4 accepted**, tag `repair-stage-4` — F03 duplicates (409 + #22 `blocksReport`, CR-020 spot rule, step-2 block CR-021) + follow #23, F04 team-handled (locked `?mode=team`, S06 tab `ทีมแก้เอง`, #35 `closedReason`), F05 hand over #24; CR-021 relayout from `maintenance-demo.html`, CR-022 room cards / step heights; migration `20261024000001`; D-098–D-102; e2e F03 / F04 / F05
- 2026-10-26: CR-022 (room cards, step heights) + S06 lead hero polish — F02 / F03 / F04 26 passed, 1 skipped, F03 AC1 desktop see Open issues; tsc / eslint pass
- 2026-10-25: CR-021 approved + built (D-101) — S03 / S04 / S06 relayout from `maintenance-demo.html`, step-2 duplicate block, locked team mode, #35 `closedReason`; e2e F03 / F04 reworked
- 2026-10-25: Stage 4 wired — Codex UI reviewed (no changes), real API + e2e F03 / F04 / F05 pass; older specs F01 / F02 / F22 brought up to date (D-097 closed)
- 2026-10-24: Stage 4 prepare — backend #5 duplicates + team, #22–#24, migration `20261024000001`; `golangci-lint` 0 issues, `go test ./...` pass incl. Postgres integration (scratch Pg 15, port 5499, `TestPgDuplicatesFollowTeamHandOver`); FE contract `tsc` + `eslint` pass, mock rules checked in Node (17 checks); HANDOFF ready for Codex; then CR-020 (spot rule, copy) applied — backend + Pg tests, FE contract, 21 mock checks pass
- 2026-10-24: Stage 3U accepted (CR-019: S06 / S07 / S03 relayout, S29 polish, tiger mascot, S01 login from `bam-workplace-login-v7.html`, S06 = 10 per page from slim #35 `GET /tickets/mine`), tag `repair-stage-3U`; e2e F01 / F02 / F23 re-run still open (D-097)
- 2026-10-20: Stage 3D accepted (CR-016–CR-018), tag `repair-stage-3D`

- 2026-10-20: CR-017 — e2e F23 (incl. step badges = #27, 1 pin per open ticket → S07) + F31 + F01 pass on the real API; backend lint 0 / tests pass; FE lint / typecheck / build pass

- 2026-10-20: Stage 3D built (S29 + 3D อาคาร 1 + equipment, CR-016)

- 2026-10-19: Stage 3D prepare — backend #27 / #29–#34 + 8 unit tests + `TestPgDashboardAndAssets`; `golangci-lint` 0 issues, `go test ./...` pass (with a scratch Postgres); FE `types` / `mocks` / `api` / `errors` / `plan-geometry` / `service-samples`, `tsc` + `eslint` pass; HANDOFF ready for Codex

- 2026-10-19: S29 modern mockup `ui/mockups/S29-admin-dashboard-modern.html` (owner request) — chosen as the S29 layout (D-082)
- 2026-10-19: standalone `แผนผังงานซ่อมอาคาร.html` redesigned (owner prototype, `output/facility-redesign/README.md`) — its อาคาร 1 model is the Stage 3D source (D-082)
- 2026-10-19: Stage 3 built (S11 งานทั้งหมด, #21 admin close with reason, CR-015 oldest first, executive read-only)
- 2026-10-18/19: Stage 2N built (navbar, S06 groups, S07 summary, CR-012, D-068); AC5 follower / AC6 staff print not checked on the real API
- 2026-10-18: Stage 2R built (migration `20261016000001_repair_cr008`, priority rule, S03 wizard, S05 / S07 / S08 / S17 / S10); AC4 / AC6 not checked on the real API
- 2026-10-19: Stage 2M (CR-014, D-071–D-075) accepted, tag `repair-stage-2M`: migration `20261019000001_repair_cr014` (rooms, real master, car park) applied on dev DB; S03 3 equal frames + required room; location line on S05–S09; AC1–AC7 ✅, e2e F02 written but not run
- 2026-10-18: CR-010 / CR-011 approved (D-064–D-066) and built as Stage 2N; `output/navbar-redesign/` kept as the visual reference
- P1 approved 2026-10-14 (+CR-001) · P2 approved 2026-10-14 (D-018) · P3 approved 2026-10-14 (D-019, D-020) · P4 approved 2026-10-14 (D-021–D-025) · Stage 0 platform accepted 2026-10-14, tag `platform-stage-0` (D-026–D-031)
- Stage 1 built 2026-10-14 (+CR-002, CR-003) · CR-005 approved + applied 2026-10-15 (D-038–D-041): re-plan, Stage 1 rework + Stage 2 built
- 2026-10-16: CR-008 approved (D-053–D-059), Stage 2R planned · 2026-10-18: CR-009 approved (D-060–D-063), Stage 2R built
