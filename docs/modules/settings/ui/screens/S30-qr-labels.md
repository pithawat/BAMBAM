# S30 — พิมพ์ป้าย QR (CR-007, repair CR-036)

Status: APPROVED (2026-11-01) — owner approved repair CR-036 / settings CR-007. Layout detail is confirmed at repair Stage 5B prepare (no mockup yet; follows the S20 CR-006 page frame).

> **repair CR-037 (2026-11-03):** label cell = `output/qr-login-redesign/label-v7.html` (blue, peeking mascot, 40 mm QR on a white card, curved arrow, `สแกนแจ้งปัญหา` + logo top left, dark footer code 10 pt / name 9 pt / location 8 pt one line each). Colour by default; "พิมพ์แบบขาวดำ" in the preview. Supersedes the black-on-white-only rule of BR-F13A-1 for the look; the content is unchanged.

- **Flows:** repair F13-A, BR-F13A-1…5 (see ../../../repair/02-flows.md)
- **Persona:** Admin or Superadmin on desktop with a printer; phones can preview but printing is a desktop job (see ../../01-users.md)
- **Purpose of this screen (one sentence):** choose equipment by building, floor and room, preview the QR labels on A4 and print them, then mark them printed.
- **Access:** `settings.assets.manage` (`_common.md` §1)
- **Route:** `/settings/buildings/labels` — selection in `?building=&floor=&room=&assets=` (`assets` = comma-separated ids, used by the S20 entry points; replace, no new history entry)
- **Mockup:** none — S20 frame (`../mockups/CR-006-design/App.tsx`)
- **Data:** `getPlanBuildings` (#13), `listLabelAssets` (#56), `markLabelsPrinted` (#57) → `modules/settings/api.ts`; QR built in the browser (`qrcode`, SVG, error correction M) from `{window.location.origin}/q/{code}`

## Layout — mobile first

```
┌──────────────────────────────┐
│ breadcrumb ตั้งค่าระบบ › สถานที่และอุปกรณ์ › พิมพ์ป้าย QR │
│ H1 พิมพ์ป้าย QR                │
│ [อาคาร ▾ อาคาร 1]              │
│ ☐ ทั้งอาคาร                    │
│ ▸ ☐ ชั้น 1 (12)                │ ← floor rows expand to room rows with ticks
│ ▾ ☑ ชั้น 5 (8)                 │
│     ☑ ห้องประชุม 5B (3)        │
│ filter: ทั้งหมด · ควรพิมพ์ใหม่ · ยังไม่เคยพิมพ์ │
│ ☑ AC-5-001 แอร์… [ย้ายแล้ว…]   │ ← asset rows with ticks + label badge
│ ☑ TV-5-002 จอ…                 │
│ [ ดูตัวอย่างและพิมพ์ (12) ]     │ ← sticky bottom on mobile
└──────────────────────────────┘
```

Desktop (≥1024px): S20 frame. Left panel ~320px: building select, floor / room tree with ticks. Main panel: filter chips, asset table (tick · code mono · name · room · badge), footer `เลือกแล้ว {n} ชิ้น · {p} หน้า A4` + primary `ดูตัวอย่างและพิมพ์`.

Preview (full-screen `Dialog` on desktop, full page on mobile): A4 pages rendered at scale, `พิมพ์` (primary) + `ปิด`. Printing uses the same markup with `@media print`.

**Label (one cell, A4 portrait 3 × 4 = 12 per page, ≈ 70 × 74 mm, 0.3 mm grey cut line):**

```
┌───────────────────┐
│     ▓▓▓▓▓▓▓▓       │ ← QR 40 × 40 mm, quiet zone 4 modules
│     ▓▓ QR ▓▓       │
│     ▓▓▓▓▓▓▓▓       │
│  AC-1-012          │ ← 14pt bold mono, centred
│  แอร์ห้องประชุม 1A ตัวซ้าย │ ← 10pt, max 2 lines (ellipsis)
│  อ.1 · ชั้น 5 · ห้องประชุม 5B │ ← 9pt, max 2 lines
│  สแกนเพื่อแจ้งซ่อม · BAMBAM │ ← 7pt muted
└───────────────────┘
```

Short location (BR-F13A-1): building name starting with `อาคาร ` → `อ.` + rest (`อาคาร 1` → `อ.1`); other names unchanged; `ชั้น {floor name}`; room name in full (the floor's common area prints its name too). Black on white only (no theme colours) so any printer works.

## Components

| Area | Component (design-system.md) | Notes |
|---|---|---|
| Building | `Select` | first active building with assets by default |
| Floor / room tree | `Checkbox` + collapsible rows | parent tick = all children; partial = indeterminate |
| Filter | `ToggleGroup` chips | client-side on #56 rows |
| Asset list | table (desktop) / list rows (mobile) + `Checkbox` | badge as S20 (CR-007) |
| Preview | `Dialog` (desktop) / page (mobile) | print-only CSS hides the app chrome |
| Confirm | `AlertDialog` | after `afterprint` |

## Content and copy (exact Thai text)

| Element | Text |
|---|---|
| Title / sub-menu | พิมพ์ป้าย QR |
| Intro | เลือกอุปกรณ์ที่ต้องการ แล้วพิมพ์ป้ายลงกระดาษ A4 (12 ดวงต่อแผ่น) |
| Whole building | ทั้งอาคาร |
| Floor row | ชั้น {name} ({n}) |
| Filters | ทั้งหมด · ควรพิมพ์ใหม่ · ยังไม่เคยพิมพ์ |
| Badges | ย้ายแล้ว ควรพิมพ์ป้ายใหม่ · ข้อมูลบนป้ายเปลี่ยน ควรพิมพ์ใหม่ · ยังไม่เคยพิมพ์ป้าย |
| Footer | เลือกแล้ว {n} ชิ้น · {p} หน้า A4 |
| Primary | ดูตัวอย่างและพิมพ์ ({n}) |
| Preview buttons | พิมพ์ · ปิด |
| Label footer | สแกนเพื่อแจ้งซ่อม · BAMBAM |
| Confirm | title: พิมพ์ป้ายเรียบร้อยไหม · body: ระบบจะจำข้อมูลบนป้าย {n} ชิ้นนี้ไว้ เพื่อเตือนเมื่ออุปกรณ์ถูกย้ายหรือเปลี่ยนชื่อ · buttons: ใช่ พิมพ์แล้ว / ยังไม่ |
| Saved toast | บันทึกการพิมพ์ป้าย {n} ชิ้นแล้ว |
| Nothing selected | button disabled + hint: เลือกอุปกรณ์อย่างน้อย 1 ชิ้น |
| `ASSET_NOT_ACTIVE` | toast: มีอุปกรณ์ที่ถูกปิดใช้งานระหว่างนี้ โหลดข้อมูลล่าสุดให้แล้ว (list reloads, selection kept for still-active ones) |

## States

| State | What shows |
|---|---|
| Loading | Skeleton tree + 6 skeleton rows |
| Empty | Building has no active assets: ยังไม่มีอุปกรณ์ในอาคารนี้ / เพิ่มอุปกรณ์ได้ที่หน้าสถานที่และอุปกรณ์ · link ไปที่สถานที่และอุปกรณ์ (S20). Filter with no rows: ไม่มีอุปกรณ์ตามตัวกรองนี้ |
| Error | `_common.md` §6 panel + ลองอีกครั้ง; #57 network error → toast ทำรายการไม่สำเร็จ ลองอีกครั้ง (confirm dialog stays) |
| Forbidden | `_common.md` forbidden state (no `settings.assets.manage`) |
| Success feedback | Saved toast; badges of the printed rows clear |

## Interactions

- Entry from S20 row / room → `?assets=` ticks those assets and scrolls to the first; changing building clears the ticks.
- `ดูตัวอย่างและพิมพ์` → preview; `พิมพ์` → `window.print()`; on `afterprint` → confirm dialog. `ใช่ พิมพ์แล้ว` → #57 with the ticked ids → toast, statuses `current`. `ยังไม่` → close, nothing saved (AC5).
- Order on paper = list order (floor → room → code); a new room does not start a new page.
- Max 500 assets per print (#57 limit): above it the primary button is disabled with hint เลือกได้ครั้งละไม่เกิน 500 ชิ้น.

## Acceptance checklist (reports results in ../HANDOFF.md — does not edit this file)

- [ ] Layout at 375px (list + sticky button, preview page) and 1280px (tree + table, preview dialog)
- [ ] Print: 12 labels per A4 page in Chrome / Edge print preview, no app chrome, nothing cut at 100 % scale, QR scans from paper with a phone camera
- [ ] Label text follows BR-F13A-1 incl. 2-line limits and the `อ.` rule
- [ ] Tree ticks (all / partial / none), filters, 500 limit, entry from S20 with `?assets=`
- [ ] Confirm yes / no paths; `ASSET_NOT_ACTIVE` reload
- [ ] All states with the exact copy; keyboard: tree, checkboxes, dialog focus return
- [ ] Works with mocks (`NEXT_PUBLIC_USE_MOCKS=true`)
