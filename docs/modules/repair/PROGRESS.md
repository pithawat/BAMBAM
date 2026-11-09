# ระบบแจ้งซ่อม — Progress

<!-- The module's memory. Agents update it at the end of every task. Keep under ~60 lines. -->

**Phase:** P5 Build   **Stage:** 1 / 2 / 2R / 2N / 3 / 4 accepted (2026-10-26); 5P 2026-11-01; 4P / 4R / 3D-2 / 3D-3 accepted 2026-10-29, 3D-4 2026-10-30, 3D-5 2026-11-01; 5 / 5B accepted 2026-11-02 · of 8   **Updated:** 2026-11-09 (CR-039 accepted, tag `repair-cr-039`)

## Now

- **2026-11-09 CR-039 accepted by owner, tag `repair-cr-039` (M, D-144):** S07 `บันทึก PDF` (browser print dialog) prints only the new report from the owner's sample — logo · `รายงานการดำเนินงาน` · ticket no · QR → `/repair/tickets/{id}`, `ข้อมูลทั่วไป` + one table per step, photos, footer `หน้า n/total` (Chrome / Edge). Files: `ticket-report.tsx` (new), `ticket-detail.tsx`, shared `components/shared/qr-svg.tsx` (moved from settings label sheet). tsc / eslint pass; mock-mode PDFs checked (A4, 2 pages, no JS errors). **Not run:** e2e `F06-cr039-report-pdf.spec.ts` (Docker down), phone scan of a printed QR. Next: **Stage 6** — `/build-stage repair 6 prepare` in a fresh session; `/atlas sync repair` for CR-039.

- **2026-11-03 CR-037 + CR-038 accepted by owner 2026-11-03:** S01 login = `login.html` (headline keeps Plex 650 + swoosh); S30 label = `label-v7.html`, text `สแกนแจ้งปัญหา`, mono toggle; S03 room picked on the floor plan (desktop 3D, phones 2D, list behind "เลือกจากรายชื่อ"), new #36 `floors/{id}/room-plan` (D-143). Go build / unit tests, tsc, eslint pass. **Not run:** e2e (Docker down), browser check (the dev server stopped on start to show a Next.js upgrade notice), paper print + phone scan of the v7 label. Proposal history: CR-037 v2–v7 in `output/qr-login-redesign/`.




- **2026-11-02 CR-037 v2 revision ready:** separate `output/qr-login-redesign/{index-v2,login-v2}.html`; original BAM face / fur in a generated QR-holding pose, second-reference yellow arrow + black graphics, login's existing IBM Plex Sans Thai, centered CTA and concise service explanations. V1 retained. Done: 12 layouts, 5 login states, font / center checks, QR decode, one-page A4 PDFs and text containment pass. Next: owner reviews v2; production still unchanged, physical print / phone scan pending. Prompt / asset recorded in `output/qr-login-redesign/imagegen-v2-prompt.md`.

- **2026-11-02 CR-037 PROPOSED (M):** owner-requested QR + login redesign ready at `output/qr-login-redesign/{index,login}.html`, with colour / monochrome 12-label A4 PDFs and a large poster. No emoji; flat tiger holding a real QR; simpler login keeps the exact headline and a prominent CTA without in-button status. Done: 12 responsive layouts, 5 login states, dialog focus, rendered QR decoding, print geometry / text containment all pass; each PDF is one A4 page. Next: owner approves the design / CR, then a bounded handoff; physical paper scan remains open. Production / shared code untouched; existing source edits preserved. Stage 6 not started.

- **Stage 5B accepted 2026-11-02**, tag `repair-stage-5B` (CR-036 F13-A, D-142). Next: **Stage 6** (home by role) — `/build-stage repair 6 prepare` in a fresh session
- **Stage 5 accepted 2026-11-02**, tag `repair-stage-5` (CR-036 F13-B)

- **2026-11-01 CR-036 APPROVED (M, D-140) + settings CR-007:** QR = `{FRONTEND_URL}/q/{code}` (redirect to `/repair/new?asset=`, replaces D-024); in-app scan on phones only, desktop = manual code; asset code stays optional in S03; new **Stage 5B** after Stage 5 = print QR labels in the app (settings S30 + S20 actions, A4 3 × 4, label status never / current / moved / changed, code locked after print). Docs applied (flows F13-A / F13-B, plan Stage 5 + 5B, contracts, S16 / S03 / S06 / S02, settings S20 / S30, HANDOFFs). No code yet.

- **2026-11-01 CR-035 accepted by owner, tag `repair-cr-035` (D-139, visual only):** employee Home from `output/home-user-redesign/index.html` (+ รายการของฉัน from #35), S06 top row from `repair-my-option-b.html`, one `MascotPanel` (white tiger on solid primary) for every mascot: login, S03, S05, S06, S07 review band, S29 + empty attention, settings headings, empty / error / forbidden. tsc / eslint pass; screenshots 390 / 820 / 1440, no overflow / JS errors; e2e F01 / F29 / F06 / F07 / F23 pass (selectors updated; one 3D budget load flake passed alone). Run on a scratch stack web :3300 / API :8290 (`.next-e2e3`). Atlas synced (CR-035 on the timeline, verify 13 / 13 pass). Next: Stage 5 (`/build-stage repair 5 prepare` in a fresh session).

- **2026-11-01 Home visual proposal accepted by owner:** `output/home-user-redesign/index.html` is the chosen employee Home layout. The standalone HTML is retained for the later CR / implementation handoff. Cache cleanup: owner authorized stopping the project Next.js servers on ports 3000 / 3100 / 3200; all three generated directories (`frontend/.next`, `.next-e2e`, `.next-e2e2`) were removed after their locks were released. `frontend/.gitignore` now covers future `.next-e2e*` directories.

- **Stage 5P accepted 2026-11-01**, tag `repair-stage-5P` (CR-034, D-137 / D-138). Next: **Stage 5** (QR scan → prefilled S03, F13-B) — `/build-stage repair 5 prepare` in a fresh session

- **2026-11-01 CR-034 APPROVED (M, D-137)** — owner page polish: S03 disabled ถัดไป + hint, navbar layout (settings → right), S17 `ประเภทผู้ดำเนินการซ่อม` + required in-house technician (`assignee_id`, #36), S10 technician card + `รายละเอียดการซ่อม`, required reschedule reason (not re-accept), tracking needs `repair.ticket.report` (#35 403), extra spot stays required. Docs applied (flows, contract, screens, plan **Stage 5P** before Stage 5). Navbar mockup `changes/CR-034/navbar.html` (A inline lock-up + gear icon, B stacked + labelled button) — waiting for owner pick, then `/build-stage repair 5P`

- **2026-11-01 Home + S06 design revision (owner request):** `output/home-user-redesign/index.html` uses the supplied reference's centered heading and overlapping three-service cards with existing app tokens; repair is active, car / room buttons are natively disabled. `repair-my.html` now separates the introduction and report action into two bordered cards (owner follow-up): pale sage mascot/heading panel and white action panel with the app-blue button; no gradients or extra mascot backdrop. Desktop cards align; mobile cards stack. Focused follow-up checks pass at 8 widths in both themes (16 layouts), including panel separation, content containment and report-dialog focus return. `car-booking.html` / `room-booking.html` reserve upcoming-service landing layouts only; booking rules remain undefined. All four HTML files embed fonts/assets. Browser checks pass: 56 layouts (7 widths, 320–1440px, both app themes), no mascot/text collisions or overflow; search, filters, review-first sorting, tabs, dialogs/focus, loading/empty/error/forbidden, disabled actions and offline loading pass. Further owner-requested alternatives: `repair-my-option-a.html` (white card, blue outline, navy button) and `repair-my-option-b.html` (navy card, white button). Both restore the original blue mascot surface, widen the report card and use a 54px+ action. A/B navigation, report dialog/focus and 32 layouts (8 widths, both themes) pass; minimum button text contrast 6.52:1. Next: owner reviews the proposals; production adoption follows the CR process. Production/shared code and approved source docs unchanged.

- **Stage 3D-5 accepted 2026-11-01**, tag `repair-stage-3D-5` (CR-033, D-135 / D-136). Next: **Stage 5** (QR scan → prefilled S03, F13-B) — `/build-stage repair 5 prepare` in a fresh session

- **2026-10-30 mascot proposal, revised by owner:** Keep the EXISTING theme/layout; only change mascot backdrops and related heading surfaces (darker tracking header like existing Home). Done: `output/mascot-theme-options/index.html`, 6 paint options + original across 12 contexts, embedded assets/fonts; 336 viewport checks + 288 geometry comparisons pass in both existing themes at 375/1440. Owner cleanup: only this standalone demo HTML retained; screenshots, supporting files and the superseded Home redesign removed. Next: owner selects per-page treatments; implementation/CR pending. Production/shared code untouched.

- **Stage 3D-4 accepted 2026-10-30**, tag `repair-stage-3D-4` (CR-031 + CR-032): Riverside = 9 real models, site roads / walkways / car parks. Next: **Stage 5** (QR scan → prefilled S03, F13-B) — `/build-stage repair 5 prepare` in a fresh session

- **Stage 3D-3 accepted 2026-10-29**, tag `repair-stage-3D-3` (CR-030): office side = 7 real models. Next: **Stage 5** (QR scan → prefilled S03, F13-B) — `/build-stage repair 5 prepare` in a fresh session

- **CR-029 accepted 2026-10-29 (D-128):** 8 white tiger poses (PNG masters + cache-safe WebP), contrasting theme-aware surfaces across login / Home / repair / settings / shared states; lint / typecheck / build pass, browser audit 56/56 + Home recheck 4/4. Owner requested cleanup: temporary previews / logs / helpers and duplicate exports removed. Shared: `components/shared/mascot.tsx`, `states.tsx`, `app/globals.css`.

- **Stage 4R accepted 2026-10-29**, tag `repair-stage-4R` (CR-024). Next: Stage 5 (QR scan → prefilled S03, F13-B)
- **Stage 3D-2 accepted 2026-10-29**, tag `repair-stage-3D-2` (CR-027 + CR-028, D-124 / D-126 / D-127): site view in 2 sides, real อาคาร 1 / 2 models, อาคาร 2 floors 1–4. Next: **Stage 3D-3** (CR-030 approved, D-129) — office-side real buildings + models; start with `/build-stage repair 3D-3 prepare` in a fresh session
- **CR-025 approved + applied to docs 2026-10-27 (L, D-117 / D-118):** S03 = สถานที่ → ปัญหาที่พบ → รูปภาพและส่ง; building types (`platform.building_types`: สำนักงาน · โกดัง · ภายนอกอาคาร), categories per type (`repair.category_building_types`, อื่น ๆ everywhere), #5 `CATEGORY_NOT_FOR_BUILDING`; duplicate card → step 2; mock warehouse `โกดังเก็บของ 1 (ตัวอย่าง)`; admin side = settings CR-005 / settings Stage 4P. Code = new Stage 4P
- **CR-026 approved 2026-10-27 (M, D-119) + A1 2026-10-29 (D-120):** photo JPEG quality 0.85 → 0.25 (1920px kept); photos stay in the form and upload only on submit (option A, all photo forms); S03 draft photos in IndexedDB, 24 h expiry — in Stage 4P
- **CR-024 approved + applied to docs 2026-10-26 (M, D-112):** remove the `executive` role (existing users → `employee`) and the whole notification system (F19-B, S13, bell, P4–P7); new copy in `ui/screens/_common.md` §9. Code, unit / e2e tests and System Atlas = Stage 4R (Claude only)

- **Stages 1 / 2 / 2R / 2N / 3 accepted 2026-10-26** (owner, on the e2e results), tags `repair-stage-1`, `-2`, `-2R`, `-2N`, `-3`; Stage 4 accepted 2026-10-26 (`repair-stage-4`), 3U 2026-10-24, 3D 2026-10-20, 2M 2026-10-19 — every stage up to 4 is accepted. Next stage: 5
- **CR-023 done 2026-10-26 (M, D-105):** contractor names unique ignoring case / spaces, inactive included (re-activate instead); branch typed into the name; migration `20261026000001` (stops on existing duplicates); 409 `CONTRACTOR_NAME_TAKEN`; S18 `ดูร้านนี้` / S17 `เลือกร้านนี้`; Go unit + Pg + e2e F24 AC8
- **e2e coverage round 2026-10-26:** specs F06 / F07 / F21 / F24 (+ F02 draft restore) — full run 118 passed, 0 failed (before CR-023's case); fixed S18 / S09 desktop header buttons and the empty S18 edit form; D-103 (no software WebGL on desktop, fixed the F03 AC1 "33 s" issue); Atlas `upload` action (D-104); tours F03 / F04 / F05, every runnable tour passes
- **Atlas tours 2026-10-26:** 12 runnable flows have tours and pass `cli verify` — F01-B, F02, F03, F04, F05, F06, F08-B, F21, F22, F23, F24, F31; F07 has none (F07-2 auto-close has no e2e — owner: no test case); OV (overview path) has no tour of its own. Full e2e after CR-023: 120 passed, 0 failed, 6 skipped
- CR-004 (Home blocks) PROPOSED, waiting for a pick · `ui/HANDOFF.md`: READY FOR CODEX — Stage 5 (2026-11-01)

## Next

   - (2026-10-27) System Atlas already follows CR-024 / CR-025 / CR-026: no executive role, no F19-B / bell, 4R + 4P on the timeline (pending, no flows bound — owner's choice), F07 tour added (verify passes); 4R only re-checks with `/atlas sync repair` + `verify` after its FE changes
   - (D-113, 2026-10-26) the backend part is done in settings Stage 1 (migration executive → employee, no executive role, `Viewer.Can`, Go tests); 4R keeps FE copy / bell / toasts, e2e and the Atlas
0. Owner: try S30 on a real printer (Chrome / Edge, 100 % scale) and scan a paper label with a phone — not done yet
0. Shared dev DB: run migrations up to `20261026000001` once a writable user exists (dev DB still rejects DDL)
0. Owner checks the อาคาร 1 room data (Open issues "3D rooms")

## Open issues / questions

- CR-039: PDF page numbers (`@page` margin boxes) show in Chrome / Edge only; Safari / Firefox print without them. Owner sample PDF not stored in the repo (attached in chat) — drop it into `changes/CR-039/` if it should be kept
- Stage 5: plan AC1 names the old sample place (อาคารหลัก ชั้น 5 ห้องประชุม 5B); the real DB has no asset yet. Mocks keep `AC-05-012` in อาคารฝั่ง Office ชั้น 5 ห้องประชุม 5B; on the real API the e2e creates its own asset in a real room (อาคาร 1) — demo: add `AC-05-012` in S29 / S20 first. BR-F13B-1 asset list file still not received
- e2e: F06 BR-F06-2 assumes the employee's only ticket awaiting rating is its own — flaky in a full parallel run (passes alone); make it pick by id
- CR-036: is UAT / prod served over HTTPS? The in-app camera (S16) needs a secure context; the phone's own camera + `/q/{code}` works either way. Owner not sure (2026-11-01) — confirm before UAT
- CR-036: settings R2 (S20 restyle) and repair 5B (S20 print actions) both touch S20 — the later stage keeps the other's changes
- `er-diagram.dbml` still shows the old planned `repair.assets`; real table is `platform.assets` (CR-016) + Stage 5B label columns (`label_printed_at`, `label_printed_by`, `label_snapshot`) — refresh the diagram
- 5B: the repair S29 3D asset dialog cannot show the code read-only up front (repair `<Asset>` has no label field); it shows `ASSET_CODE_LOCKED` under the code field after saving. Adding `labelPrinted` to `<Asset>` would be a small CR — owner to decide
- 5B: AC2 checked by a Chromium print-to-PDF (A4, 12 cells per page, only labels) and the e2e; a real paper print + phone scan is still to do
- 5B: when starting the e2e stack by hand, the API also needs `SUPER_ADMIN_EMPLOYEE_CODES=EMP0105` (see `e2e/test-stack.cjs` apiEnv) or F15 AC3 / F29 AC3 fail

- 5P: stale test servers from an earlier session still hold :3100 / :8090 (old code) and could not be stopped from this session — 5P e2e / Atlas ran on :3200 / :8190 (`E2E_PORT` / `E2E_API_URL`, dist `.next-e2e2`); stop the old ones before the next `test:e2e`. Picker `ช่างผู้รับผิดชอบ` lists Superadmin users too (they hold every key, BR-F25-1) — confirm. A view-all role without `report` now starts the repair service at งานทั้งหมด (`repairHome`, shared lib)
- 5P: S07 shows `ช่างผู้รับผิดชอบ` to staff only for in-house jobs; old in-house tickets without an assignee show `ยังไม่ระบุช่าง` (the S17 picker fills it at the next reschedule)

- CR-033 / 3D-5 owner checks: Riverside blocks vs OSM (D-136) — OSM shows one 99 × 40 m building where CPAC Warehouse 2 / 3 are (our Warehouse 3 80 × 40 frame also runs over an OSM road), Riverside 1 / 2 as one ~36 × 34 m block south of our Riverside 1–3 / อเนกประสงค์ frames, no CCTC / โรงเรือน; office plan details by Claude: shop heights from their "n-SC-F" labels, the unnamed building by the steel tower drawn 2 storeys, the transmission line and the plan's "new building" complex (where TrialMix stands) not drawn; Pracha Rat Sai / Phibun Songkhram curves on the Riverside side come from OSM, not a plan

- 3D-4 owner checks: Warehouse 3 placed 22 m past Warehouse 2 along its long side (real position unknown); Riverside 1 / 2 drawn with 2 floors (the plans' 3rd page is the toilet block — was 3 on the map); CCTC plan is 48 × 17.7 = 849.6 m² vs the sheet's 839.06 / 851.41; room names by Claude (ห้องประชุม Riverside 1 / 2, น.I&T 1–3, WP 1–5, น.WPS 1 / 2, โรงเรือนเพาะปลูก…); floors without a common-area outline have a shapeless common area (Riverside 1 / 3, Warehouses 1–3); site-view markers of Riverside 2 / 3 overlap (zoom in, or keyboard) — e2e opens markers by keyboard; long plans (Warehouse 1 / 3) open cut off at the sides until zoomed out
- e2e: with the Playwright-started web server, `next dev` stops on every other first start (Next.js security notice) — start the stack by hand (`test-stack.md`) for long runs; F02 desktop needs 15 s for the place step while the 3D specs load the GPU

- 3D-3 owner checks: names by Claude — RMC Excellence Office 1 / 2, RMC Metro 1–3, ทางเดิน (อ.3), ห้องทดสอบก้อนปูน 1 / 2, SB&M 1–6, ฟิตเนส (plan says ฟิสเนส); อ.4 floor 2 drawn on x 0–35 of the 38 m plan, its 3.25 m² closet left in the common area; TrialMix lab placed 3 m east of the shed; canteen outline approximated from plan p.2 (scaled to 233.64 m²); ลานกองของ 337.5 m² (outdoor) not drawn; ห้องประชุม 60 ปี common area has no shape. Go Pg tests must run with `-p 1` (TestRenames collides with repair tests on a shared DB)

- CR-029's temporary Next.js image-query error is resolved: live sources use `-white.webp` filenames, no query strings. Re-run F23 / F31 + Atlas verify for 3D-2 separately; CR-029's 56 browser checks, lint / typecheck / build all pass.

- 3D-2 owner checks: CPAC Warehouse 3 plan is 80 × 40 m but its map frame (no. 13) is ~18 × 17 m next to Warehouse 2 — kept the frame size; storeys / footprints of 16 โรงอาหาร and 17 ห้องประชุม 60 ปี are the frame (one irregular plan for both); no. 14 โรงตาข่าย not on the map; อาคาร 2 room names by Claude (อ.2 ห้อง 201–205 / 301–303, พื้นที่ทำงาน ชั้น 2 / 3) — rename in settings
- 3D-2: the full e2e under 4 workers had 5 timing flakes (F01 / F02 AC7 / F06 / F26 / F29), all pass on re-run; 3D specs now `test.slow()`

- 4R: copy not in §9 — S18 contractor dialog / S10 contractor score said "เห็นเฉพาะช่าง Admin และผู้บริหาร", now "เห็นเฉพาะช่างและ Admin" (confirm)
- e2e: a stale `next dev` on :3100 from an earlier run is reused by Playwright and dies / crawls mid-run (100–196 false failures); kill it, or start the stack by hand, before `test:e2e`
- S11 keeps hiding its manage column when a (custom) role has view-all but neither close nor hand-over — permission-based, not the old executive mode
- CR-025: real warehouse buildings (names, floors, rooms) — owner to send; mock `โกดังเก็บของ 1 (ตัวอย่าง)` until then (rename in S20 or replace by migration)
- CR-026: result (S10) / send-back (S08) photos use the same 0.25 quality — owner did not answer whether they should stay sharper
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

- 2026-11-02: **Stage 5B accepted**, tag `repair-stage-5B` (CR-036 F13-A, D-142) — QR labels: #56 / #57, `labelStatus`, code lock (#48 / #32), S30 + S20 actions, e2e F13A

- 2026-11-02: **Stage 5 accepted**, tag `repair-stage-5` (CR-036) — #25 asset lookup + `assetCode` on #5; S16 camera / manual / desktop card, S03 QR banner + prefill (QR replaces a saved draft, D-141), สแกน QR on S06 / Home (phones only); `/q/{code}` route handler; e2e F13B 11 / 11, full run 246 pass (5 parallel flakes pass alone); UI built by Claude, AC6 no screen e2e

- 2026-11-01: **Stage 5P accepted**, tag `repair-stage-5P` (CR-034, D-137 / D-138) — disabled ถัดไป + hint, sticky spot `*`, navbar gear + stacked logo, `assignee` + #36 + required reschedule reason, S10 card, tracking needs `report`; Go lint 0 / tests incl. Pg pass, e2e 229 pass, Atlas 13 / 13

- 2026-11-01: **Stage 3D-5 accepted**, tag `repair-stage-3D-5` (CR-033) — site ground from site plan p.4 / OSM, อาคาร 4 turned, in-map side button; budget 53 / 47 calls; e2e F23 / F31 + Atlas 13 / 13 pass

- 2026-11-01: Stage 3D-5 wired (CR-033) — `site-ground.ts` re-traced (plan p.4 / OSM), in-map side button, marker order; Go lint 0 / tests pass; eslint / tsc / next build pass; e2e F23 + F31 34 passed (4 parallel-load fails passed alone); Atlas verify 13 / 13; D-136

- 2026-10-30: **Stage 3D-4 accepted**, tag `repair-stage-3D-4` (CR-031, owner fixes Riverside 2 stairs / CCTC ห้อง 202, CR-032 site ground) — Riverside side: 9 real buildings + light models, side 2 = 44 calls / 5.9k tris; e2e F02 / F23 / F31 pass (load flakes passed alone), Atlas 13 / 13

- 2026-10-29: **Stage 3D-3 accepted**, tag `repair-stage-3D-3` (CR-030) — office side: อาคาร 3 / 4, TrialMix, โรงอาหาร, ห้องประชุม 60 ปี as real buildings + procedural models; floor plans from outlines; budget 49 calls / 12.5k tris; e2e F02 / F23 / F31 pass (2 parallel-load flakes passed alone), Atlas 13 / 13 (F31 passed on re-run)

- 2026-10-29: **Stage 3D-2 accepted** by the owner, tag `repair-stage-3D-2` — Atlas verify / full e2e not re-run after CR-028 because of the concurrent CR-029 mascot image error (open issue)

- 2026-10-29: CR-029 accepted — 8 transparent white poses, contrasting surfaces / login palette, full desktop Home mascot; lint / typecheck / production build pass, browser audit 56/56 + Home recheck 4/4. Temporary evidence / helpers / preview cache and duplicate exports removed at owner's request.

- 2026-10-29: CR-028 applied in 3D-2 — `site_blocks.side`, #27 `side`, card side toggle + picker, real models on the site; Go tests incl. Pg pass, tsc / eslint pass, F23 / F31 14–15 / 15 (fails only from the concurrent CR-029 mascot `?v=` image error, not 3D)

- 2026-10-29: Stage 3D-2 built (CR-027) — migration `20261029000002` (`model_key`, `platform.site_blocks`, อาคาร 2 + rooms, idempotent Up), #27 `modelKey` + `site[]`; FE registry / site / building-two, engine site mode; Go lint 0, go test incl. Pg pass; tsc / eslint / next build pass; e2e F23 / F31 15 / 15 ×3, full suite 189 + 5 flakes (pass on re-run); Atlas verify all pass (F23 / F31 tours got a site step)

- 2026-10-29: **Stage 4R accepted**, tag `repair-stage-4R` — CR-024: bell + notification copy removed (§9), no executive traces, Go test executive → 400, e2e F01-cr024 (AC1–AC3); e2e 193 pass (2 timing flakes passed on re-run), Atlas verify pass
- 2026-10-29: **Stage 4P accepted**, tag `repair-stage-4P` — CR-025 (place first, building types, mock warehouse, #5 422) + CR-026 (0.25, upload on submit, IndexedDB drafts); UI by Claude; e2e repair + Atlas 13 / 13 pass; settings e2e not run (Docker off, D-123)
- 2026-10-29: Stage 4P wired — UI by Claude (S03 place first, S04 step 2), e2e F02 / F03 / F04 reworked + AC6 / AC7 / draft-photo specs, Atlas tours re-recorded (13 / 13 pass)
- 2026-10-29: Stage 4P prepare — CR-025 backend (migration `20261029000001`, #1 / #2 / #5 422) + FE contract, CR-026 quality 0.25 + A1 (upload on submit, IndexedDB draft photos); Go lint 0 / tests pass incl. Pg; tsc / eslint pass; HANDOFF ready for Codex; D-122
- 2026-10-29: CR-026 A1 approved (photos upload on submit, option A; IndexedDB draft photos 24 h) — D-120; order 4P → settings 4P → 4R (D-121)
- 2026-10-27: CR-025 (place first, building types, L) + CR-026 (photo quality 0.25, M) approved and applied to docs; settings CR-005; D-117–D-119
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
