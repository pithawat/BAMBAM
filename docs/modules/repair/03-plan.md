# ระบบแจ้งซ่อม — Build plan

Status: APPROVED (2026-10-14)

<!-- Written by Claude in /stage-plan (2026-10-14). Stages are vertical slices that can be demoed.
     Each stage should fit in one focused session (Claude part + Codex part).
     Endpoints: 04-api-contract.md · Screens: ui/screens/ · e2e: frontend/e2e/repair/<flow-id>-*.spec.ts -->

## Before Stage 1 — Stage 0 (platform, `docs/shared/00-platform.md`)

Repair Stage 1 needs: SSO login (S01 `/login`, `/signed-out`), `proxy.ts` gate, `GET /api/v1/me` (P1), AppShell with the role-based sidebar, top bar and `BottomNav` (`ui/screens/_common.md` §1), S14 profile + logout, S15 role switcher + demo users (P2, P3, one seeded demo user per role with the names in `_common.md` §8), design-system tokens, fonts, mascot + logo assets, shared `EmptyState` / `ErrorState` / `ForbiddenState` / `Mascot` / `ServiceIcon` / `ServiceHeader` / `PriorityIndicator`. Bell and Home are placeholders until Stage 7 (Home shows the option-a CTA card + services only).

## Stages

| Stage | Goal (demoable) | Flows | Screens | Status |
|---|---|---|---|---|
| 1 | พนักงานแจ้งซ่อมพร้อมรูปได้จริง ได้เลขงาน และเปิดดูงานของตัวเองได้ | F02 (happy path), F06 | S03, S05, S06, S07 (view only) | pending |
| 2 | ช่างเห็นคิวหมวดของตัวเอง รับงาน (ทีละ 1 งาน) บันทึกผล หรือคืนงานได้ | F21 | S09, S10, S07 (technician actions) | pending |
| 3 | ผู้แจ้งตรวจรับให้ดาว หรือส่งกลับให้ช่างคนเดิม และงานปิดเองเมื่อครบ 3 วัน — วงจรหลักครบ | F07, CR-001 reserved job | S08, S07 (reporter actions), S09 (reserved states) | pending |
| 4 | Admin เห็นทุกงาน จัดลำดับคิว ปรับความเร่งด่วน ปิดงานได้; ผู้บริหารดูได้อย่างเดียว | F22, F08-B, BR-F06-1 | S11, S07 (admin actions) | pending |
| 5 | ระบบจับงานซ้ำให้ติดตามเคสเดิม หัวหน้าทีมบันทึกงานที่ทีมทำเอง และส่งต่อให้ช่างได้ | F03, F04, F05 | S04, S03 (team card), S07 + S11 (hand over) | pending |
| 6 | สแกน QR ที่อุปกรณ์แล้วได้ฟอร์มที่กรอกไว้ให้ | F13-B | S16, S03 (QR banner) | pending |
| 7 | หน้าแรกตาม role และแจ้งเตือนเฉพาะตัวพร้อมกระดิ่ง | F01 (Home), F19-B | S02, S13, bell | pending |
| 8 | ภาพรวมอาคาร 3D ให้ Admin / ผู้บริหาร | F23 | S12 | pending |
| 9 | ตรวจสิทธิ์ทุก role, edge cases, a11y และความพร้อม UAT | all phase-1 flows | all | pending |

Order rationale: 1→3 is the main loop (report → repair → confirm) split into three slices that each demo end to end. Admin control (4) comes next because the queue needs an owner. 5–6 add entry variants of F02. Notifications (7) come after all events exist, so they hook into one complete event list. 3D (8) is mockup-first (D-010). 9 hardens everything.

---

## Stage 1 — แจ้งซ่อมได้จริงและดูงานของตัวเองได้

**Scope**
- Flows: F02 steps 1–6 without duplicate check, team-handled or QR; F06 (list, search, filters, detail, timeline)
- Screens: S03 (no QR banner, no team card), S05 (normal variant), S06, S07 (no action bar yet; `allowedActions` is empty)
- Endpoints: 1, 2, 3, 4, 5 (without `teamHandled`), 6 + 7 (`scope=mine`), 8
- Out of this stage: S04 duplicates, F04, F13-B, any status change after `new`, notifications, Home widgets

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
3. Show S05, open ดูงานนี้ (S07), back to งานของฉัน, search by the ticket number
4. Switch to หัวหน้าแม่บ้าน and paste the ticket URL → forbidden

---

## Stage 2 — ช่างรับงานและบันทึกผล

**Scope**
- Flows: F21 (queue in order, building filter, claim with one-job rule, record result, give back) — BR-F21-1 … BR-F21-7
- Screens: S09 (holding / free / empty / filter-empty / no-categories states; reserved states come in Stage 3), S10, S07 technician actions (รับงาน, disabled helper, บันทึกผลซ่อม, คืนงาน), claim + give-back dialogs
- Endpoints: 9, 10, 11, 12, 13; #8 returns `allowedActions` / `blockedActions` for technicians
- Out of this stage: reserved (sent-back) tickets, admin reorder (queue uses automatic order), notifications

**Backend (Claude)**
- [ ] Migration: `technician_categories`; dev seed maps demo technicians to categories (`_common.md` §8)
- [ ] Queue order query: `new` in my categories, not reserved for others, automatic order priority → created_at (BR-F22-1); position numbers over the full queue
- [ ] Service rules: claim in one transaction with `SELECT … FOR UPDATE` on the ticket and a busy check on the technician (BR-F21-2/3); resolve needs note + ≥ 1 photo (BR-F21-4) and sets `autoCloseAt`; give back returns the ticket to `new` with its old rank (BR-F21-5); events `claimed`, `resolved`, `given_back`
- [ ] Allowed-actions builder (one function used by #8 and future stages), unit-tested per viewer × status
- [ ] Tests: concurrent claim (two goroutines → one `TICKET_ALREADY_CLAIMED`), busy claim → `TECHNICIAN_BUSY`, non-holder resolve → `NOT_HOLDER`

**Frontend contract (Claude)**
- [ ] Types/mocks/api for 9–13; mocks include a race mock returning `TICKET_ALREADY_CLAIMED` and a technician without categories
- [ ] HANDOFF → Stage 2

**Frontend UI (Codex)**
- [ ] S09 (mobile + desktop), building filter persisted in sessionStorage
- [ ] S10 form
- [ ] S07 technician action bar + dialogs (`_common.md` §7)

**Wiring + e2e (Claude)**
- [ ] `e2e/repair/F21-claim-resolve.spec.ts` (claim → claim of a second job blocked → resolve with photo → reporter sees `ซ่อมเสร็จ รอตรวจรับ`), `F21-give-back.spec.ts`

**Acceptance criteria**
- [ ] AC1: Demo `technician` sees only `new` tickets of their categories in priority → time order; building filter hides rows without reordering and keeps position numbers
- [ ] AC2: After claiming one ticket every other "รับงาน" is disabled with "จบงานปัจจุบันก่อน (บันทึกผล หรือ คืนงาน)"; calling the claim API directly returns 422 `TECHNICIAN_BUSY`
- [ ] AC3: Two browsers claim the same ticket at once → exactly one succeeds, the other sees "งานนี้มีช่างรับไปแล้ว"
- [ ] AC4: Resolve without a photo is blocked with "แนบรูปหลังซ่อมอย่างน้อย 1 รูป"; with a photo the reporter's S06 shows the ticket under รอตรวจรับ
- [ ] AC5: Give back with a reason → ticket returns to its old queue position; reason shows in the S07 timeline
- [ ] AC6: Technician with no categories sees "ยังไม่ได้กำหนดหมวดงาน ติดต่อ Admin"

**Demo script**
1. As employee report 2 tickets (ไฟฟ้า สูง, ระบบปรับอากาศ ปกติ)
2. Switch to ช่างเทคนิค → S09 shows both in order → filter อาคารด้านหลัง → ดูทุกอาคาร
3. รับงาน the first → second claim disabled → บันทึกผลซ่อม with photo → back to queue, free again
4. Claim the second → คืนงาน with reason → it is back in the queue

---

## Stage 3 — ตรวจรับ ส่งกลับให้แก้ และปิดอัตโนมัติ

**Scope**
- Flows: F07 (confirm with optional rating, send back with reason, auto-close after 3 days), CR-001 reserved job (BR-F07-3, BR-F21-3 reserved part)
- Screens: S08 (both modes), S07 reporter actions + `?action=confirm|sendback`, S07 "เริ่มงาน", S09 reserved pinned card / strip / note
- Endpoints: 14, 15, 16; auto-close job
- Out of this stage: auto-close reminder notification (Stage 7)

**Backend (Claude)**
- [ ] Service rules: only the reporter confirms / sends back (BR-F07-1); rating optional (BR-F07-2); send back → same technician `in_progress` if free, else `new` + `reserved_for` (BR-F07-3); start reserved; claim blocked while a reserved ticket waits (`RESERVED_TICKET_WAITING`); events `confirmed`, `sent_back`, `started`, `auto_closed`
- [ ] Auto-close worker: ticker every 15 min in the API process, idempotent, closes `resolved` where `auto_close_at <= now` (BR-F07-4); `make` target / test hook to run it once
- [ ] Tests: send back free vs busy technician; reserved hidden from other technicians' queues; auto-close at 72 h boundary; confirm after auto-close → `TICKET_CLOSED`

**Frontend contract (Claude)**
- [ ] Types/mocks/api for 14–16; mocks for each S08 error; HANDOFF → Stage 3

**Frontend UI (Codex)**
- [ ] S08 sheet / dialog (stars, comment, reason, photos)
- [ ] S07 reporter action bar, query-param opening
- [ ] S09 reserved card, strip and note

**Wiring + e2e (Claude)**
- [ ] `e2e/repair/F07-confirm.spec.ts` (resolve → confirm 4 stars → closed + rating shown), `F07-send-back.spec.ts` (busy technician → reserved card → start after resolving current), `F07-auto-close.spec.ts` (time moved via test hook)

**Acceptance criteria**
- [ ] AC1: Reporter confirms with 4 stars → S07 shows ปิดงานแล้ว · ตรวจรับแล้ว and ★★★★☆ ดีมาก; a subscriber of the same ticket has no confirm button and the API returns `NOT_REPORTER`
- [ ] AC2: Send back while the technician is free → ticket is `in_progress` with that technician again
- [ ] AC3: Send back while the technician holds another job → their S09 shows "ส่งกลับให้แก้ · งานถัดไปของคุณ" with the strip; other technicians do not see the ticket; "เริ่มงาน" works only after the current job is finished
- [ ] AC4: Running the auto-close job on a ticket resolved 72 h ago closes it as ปิดอัตโนมัติ; one resolved 71 h ago stays open
- [ ] AC5: Send back without a reason shows "กรุณาบอกสิ่งที่ยังไม่เรียบร้อย"

**Demo script**
1. Continue from Stage 2 demo: employee opens the resolved ticket → ส่งกลับให้แก้ with a reason
2. Technician (holding another job) sees the reserved card → resolves current job → เริ่มงาน → resolves again
3. Employee confirms with 4 stars; show the timeline end to end
4. Run the auto-close hook on a seeded old resolved ticket

---

## Stage 4 — Admin คิวงานและการจัดการ

**Scope**
- Flows: F22 (reorder per category, change priority), F08-B (close any ticket), BR-F06-1 all tickets, BR-F22-6 executive read-only
- Screens: S11 (all tabs, drag + keyboard + menu moves, undo, executive mode, mobile list), S07 admin actions (ปิดงาน, priority select, send-back count, queue-move events)
- Endpoints: 6 + 7 (`scope=all`), 17, 18, 19, 20, 21
- Out of this stage: hand over button in the closed tab (Stage 5 — no team tickets exist yet)

**Backend (Claude)**
- [ ] Manual queue order: `queue_rank` (fractional / gap-based), `manually_ordered`; new tickets placed after same-priority tickets even when admin reordered (BR-F22-2); priority change resets manual order (BR-F22-4); `queueVersion` for conflict detection
- [ ] Service rules: only `new`, non-reserved tickets move (BR-F22-5); close from any open status frees the holder (BR-F21-8); events `queue_moved` (admin/executive-only visibility), `priority_changed`, `admin_closed`
- [ ] Audit: every move / priority change writes who, when, from → to (BR-F22-3) — via `ticket_events` + `platform.audit_log`
- [ ] Tests: move + new-ticket insertion rules, stale version → `QUEUE_CHANGED`, executive gets 403 on every write

**Frontend contract (Claude)**
- [ ] Types/mocks/api for 17–21 and `scope=all`; HANDOFF → Stage 4 (adds `@dnd-kit/sortable`, D-025)

**Frontend UI (Codex)**
- [ ] S11 desktop + mobile, executive read-only rendering
- [ ] S07 admin actions card + close / priority dialogs

**Wiring + e2e (Claude)**
- [ ] `e2e/repair/F22-reorder.spec.ts` (drag + keyboard move, undo, technician sees new order), `F08B-admin-close.spec.ts` (close a held ticket → technician free), `F22-executive-readonly.spec.ts`

**Acceptance criteria**
- [ ] AC1: Admin drags a ticket to position 1 in ระบบปรับอากาศ → the technician's S09 shows it first after refresh; the row shows "จัดลำดับเอง"; "เลิกทำ" restores it
- [ ] AC2: The same move works with keyboard only (handle → Space → arrows → Space)
- [ ] AC3: Changing priority asks for confirmation and puts a manually ordered ticket back into automatic order
- [ ] AC4: Admin closes a ticket a technician is holding → the technician can claim a new job immediately
- [ ] AC5: Executive sees the same tabs and data with no drag handles, selects or close buttons; direct API writes return 403
- [ ] AC6: Two admin tabs: moving in a stale tab shows "ลำดับคิวเปลี่ยนไปแล้ว โหลดใหม่ให้แล้ว"

**Demo script**
1. Switch to Admin → คิวงาน → ระบบปรับอากาศ → drag the ปกติ ticket to the top → switch to ช่าง and show the order
2. Admin → กำลังดำเนินการ → ปิดงาน the held ticket with a reason
3. Switch to ผู้บริหาร → same page, read-only

---

## Stage 5 — งานซ้ำ งานทีมทำเอง และส่งต่อให้ช่าง

**Scope**
- Flows: F03 (duplicate check, follow with note + photos), F04 (team-handled record), F05 (hand over by the recording lead or admin)
- Screens: S04, S03 team card + "บันทึกงานทีม" + S05 team variant, S07 hand-over action, S11 closed tab "ส่งต่อให้ช่าง"
- Endpoints: 22, 23, 24; #5 `teamHandled`
- Out of this stage: notifications to subscribers (Stage 7)

**Backend (Claude)**
- [ ] Duplicate query (same category + floor, open statuses, BR-F03-1) with an index
- [ ] Follow: subscriber row + `subscribed` event with note/photos; reporter/subscriber → `ALREADY_FOLLOWING`
- [ ] Team handled: leads only (BR-F04-1), note + ≥ 1 photo (BR-F04-2), created `closed` / `team_handled`, event `team_handled`
- [ ] Hand over: only `team_handled` (BR-F05-1), recording lead or admin (BR-F05-2), same ticket back to `new` in priority order (BR-F05-3), event `handed_over`
- [ ] Subscribers now count in `scope=mine` and visibility
- [ ] Tests: duplicate matching, follow permissions, team-handled role check, hand-over permission matrix

**Frontend contract (Claude)**
- [ ] Types/mocks/api for 22–24 + team variant of #5; HANDOFF → Stage 5

**Frontend UI (Codex)**
- [ ] S04 sheet / dialog (follow, own case, already following, closed meanwhile)
- [ ] S03 team card for leads; S05 team variant
- [ ] S07 hand-over action; S11 closed-tab button + "เฉพาะงานทีมทำเอง" toggle

**Wiring + e2e (Claude)**
- [ ] `e2e/repair/F03-duplicate-follow.spec.ts`, `F04-team-handled.spec.ts`, `F05-handover.spec.ts`

**Acceptance criteria**
- [ ] AC1: Reporting on a floor + category that has an open ticket opens S04 listing it; "ติดตามเคสนี้" adds the user as subscriber, their note/photos appear in that ticket's timeline, and the ticket shows in their S06 with "คุณติดตามเคสนี้"
- [ ] AC2: "ไม่ใช่เรื่องเดียวกัน แจ้งใหม่" creates a new ticket without asking again
- [ ] AC3: Demo `housekeeper_lead` sees the team card; demo `employee` does not, and the API rejects `teamHandled` with 403
- [ ] AC4: A team-handled record is closed immediately (S05 team variant, ทีมดำเนินการเอง) and never enters the technician queue
- [ ] AC5: The lead who recorded it (and admin) can hand it over; it reappears in the technician queue with the same ticket number; another lead gets 403

**Demo script**
1. Employee reports แอร์ไม่เย็น ชั้น 5 again → S04 → ติดตามเคสนี้ → S07 of the old case
2. Switch to หัวหน้าแม่บ้าน → report พื้นเปียก with "ทีมของฉันแก้ปัญหานี้เรียบร้อยแล้ว" → S05 team variant
3. Open it → ส่งต่อให้ช่าง with a reason → switch to ช่าง → it is in the queue

---

## Stage 6 — สแกน QR เติมฟอร์ม

**Scope**
- Flows: F13-B (in-app scan, phone-camera deep link, manual code, not found)
- Screens: S16, S03 QR banner (found / not found / "ไม่ใช่อุปกรณ์นี้")
- Endpoint: 25; asset seed
- Out of this stage: F13-A (printing QR labels) — phase 1 labels are generated outside the app from the URL format in the contract (D-024)

**Backend (Claude)**
- [ ] Migration `assets` (code unique case-insensitive, category, building, floor, location detail) + dev seed (`AC-05-012` …); ticket keeps `asset_code`
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

## Stage 7 — หน้าแรกตาม role และแจ้งเตือน

**Scope**
- Flows: F01 step 3 (Home by role), F19-B (all events in its table), auto-close reminder (F07 Added by Claude)
- Screens: S02 (3 variants), S13, bell count in hero / top bar, bottom-nav dot
- Endpoints: 26, P4–P7
- Shared code touched: `internal/platform` notifications table + service (`platform.notifications`), `components/shared` bell — listed in the stage report

**Backend (Claude)**
- [ ] Migration `platform.notifications` (user, type, ticket, params jsonb, read_at); platform `Notifier` interface injected into the repair service in `main.go`
- [ ] Fan-out per the F19-B table on every event from Stages 1–5 (new in category → category technicians; claimed / given back → reporter + subscribers; resolved → reporter / subscribers; sent back → technician; admin closed → reporter + subscribers + holder)
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
- [ ] AC1: Running the Stage 3 demo loop produces exactly the F19-B notifications for each role, with the exact S13 copy
- [ ] AC2: Tapping a notification marks it read and opens S07; the bell count drops
- [ ] AC3: Home shows the awaiting card on top for a reporter with a resolved ticket; technician Home shows the current-job card states; admin Home shows the 4 counts linking to S11 tabs
- [ ] AC4: A ticket 48 h after `resolved` produces one reminder; at 72 h the auto-closed notification

**Demo script**
1. Repeat the main loop across roles and open the bell each time
2. Show the three Home variants via the role switcher (mobile + desktop)

---

## Stage 8 — ภาพรวมอาคาร 3D

**Scope**
- Flows: F23 — model generated from buildings/floors; pins by highest priority; floor list
- Screens: S12 (3D, selection, list view, mobile list + sheet)
- Endpoint: 27; S12 floor list uses #6
- Before starting: user confirms floor count / names / rear building (D-010 open question). Rendering = SVG isometric as in the mockup (D-025; no 3D library)

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

## Stage 9 — ตรวจสิทธิ์ edge cases และความพร้อม UAT

**Scope**
- The full permission matrix in `01-users.md` for all six roles, every edge-case table in `02-flows.md`, design-system "Definition of done" items across S01–S16
- Load the real seed files if they have arrived (categories + symptoms, technician ↔ category, buildings / floors, assets, roles)

**Backend (Claude)**
- [ ] Table-driven API test: every endpoint × every role → expected status (matrix generated from `01-users.md`)
- [ ] Query plans checked for list / queue / overview endpoints with 50k seeded tickets; missing indexes added
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
- D-025 Drag-and-drop library `@dnd-kit/sortable`; S12 rendered as data-driven SVG (no 3D library)

## Open questions

- Real seed files (categories, technicians, buildings / floors, assets) — needed by Stage 9 at the latest; sample data until then
- Deploy target for UAT / production (affects `PHOTO_STORAGE_DIR` volume and backups)
- Floor count / names / rear building for S12 — needed before Stage 8
