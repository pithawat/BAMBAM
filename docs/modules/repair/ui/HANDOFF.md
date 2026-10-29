# UI handoff — ระบบแจ้งซ่อม — Stages 1–2 + 2R (CR-008)

Status: BUILT BY CLAUDE — Stage 2M (CR-014 S03 + location line) on top of Stage 2N (CR-010 navbar + CR-011 S06 / S07 + CR-012 S07 / S08 + S06 polish D-068) on top of Stage 2R (CR-008 + CR-009), waiting for user acceptance; Codex has nothing to build. Visual sources: `output/navbar-redesign/` (CR-010 / CR-011), docs/modules/repair/changes/CR-008/ (design demo 06)

## CR-014 (approved 2026-10-19) — Stage 2M, built by Claude 2026-10-19

S03 = 3 equal frames (`changes/CR-014/form-steps.html`), categories from the DB master, required room. Files (Claude owns): `modules/repair/components/report-form.tsx` (rewritten), `modules/repair/{types,mocks,errors,priority}.ts`, location line `placeLine` / `ticketLocation` / `floorLabel` in `ticket-presentation.ts`, used by `my-tickets.tsx`, `ticket-detail.tsx`, `ticket-actions.tsx`, `technician-work.tsx`, `report-success.tsx`. Codex has nothing to build.

## CR-010 / CR-011 (2026-10-18) — built by Claude

| Area | Files (Claude owns; shared code marked *) |
|---|---|
| Shell, navbar, account menu, role switcher strip | *`components/shared/{app-shell,app-navbar,role-switcher,page-header,logout-dialog,service-unavailable,mascot}.tsx`; removed `app-sidebar.tsx`, `bottom-nav.tsx` |
| Car / room "เร็วๆ นี้" | `app/(app)/{car-booking,room-booking}/page.tsx` |
| Repair section nav | `app/(app)/repair/layout.tsx`, `modules/repair/components/repair-nav.tsx` |
| S06 / S07 | `modules/repair/components/{my-tickets,ticket-detail,ticket-story}.tsx` |
| S07 / S08 CR-012 (2026-10-19) | `modules/repair/components/{ticket-detail,ticket-actions}.tsx` — visual source `output/ticket-detail-redesign/` (no priority row) |

## CR-005 (2026-10-15) — built by Claude, not by Codex

The user asked Claude to change the flow and wire the real API for report + tracking (reporter and technician) in one go. Codex does not need to build these; read this before touching the files.

| Screen | Route → file |
|---|---|
| S06 / S07 updates (step labels, forward-only tracker, action bar) | `modules/repair/components/{my-tickets,ticket-detail,ticket-progress,ticket-actions}.tsx` |
| S08 ประเมินงาน / ส่งกลับ, S17 ประเมินงาน (dialogs) | `ticket-actions.tsx` |
| S09 งานซ่อม | `/repair/work` → `app/(app)/repair/work/page.tsx`, `technician-work.tsx` |
| S10 บันทึกผลซ่อม | `/repair/tickets/[id]/resolve` → `resolve-form.tsx` |
| S18 ช่างภายนอก | `/repair/contractors`, `/repair/contractors/[id]` → `contractors.tsx` |
| Nav | `components/shared/app-sidebar.tsx`, `bottom-nav.tsx` (shared code) |

Mock mode (`NEXT_PUBLIC_USE_MOCKS=true`) covers Stage 1 reads only; Stage 2 actions and contractors always call the API.

<!-- Claude sets `READY FOR CODEX — Stage <n>` in /build-stage prepare; Codex sets `UI DONE — Stage <n>, waiting for Claude wire`. -->

<!-- Written by Claude (/ui-spec 2026-10-14, updated by /build-stage prepare). Codex starts here.
     The Stage column is filled by /stage-plan. Only build the screens of the current stage. -->

## Read in this order

1. `frontend/AGENTS.md` (rules)
2. `docs/shared/design-system.md` (tokens, components, patterns)
3. `ui/screens/_common.md` (app shell per role, labels, list rows, PhotoPicker, shared dialogs and state copy) — applies to every screen
4. Screen specs for this stage (below)
5. Mockups next to them (open the .html in a browser; phone frames scroll)
6. `frontend/src/modules/repair/types.ts` and `mocks.ts` (data shapes — do not change)

## Stage 1 — what to build now

Goal: พนักงานแจ้งซ่อมพร้อมรูปได้จริง ได้เลขงาน และเปิดดูงานของตัวเองได้ (`../03-plan.md` Stage 1).

| Screen | Build in Stage 1 | Leave out (later stage) | Route → file |
|---|---|---|---|
| S03 ฟอร์มแจ้งซ่อม | mobile 4-step wizard + desktop sections with sticky summary panel (CR-002), อาคาร / ชั้น via `ChoiceField` (CR-002), `PhotoPicker` (`_common.md` §5), validation with exact copy, discard dialog | QR banner / `?asset=` (6), team-handled card (5), duplicate check + S04 (5): submit goes straight to `createTicket` | `/repair/new` → `app/(app)/repair/new/page.tsx` |
| S05 แจ้งสำเร็จ | normal variant | team variant (5) | `/repair/new/done?id={ticketId}` → `app/(app)/repair/new/done/page.tsx` |
| S06 ติดตามงานซ่อม | status groups (CR-002), search (300 ms), scope segmented control, date filter sheet / `FilterPill`, awaiting cards, rows with thumb + progress, closed preview + `?closed=all`, desktop list + preview panes, "โหลดเพิ่ม" per group, all states | — | `/repair/my` → `app/(app)/repair/my/page.tsx` |
| S07 รายละเอียดงาน | view only: header card, details, photos + lightbox, result card, timeline (all event labels), loading / not-found / forbidden / error states | the action bar and every action dialog (2–5); `allowedActions` is always `[]` in Stage 1 — render it generically so later stages only add buttons | `/repair/tickets/[id]` → `app/(app)/repair/tickets/[id]/page.tsx` |

Empty route folders exist (with `.gitkeep`; delete it when you add the page). Put reusable pieces in `modules/repair/components/` (e.g. `PhotoPicker`, `TicketStatusBadge`, `TicketListRow`, `Timeline`).

### Data — `frontend/src/modules/repair/api.ts` (do not call `fetch` yourself)

| Function | Used by | Notes |
|---|---|---|
| `getCategories()`, `getBuildings()` | S03 | reload both after `MASTER_DATA_CHANGED` |
| `uploadPhoto(file, { onProgress, signal })` | S03 `PhotoPicker` | resizes to 1920px JPEG itself (D-022); `onProgress` 0–1 drives the ring; abort on tile remove / unmount; rejects `PHOTO_TYPE_NOT_ALLOWED` / `PHOTO_TOO_LARGE` / `NETWORK` |
| `createTicket(req)` | S03 submit | send `teamHandled: null`; on success → `router.replace("/repair/new/done?id=" + ticket.id)` |
| `getTicket(id)` | S05, S07 | 404 `TICKET_NOT_FOUND` → not-found state · 403 `FORBIDDEN` → forbidden state |
| `getTickets(query)`, `getTicketCounts(query)` | S06 | one call per group (CR-002) — group `open` → `status: ["new","in_progress"]` · `resolved` → `["resolved"]` · `closed` → `["closed"]`; range → `createdFrom`; scope select → `relation`; server already orders (awaiting-mine first, closed by close time) |

- Errors: `modules/repair/errors.ts` → `errorMessage(err)` for toasts / alerts, `createTicketFieldErrors(err)` maps `VALIDATION_FAILED` fields to the S03 messages. Never show `err.message`.
- `MAX_PHOTOS` (5) and `MAX_PHOTO_BYTES` are exported from `api.ts`.
- Photo URLs (`thumbUrl`, `url`) are same-origin API paths in real mode and data/blob URLs in mock mode — use a plain `<img>` (not `next/image`).
- Date formatting: `lib/format.ts` (`formatDateTime`); add a list-date helper inside `modules/repair/components/` if you need the `_common.md` §3 list format (today / เมื่อวาน / this year / older).

### Mocks — `NEXT_PUBLIC_USE_MOCKS=true` (default in `.env.development`)

- Viewer = the role chosen in the role switcher (S15); sample tickets are seen from วรรณา (พนักงานทั่วไป). Use "ดูในบทบาท" → หัวหน้าแม่บ้าน to see the S07 forbidden state for her tickets.
- Scenario: add `?mock=<name>` to any URL (remembered; `?mock=normal` resets): `normal` · `empty` · `error` · `forbidden` · `slow` · `validation` · `master_changed` · `upload_error`.
- Fixed ids in `mocks.ts` `MOCK_IDS`: `forbiddenTicket` (someone else's ticket), `notFoundTicket`, `awaitingTicket` (resolved, waiting for วรรณา).
- Tickets created in mock mode appear in S06 / S07 until the page reloads.

## Screens

| Screen | Spec | Mockup (closest if none) | Route | Stage |
|---|---|---|---|---|
| S01 เข้าสู่ระบบ / ออกจากระบบแล้ว | `screens/S01-login.md` | — (`docs/shared/style/options/option-a.html`) | `/login`, `/signed-out` | 0 (platform) |
| S02 หน้าแรก | `screens/S02-home.md` | `docs/shared/style/options/option-a.html` (employee); `mockups/S09-technician-queue.html` (technician); `mockups/S11-admin-queue.html` (admin) | `/` | 7 (Stage 0: placeholder) |
| S03 ฟอร์มแจ้งซ่อม | `screens/S03-report-form.md` | `mockups/S03-report-form.html` (mobile) · `mockups/S03-report-form-desktop.html` (desktop, CR-002) | `/repair/new` | 1 (+5 team card, +6 QR banner) |
| S04 พบงานซ้ำ | `screens/S04-duplicate-found.md` | `mockups/S03-report-form.html` → "พบงานซ้ำ" | — (sheet / dialog) | 5 |
| S05 แจ้งสำเร็จ | `screens/S05-report-success.md` | `mockups/S03-report-form.html` → S05 frames | `/repair/new/done` | 1 (+5 team variant) |
| S06 ติดตามงานซ่อม | `screens/S06-my-tickets.md` | `mockups/S06-my-tickets.html` (CR-002) | `/repair/my` | 1 |
| S07 รายละเอียดงาน | `screens/S07-ticket-detail.md` | `mockups/S07-ticket-detail.html` | `/repair/tickets/[id]` | 1 view (+2, 3, 4, 5 actions) |
| S08 ตรวจรับ / ส่งกลับให้แก้ | `screens/S08-confirm-or-send-back.md` | `mockups/S07-ticket-detail.html` → S08 frames | — (sheet / dialog) | 3 |
| S09 คิวงานช่าง | `screens/S09-technician-queue.md` | `mockups/S09-technician-queue.html` | `/repair/queue` | 2 (+3 reserved states) |
| S10 บันทึกผลซ่อม | `screens/S10-record-result.md` | — (`mockups/S03-report-form.html` form + `mockups/S07-ticket-detail.html` header) | `/repair/tickets/[id]/resolve` | 2 |
| S11 คิวงาน (Admin) | `screens/S11-admin-queue.md` | `mockups/S11-admin-queue.html` | `/repair/admin/queue` | 4 (+5 hand over) |
| S12 ภาพรวมอาคาร 3D | `screens/S12-building-overview.md` | `mockups/S12-building-overview.html` | `/repair/admin/overview` | 8 |
| S13 แจ้งเตือน | `screens/S13-notifications.md` | — (`option-a.html` notification rows) | `/notifications` | 7 |
| S14 โปรไฟล์ | `screens/S14-profile.md` | — (`option-a.html`) | `/profile` | 0 (platform) |
| S15 ตัวสลับบทบาท | `screens/S15-role-switcher.md` | — (pill in `option-a.html`) | — (component) | 0 (platform) |
| S16 สแกน QR | `screens/S16-scan-qr.md` | — (`mockups/S03-report-form.html`) | `/repair/scan` | 6 |

**Shared / platform screens:** S01, S02, S13, S14 and S15 live outside `app/(app)/repair` (routes `/login`, `/signed-out`, `/`, `/notifications`, `/profile`, and `components/shared/RoleSwitcher`). S01, S14, S15 and the AppShell are built in Stage 0 (`docs/shared/00-platform.md`); S02 and S13 in repair Stage 7, when "You may edit" is widened to `app/(app)/page.tsx` and `app/(app)/notifications/**` for that stage only.

## You may edit

- `frontend/src/app/(app)/repair/**`
- `frontend/src/modules/repair/components/**`
- `frontend/src/components/ui/**` only via `npx shadcn@latest add`
- This file: checklist and "Open questions" only

## Do not edit

- `backend/**`, `docs/**` (except this file), `modules/repair/{types,mocks,api,errors}.ts`, `src/proxy.ts`, `src/lib/**`
- `components/shared/**` — if you need a change there, write it in Open questions. Use its pickers for every choice: `ChoiceField` / `Picker` (form), `FilterPill`, `SegmentedControl` — never `components/ui/select` directly (CR-002, design-system "Pickers")

## Run

```
cd frontend
npm run dev          # NEXT_PUBLIC_USE_MOCKS=true in .env.development
npm run lint && npm run typecheck
```

## Done when

- [x] Every item in each screen's acceptance checklist passes for Stage 1 scope (record below)
- [x] lint + typecheck pass
- [x] Each screen compared with its mockup at 375px and 1280px; differences listed below

## Checklist results (Codex fills)

| Screen | All checklist items pass? | Notes |
|---|---|---|
| S03 | Yes (Stage 1 scope, re-checked after CR-002) | CR-002 (Claude): desktop sections show ครบแล้ว / ต้องแก้ {n} ช่อง, sticky summary panel at ≥ 1280px (checklist rows jump to the section; submit scrolls to the first error), bottom bar at 1024–1279px; อาคาร = pills, ชั้น = grid (Picker with search when > 12, checked with a 25-floor sample). 4-step wizard (mobile) / single page (desktop), per-step + full validation with exact copy, PhotoPicker, discard dialog only when data entered, data kept on submit failure. QR banner, team-handled card, duplicate check: later stages (5, 6), not built. Draft resets when the route is left (cacheComponents keeps hidden routes alive) — 17 reports in a row via client navigation, form fresh and unlocked each time. |
| S05 | Yes (normal variant) | Mobile gradient + mascot, desktop centered card; copy button; error state with "ไปที่ติดตามงานซ่อม"; forbidden; `router.replace` so back never returns to the form. Team variant: Stage 5. |
| S06 | Yes (CR-002 redesign, Claude) | Groups รอตรวจรับ → กำลังดำเนินการ → ปิดแล้ว (latest 3, `?closed=all` with load more + "แสดง {a} จาก {n} งาน"), empty groups hidden, awaiting cards with deadline chip, rows with thumb + mini progress, desktop list + preview pane (`?id`, default = first awaiting), date `FilterPill` + scope segmented control. Checked with 21 open tickets: 20 shown, "โหลดเพิ่ม" → 21 unique, button hides; no console errors. |
| S07 | Yes (view only) | Header, details, photos + lightbox (keyboard Enter/Esc, focus returns; arrows + swipe), result card with "รูปหลังซ่อม", timeline (all event labels, time right-aligned as mockup), info card incl. อุปกรณ์ "—"; forbidden / not-found / error states. `allowedActions` rendered generically (empty in Stage 1). |

## Differences from mockup (Codex fills)

- S06 / S03 desktop follow the CR-002 mockups; thumbnails in mock mode are SVG placeholders.
- Mockups show the UAT strip; dev shows the DEV role strip (platform, expected).

## Open questions (Codex fills — never guess)

- CR-013 preview revision 2 (2026-10-19): owner requested less blue. Evaluation card now uses warm orange (existing attention colour) for its CTA, top border and icon with a pale warm background. Proposal includes a bounded exception to the blue-action convention; production remains unchanged.

- CR-013 preview ready (2026-10-19): `output/repair-evaluation-preview/index.html`, desktop/mobile captures in the same directory. Responsive and simulated evaluation-entry checks pass. No production edits; awaiting owner's design approval.

- CR-013 PROPOSED (2026-10-19, S): owner reports S07 evaluation looks like a status strip. Proposed prominent blue `ประเมินงานซ่อม` button, explicit awaiting-your-evaluation heading, and labeled optional star shortcut; see `changes/CR-013.md`. Await approval for the bounded ReviewCard correction in `ticket-detail.tsx`; API and S08 submission remain unchanged.

- CR-012 revision 2 PROPOSED (2026-10-18, M): S07 blue timeline (existing type), reference job facts, outcome-first evidence and white evaluation card; S08 rating dialog adds explicit confirmation of a draft score. Review `output/ticket-detail-redesign/index.html` and `changes/CR-012.md`; reconcile the owner's requested priority row with CR-011 before implementation. Production ownership unchanged; S03/S06 outside scope. Preview responsive/gallery/rating/keyboard/focus/role/states/print checks pass; no production API verification claimed.
- CR-010 revised + CR-011 (2026-10-18): owner requests equal three-service navigation, no navbar mascot, and redesigned S06/S07 using `support ticket1.png`, `support ticket2.png`, `timeline.png`. Review `changes/CR-010.md`, `changes/CR-011.md` and `output/navbar-redesign/{index,repair-my,ticket-detail}.html`; production awaits approval and bounded shared shell/S06/S07 ownership. Existing routes retained; mascot asset stays in `frontend/public/brand` for later approved placement.
- For Claude (wire): `cacheComponents` keeps visited routes alive with their state — worth a note in `frontend/AGENTS.md` so later screens reset drafts / refresh lists on reveal.
