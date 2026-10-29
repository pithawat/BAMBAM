# S20 — อาคารและอุปกรณ์ (CR-001 / CR-002)

Status: APPROVED (2026-10-16) — user approved screens + plan · rewritten by CR-001 / CR-002 2026-10-26 (owner approved the design `../mockups/CR-001-admin-settings.html`); the original "อาคารและชั้น" spec is kept at the end for history · CR-005 building types (approved 2026-10-27)

- **Flows:** F26 (see ../../02-flows.md)
- **Persona:** Admin and Superadmin on desktop (see ../../01-users.md)
- **Purpose of this screen (one sentence):** pick a room from the building plan and keep its equipment, the equipment types and the building / room names right.
- **Access:** `settings.locations.manage` (rename) · `settings.assets.manage` (assets, types) — Admin and Superadmin (`_common.md` §1)
- **Route:** `/settings/buildings` — tab in `?tab=` (`assets` default · `asset-types`); selection in `?building=&floor=&room=` (replace, no new history entry). `/settings` redirects here.
- **Mockup:** `../mockups/CR-001-admin-settings.html#places` (desktop / mobile, asset dialog with inline type, rename dialogs); `?tab=types#places` for the types tab; screenshots `../mockups/CR-001-assets/places-*.png`, `asset-*.png`
- **Data:** `getPlanBuildings` (#13), `renameBuilding` (#15), `renameRoom` (#27), `listRoomAssets` (#46), `createAsset` (#47), `updateAsset` (#48), `suggestAssetCode` (#49), `listAssetTypes` (#50), `createAssetType` (#51), `updateAssetType` (#52)

> **CR-005 (approved 2026-10-27, repair CR-025) — building types.** (1) New tab `ประเภทอาคาร` (`?tab=building-types`, after `ประเภทอุปกรณ์`, same table pattern): columns ชื่อประเภทอาคาร · อาคาร (`{n}`) · หมวดงาน (`{n} หมวด`) · สถานะ · row menu `แก้ไขชื่อ` / `ปิดใช้งาน` / `เปิดใช้งาน`; primary `เพิ่มประเภทอาคาร`. Add dialog: `ชื่อประเภทอาคาร *` + `หมวดงานที่ใช้ได้` (check boxes of active categories except อื่น ๆ, all ticked; hint `หมวด “อื่น ๆ” ใช้ได้กับทุกประเภทอาคาร`). Deactivate blocked while used: `ยังมีอาคารใช้ประเภทนี้อยู่ เปลี่ยนประเภทของอาคารก่อน`; else confirm `ปิดใช้งานประเภทอาคารนี้? หมวดงานที่ใช้เฉพาะประเภทนี้จะไม่แสดงในฟอร์มแจ้งซ่อม`. Empty: `ยังไม่มีประเภทอาคาร`. (2) Building rename dialog → `แก้ไขอาคาร`: `ชื่ออาคาร *` + `ประเภทอาคาร *` (select of active types); note `เปลี่ยนประเภทแล้วมีผลกับงานแจ้งใหม่เท่านั้น`. (3) The building header / picker shows the type as a small tag. Data: #53–#55, #15 `buildingTypeId`. Access: `settings.locations.manage`.

## Layout — mobile first

Heading (all sizes, `_common.md` §1): H1 "อาคารและอุปกรณ์", subtitle, role mascot; the types tab shows the primary action "เพิ่มประเภทอุปกรณ์" on the heading row. Under the heading: section tabs (segmented, icon + label): **อุปกรณ์ในห้อง** (`Box`) · **ประเภทอุปกรณ์ {n}** (`Tags`).

**Tab อุปกรณ์ในห้อง — desktop (≥ 1024px):** two columns, navigator ~300px (subdued) + main asset panel.

```
┌ เลือกห้องจากผัง ─────────┐ ┌ อาคาร 1 › ชั้น 1 ─────────────────────────────┐
│ อาคาร          [✎ แก้ชื่อ]│ │ ห้องประชุม 1A  ✎                 [+ เพิ่มอุปกรณ์] │
│ [ อาคาร 1            ⌄ ] │ │ อุปกรณ์ 4 ชิ้น                                 │
│ ชั้น                      │ │ [🔍 ค้นหาชื่อหรือรหัสอุปกรณ์] [ทุกประเภท ⌄]      │
│ [ชั้น 1][ชั้น 2][ชั้น 3]  │ │ (❄) แอร์ห้องประชุม 1A         เครื่องปรับอากาศ  ⋯ │
│ ห้อง / พื้นที่     3 ห้อง │ │     AC-1-001                                  │
│ ▌ห้องประชุม 1A        4  │ │ (🎤) ไมโครโฟนไร้สาย ตัวที่ 1   ไมโครโฟน        ⋯ │
│  ห้องประชุม 1B        1  │ │ …                                             │
│  พื้นที่ส่วนกลางชั้น 1  0  │ └───────────────────────────────────────────────┘
│ 🔒 ชั้นและห้องอ้างอิงจากผังอาคาร│ [☐ แสดงอุปกรณ์ที่ปิดใช้งาน]
└─────────────────────────┘
```

**Mobile (< 1024px):** one column — navigator panel first (building select, floor buttons wrap, room list), then the asset panel; asset rows hide the type column (type shows via the icon). Dialogs become bottom sheets.

**Tab ประเภทอุปกรณ์:** one panel "ประเภทอุปกรณ์" (subtitle "ใช้ร่วมกันทุกอาคาร และเลือกได้เมื่อเพิ่มอุปกรณ์", count "{n} ประเภท"); table: ชื่อประเภท (icon circle + name; under the name `{codePrefix}` mono + mount label, muted) · อุปกรณ์ที่ใช้งาน ("{n} ชิ้น") · text button "แก้ไข" (`Pencil`).

## Components

| Area | Component | Notes |
|---|---|---|
| Section tabs | `SegmentedControl` | `aria-pressed`; count badge on ประเภทอุปกรณ์ |
| Building | `Select` + text button "แก้ชื่อ" (`Pencil`) | changing building selects its first floor and first room |
| Floors | toggle buttons (`aria-pressed`), bottom floor first | names read-only |
| Rooms | list buttons with icon, name, active asset count; selected = soft blue + left bar | |
| Plan note | muted line with `Lock`: ชั้นและห้องอ้างอิงจากผังอาคาร | no create / delete / reorder anywhere (CR-002) |
| Room heading | context path "{อาคาร} › {ชั้น}" (muted) · H2 room name · icon button `Pencil` (aria-label "แก้ไขชื่อห้อง") · "อุปกรณ์ {n} ชิ้น" | |
| Toolbar | search `Input` (`Search` icon) · type filter `Select` "ทุกประเภท" | client-side filter is fine (≤ ~50 assets / room) or #46 `q` / `assetTypeId` |
| Asset rows | icon circle (type icon, `components/shared/asset-icon.ts`) · name · code (mono) · "ปิดใช้งาน" small muted when inactive · type (desktop column) · row menu `MoreHorizontal` (aria-label "ตัวเลือก {ชื่อ}") | inactive rows muted |
| Row menu | active: แก้ไข / ย้ายห้อง · ปิดใช้งาน (destructive) · inactive: เปิดใช้งาน only (#48 edits active assets only) | |
| Asset dialog | `Dialog` / `Sheet` | see Content |
| Inline type editor | collapsible block under the type select, toggled by text button "เพิ่มประเภทใหม่" (`aria-expanded`) | Enter in the name field submits the inline editor, not the form |
| Type dialog | `Dialog` / `Sheet` | name, code prefix, mount, icon picker (8 radio tiles with Thai accessible names) |
| Rename dialog | `Dialog` / `Sheet` | one field |
| Deactivate | `_common.md` §5 | extra line none |

## Content and copy (exact Thai text)

| Element | Text |
|---|---|
| Title / subtitle | อาคารและอุปกรณ์ / เลือกห้องจากผัง แล้วจัดการอุปกรณ์ที่ติดตั้งในห้องนั้น · types tab subtitle: จัดการประเภทอุปกรณ์ที่เลือกใช้ร่วมกันได้ในทุกอาคาร |
| Tabs | อุปกรณ์ในห้อง · ประเภทอุปกรณ์ {n} |
| Navigator | เลือกห้องจากผัง · อาคาร · แก้ชื่อ · ชั้น · ห้อง / พื้นที่ · {n} ห้อง · ชั้นและห้องอ้างอิงจากผังอาคาร |
| Asset panel | {อาคาร} › {ชั้น} · อุปกรณ์ {n} ชิ้น · เพิ่มอุปกรณ์ · search placeholder ค้นหาชื่อหรือรหัสอุปกรณ์ · filter ทุกประเภท · headers อุปกรณ์ · ประเภท · toggle แสดงอุปกรณ์ที่ปิดใช้งาน |
| Asset dialog | title เพิ่มอุปกรณ์ / แก้ไขอุปกรณ์ · subtitle ข้อมูลอุปกรณ์และตำแหน่งที่ติดตั้ง · อาคาร * · ชั้น * · ห้อง / พื้นที่ * · ประเภทอุปกรณ์ * (+ เพิ่มประเภทใหม่; edit: read-only with hint "เปลี่ยนประเภทไม่ได้") · รหัสอุปกรณ์ * (placeholder เช่น AC-1-003, prefilled from #49 on add when the type or room changes and the user has not typed; hint รหัสต้องไม่ซ้ำกับอุปกรณ์อื่นในระบบ) · ชื่ออุปกรณ์ * (placeholder เช่น แอร์ห้องประชุม 1A ตัวซ้าย) · buttons ยกเลิก · **เพิ่มอุปกรณ์** / **บันทึก** |
| Move hint (edit, room changed) | ย้ายห้องแล้วต้องจัดวางตำแหน่งบนผัง 3D ใหม่ |
| Inline type editor | ชื่อประเภทใหม่ (placeholder เช่น เครื่องพิมพ์) · รหัสนำหน้า * (placeholder เช่น PRN) · ตำแหน่งติดตั้ง (พื้น · ผนัง · เพดาน, default พื้น) · buttons ยกเลิก · **เพิ่มประเภท** |
| Type dialog | title เพิ่มประเภทอุปกรณ์ / แก้ไขประเภทอุปกรณ์ · subtitle ประเภทนี้เลือกใช้ได้กับอุปกรณ์ในทุกอาคาร · ชื่อประเภทอุปกรณ์ * · รหัสนำหน้า * (hint ใช้ตั้งรหัสอุปกรณ์อัตโนมัติ เช่น PRN-1-001 · ตัวอักษรอังกฤษหรือตัวเลข 2–5 ตัว) · ตำแหน่งติดตั้ง * · ไอคอน · buttons ยกเลิก · **เพิ่มประเภทอุปกรณ์** / **บันทึก** |
| Icon names | อุปกรณ์ทั่วไป · เครื่องปรับอากาศ · ไมโครโฟน · ลำโพง · จอภาพ · อุปกรณ์ไฟฟ้า · ระบบน้ำ · เฟอร์นิเจอร์ |
| Rename dialog | title แก้ไขชื่ออาคาร / แก้ไขชื่อห้อง / พื้นที่ · subtitle (building) ชื่อที่ใช้แสดงในระบบ · (room) {อาคาร} · {ชั้น} · label ชื่ออาคาร * / ชื่อห้อง / พื้นที่ * · hint เปลี่ยนชื่อที่แสดง โดยตำแหน่งในผังและอุปกรณ์ยังอยู่ที่เดิม · buttons ยกเลิก · **บันทึกชื่อ** |
| Validation | กรุณากรอกชื่อ · กรุณากรอกรหัสและชื่ออุปกรณ์ · รหัสอุปกรณ์ใช้ได้เฉพาะ A–Z 0–9 - _ ไม่เกิน 50 ตัว · รหัสอุปกรณ์นี้มีอยู่แล้ว กรุณาใช้รหัสอื่น · กรุณากรอกชื่อประเภทอุปกรณ์ · ประเภทอุปกรณ์นี้มีอยู่แล้ว · กรุณากรอกรหัสนำหน้า · รหัสนำหน้าใช้ตัวอักษรอังกฤษหรือตัวเลข 2–5 ตัว · รหัสนำหน้านี้มีประเภทอื่นใช้แล้ว · ชื่อนี้มีอยู่แล้ว |
| Toasts | เพิ่มอุปกรณ์แล้ว · บันทึกอุปกรณ์แล้ว · เพิ่มประเภทอุปกรณ์แล้ว · บันทึกประเภทอุปกรณ์แล้ว · บันทึกชื่อแล้ว · ปิดใช้งาน "{ชื่อ}" แล้ว · เปิดใช้งาน "{ชื่อ}" แล้ว |
| Empty — no plan | ยังไม่มีข้อมูลผังอาคาร / อาคาร ชั้น และห้องจะแสดงเมื่อมีการกำหนดผังอาคารแล้ว (no button) |
| Empty — room | ยังไม่มีอุปกรณ์ในห้องนี้ / เพิ่มอุปกรณ์ที่ติดตั้งในห้องนี้ เพื่อใช้อ้างอิงตอนแจ้งซ่อม · button เพิ่มอุปกรณ์ชิ้นแรก |
| Empty — filter | ไม่พบอุปกรณ์ที่ตรงกับตัวกรอง / ลองเปลี่ยนคำค้นหาหรือประเภทอุปกรณ์ · button ล้างตัวกรอง |
| Empty — types | ยังไม่มีประเภทอุปกรณ์ / เพิ่มประเภทอุปกรณ์ เพื่อให้เลือกใช้ตอนเพิ่มอุปกรณ์ในห้อง · button เพิ่มประเภทอุปกรณ์ |

## States

| State | What shows |
|---|---|
| Loading | heading + tabs; panel with 6 skeleton rows (circle + two lines) |
| Empty | per copy above |
| Error | `_common.md` §6 whole-page panel; room assets only: inline error in the asset panel + ลองอีกครั้ง |
| Forbidden | `_common.md` §1 |
| Saving | dialog primary button spinner + disabled; dialogs keep input on failure |

## Interactions

- Selecting a floor selects its first room; selecting a room clears search and filter.
- Saving an asset (add, edit, move) selects the building / floor / room where it now is and clears the filters.
- Inline type: saving adds the type, selects it in the type select, closes the editor and **keeps every other field** of the asset form; Cancel returns focus to "เพิ่มประเภทใหม่".
- Rename keeps the selection (same id); room counts and names update in place.
- Deactivate asks (`_common.md` §5); activate acts at once.
- Conflicts (`VERSION_CONFLICT`): `_common.md` §6.

## Acceptance checklist

- [ ] Matches the design at 375px and 1280px (sidebar / drawer, heading + mascot, tabs, navigator + asset panel)
- [ ] No control creates, deletes, reorders or deactivates a building, floor or room; floor names are not editable
- [ ] Rename building / room keeps the selection and the room's assets
- [ ] Add / edit / move / deactivate / activate assets; duplicate code (any case, incl. inactive) is refused with the copy
- [ ] Inline type creation keeps the asset form values and selects the new type; duplicate name / prefix refused
- [ ] Types tab: add / edit name, prefix, mount, icon; counts of active assets
- [ ] All states above with the exact copy; Admin and Superadmin both have full access; other roles Forbidden
- [ ] Keyboard: tabs, floor / room buttons, menus, dialogs and the icon picker operable; inputs labelled
- [ ] Works with mocks

---

<details><summary>Original S20 "อาคารและชั้น" (2026-10-16) — superseded by CR-002</summary>

### S20 — อาคารและชั้น [superseded]

Status: APPROVED (2026-10-16) — user approved screens + plan; visual style follows the new design direction (repair CR-008, pending)

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

</details>
