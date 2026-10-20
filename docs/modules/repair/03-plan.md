# ระบบแจ้งซ่อม — Build plan

Status: APPROVED (2026-10-14) · re-planned by CR-005 (2026-10-15) · re-planned by CR-008 (2026-10-16) · Stage 2N added by CR-010 / CR-011 (2026-10-18) · Stage 2M added by CR-014 (2026-10-19) · Stage 3 reduced + S09 sort rework by CR-015 (2026-10-19) · Stage 3D added, Stage 7 replaced by CR-016 (2026-10-19)

<!-- Written by Claude in /stage-plan (2026-10-14). Stages are vertical slices that can be demoed.
     Each stage should fit in one focused session (Claude part + Codex part).
     Endpoints: 04-api-contract.md · Screens: ui/screens/ · e2e: frontend/e2e/repair/<flow-id>-*.spec.ts -->

## Before Stage 1 — Stage 0 (platform, `docs/shared/00-platform.md`)

Repair Stage 1 needs: SSO login (S01 `/login`, `/signed-out`), `proxy.ts` gate, `GET /api/v1/me` (P1), AppShell with the role-based sidebar, top bar and `BottomNav` (`ui/screens/_common.md` §1), S14 profile + logout, S15 role switcher + demo users (P2, P3, one seeded demo user per role with the names in `_common.md` §8), design-system tokens, fonts, mascot + logo assets, shared `EmptyState` / `ErrorState` / `ForbiddenState` / `Mascot` / `ServiceIcon` / `ServiceHeader` / `PriorityIndicator`. Bell and Home are placeholders until Stage 7 (Home shows the option-a CTA card + services only).

## Stages

| Stage | Goal (demoable) | Flows | Screens | Status |
|---|---|---|---|---|
| 1 | พนักงานแจ้งซ่อมพร้อมรูปได้จริง ได้เลขงาน (สถานะ "กำลังดำเนินการ · รอช่างประเมิน") และเปิดดูงานของตัวเองได้ — API จริง (CR-005) | F02 (happy path), F06 | S03, S05, S06, S07 (view) | built, rework CR-005 done — waiting acceptance |
| 2 | ช่างเห็นทุกงาน ประเมิน (วันคาดเสร็จ) บันทึกผล + ผู้ดำเนินการ + คะแนนช่างภายนอก; ผู้แจ้งให้ดาว (บังคับ) หรือส่งกลับ; ปิดเองเมื่อครบ 3 วัน — วงจรหลักครบ (CR-005) | F21, F07, F24 (technician) | S09, S17, S10, S08, S07 actions, S18 | built — waiting acceptance (no tests, CR-005) |
| 2R | **CR-008 rework:** ระบบกำหนดความเร่งด่วนจากอาการ + "อื่นๆ" · หน้าตาใหม่ทั้งแอป (design-system CR-008) · S03 แบบทีละขั้น + ตรวจสอบก่อนส่ง + ที่เคยแจ้ง + ร่าง · S05 · S07 หน้าติดตามแนวตั้ง + การ์ดสิ่งที่ต้องทำ + พิมพ์รายงาน · S08 ให้คะแนนไม่ตั้งค่าไว้ก่อน · S17 ปุ่มวัน + เหตุผลที่เลื่อน · S10 เป็น sheet — ตรวจรับพร้อม Stage 1–2 | F02, F06, F07, F21 | S03, S05, S06, S07, S08, S09, S10, S17, shell | in progress |
| 2M | **CR-014 rework:** หมวดงาน / อาการจริงตามเอกสาร (เก็บใน DB) · ฟอร์ม 3 ขั้น กรอบเท่ากันทุกขั้น · ห้องหรือจุดที่เกิดบังคับ เลือกจากรายการห้อง ผูกกับหมวด | F02, F06 | S03, location line on S05 / S06 / S07 / S09 | done (2026-10-19, `repair-stage-2M`) |
| 3 | Admin เห็นทุกงาน ปิดงานได้ (CR-015: ไม่ปรับความเร่งด่วน); ดูช่างภายนอก; ผู้บริหารดูได้อย่างเดียว | F22 (reduced), F08-B, F24 (view) | S11, S07 (admin actions), S18 (view) | built 2026-10-19 — waiting acceptance |
| 3D | **CR-016:** หน้าแรก Admin / ผู้บริหาร = dashboard ตัวเลขสำคัญ + โมเดล 3D อาคาร 1 กลางหน้า (ชั้น → ผังห้อง → หมุดงานค้าง) · อุปกรณ์ (แอร์ ไมค์ ลำโพง ทีวี) วางในห้องด้วย drag and drop · บล็อกจองรถ / ห้องเป็นข้อมูลตัวอย่าง | F23, F31 | S29 (+ asset dialog) | done — accepted 2026-10-20, tag `repair-stage-3D` |
| 4 | ระบบจับงานซ้ำให้ติดตามเคสเดิม (การ์ดในฟอร์มระหว่างกรอก, CR-008) หัวหน้าทีมบันทึกงานที่ทีมทำเอง (โหมดทีมในฟอร์ม) และส่งต่อให้ช่างได้ | F03, F04, F05 | S04 (inline + fallback), S03 (team step), S05 variants, S07 + S11 (hand over) | pending |
| 5 | สแกน QR ที่อุปกรณ์แล้วได้ฟอร์มที่กรอกไว้ให้ (CR-016: ตาราง assets มาจาก 3D แล้ว เหลือ lookup + สแกน) | F13-B | S16, S03 (QR banner) | pending |
| 6 | หน้าแรกตาม role (CR-016: admin / ผู้บริหารทำแล้วใน 3D) และแจ้งเตือนเฉพาะตัวพร้อมกระดิ่ง | F01 (Home), F19-B | S02, S13, bell | pending |
| 7 | ~~ภาพรวมองค์กร S27~~ — **replaced by Stage 3D (CR-016)**; left: models for the other buildings when their data arrives | F23 | — | replaced |
| 8 | ตรวจสิทธิ์ทุก role, edge cases, a11y และความพร้อม UAT | all phase-1 flows | all | pending |

Order rationale: 1→2 is the main loop (report → assess → repair → rate), re-planned by CR-005 (one in-house technician, no queue; contractors). Admin control (3) comes next. 4–5 add entry variants of F02. Notifications (6) come after all events exist. 3D moved up to 3D right after Stage 3 (CR-016, owner 2026-10-19). 8 hardens everything.

---

## Stage 1 — แจ้งซ่อมได้จริงและดูงานของตัวเองได้

**Scope**
- Flows: F02 steps 1–6 without duplicate check, team-handled or QR; F06 (list, search, filters, detail, timeline)
- Screens: S03 (no QR banner, no team card), S05 (normal variant), S06, S07 (no action bar yet; `allowedActions` is empty)
- Endpoints: 1, 2, 3, 4, 5 (without `teamHandled`), 6 + 7 (`scope=mine`), 8
- Out of this stage: S04 duplicates, F04, F13-B, status changes after create (Stage 2), notifications, Home widgets

**Backend (Claude)**
- [ ] Migration `repair` schema: `categories`, `symptoms`, `buildings`, `floors`, `settings` (ticket number format: prefix, year format, digits — BR-F02-5), `ticket_counters` (per year), `photos`, `tickets` (status, closed_reason, priority, category, building, floor, location_detail, details, reporter, holder, reserved_for, asset_code, timestamps, `queue_rank`, `manually_ordered`), `ticket_symptoms`, `ticket_photos` (kind: `report` / `result` / `send_back` / `follow` / `team`), `ticket_events`, `ticket_subscribers`; indexes for every list filter (status, reporter, category+status+queue_rank, floor, created_at)
- [ ] Dev seed: sample master data from `ui/screens/_common.md` §8 (marked sample; replaced when the real seed files arrive)
- [ ] Ticket number generator: per-year counter row locked in the create transaction; format from `settings` (`RP-{BE}-{000000}`)
- [ ] Photo storage behind an interface (`PhotoStore`), first impl = local directory (`PHOTO_STORAGE_DIR`, D-022); thumbnails generated on upload; cleanup of unattached photos older than 24 h
- [ ] Service rules: BR-F02-1 … BR-F02-5, BR-F06-1 visibility (reporter / subscriber / category technician / admin / executive), timeline event `created`
- [ ] Endpoints 1–8 per contract (Stage 1 parts)
- [ ] Tests: service tests for validation, ticket number (year rollover, concurrent creates), visibility matrix; repository tests against a real Postgres

**Frontend contract (Claude)**
- [ ] `modules/repair/types.ts` (shared objects + Stage 1 endpoints), `mocks.ts` (sample data from `_common.md` §8 incl. a followed ticket and every status for S06/S07), `api.ts`
- [ ] Error-code → Thai message map in `modules/repair/errors.ts`
- [ ] `ui/HANDOFF.md` → `READY FOR CODEX — Stage 1`

**Frontend UI (Codex)**
- [ ] S03 wizard (mobile) + single page (desktop), `PhotoPicker` with client resize
- [ ] S05 normal variant
- [ ] S06 tabs, search, filter sheet, paging
- [ ] S07 view: header card, details, result card, timeline, lightbox, all states

**Rework — CR-005 (Claude)**
- [x] Migration `20261015000001_repair_cr005`: statuses without `new`, queue columns dropped, assessment / work-by / contractor columns, contractor tables
- [x] #5 creates `in_progress` (awaiting assessment); #6 / #7 `step` filter + counts; S05 / S06 / S07 copy and forward-only tracker
- [x] Real API (`NEXT_PUBLIC_USE_MOCKS=false`); mocks updated to the new types (mock mode does not cover Stage 2 endpoints)
- [ ] Tests: none added this round (user, CR-005) — existing Go tests adjusted to compile and pass

**Rework — CR-002 (Claude, Codex out of tokens)**
- [x] Shared pickers in `components/shared`: `Picker`, `ChoiceField`, `FilterPill`, segmented control (design-system "Pickers")
- [x] S06 redesign: status groups, awaiting cards with deadline, rows with thumb + mini progress, closed preview + `?closed=all`, desktop list + preview panes
- [x] S03 desktop: denser sections with status, sticky summary panel (bottom bar below `xl`); อาคาร / ชั้น via `ChoiceField` (mobile too)
- [x] Compare with the new mockups at 375px and 1280px; lint + typecheck

**Wiring + e2e (Claude)**
- [ ] Real API connected (`NEXT_PUBLIC_USE_MOCKS=false`)
- [ ] `e2e/repair/F02-report.spec.ts` (report with 2 photos → S05 → S07), `F06-my-tickets.spec.ts` (search, tabs, forbidden on someone else's ticket)

**Acceptance criteria**
- [ ] AC1: As demo `employee`, submit the S03 form with 2 photos → S05 shows `RP-2569-000001` (or next number) and the ticket appears under S06 "กำลังดำเนินการ"
- [ ] AC2: Each S03 validation message appears with the exact copy when its field is missing; data stays after a failed submit (API stopped)
- [ ] AC3: S07 shows details, photos (lightbox works), category, priority, location and the `แจ้งซ่อม` timeline event
- [ ] AC4: Demo `housekeeper_lead` opening the employee's ticket URL sees the S07 forbidden state; demo `admin` can open it
- [ ] AC5: Changing the prefix in `repair.settings` changes the next ticket number only (old numbers unchanged)
- [ ] AC6: lint, typecheck, Go tests and e2e pass

**Demo script**
1. Log in, switch to พนักงานทั่วไป, open แจ้งซ่อม from the bottom nav (mobile 375px)
2. Pick ระบบปรับอากาศ → แอร์ไม่เย็น + มีน้ำหยด → อาคารหลัก ชั้น 5 → 2 photos → สูง → ส่งแจ้งซ่อม
3. Show S05, open ดูงานนี้ (S07), back to ติดตามงานซ่อม, search by the ticket number
4. Switch to หัวหน้าแม่บ้าน and paste the ticket URL → forbidden

---

## Stage 2 — ช่างประเมิน ซ่อม บันทึกผล และผู้แจ้งประเมิน (CR-005)

**Scope**
- Flows: F21 (work list, assess, resolve with work-by), F07 (rating required, send back → reworking, auto-close), F24 (contractors: add / edit / types / rating — technician part)
- Screens: S09 งานซ่อม, S17 ประเมินงาน (dialog), S10 บันทึกผลซ่อม, S08 ประเมินงาน / ส่งกลับ (dialogs), S07 action bar, S18 ช่างภายนอก (list, detail, form)
- Endpoints: 9–19; auto-close job
- Out of this stage: admin actions (Stage 3), notifications (Stage 6)

**Backend (Claude)**
- [x] Service rules: technician-only assess (date ≥ today) / resolve (assessed first, note + ≥ 1 photo, work-by, contractor active + rating 1–5); reporter-only confirm (rating required) / send back (reason, `send_back_count` + 1); row lock per action; events `assessed`, `assessment_changed`, `resolved`, `sent_back`, `confirmed`, `auto_closed`
- [x] Visibility: technician sees every ticket (`scope=all`); contractor name / rating hidden from non-staff (BR-F24-4)
- [x] Contractors + types (create-or-get by name), job history, average score
- [x] CR-006: the assessment records who does the work (`workBy`, `contractorId`); resolve only needs the contractor rating for contractor jobs; migration `20261015000002` resets older assessments without `work_by`
- [x] Auto-close worker at start + every 15 min (BR-F07-4)
- [ ] Tests (skipped this round, CR-005 — Open issue)

**Frontend (Claude, CR-005)**
- [x] Types / api for 9–19; error copy + field messages
- [x] S09 `/repair/work` (tabs by step, building filter, priority order → oldest first in Stage 3 rework (CR-015), overdue mark); nav: sidebar "งานช่าง" + bottom-nav slot for the technician
- [x] S07 action bar: ประเมินงาน / เลื่อนวันคาดว่าเสร็จ, บันทึกผลซ่อม (disabled until assessed), ประเมินงาน (stars), ส่งกลับให้แก้; `?action=confirm|sendback`
- [x] S10 `/repair/tickets/[id]/resolve`: note + photos, contractor stars for contractor jobs (CR-006); S17 assess dialog: date + ผู้ดำเนินการ + contractor picker with inline "เพิ่มใหม่"
- [x] S18 `/repair/contractors` + `/repair/contractors/[id]` (technician edits; admin / executive view)
- [ ] e2e (skipped this round)

**Acceptance criteria**
- [ ] AC1: Employee reports → S06 shows "กำลังดำเนินการ · รอช่างประเมิน"; the technician sees it under รอประเมิน (oldest first, CR-015)
- [ ] AC2: "บันทึกผลซ่อม" is disabled until the technician sets an expected date and ผู้ดำเนินการ; after assessing, the reporter sees "คาดว่าจะเสร็จ {date}"
- [ ] AC3: Assess with ช่างภายนอก requires a contractor (pick or เพิ่มใหม่); resolve then requires the contractor stars; the reporter sees "ดำเนินการโดยช่างภายนอก · {ประเภท}" from the กำลังซ่อม step but never the name or score
- [ ] AC3b: "แก้การประเมิน" can switch to ช่างในระบบ or another contractor; the timeline shows the change
- [ ] AC4: Reporter cannot submit the rating without stars; with 4 stars the ticket closes as ประเมินแล้ว
- [ ] AC5: Send back adds a "ส่งกลับให้แก้" event and the tracker grows "ส่งกลับให้แก้ → แก้ไขเสร็จ"; the technician resolves again
- [ ] AC6: A ticket resolved 72 h ago closes as ปิดอัตโนมัติ at the next worker run
- [ ] AC7: S18 shows the contractor's job history with scores to technician / admin / executive; employee gets the forbidden state

**Demo script**
1. Employee reports แอร์ไม่เย็น → S05 → S06 "รอช่างประเมิน"
2. Switch to ช่างเทคนิค → งานซ่อม → open it → ประเมินงาน (พรุ่งนี้, ช่างภายนอก → เพิ่มใหม่ "ร้านแอร์เย็นฉ่ำ" ประเภท แอร์) → บันทึกผลซ่อม → 4 ดาวให้ช่างภายนอก
3. Switch to พนักงาน → ส่งกลับให้แก้ → ช่าง resolves again → พนักงาน ให้ 5 ดาว
4. Switch to Admin → ช่างภายนอก → ร้านแอร์เย็นฉ่ำ → history + score

---

## Stage 2R — CR-008 rework (priority from symptoms, new look, S03 wizard, S07 tracking page)

**Scope**
- Flows: F02 (BR-F02-1 / BR-F02-2 CR-008: priority set by the system, "อื่นๆ"), F06 (S07 layout), F07 (BR-F07-7 rating UI), F21 (BR-F21-8 รับเรื่อง chips + reason)
- Screens: design-system tokens + shell (sidebar, top bar, bottom nav) · S03 step wizard (ปัญหาที่พบ → สถานที่ → รูปภาพ → ตรวจสอบก่อนส่ง; ที่เคยแจ้ง; local draft) · S05 · S06 copy · S07 (header band, สิ่งที่ต้องทำตอนนี้, timeline with nested events, ข้อมูลงาน, ก่อนซ่อม / หลังซ่อม, print) · S08 · S17 · S10 as a sheet · S09 copy
- Endpoints: #1 (+ priorities), #5 (no `priority`, + `categoryOther` / `symptomOther`), #6 / #8 objects (+ `categoryOther`, `symptomOther`, `prioritySource`), #9 (+ `reason`), #28 recent places
- Out of this stage: duplicate card + team step (Stage 4), QR banner (Stage 5), S27 (Stage 7), settings S22 priority fields (settings Stage 5; until then priorities come from the seed / sample data), room chips (settings Stage 4 rooms)

**Backend (Claude)**
- [x] Migration `20261016000001_repair_cr008`: `symptoms.priority`, `categories.default_priority` (default `medium`), `tickets.category_id` nullable + `category_other`, `symptom_other`, `priority_source` (existing rows `reporter`), check (category or category_other)
- [x] Dev / UAT sample data (D-032): symptom priorities + category defaults (`_common.md` CR-008), building names อาคารฝั่ง Office / อาคาร Office โรงงานบางซ่อน updated **by id**
- [x] Create: priority rule (highest symptom → category default → `medium`), "อื่นๆ" validation; old `priority` field ignored
- [x] Assess: optional `reason` (≤ 100) on a change → event `data.reason`
- [x] #28 recent places (my tickets, distinct building / floor / location, max 3)
- [x] Tests: service tests for the priority rule, "อื่นๆ" validation, recent places

**Frontend (Claude)**
- [x] Tokens, Anuphan only, shell restyle (no gradients)
- [x] types / api / mocks for the new fields and #28
- [x] S03 wizard + review + draft · S05 · S06 / S09 copy
- [x] S07 tracking page + print · S08 rating without default + low-score hint · S17 date chips + reason · S10 sheet
- [x] CR-009: labels แจ้งงาน → รับเรื่อง → กำลังดำเนินการ → (ส่งกลับให้แก้) → เสร็จ → ประเมินตรวจงาน everywhere (S05, S06, S07, S08, S09, S17); buttons เริ่มดำเนินการ / ประเมินตรวจงาน; S07 = demo-05 layout (`ticket-detail.html` on disk) with the 5-stage timeline

**Acceptance criteria**
- [ ] AC1: Picking มีน้ำหยด + แอร์ไม่เย็น shows `ความเร่งด่วนของงานนี้: สูง` and the created ticket has priority สูง (`prioritySource = symptom`); category อื่นๆ with typed text creates a ticket with priority ปกติ
- [ ] AC2: S03 moves step by step; ถัดไป blocks an incomplete step with its message; ตรวจสอบก่อนส่ง shows every value with แก้ไข; reloading the page restores the draft
- [ ] AC3: A reporter with earlier tickets sees up to 3 ที่เคยแจ้ง places; tapping one fills building / floor / location
- [ ] AC4: S07 shows the step-coloured header and action card per viewer (reporter, follower, technician), the 4-stage timeline with nested date changes / send backs, and prints on A4
- [ ] AC5: The rating dialog opens with no score (or the tapped star), 1–2 stars offer ส่งกลับให้แก้แทน
- [ ] AC6: The technician รับเรื่อง with a date chip; เลื่อนวันเสร็จ with a reason shows the reason to the reporter
- [ ] AC7: Stage 1–2 acceptance criteria still pass (with the new copy); `go vet`, `go test ./...`, `tsc`, `eslint`, `next build` pass

**Demo script**
1. Employee (phone 390px): แจ้งซ่อม → ระบบปรับอากาศ → แอร์ไม่เย็น + มีน้ำหยด (see สูง) → ที่เคยแจ้ง → 2 photos → ตรวจสอบก่อนส่ง → ยืนยันส่งแจ้งซ่อม → S05 → ดูงานนี้
2. Technician: รับเรื่อง (พรุ่งนี้) → เลื่อนวันเสร็จ (อีก 3 วัน, รออะไหล่) → บันทึกผลซ่อม (photo + note)
3. Employee: S07 shows the reason under ซ่อม → tap 2 stars → ส่งกลับให้แก้แทน → technician resolves again → employee 5 stars → พิมพ์รายงาน

---

## Stage 2N — CR-010 / CR-011 rework (top navbar, S06 groups, S07 summary) (CR-010, CR-011)

**Scope**
- Flows: entry points only (F06 reading / filtering, F07 evaluation entry, F21 progress); no business rule changes
- Screens: shell (`_common.md` §1) · S06 · S07 · car / room "เร็วๆ นี้" pages
- Endpoints: none new — #6 (per-status lists, `sort`), #7 counts, #8 detail
- Out of this stage: Home redesign (CR-004), notifications page (Stage 6), admin pages (Stage 3 / 7)

**Frontend (Claude)**
- [x] Navbar + account menu + mobile service row; remove sidebar / bottom nav; role switcher strip; page headers without bell / switcher
- [x] Repair section nav for technician / admin / executive; `/car-booking`, `/room-booking`
- [x] S06 groups (no status filter, owner 2026-10-18), review banner, relation tabs, date / sort / search, per-group paging
- [x] S07 summary + next action + evidence order + timeline header; priority events hidden from reporter / follower
- [x] Platform e2e updated for the navbar
- [x] CR-012 (2026-10-19): S07 heading + review card + job info (อาการ, no priority for reporter / follower) + evidence photo sets + blue timeline; S08 rating dialog (CR-012)
- [x] S06 polish (D-068): two-line rows, closed caption without star, folder-check icon, 5px status tags

**Acceptance criteria**
- [ ] AC1: No sidebar, no bottom nav; หน้าแรก and the three services reachable at 375 / 768 / 1024 / 1440px; only the current service is marked active
- [ ] AC2: Technician / admin / executive reach every former sidebar destination through the repair section nav; employees see no extra menu
- [ ] AC3: Account menu: opens, closes on Escape / outside click / selection, focus returns to the avatar; logout keeps its confirm; role switcher never in production
- [ ] AC4: S06 shows no status filter; tabs, date, sort, search and reset change every group and its count; groups collapse; a ticket opened from the list returns with the filters kept
- [ ] AC5: S07 shows number, status, title, location, date, category and relation at the top; reporter sees `ประเมินตรวจงาน` / `ส่งกลับให้แก้` only when `allowedActions` allows; follower sees no buttons; no priority anywhere for them (history included)
- [ ] AC6: Staff S07 still shows priority, fixer and their actions; print still A4
- [ ] AC7: `tsc`, `eslint`, `next build` pass
- [ ] AC8 (CR-012): reporter awaiting rating sees the review card; a star opens S08 with that score, `ประเมินพร้อมความคิดเห็น` opens it empty, only `ยืนยันผลประเมิน` submits; follower sees no stars / buttons; ข้อมูลงาน shows อาการ and no priority for reporter / follower, priority for staff; before / after photos stack on phones; print hides the review card

**Demo script**
1. Employee (390px, then 1440px): navbar → แจ้งซ่อม → S06 → ที่ฉันติดตาม → collapse a group → open a ticket → back (tab kept) → ไปตรวจงาน → ประเมินตรวจงาน dialog → cancel → account menu → ออกจากระบบ → ยกเลิก
2. จองรถ → "เร็วๆ นี้" page
3. Technician: แจ้งซ่อม → งานซ่อม (repair nav) → ticket → พิมพ์งานนี้; admin: repair nav shows งานทั้งหมด · ช่างภายนอก · ภาพรวมอาคาร

---

## Stage 2M — CR-014 rework (real category master, 3-step equal frames, required room) (CR-014)

Status: done — accepted 2026-10-19, tag `repair-stage-2M`

**Scope**
- Flows: F02 (3 steps; BR-F02-1 CR-014 part, BR-F02-6 master, BR-F02-7 rooms), F06 (location line with room), F03 data only (room id stored for Stage 4)
- Screens: S03 (`changes/CR-014/form-steps.html`, S03 spec CR-014 block) · location line with room on S05, S06, S07, S09, print
- Endpoints: #1 (+ `isOther`, `areaTypes`), #2 (+ rooms per floor), #5 (`roomId` required, `categoryOther` only with `isOther`), #6 / #8 objects (+ `room`; `q` also searches room name), #28 (+ room)
- Out of this stage: admin screens for rooms (settings Stage 4) and categories / symptoms / area types / priorities (settings Stage 5); duplicate by room (Stage 4); QR room prefill (Stage 5); S27 rooms (Stage 7)

**Backend (Claude)**
- [x] Migration `…_repair_cr014.sql`: `platform.rooms` (id, floor_id → floors, name, area_type CHECK, sort_order, is_active, created / updated, unique (floor_id, lower(name))) — the table settings Stage 4 planned (D-048), with `area_type` added; `repair.categories.is_other` (unique partial index where true); `repair.category_area_types` (category_id, area_type, PK both); `repair.tickets.room_id` nullable FK + index; Down reverses (drops `room_id` data)
- [x] Data migration (every environment): upsert the 7 categories / symptoms of `attachments/REPAIR-CATEGORY-SYMPTOM-MASTER.md` with stable ids, icons, sort order, CR-014 priorities and area types; `อื่น ๆ` `is_other = true`; deactivate every other category (sample ones), never delete; one `พื้นที่ส่วนกลางชั้น {n}` room (`common_area`) per active floor
- [x] Note: `repair.buildings` / `floors` still live in `repair` until settings Stage 4 moves them; `platform.rooms.floor_id` FK follows the `SET SCHEMA` move (ids kept)
- [x] Dev / UAT sample (`seed.go`, D-032): sample rooms with area types per floor (ห้องประชุม, ห้องน้ำชาย / หญิง, Pantry, สำนักงาน) — SAMPLE ONLY until the owner's room list
- [x] #1 `isOther`, `areaTypes`; #2 rooms per floor (floors without an active room are skipped)
- [x] Create: `categoryId` always required, `categoryOther` only with `isOther` (`NOT_ALLOWED`), `roomId` required and active on `floorId` (`MASTER_DATA_CHANGED`); priority rule unchanged
- [x] Ticket objects + list / detail / print queries carry `room`; #6 `q` matches room name; #28 distinct by room
- [x] Tests: create rules (room missing / other floor / inactive, `categoryOther` on a normal category, `อื่น ๆ` with symptoms), priority with the new symptoms, master migration idempotent (repository integration test), #2 rooms shape

**Frontend (Claude)**
- [x] types / api / mocks: `isOther`, `areaTypes`, rooms, `room` on tickets; mocks use the real master + sample rooms
- [x] S03: 3 steps in one 880px frame with fixed body height (desktop), ปัญหาที่พบ without the client "อื่นๆ" card, สถานที่ with room groups / picker (> 9) + จุดเพิ่มเติม + ที่เคยแจ้ง button, รูปภาพและส่ง two columns; validation, draft (room id), skeleton
- [x] Location line helper used by S05 / S06 / S07 / S09 / print: `ชั้น {n} · {room}` (+ จุดเพิ่มเติม), old tickets unchanged

**Acceptance criteria**
- [x] AC1: S03 shows exactly the 7 categories and their symptoms from the attachment (no `อื่นๆ` symptom rows; `อาการอื่นๆ` check box instead); changing category clears symptoms and typed text
- [x] AC2: `อื่น ๆ` + `ใช้งานไม่ได้` + typed `ลิฟต์` creates a ticket with category อื่น ๆ, `categoryOther = ลิฟต์`, priority ปกติ; มีกลิ่นไหม้/ประกายไฟ → ฉุกเฉิน
- [x] AC3: ถัดไป on สถานที่ without a room shows `เลือกห้องหรือจุดที่เกิด`; rooms matching the category are listed first; the API rejects a missing room, a room of another floor and an inactive room
- [x] AC4: On desktop (1280 / 1440px) the frame width and height, progress strip and footer are identical on all 3 steps and no step leaves more than ~25% of the frame empty (sample data); phone 375px has no horizontal scroll
- [x] AC5: ตรวจสอบก่อนส่ง shows ปัญหา · ความเร่งด่วน · สถานที่ with room, each แก้ไข returns to its step; draft restore and ที่เคยแจ้ง fill the room
- [x] AC6: Old tickets (no room, `category: null`) still render on S06 / S07 / print
- [x] AC7: `go vet`, `go test ./...`, `golangci-lint`, `tsc`, `eslint`, `next build` pass

**Demo script**
1. Employee (1440px): แจ้งซ่อม → ห้องประชุมและโสตทัศนูปกรณ์ → จอไม่แสดงผล/ไม่ติด → ถัดไป → อาคารฝั่ง Office ชั้น 5 → ห้องประชุมขึ้นก่อน → ห้องประชุม 5B + `ฝั่งหน้าต่าง` → ถัดไป → 1 photo + รายละเอียด → ยืนยันส่งแจ้งซ่อม → S05 → S07 shows `ชั้น 5 · ห้องประชุม 5B · ฝั่งหน้าต่าง`
2. Same at 375px with อื่น ๆ + typed `ลิฟต์`; try ถัดไป without a room

---

## Stage 3 — Admin งานทั้งหมดและการจัดการ (CR-005: no queue reorder; CR-015: no priority change)

**Scope**
- Flows: F22 (all tickets; CR-015: no priority change), F08-B (close any ticket), BR-F06-1 all tickets, BR-F22-6 executive read-only, F24 admin view
- Screens: S11 งานทั้งหมด (tabs by step, filters, executive mode, mobile list; oldest first, priority shown as info), S07 admin action (ปิดงาน), S18 view
- Endpoints: 6 + 7 (`scope=all`), 21 (CR-015: #20 removed)
- Out of this stage: hand over (Stage 4)

**Backend (Claude)**
- [x] Service rules: admin close from any open status (event `admin_closed`) — #21, `allowedActions` `close`
- [x] Tests: executive gets 403 on every write (`TestExecutiveWritesForbidden`, `TestAdminClose*`)

**Frontend**
- [x] S11 list (re-spec without drag and drop — `@dnd-kit/sortable` no longer needed, D-025 superseded), S07 admin action card + close dialog (CR-015: no priority select / dialog)

**Rework from CR-015 (Stage 2 code)**
- [x] `technician-work.tsx` (S09): `sort: "createdAt:asc"` instead of `priority:asc` (2 calls); keep the priority chip; update Stage 2 AC1 wording "most urgent first" → oldest first
- [x] Home technician `top` list (#home) ordered oldest first if it uses priority; remove `change_priority` / `priority_changed` leftovers in types / mocks if any

- [x] e2e `e2e/repair/F22-admin-tickets.spec.ts` (written, not run yet: needs the local API on current code)

**Acceptance criteria**
- [ ] AC1 (CR-015): S11 lists open tickets oldest first; priority is shown but admin has no way to change it (no select, no endpoint)
- [ ] AC2: Admin closes an in-progress ticket with a reason; reporter sees Admin ปิดงาน
- [ ] AC3: Executive sees the same data with no selects or close buttons; direct API writes return 403

---

## Stage 3D — Dashboard หน้าแรก Admin / ผู้บริหาร + อุปกรณ์ + 3D อาคาร 1 (CR-016)

**Start:** owner said go 2026-10-19 (S29 approved with `S29-admin-dashboard-modern.html` + the owner's model, D-082). Branch `repair/stage-3D`.

**Scope**
- Flows: F23 (dashboard + 3D drill-down), F31 (place equipment)
- Screens: S29 (admin / executive Home: overview band, repair counts, 3D card, other-service sample blocks, attention list; edit mode + asset dialog; phone = floor list)
- Endpoints: 27 (CR-016 shape), 29–34
- Data: อาคาร 1 = 6 floors × 32 × 15 m (`attachments/building plan/1-อาคาร 1.pdf`); real rooms per floor + outlines traced from the PDF (owner checks); 4 asset types
- Out of this stage: QR lookup / scan (Stage 5), notifications (Stage 6), other buildings' models

**Backend (Claude)**
- [x] Migration `20261020000001_repair_cr016`: `platform.asset_types` (+ seed 4), `repair.asset_type_categories`, `platform.assets`, `platform.floor_plans`, `platform.rooms.plan_shape`, `repair.tickets.asset_id`; อาคาร 1 floors / rooms / outlines (every environment, stable ids)
- [x] Queries + repository + service: #27 (counts, floors, attention), #29, #30, #31–#34 with rules BR-F31-1…6 (unique code ignoring case, point in polygon, deactivate only, audit log)
- [x] Tests: point-in-polygon, code rules, permissions (admin writes, executive 403 on #31–#34, others 403 on all), #27 numbers = S11 counts

**Frontend**
- [x] `types.ts` / `mocks.ts` / `api.ts` for #27, #29–#34 (+ `plan-geometry.ts`, `service-samples.ts`, `three` 0.160.1)
- [x] Home: admin / executive get S29; other roles keep the current Home (Stage 6)
- [x] `BuildingScene` (D-082: the owner's model ported to plain `three`, lazy-loaded): building → floor → plan, pins, legend, keyboard floor picker; list fallback < 1024px and for buildings without a plan
- [x] Edit mode: palette drag → drop on a room → asset dialog; drag to move (toast with undo); click → edit / ปิดใช้งาน; "เพิ่มอุปกรณ์" form without a pointer

**Wiring + e2e (Claude)**
- [x] `e2e/repair/F23-dashboard.spec.ts` (numbers match S11, floor drill-down, executive read-only, employee keeps the normal Home)
- [x] `e2e/repair/F31-assets.spec.ts` (add by form, move, duplicate code, deactivate)

**Acceptance criteria**
- [x] AC1: Admin / executive Home shows the key numbers and they match S11
- [x] AC2: อาคาร 1 shows 6 floors; clicking a floor opens its plan with rooms, assets and open-ticket pins; back to the building
- [x] AC3: Admin adds an แอร์ by dragging it into a room, enters code + name, sees it after reload; moves it to another room; deactivates it (it disappears, the code stays taken)
- [x] AC4: Duplicate code → `รหัสนี้มีอุปกรณ์อื่นใช้แล้ว`; drop outside a room is refused
- [x] AC5: Executive sees everything without edit controls; direct writes 403; employee / technician Home unchanged
- [x] AC6: Phone (390px): no 3D, floor list + numbers, no horizontal scroll

**Demo script**
1. Admin → หน้าแรก → numbers → click อาคาร 1 ชั้น 1 → room pin → ticket
2. จัดวางอุปกรณ์ → drag แอร์ into HR → `AC-1-001` / `แอร์ห้อง HR` → save → move it → ปิดใช้งาน
3. Switch to ผู้บริหาร; open on a phone

---

## Stage 4 — งานซ้ำ งานทีมทำเอง และส่งต่อให้ช่าง

**Scope**
- Flows: F03 (duplicate check, follow with note + photos), F04 (team-handled record), F05 (hand over by the recording lead or admin)
- Screens: S04, S03 team card + "บันทึกงานทีม" + S05 team variant, S07 hand-over action, S11 closed tab "ส่งต่อให้ช่าง"
- Endpoints: 22, 23, 24; #5 `teamHandled`
- Out of this stage: notifications to subscribers (Stage 7)

**Backend (Claude)**
- [ ] Duplicate query (same category + floor + room / spot, open statuses, BR-F03-1 CR-009; by `room_id` + old-ticket fallback, CR-014) with an index; #5 refuses a match → 409 `DUPLICATE_FOUND` / `OWN_TICKET_AWAITING_RATING` (CR-009)
- [ ] Follow: subscriber row + `subscribed` event with note/photos; reporter/subscriber → `ALREADY_FOLLOWING`
- [ ] Team handled: leads only (BR-F04-1), note + ≥ 1 photo (BR-F04-2), created `closed` / `team_handled`, event `team_handled`
- [ ] Hand over: only `team_handled` (BR-F05-1), recording lead or admin (BR-F05-2), same ticket back to `in_progress` awaiting assessment (BR-F05-3, CR-005), event `handed_over`
- [ ] Subscribers now count in `scope=mine` and visibility
- [ ] Tests: duplicate matching, follow permissions, team-handled role check, hand-over permission matrix

**Frontend contract (Claude)**
- [ ] Types/mocks/api for 22–24 + team variant of #5; HANDOFF → Stage 5

**Frontend UI (Codex)**
- [ ] S04 sheet / dialog (follow, own case, already following, closed meanwhile)
- [ ] S03 mode switch `เรียกช่าง | ทีมแก้เองแล้ว` at the top for leads (CR-009); S03 duplicate card + blocking submit dialog (ติดตามเคสเดิม / ยกเลิกการแจ้ง only); S05 team variant
- [ ] S07 hand-over action; S11 closed-tab button + "เฉพาะงานทีมทำเอง" toggle

**Wiring + e2e (Claude)**
- [ ] `e2e/repair/F03-duplicate-follow.spec.ts`, `F04-team-handled.spec.ts`, `F05-handover.spec.ts`

**Acceptance criteria**
- [ ] AC1: Reporting on a floor + category that has an open ticket opens S04 listing it; "ติดตามเคสนี้" adds the user as subscriber, their note/photos appear in that ticket's timeline, and the ticket shows in their S06 with "คุณติดตามเคสนี้"
- [ ] AC2: "ไม่ใช่เรื่องเดียวกัน แจ้งใหม่" creates a new ticket without asking again
- [ ] AC3: Demo `housekeeper_lead` sees the team card; demo `employee` does not, and the API rejects `teamHandled` with 403
- [ ] AC4: A team-handled record is closed immediately (S05 team variant, ทีมดำเนินการเอง) and never reaches the technician
- [ ] AC5: The lead who recorded it (and admin) can hand it over; it reappears in the technician's รอประเมิน tab with the same ticket number; another lead gets 403

**Demo script**
1. Employee reports แอร์ไม่เย็น ชั้น 5 again → S04 → ติดตามเคสนี้ → S07 of the old case
2. Switch to หัวหน้าแม่บ้าน → report พื้นเปียก with "ทีมของฉันแก้ปัญหานี้เรียบร้อยแล้ว" → S05 team variant
3. Open it → ส่งต่อให้ช่าง with a reason → switch to ช่าง → it is under รอประเมิน

---

## Stage 5 — สแกน QR เติมฟอร์ม

**Scope**
- Flows: F13-B (in-app scan, phone-camera deep link, manual code, not found)
- Screens: S16, S03 QR banner (found / not found / "ไม่ใช่อุปกรณ์นี้")
- Endpoint: 25; asset seed
- Out of this stage: F13-A (printing QR labels) — phase 1 labels are generated outside the app from the URL format in the contract (D-024)

**Backend (Claude)**
- [ ] ~~Migration `assets`~~ — created in Stage 3D (CR-016: `platform.assets`, room only, category via `asset_type_categories`); here: #25 lookup returns `room` + type, S03 prefills, ticket stores `asset_id` + `asset_code`
- [ ] Endpoint 25; tests

**Frontend contract (Claude)**
- [ ] Types/mocks/api for 25 (`AC-05-012` found, anything else not found); QR decoder library chosen (BarcodeDetector + fallback — proposed) and added; HANDOFF → Stage 6
- [ ] `proxy.ts` keeps `?asset=` through the login redirect (F13-B) — verify, it is shared code

**Frontend UI (Codex)**
- [ ] S16 camera / blocked / manual sheet / desktop
- [ ] S03 QR banner states

**Wiring + e2e (Claude)**
- [ ] `e2e/repair/F13B-qr-prefill.spec.ts` (deep link logged out → login → prefilled form; manual code not found)

**Acceptance criteria**
- [ ] AC1: Opening `/repair/new?asset=AC-05-012` while logged out → after login the form shows the QR banner with ระบบปรับอากาศ, อาคารหลัก ชั้น 5, ห้องประชุม 5B prefilled and editable
- [ ] AC2: Unknown code → "ไม่พบอุปกรณ์นี้" and an empty form that still submits
- [ ] AC3: On a phone, the scan button reads a printed test QR and opens the prefilled form; denying camera shows "เปิดกล้องไม่ได้" with manual entry
- [ ] AC4: The created ticket shows the asset line in S07

**Demo script**
1. Print / show a QR of `{FRONTEND_URL}/repair/new?asset=AC-05-012`
2. Scan with the phone camera (logged out) → login → prefilled form → submit
3. In the app, สแกน → deny camera → กรอกรหัสอุปกรณ์เอง → `XX-99` → not found

---

## Stage 6 — หน้าแรกตาม role และแจ้งเตือน

**Scope**
- Flows: F01 step 3 (Home by role), F19-B (all events in its table), auto-close reminder (F07 Added by Claude)
- Screens: S02 (3 variants), S13, bell count in hero / top bar, bottom-nav dot
- Endpoints: 26, P4–P7
- Shared code touched: `internal/platform` notifications table + service (`platform.notifications`), `components/shared` bell — listed in the stage report

**Backend (Claude)**
- [ ] Migration `platform.notifications` (user, type, ticket, params jsonb, read_at); platform `Notifier` interface injected into the repair service in `main.go`
- [ ] Fan-out per the F19-B table on every event from Stages 1–4 (new → technician; assessed / date changed → reporter + subscribers; resolved → reporter / subscribers; sent back → technician; admin closed → reporter + subscribers + technician) (CR-005)
- [ ] Auto-close reminder 24 h before `autoCloseAt` (once per ticket) and `ticket_auto_closed`
- [ ] Endpoint 26 (role-based blocks) and P4–P7
- [ ] Tests: recipients per event, nobody sees others' notifications (BR-F19B-1)

**Frontend contract (Claude)**
- [ ] Types/mocks/api for 26, P4–P7; notification text templates (S13 table) in `modules/repair`; HANDOFF → Stage 7 with the widened edit list (`app/(app)/page.tsx`, `app/(app)/notifications/**`)

**Frontend UI (Codex)**
- [ ] S02 variants A / B / C (mobile + desktop) per spec and option-a.html
- [ ] S13 list, groups, mark read / all
- [ ] Bell badge + bottom-nav dot (request change in `components/shared` via Open questions if needed)

**Wiring + e2e (Claude)**
- [ ] `e2e/repair/F19B-notifications.spec.ts` (full loop: each recipient gets the right text), `F01-home-by-role.spec.ts`

**Acceptance criteria**
- [ ] AC1: Running the Stage 2 demo loop produces exactly the F19-B notifications for each role, with the exact S13 copy
- [ ] AC2: Tapping a notification marks it read and opens S07; the bell count drops
- [ ] AC3: Home shows the awaiting card on top for a reporter with a resolved ticket; technician Home shows รอประเมิน / กำลังซ่อม counts and the oldest open jobs (CR-015); admin Home shows counts linking to S11 tabs
- [ ] AC4: A ticket 48 h after `resolved` produces one reminder; at 72 h the auto-closed notification

**Demo script**
1. Repeat the main loop across roles and open the bell each time
2. Show the three Home variants via the role switcher (mobile + desktop)

---

## Stage 7 — ภาพรวมอาคาร 3D

> **CR-016 (2026-10-19): replaced by Stage 3D.** The tasks below are kept for history only.

**Scope**
- Flows: F23 — model generated from buildings/floors; pins by highest priority; floor list
- Screens: S12 (3D, selection, list view, mobile list + sheet)
- Endpoint: 27; S12 floor list uses #6
- Before starting: user confirms floor count / names / rear building (D-010 open question). Rendering = SVG isometric as in the mockup (D-025; no 3D library)
- (CR-014) S27 rooms come from `platform.rooms` and tickets' `room_id`

**Backend (Claude)**
- [ ] Endpoint 27 (aggregate query, index on floor + status); tests

**Frontend contract (Claude)**
- [ ] Types/mocks/api for 27 (mock with 9 floors as in the mockup + a variant with 10 floors); HANDOFF → Stage 8

**Frontend UI (Codex)**
- [ ] `BuildingModel` component (data-driven SVG), panel, list view, mobile list + sheet

**Wiring + e2e (Claude)**
- [ ] `e2e/repair/F23-overview.spec.ts` (select floor → open ticket; keyboard selection; executive access; employee forbidden)

**Acceptance criteria**
- [ ] AC1: Counts per floor match S11 totals for the same filters
- [ ] AC2: Changing the seed to add a floor changes the model without code changes
- [ ] AC3: Floors are selectable by mouse and keyboard; list view shows the same numbers
- [ ] AC4: Employee and technician get the forbidden state

**Demo script**
1. Admin → ภาพรวมอาคาร → hover ชั้น 2 → click ชั้น 5 → open a ticket
2. Toggle ดูแบบรายการ; switch to ผู้บริหาร; open on a phone

---

## Stage 8 — ตรวจสิทธิ์ edge cases และความพร้อม UAT

**Scope**
- The full permission matrix in `01-users.md` for all six roles, every edge-case table in `02-flows.md`, design-system "Definition of done" items across S01–S16
- Load the real seed files if they have arrived (categories + symptoms, buildings / floors, assets, roles incl. the one technician)
- Add the unit / e2e tests skipped in CR-005 (Stages 1–2 actions, contractors, auto-close)

**Backend (Claude)**
- [ ] Table-driven API test: every endpoint × every role → expected status (matrix generated from `01-users.md`)
- [ ] Query plans checked for list / work list / overview endpoints with 50k seeded tickets; missing indexes added
- [ ] Logging review: no tokens or full personal data in logs (PROJECT.md NFR)

**Frontend (Claude, Codex for fixes listed in HANDOFF)**
- [ ] Sweep of loading / empty / error / forbidden states on every screen at 375px and 1280px
- [ ] Accessibility pass (labels, focus order, contrast, reduced motion, screen-reader names for drag and 3D)

**Wiring + e2e (Claude)**
- [ ] `e2e/repair/permissions.spec.ts` (UI-level: each role's nav and forbidden pages)
- [ ] Full regression run of all e2e specs

**Acceptance criteria**
- [ ] AC1: The permission test covers 100% of endpoints × roles and passes
- [ ] AC2: Every edge case in `02-flows.md` has a passing test or a manual check recorded in PROGRESS.md
- [ ] AC3: No state on any screen is missing (checklist in PROGRESS.md signed off by the user)
- [ ] AC4: List endpoints respond under 300 ms p95 with 50k tickets locally

**Demo script**
1. Walk the role switcher through all six roles on mobile and desktop
2. Show the permission test report and the e2e run

---

## Decisions recorded with this plan (DECISIONS.md)

- D-021 IDs are UUIDs (not guessable in URLs; tickets are shown by `ticketNo`)
- D-022 Photos: `PhotoStore` interface, phase 1 local directory (`PHOTO_STORAGE_DIR`, persistent volume), max 10 MB, client resize 1920px JPEG, unattached photos deleted after 24 h
- D-023 Platform screens: S01, S14, S15 + AppShell in Stage 0; S02 Home and S13 notifications (+ `platform.notifications`) in repair Stage 7
- D-024 QR content = `{FRONTEND_URL}/repair/new?asset={code}`; F13-A label printing stays outside the app in phase 1
- D-025 Drag-and-drop library `@dnd-kit/sortable` (dropped by CR-005 — no queue); S12 rendered as data-driven SVG (no 3D library)
- CR-005 decisions: D-038 – D-041

## Open questions

- Real seed files (categories, the technician's account, buildings / floors, assets) — needed by Stage 8 at the latest; sample data until then · categories / symptoms arrived 2026-10-19 (CR-014)
- (CR-014) Real room list per floor (name + area type) — who supplies it? Sample rooms (seed.go, dev/UAT) until then
- ~~(CR-014) ลานจอด / ไม้กั้น has no building / floor~~ — answered 2026-10-19: building `พื้นที่ภายนอกอาคาร` → floor / room `ลานจอดรถ` (D-075); real zones still open
- Deploy target for UAT / production (affects `PHOTO_STORAGE_DIR` volume and backups)
- Floor count / names / rear building for S12 — needed before Stage 7
