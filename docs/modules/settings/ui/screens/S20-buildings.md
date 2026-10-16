# S20 — อาคารและชั้น

Status: DRAFT

- **Flows:** F26 steps 1–2 (see ../../02-flows.md)
- **Persona:** Superadmin on desktop (see ../../01-users.md)
- **Purpose of this screen (one sentence):** keep the list of buildings and their floors (name and vertical order) matching the real site.
- **Route:** `/settings/buildings` (desktop: first active building selected) · `/settings/buildings/[buildingId]` (that building selected; on mobile this is the floor list page)
- **Mockup:** `../mockups/S20-buildings.html` (desktop two-pane, floor-add dialog, "เพิ่มหลายชั้น" dialog, mobile list → floors)
- **Data:** `listBuildings`, `createBuilding`, `updateBuilding`, `reorderBuildings`, `setBuildingActive`, `deleteBuilding`, `listFloors`, `createFloor`, `createFloorsBulk`, `updateFloor`, `reorderFloors`, `setFloorActive`, `deleteFloor`

## Layout — mobile first

Mobile `/settings/buildings`:

```
┌──────────────────────────────┐
│ ‹      อาคารและชั้น       [+] │ ← white top bar; + = เพิ่มอาคาร
│ ┌──────────────────────────┐ │
│ │ อาคาร (2)  [แสดงที่ปิดใช้งาน]│ │
│ │ อาคารหลัก      7 ชั้น  ⋯ › │ │
│ │ อาคารด้านหลัง   2 ชั้น  ⋯ › │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

Mobile `/settings/buildings/[id]` (white top bar "อาคารหลัก", right action ⋯ = building menu):

```
┌──────────────────────────────┐
│ ‹        อาคารหลัก         ⋯ │
│ [+ เพิ่มชั้น] [เพิ่มหลายชั้น]   │ ← two pill buttons, outline
│ ┌──────────────────────────┐ │
│ │ ชั้น (7) เรียงจากบนลงล่าง   │ │
│ │ ชั้น 7   0 ห้อง        ⋯ › │ │
│ │ ชั้น 6   4 ห้อง        ⋯ › │ │
│ │ ชั้น 5   8 ห้อง [มีผังชั้น] ⋯ › │ │
│ │ …                         │ │
│ │ ชั้น 1   6 ห้อง        ⋯ › │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

Desktop (≥1024px): header H1 "อาคารและชั้น" + subtitle, action "เพิ่มอาคาร" (primary). Two panes (grid 5 / 7 columns, gap 18px):
- **Left:** `MasterList` "อาคาร ({n})" with rows: name · "{n} ชั้น" · menu · `›`; selected row highlighted (`_common.md` §4).
- **Right:** card for the selected building: title = building name + "ปิดใช้งาน" badge if inactive; actions "เพิ่มชั้น" (primary sm) · "เพิ่มหลายชั้น" (outline sm). A small elevation strip on the left edge of the card (one 6px bar per floor, stacked, top floor first) gives the "ตึก" feel and mirrors S12. Floor rows: "ชั้น {name}" H3 · "{n} ห้อง" · "มีผังชั้น" badge when set · menu · `›` → S21.

Floors are listed **top floor first** (highest `level` at the top) like a building section; drag reorders and rewrites `level` from bottom = 1.

## Components

| Area | Component | Notes |
|---|---|---|
| Lists | `MasterList` (`_common.md` §4) | buildings and floors |
| Add / edit building | `Dialog` / `Sheet` | field: ชื่ออาคาร* |
| Add / edit floor | `Dialog` / `Sheet` | fields: ชื่อชั้น*, ตำแหน่ง (Picker: "บนสุด (เหนือชั้น {top})" default · "ใต้ชั้น {x}" for each floor) |
| Add many floors | `Dialog` / `Sheet` | field: จำนวนชั้น* (Input number 1–100); preview line |
| Confirmations | `_common.md` §5 | |

## Content and copy (exact Thai text)

| Element | Text |
|---|---|
| Title / subtitle | อาคารและชั้น / อาคารและชั้นที่ใช้ในฟอร์มแจ้งซ่อมและภาพรวมอาคาร |
| Left card title | อาคาร ({n}) |
| Right card subtitle | ชั้น ({n}) · เรียงจากบนลงล่าง |
| Buttons | เพิ่มอาคาร · เพิ่มชั้น · เพิ่มหลายชั้น |
| Building dialog | title: เพิ่มอาคาร / แก้ไขอาคาร · label: ชื่ออาคาร * · placeholder: เช่น อาคารหลัก |
| Floor dialog | title: เพิ่มชั้น / แก้ไขชั้น · label: ชื่อชั้น * · hint: แสดงเป็น "{อาคาร} ชั้น {ชื่อชั้น}" เช่น 5, G, ดาดฟ้า · label: ตำแหน่ง |
| Many floors dialog | title: เพิ่มหลายชั้น · label: จำนวนชั้น * · hint: สร้างชั้น 1 ถึง {n} ต่อจากชั้นบนสุด ชื่อเป็นตัวเลข แก้ชื่อทีหลังได้ · preview: จะสร้าง: ชั้น {from}–{to} · button: สร้าง {n} ชั้น |
| Deactivate building — extra line | ชั้นและห้องทั้งหมดในอาคารนี้จะถูกซ่อนจากตัวเลือกด้วย |
| Deactivate floor — extra line (when it has open tickets) | มีงานที่ยังไม่ปิด {n} งานในชั้นนี้ งานเหล่านี้ทำต่อได้ตามปกติ |
| Empty — no buildings | ยังไม่มีข้อมูลอาคาร / เพิ่มอาคารแรกเพื่อให้ผู้ใช้เลือกตอนแจ้งซ่อม · button เพิ่มอาคาร |
| Empty — building has no floors | ยังไม่มีชั้นในอาคารนี้ / ใช้ "เพิ่มหลายชั้น" เพื่อสร้างทีเดียว · buttons เพิ่มหลายชั้น · เพิ่มชั้น |
| Building not found | ไม่พบอาคารนี้ · button กลับไปรายการอาคาร |

Floor name rules: ≤ 20 characters. Building name ≤ 100. Number of floors 1–100 → error "ใส่จำนวน 1–100". Bulk names that already exist in the building → error "มีชั้น {list} อยู่แล้ว".

## States

| State | What shows |
|---|---|
| Loading | left: 3 skeleton rows; right: header skeleton + 7 skeleton rows |
| Empty | per copy above (no buildings → right pane hidden, empty card full width) |
| Error | whole page: shared copy; floors pane only: inline `Alert` "โหลดรายการชั้นไม่สำเร็จ" + ลองอีกครั้ง |
| Forbidden | `_common.md` §1 |
| Success feedback | toasts from `_common.md` §5; bulk: "เพิ่ม {n} ชั้นแล้ว" |

## Interactions

- Select a building (desktop) → URL becomes `/settings/buildings/[id]` (replace, no new history entry), floors load in the right pane.
- Floor row click / Enter → S21.
- Deactivated building selected with "แสดงที่ปิดใช้งาน" on → right pane is read-only with an info `Alert` "อาคารนี้ปิดใช้งานอยู่" + button "เปิดใช้งาน".
- Validation: on submit, then on change (design-system Forms).

## Acceptance checklist

- [ ] Matches the mockup at 375px and 1280px
- [ ] Floors show top floor first; drag and "เลื่อนขึ้น/ลง" both reorder and persist
- [ ] Delete disabled with the hint for items in use; deactivate dialog shows the extra lines
- [ ] All states above with the exact copy
- [ ] Keyboard: list rows, menus and dialogs reachable and operable
- [ ] Works with mocks
