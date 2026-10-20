# UI handoff — ระบบแจ้งซ่อม — Stages 1–2 + 2R (CR-008)

Status: BUILT BY CLAUDE — Stage 3D (owner asked Claude to build the S29 UI and wire it, 2026-10-20, D-085); waiting for user acceptance; Codex has nothing to build. Earlier: BUILT BY CLAUDE — Stage 3 (S11 งานทั้งหมด + S07 admin close, CR-015 S09 order), waiting for user acceptance; Codex has nothing to build. Earlier: Stage 2M (CR-014 S03 + location line) on top of Stage 2N (CR-010 navbar + CR-011 S06 / S07 + CR-012 S07 / S08 + S06 polish D-068) on top of Stage 2R (CR-008 + CR-009), waiting for user acceptance; Codex has nothing to build. Visual sources: `output/navbar-redesign/` (CR-010 / CR-011), docs/modules/repair/changes/CR-008/ (design demo 06)

## Stage 3D (2026-10-19 / 20) — BUILT BY CLAUDE (D-085): S29 dashboard Home for admin / executive + 3D อาคาร 1 + equipment (CR-016)

> Written as a Codex brief; the owner then asked Claude to build it. Files (Claude owns): `app/(app)/page.tsx` (role switch), `modules/repair/components/dashboard/{admin-dashboard,building-card,asset-dialog,floor-list,dashboard-ui}.tsx`, `dashboard/scene/{kit,building-one,floor-plan,engine}.ts`, e2e `F23-dashboard` / `F31-assets`. Results in "Stage 3D checklist results" below.

Goal: admin and executive open `/` and see the key numbers, a 3D model of อาคาร 1 in the centre (building → floor → rooms, open-ticket pins, equipment), and admin can place equipment by drag and drop (`../03-plan.md` Stage 3D, AC1–AC6). Every other role keeps the current Home.

### Read in this order

1. `frontend/AGENTS.md`, `docs/shared/design-system.md`, `ui/screens/_common.md`
2. **`ui/screens/S29-admin-dashboard.md`** (APPROVED; read the "Approved sources" box first) and `../02-flows.md` F23 + F31
3. **Layout / look:** `ui/mockups/S29-admin-dashboard-modern.html` (open in a browser). Use its layout, panels, colours, copy, edit-mode bar, palette, dialog and phone layout. **Do not port its 3D code** (lines from `<script type="module">` on) — that was only a placeholder.
4. **3D model:** `แผนผังงานซ่อมอาคาร.html` (repo root, the owner's model) — port **อาคาร 1 only** + its floor-plan renderer, as listed below
5. `frontend/src/modules/repair/{types,api,mocks,plan-geometry,service-samples}.ts` (data — do not change)

### What to build

| Piece | Where | Notes |
|---|---|---|
| Home switch | `app/(app)/page.tsx` (**this stage only**) | `useCurrentUser()`: role `admin` / `executive` → render `<AdminDashboard />`; every other role → the current Home JSX unchanged (move it into a local `EmployeeHome` component in the same file, no other change) |
| S29 page | `modules/repair/components/dashboard/admin-dashboard.tsx` (+ small parts in the same folder) | greeting row (สวัสดีตอนเช้า < 12:00 · ตอนบ่าย < 17:00 · ตอนเย็น, Bangkok time; `formatLongDate`), building `ChoiceField`/`FilterPill` (only buildings from #27; `hasModel` → 3D, else floor list), admin-only `จัดวางอุปกรณ์` toggle (`aria-pressed`, label `เสร็จสิ้น` while on); band ภาพรวมวันนี้; แจ้งซ่อม column + งานที่ควรติดตาม; 3D card; บริการอื่น column; states |
| 3D scene | `modules/repair/components/dashboard/building-scene.tsx` + `components/dashboard/scene/*.ts` | client only, loaded with `next/dynamic(..., { ssr: false })` **only** when the viewport is ≥ 1024 px **and** WebGL is available; otherwise the floor list. Dispose renderer, geometries, materials, textures and listeners on unmount |
| Asset dialog, deactivate confirm, popovers, toast with undo | `components/dashboard/*` | shadcn `Dialog` / `AlertDialog` / `Popover` + `sonner` (already in the app) |
| Phone / tablet (< 1024 px) | same page | no 3D: band as 2 columns, แจ้งซ่อม counts, งานที่ควรติดตาม, floor list (`ชั้น {n}` · open count · priority dot · `›` → bottom sheet with that floor's rooms from #30: open count + equipment count, and its open tickets), บริการอื่น, caption `จัดวางอุปกรณ์ได้บนคอมพิวเตอร์` |

### Port from `แผนผังงานซ่อมอาคาร.html` (line numbers of that file)

Keep (convert to TypeScript modules; `three` **0.160.1** is installed, same as the model's import map; addons from `three/examples/jsm/...`):

- Helpers 653–697 (`canvasTex`, `rng`, `noise`, `bg`, `worldUV`, `mesh`, `merged`, `planeUV`) and the textures 699–877 (+ environment / fog 878–886) that อาคาร 1 and the plan use (sky / env, concrete, interior, poster, portrait, sign, fan, tile, wetTile, carpet, leaves for the plan's potted plants).
- Building config **B1 only** (228–251) **without `plans`**: `floors 6, width 32, depth 15, floorHeight 3.5, overhang 1.2, style 'balcony', entrance 'main', roofSign, cladding, frame, rows [6,3,6], bay 4, core [...]`.
- Building: `addLights`, `floorMats`, `glassBox`, `mullionGrid`, `makeShell`, `finishFloor`, `groundFloor`, `balconyFloor`, `roofOf` (887–1092); the stacking loop 1188–1205 for B1 only; `setOpacity`.
- Plan: `buildPlan` 1247–1446 — floor slab + tile, low walls cut at 1.2 m with door gaps, core (ห้องน้ำ / บันได / A.H.U. / ลิฟต์ — drawn on every floor), facade sill + glass + entrance gap (floor 1 only: `entrance { x: 14, w: 6 }`, `reception` → floor 1 only), columns on the grid, dimension ticks + labels, instanced desks / chairs, potted plants.
- HTML labels projected from 3D (1451–1479), camera poses / tweens / `fitSphere` / `focusBuilding` / `enterFloor` / `showPlan` / `backFromPlan` (1521–1612), picking (1631–1688), resize with `ResizeObserver` (1703–1717).

Change:

- **Rooms come from #30, not from `plans[f].zones`.** For every room with a `shape` (polygon, metres, origin top-left): `common_area` = not drawn as a tile (it is the floor); `restroom` = no tile (the core draws ห้องน้ำ) but still a hit area / pin place; every other room = a tinted tile from the polygon (`THREE.Shape` → `ShapeGeometry`), outline line, walls along its edges (skip edges on the outer boundary, draw a shared edge once, door gap on edges ≥ 2.6 m as in `edgeWithDoor`), label `{name}` + `{area} ตร.ม.` (`shapeArea` from `plan-geometry.ts`; 2 decimals when not whole). Tint by `areaType` with the modern mockup tints (office `#DCE3FF`, meeting_room `#D9F0E4`, pantry / other `#FDE5D4`; floor `#F3F5F9`); no purple (D-070). Desks only in 4-point rectangular rooms with the size rule in 1360–1366.
- `floor 1` uses the same room data (its rooms equal the model's zones), so the floor-1 look stays the owner's.
- A floor with `widthM === null` or no room shapes → slab outline + `ยังไม่มีผังห้องของชั้นนี้`.
- **Pins = open tickets per room**, not per job: one pin per room with `openCount > 0` at `roomCenter(room, rooms)` (`plan-geometry.ts`), colour by `highestPriority` (critical / high / medium tokens; low uses the medium colour — legend `ปกติ / ต่ำ`), label = count, `aria-label="{room} งานค้าง {n}"`. Click → popover listing that room's open tickets (`getTickets({ scope: "all", floorId, status: ["in_progress", "resolved"], pageSize: 100 })`, keep `t.room?.id === room.id`) → S07.
- **Building view:** floor highlight colour from #27 `floors[].highestPriority` (no status colours from the model); a pin per floor with `openCount > 0`; hover = highlight + tooltip `ชั้น {n} · งานค้าง {n}`; click = floor view.
- **Equipment = round icon chips** (HTML overlay, like the model's labels) at `(x, z)`; icon by `type.key` (`aircon` → lucide `AirVent`, `microphone` → `Mic`, `speaker` → `Speaker`, `tv` → `Tv`, unknown → `Box`), badge = `openTickets` when > 0, `aria-label="{type.name} {code} {name}"`. `x === null` (not placed) → at `roomCenter` with a dashed ring and tooltip `ยังไม่ได้วางจุด`. Click → popover (code, name, room, open tickets; admin: `แก้ไข` · `ปิดใช้งาน`).
- **Render on demand**: no permanent `requestAnimationFrame` loop and no pulsing. Render on: controls `change`, tweens running, resize, data change. Drop `EffectComposer` / `GTAOPass` / the quality button / the HUD. Shadows static (`shadowMap.autoUpdate = false`, `needsUpdate` after a rebuild). Respect `prefers-reduced-motion` for camera tweens.
- Drop: B2 / B3, `curtainFloor`, site props (trees, cars, parking, hedges — keep only a plain ground + paving under อาคาร 1), `STATUS` / `JOBS` / filters / KPI / charts / table / CSV / drawers / asset localStorage, `window.facility` / `window.dashboard`.
- Controls: drag = rotate, wheel + `+` `−` = zoom, `⟲` = reset (S29). Floor picker chips `6 … 1` on the left (roving tabindex, ↑ ↓ keys), `‹ ภาพอาคาร` back.

### Edit mode (admin only; `executive` never sees the toggle, palette or edit actions)

- Building view + edit mode → hint `เลือกชั้นก่อนจัดวางอุปกรณ์`.
- Palette (from #29, order as returned): drag a type over the plan → raycast to the floor plane → plan coords (`x = p.x + W/2`, `z = p.z + D/2`) → `roomAt(x, z, rooms)` (`plan-geometry.ts`, the same rule as the server) → highlight that room; outside every room = red outline + `วางในห้องเท่านั้น`, drop refused. Drop → dialog `เพิ่มอุปกรณ์` with the type chip, code from `suggestAssetCode(typeId, floorId)` (editable), name, room (prefilled; changing the room puts the point at `roomCenter`), then `createAsset({ assetTypeId, code, name, roomId, x, z })`. Round x / z to 2 decimals.
- `เพิ่มอุปกรณ์` button (no pointer): same dialog with a type `ChoiceField` and the room list; saves without `x` / `z` (F31 step 5).
- Drag an existing chip → move at once (optimistic), `updateAsset(id, { code, name, roomId: roomAt(...), x, z })`; toast `ย้าย {code} ไป{ห้อง}แล้ว` + `เลิกทำ` (sends the previous room / x / z back); on error roll back + `errorMessage(err)`.
- `แก้ไข` → same dialog (title `แก้ไขอุปกรณ์`, no type change) → `updateAsset`. `ปิดใช้งาน` → `AlertDialog` (S29 copy) → `deactivateAsset` → toast `ปิดใช้งาน {code} แล้ว`.
- Errors: field errors via `fieldErrors(err, assetFieldMessages)` from `errors.ts` (code / name / room / x / z); `ASSET_CODE_TAKEN` → under รหัสอุปกรณ์ `รหัสนี้มีอุปกรณ์อื่นใช้แล้ว`; `POINT_OUTSIDE_ROOM` / `MASTER_DATA_CHANGED` → toast + reload the plan. Toasts `เพิ่ม {code} แล้ว` / `บันทึกแล้ว`. After every write reload #30 (and #27 for counts).

### Data — `modules/repair/api.ts`

| Function | # | Used for |
|---|---|---|
| `getOverview()` | 27 | band, แจ้งซ่อม rows + sub-lines, attention (≤ 4 shown), buildings → floors (pins, floor list) |
| `getAssetTypes()` | 29 | palette, add dialog |
| `getFloorPlan(floorId)` | 30 | floor view, phone floor sheet |
| `createAsset` · `updateAsset` · `deactivateAsset` · `suggestAssetCode` | 31–34 | edit mode |
| `getTickets(...)` | 6 | room pin popover / phone floor sheet ticket list |
| `SAMPLE_SERVICES` (`service-samples.ts`) | — | รถออกวันนี้ / ห้องประชุมใช้อยู่ tiles and the บริการอื่น blocks, always with `ข้อมูลตัวอย่าง` |

- Number → copy / link mapping: S29 spec "Content" rows "Row sub-lines" and "Row / tile links" (S11 tabs `assess` · `repair` · `rating` · `closed`).
- Attention row: title + place with the existing helpers in `ticket-presentation.ts` (`placeLine` / ticket title as S06 / S11), chip `เลยกำหนด` (in progress, `expectedDoneOn` before today), `ส่งกลับ` (`step === "reworking"`), `ฉุกเฉิน` (`priority === "critical"`); a high-priority row without one of these shows the existing `PriorityIndicator`. Empty → `ไม่มีงานที่ต้องติดตาม` + mascot `face` 64 px.
- Geometry helpers (`plan-geometry.ts`): `roomAt`, `pointInShape`, `shapeArea`, `roomCenter` — use them; do not re-implement.
- Errors: `errorMessage(err)`; #27 fails → inline Alert `โหลดภาพรวมไม่สำเร็จ` + retry; #30 fails → inside the 3D card + retry.

### Mocks (`NEXT_PUBLIC_USE_MOCKS=true`)

- อาคาร 1 uses the migration ids and the real outlines of floors 1–6; tickets 160–165 sit in its rooms (floor 1 HR 3 overdue + high, floor 4 อ.1 ห้อง 401 critical, floor 5 บัญชี reworking, floor 3 / 6 …). Equipment: 5 on floor 1, 2 on floor 4, 1 on floor 6; `AC-1-004` is inactive (code taken).
- Roles via the role switcher: ปวีณา (admin) edits, ผู้บริหาร reads, พนักงาน / ช่าง get the normal Home.
- Scenarios (`?mock=`): `normal`, `empty` (zeros, no pins, no equipment), `error` (reads fail, writes fail with network), `forbidden` (#27 / #30 → 403), `slow` (skeletons).

### You may edit (Stage 3D)

- `frontend/src/app/(app)/page.tsx` — the role switch only (this stage)
- `frontend/src/modules/repair/components/dashboard/**` (new)
- `frontend/src/components/ui/**` only via `npx shadcn@latest add`
- This file: Stage 3D checklist and "Open questions" only

Do not edit `modules/repair/{types,mocks,api,errors,plan-geometry,service-samples}.ts`, `package.json` (need another package → Open questions), `components/shared/**`, `src/lib/**`, backend, other docs.

### Done when (Codex fills the Stage 3D checklist below)

- [ ] S29 acceptance checklist (spec) at 1440 and 390 px; no horizontal scroll at 390
- [ ] อาคาร 1 looks like the owner's model (building + floor 1 plan); floors 2–6 show their rooms from #30
- [ ] Building → floor → room pin popover → S07 → back; floor picker with the keyboard
- [ ] Edit mode: drag-add, drop outside a room refused, drag-move + undo, edit, deactivate, add without dragging, duplicate code message
- [ ] Executive: no edit controls; employee / technician: old Home unchanged
- [ ] Mock scenarios normal / empty / error / forbidden / slow
- [ ] three.js only in the dashboard chunk (not in other routes), no render loop when idle, nothing left after unmount
- [ ] `npm run lint && npm run typecheck` pass

### Stage 3D checklist results (Claude, 2026-10-20 — real API on a scratch Postgres)

| Item | Pass? | Notes |
|---|---|---|
| S29 at 1440 / 390, no horizontal scroll at 390 | Yes | screenshots checked; phone = floor list + bottom sheet, 16 px gutter |
| อาคาร 1 = owner's model; floors 2–6 rooms from #30 | Yes | building, ground floor, balconies, roof + billboard, site around อาคาร 1 (other buildings dropped); floor 1 and 5 plans checked |
| building → floor → room pin popover → S07 → back; keyboard floor picker | Yes | e2e F23 AC2 (↑ ↓) |
| edit mode: drag-add, drop outside refused, drag-move + undo, edit, deactivate, add without dragging, duplicate code | Yes | e2e F31 (3 / 3 runs) + manual probes |
| executive read-only; employee / technician keep the old Home | Yes | e2e F23 AC5 |
| three.js only in the dashboard chunk; no loop when idle; disposed on unmount | Yes | one lazy 570 KB chunk (~150 KB gz), not referenced by any prerendered page; render on demand |
| lint + typecheck + build | Yes | |

### Differences from the brief / mockup (Claude)

- Site props around อาคาร 1 (lawns, hedges, parking + cars, trees) were kept from the owner's model (only the other buildings were dropped) — they are cheap and make the model read as the real place
- The 3D card is sticky and fits the viewport (`100dvh − 7.5rem`, min 560 px) instead of stretching to the right column, so the palette and the whole plan are on screen together on 800 px-tall laptops
- Room pins show a wrench + count (the room name is already the plan label; the full name is in the aria-label); the move toast stays 8 s so `เลิกทำ` can be reached
- After an equipment write only the HTML overlays reload; the 3D floor is rebuilt only when the floor changes


## Stage 3 (2026-10-19) — built by Claude

S11 re-spec (banner at the top of `screens/S11-admin-queue.md`), S07 admin `ปิดงาน`, S09 oldest first. Files (Claude owns): `app/(app)/repair/admin/queue/page.tsx`, `modules/repair/components/{admin-tickets,ticket-actions,ticket-detail,ticket-navigation,technician-work}.tsx`, `modules/repair/{types,api,mocks,priority}.ts`, `e2e/repair/F22-admin-tickets.spec.ts`. Codex has nothing to build.

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
