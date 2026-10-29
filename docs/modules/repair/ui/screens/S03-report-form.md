# S03 — ฟอร์มแจ้งซ่อม

Status: APPROVED (2026-10-14) · desktop layout + location pickers changed by CR-002 (approved 2026-10-14) · steps, master data and room changed by CR-014 (approved 2026-10-19)

> **CR-014 (approved 2026-10-19) — replaces the step list, category, location and frame parts of CR-008 below.** Visual reference: `../../changes/CR-014/form-steps.html` (sample data).
> - **3 steps, one frame:** `ปัญหาที่พบ → สถานที่ → รูปภาพและส่ง`. Desktop frame 880px wide on every step, body height = the tallest step, fixed for all steps (progress strip, card edge and footer never move). Phone / tablet: one column, frame = viewport between header and sticky footer.
> - **ปัญหาที่พบ:** categories from the DB master (`attachments/REPAIR-CATEGORY-SYMPTOM-MASTER.md`, 7 categories, 4 columns desktop / 2 mobile, `อื่น ๆ` last). No client-side "อื่นๆ" card: the `อื่น ๆ` category (`isOther`) has symptoms like the others plus `ระบุหมวดงาน (ไม่บังคับ)` ≤ 100 (placeholder `เช่น ลิฟต์ ระบบเสียง`). Symptoms 3 columns desktop / 1 mobile + `อาการอื่นๆ`. Priority explanation stays. `+ เล่ารายละเอียดเพิ่ม` moves to step 3.
> - **สถานที่:** heading row with `ที่เคยแจ้ง ▾` button on the right · `เลือกอาคาร *` and `เลือกชั้น *` side by side (desktop) · **`ห้องหรือจุดที่เกิด *`**: room cards of the floor — `ห้องที่ตรงกับปัญหา ({หมวด})` (room area type in the category's `areaTypes`, with the area type caption) then `ห้องอื่นบนชั้นนี้`; no matching room → one list without group labels; > 9 rooms → searchable `Picker` (`ค้นหาห้อง`) · `บอกจุดเพิ่มเติม (ไม่บังคับ)` ≤ 100 (placeholder `เช่น ฝั่งหน้าต่าง เครื่องที่ 2`). Building change clears floor + room; floor change clears room; category change keeps the room.
> - **รูปภาพและส่ง** (heading `รูปภาพและตรวจสอบก่อนส่ง`): desktop two columns — left `รูปภาพ *` (drop zone / camera + gallery, thumbnails, tips); right `เล่ารายละเอียดเพิ่ม (ไม่บังคับ)` textarea (≤ 500) + `ตรวจสอบก่อนส่ง` card (ปัญหา · ความเร่งด่วน (staff wording as today) · สถานที่ `{อาคาร} · ชั้น {n}` / `{ห้อง}` (+ จุดเพิ่มเติม), `แก้ไข` per row; photos not repeated). Phone: photos → รายละเอียด → ตรวจสอบก่อนส่ง. Final button `ยืนยันส่งแจ้งซ่อม`. Team mode (Stage 4): `สิ่งที่ทีมทำ *` + `รูปหลังทำ *` take the รายละเอียด slot.
> - **Validation:** `ห้องหรือจุดที่เกิด` → required → `เลือกห้องหรือจุดที่เกิด`; `บอกจุดเพิ่มเติม` → max 100; room inactive on submit → `MASTER_DATA_CHANGED` alert + reload master. Draft and ที่เคยแจ้ง store / fill the room id.
> - Loading skeleton matches the 3-step frame.

> **CR-009 (approved 2026-10-18):** leads choose `เรียกช่าง | ทีมแก้เองแล้ว` at the top as soon as the form opens (others never see it; team steps per BR-F04). Duplicate card in สถานที่ once category + floor + spot are known; on submit a match opens a blocking dialog with only `ติดตามเคสเดิม` / `ยกเลิกการแจ้ง`; the reporter's own ticket waiting for ประเมินตรวจงาน → `ไปที่งานของคุณ` (no new ticket). Built in Stage 4. ที่เคยแจ้ง, QR banner and draft restore stay.


> **CR-008 (approved 2026-10-16) — replaces the layout, steps and priority parts of this spec.** Visual source of truth: `../../changes/CR-008/style-and-form.html` (+ `form-wizard.css` / `form-wizard.js`), design demo 06.
> - **Step wizard on every size:** progress strip (`ขั้นตอน {n} จาก {m}` · `เหลืออีก {k} ขั้นตอน` + labelled segments; past steps clickable, future steps disabled) → **1 ปัญหาที่พบ → 2 สถานที่ → 3 รูปภาพ → (leads in team mode) งานที่ทีมทำ → ตรวจสอบก่อนส่ง**. Sticky footer: `ย้อนกลับ` · `ข้อมูลที่กรอกไว้จะอยู่เมื่อย้อนกลับ` · `ถัดไป` (last step `ยืนยันส่งแจ้งซ่อม` / `ยืนยันบันทึกงานทีม`). `ถัดไป` validates only the current step; the final button re-checks every step and opens the first invalid one. Desktop content max 1040px (720px on สถานที่ / ตรวจสอบ).
> - **ปัญหาที่พบ:** `เลือกหมวดที่ตรงกับปัญหา *` (1 หมวด) — category cards (icon, name, examples line e.g. `แอร์ · เครื่องปรับอากาศ`, radio; 3 columns desktop, 2 mobile; last card `อื่นๆ` → `ระบุหมวดงาน *` + `อาการที่พบ *` text fields ≤ 100). Symptoms appear after a category: check boxes `อาการที่พบ * เลือกได้มากกว่า 1 ข้อ` + `อาการอื่นๆ` (→ `ระบุอาการอื่นๆ *`). **No priority question:** a read-only explanation `ความเร่งด่วนของงานนี้: {ระดับ}` / `ระบบกำหนดจากอาการ “{อาการ}” คุณไม่ต้องเลือกระดับเอง` (BR-F02-2). `+ เล่ารายละเอียดเพิ่ม (ไม่บังคับ)` opens รายละเอียด (≤ 500).
> - **ปัญหาเกิดขึ้นที่ไหน:** `เลือกอาคาร *` (building cards with icon + radio) · `เลือกชั้น *` (buttons `ชั้น 1 …`; hint `เลือกอาคารเพื่อดูชั้นที่แจ้งได้`) · `ห้องหรือจุดที่เกิด (ไม่บังคับ)` text + room chips of that floor once settings rooms exist (settings Stage 4) · collapsed `ที่เคยแจ้ง แตะเพื่อเติมอาคาร ชั้น และห้องให้` (#28, max 3, never preselected) · duplicate card (Stage 4).
> - **รูปภาพ:** phone: `ถ่ายรูป` (camera capture) + `เลือกจากคลังรูป`; desktop: drop zone. Beside / below: tips panel `ถ่ายให้เห็นปัญหาชัดเจน` (มุมใกล้: ให้เห็นอาการ · มุมกว้าง: ให้เห็นตำแหน่ง) that turns into `รูปที่แนบแล้ว {n}/5` thumbnails.
> - **ตรวจสอบก่อนส่ง:** report card (category icon + name, title from the symptoms) with rows รายละเอียด · สถานที่ (+ อุปกรณ์ from QR) · `รูปแนบ ({n})` thumbnails · (team) งานที่ทีมทำ — each with `แก้ไข` back to that step. Never hidden.
> - **Draft:** kept in the browser per employee code; on reload a notice `กู้ข้อมูลที่กรอกค้างไว้เมื่อ {HH:mm} น. แล้ว` + `เริ่มใหม่`; cleared on submit / logout / ล้างแบบฟอร์ม.
> - QR banner (Stage 5, phones), team mode `ให้ช่างซ่อม | ทีมแก้เองแล้ว` (Stage 4), duplicate card + fallback dialog (Stage 4) follow the mockup when their stage is built.


- **Flows:** F02 (all steps), F04 (team handled option), F13-B (prefill from QR) (see ../../02-flows.md)
- **Persona:** every role, mobile first (employee standing at the broken thing); desktop usable (see ../../01-users.md)
- **Purpose of this screen (one sentence):** report a problem with category, symptoms, place, photos and urgency in under a minute — or, for team leads, record a job the team already fixed.
- **Route:** `/repair/new` · with QR: `/repair/new?asset={asset_code}`
- **Mockup:** `../mockups/S03-report-form.html` (wizard steps, QR prefill, validation errors, team-handled option; also S04 and S05 frames — its desktop frame is superseded) · desktop: `../mockups/S03-report-form-desktop.html` (CR-002)
- **Data:** categories + symptoms, buildings + floors, asset lookup by code, photo upload, create ticket (returns either the new ticket or a list of open duplicates → S04) → `modules/repair/api.ts` (names fixed in 04-api-contract.md)

## Layout — mobile first

Mobile is a 4-step wizard, one step per screen. Steps and fields (F02 order):

| Step | Heading | Fields |
|---|---|---|
| 1 | เกิดปัญหาเกี่ยวกับอะไร | หมวดงาน * (single) · อาการ * (multiple, shows after a category is picked) |
| 2 | เกิดที่ไหน | อาคาร * · ชั้น * · จุดที่เกิด |
| 3 | รูปและรายละเอียด | รูปภาพ * (1–5) · รายละเอียด |
| 4 | ความเร่งด่วน | ความเร่งด่วน * (default ปกติ) · ตรวจสอบก่อนส่ง (summary) · ทีมดำเนินการเอง (leads only) |

```
┌────────────────────────────┐
│ [UAT strip — dev/UAT only]  │
│ ←        แจ้งซ่อม         ✕ │ ← white top bar: back = previous step (step 1: leave), ✕ = leave
│ ขั้นที่ 1 จาก 4  ▬▬▬▭▭▭▭▭▭▭ │ ← Caption + Progress (4 segments)
│┌ QR banner (only with ?asset) ┐│
││ [QR] เติมข้อมูลจาก QR แล้ว      ││
││ เครื่องปรับอากาศ ห้องประชุม 5B · AC-05-012 ││
││ แก้ไขได้ถ้าไม่ตรง   ไม่ใช่อุปกรณ์นี้ ││ ← link button clears the asset only
│└────────────────────────────┘│
│ เกิดปัญหาเกี่ยวกับอะไร          │ ← H2 (mobile 18)
│ หมวดงาน *                    │
│ ┌──────────┐┌──────────┐     │ ← radio cards, 2 columns, ≥ 72px high
│ │(❄) ระบบปรับ││(💡) ไฟฟ้าและ│     │   icon circle 40px + name; selected = ring-2 ring-primary
│ │   อากาศ   ││  แสงสว่าง  │     │   + bg-secondary + check badge
│ └──────────┘└──────────┘     │
│ …                            │
│ อาการ * (เลือกได้หลายข้อ)      │
│ (แอร์ไม่เย็น✓)(มีน้ำหยด✓)(มีเสียงดัง) │ ← pill chips, multi-select, ≥ 44px
│ (มีกลิ่นอับ)(เปิดไม่ติด)          │
│                              │
├────────────────────────────┤
│ [          ถัดไป          ] │ ← sticky bottom bar, Button default full width
└────────────────────────────┘
```

Step 2: อาคาร and ชั้น as `ChoiceField` (CR-002, design-system "Pickers"): ≤ 5 options → pill radios, 6–12 → grid of buttons, > 12 → `Picker` (bottom sheet on mobile, search when > 10). With the sample data: อาคาร = 2 pills, ชั้น = grid "ชั้น 1 … ชั้น 7". ชั้น shows the hint "เลือกอาคารก่อน" (no options) until a building is picked; options = that building's floors. `Input` จุดที่เกิด with hint.
Step 3: `PhotoPicker` (`_common.md` §5) then `Textarea` รายละเอียด (4 rows, counter `0/500`).
Step 4:

```
│ ความเร่งด่วน *                │
│ ┌────────────────────────┐  │ ← RadioGroup as 4 stacked cards (≥ 64px)
│ │ ▮▮▮ ฉุกเฉิน               ○│  │   PriorityIndicator + label (H3) + one-line hint
│ │ อันตราย หรือกระทบงานหลายคนทันที│  │
│ ├────────────────────────┤  │
│ │ ▮▮▮ สูง …                ○│  │
│ │ ▮▮  ปกติ …               ●│  │ ← default
│ │ ▮   ต่ำ …                ○│  │
│ └────────────────────────┘  │
│ ตรวจสอบก่อนส่ง                 │ ← Card, rows with "แก้ไข" link → jumps to that step
│  หมวดงาน   ระบบปรับอากาศ  แก้ไข │
│  อาการ     แอร์ไม่เย็น · มีน้ำหยด │
│  สถานที่    อาคารหลัก ชั้น 5 · ห้องประชุม 5B แก้ไข │
│  รูปภาพ    [▢][▢] 2 รูป      แก้ไข │
│┌ leads only ─────────────────┐│
││ ทีมของฉันแก้ปัญหานี้เรียบร้อยแล้ว [⏻]││ ← Switch
││ งานจะปิดทันที ไม่เข้าคิวช่าง      ││
││ (when on) สิ่งที่ทีมทำ * [Textarea] ││
││ (when on) รูปหลังทำ * [PhotoPicker] ││
│└────────────────────────────┘│
├────────────────────────────┤
│ [ 🔧 ส่งแจ้งซ่อม ]  (brand)   │ ← label becomes "บันทึกงานทีม" (default variant) when the switch is on
└────────────────────────────┘
```

Desktop (≥1024px) (CR-002): sidebar + top bar (title "แจ้งซ่อม"). One column of 4 section cards + a **sticky summary panel** on the right (grid `minmax(0,1fr) 316px`, gap 18, max width 1000px, centered). Below `xl` (1280px) the panel turns into a sticky bottom bar (progress + "ส่งแจ้งซ่อม").
- Section cards have a numbered heading ("1 เกิดปัญหาเกี่ยวกับอะไร", …). The number turns into a green check and the heading shows "ครบแล้ว" when the section's required fields are valid; after a failed submit a section with errors gets a red number, a red ring and "ต้องแก้ {n} ช่อง".
- Denser than mobile so the page is about 1.4 screens: category cards in one row of 5 (icon above name); symptoms chips 40px; อาคาร + ชั้น side by side (`ChoiceField`, desktop floor grid shows numbers only "1 … 7" under the label ชั้น); photo tiles 92px in one row; รายละเอียด 3 rows; priority as 4 radio cards in one row.
- **Summary panel** (`Card` `shadow-float`, sticky top): title "สรุปการแจ้งซ่อม" · progress bar + "ครบ {n} จาก 4" · checklist rows (หมวดงาน · อาการ / สถานที่ / รูปภาพ / ความเร่งด่วน) each with a done / missing icon and the current value or the missing text; clicking a row scrolls to and focuses that section · next-step note "งานจะเข้าคิวช่างหมวด{หมวดงาน} เราจะแจ้งเตือนเมื่อช่างรับงาน" (shown once a category is picked) · "ส่งแจ้งซ่อม" (brand, full width) · "ยกเลิก" (ghost). The submit button is never disabled for missing fields: submit validates, scrolls to the first section with an error and focuses the field.
- No step-4 summary card on desktop (the panel replaces it). Team-handled card under priority (leads, Stage 5). QR banner above card 1 (Stage 6).

## Components

| Area | Component (design-system.md) | Notes |
|---|---|---|
| Top bar | white top bar (back · title · close) | mobile only |
| Progress | `Progress` or 4 segment bars + Caption | mobile only; `aria-label` "ขั้นที่ 1 จาก 4" |
| Category | `RadioGroup` styled as cards + icon circle (`a-ri` look, `svc-repair` tint) | category icon comes from the category data (lucide name); fallback `Wrench` |
| Symptoms | `ToggleGroup type="multiple"` styled as pills | selected = `bg-foreground text-white` (design-system filter pill) + check icon |
| Building / floor | `ChoiceField` (pills / grid / `Picker`) (CR-002) | rule by option count — design-system "Pickers" |
| Location detail | `Input` | |
| Photos | `PhotoPicker` (`_common.md` §5) | |
| Details | `Textarea` + counter | |
| Priority | `RadioGroup` cards + `PriorityIndicator` | |
| Summary | `Card` with rows + `Button` link "แก้ไข" | mobile step 4 only |
| Summary panel | `Card` sticky + `Progress` + checklist (CR-002) | desktop only; bottom bar below `xl` |
| Team handled | `Card` + `Switch` + `Textarea` + `PhotoPicker` | only `housekeeper_lead`, `security_lead` (BR-F04-1) |
| QR banner | `Alert` default with `QrCode` icon + `Button` link | |
| Leave confirm | `AlertDialog` discard (`_common.md` §7) | |
| Submit | `Button` variant `brand` (normal) / default (team handled), sticky bottom (mobile) | spinner + disabled while sending |
| Duplicates | S04 (Sheet / Dialog) | |

## Content and copy (exact Thai text)

| Element | Text |
|---|---|
| Title | แจ้งซ่อม |
| Step caption | ขั้นที่ {n} จาก 4 |
| Step headings | เกิดปัญหาเกี่ยวกับอะไร · เกิดที่ไหน · รูปและรายละเอียด · ความเร่งด่วน |
| Labels | หมวดงาน * · อาการ * · อาคาร * · ชั้น * · จุดที่เกิด · รูปภาพ * · รายละเอียด · ความเร่งด่วน * |
| Symptom hint | เลือกได้หลายข้อ |
| Symptom placeholder (no category yet) | เลือกหมวดงานก่อน แล้วอาการจะแสดงที่นี่ |
| Placeholders | อาคาร: เลือกอาคาร · ชั้น: เลือกชั้น · จุดที่เกิด: เช่น ห้องประชุม 5B ฝั่งหน้าต่าง · รายละเอียด: เล่าเพิ่มเติม เช่น เริ่มเป็นตั้งแต่เมื่อไร |
| Hints | จุดที่เกิด: บอกจุดที่ช่างหาเจอง่าย · รูปภาพ: อย่างน้อย 1 รูป สูงสุด 5 รูป |
| Priority options | ฉุกเฉิน — อันตราย หรือกระทบงานหลายคนทันที · สูง — กระทบการทำงานของคุณหรือทีม · ปกติ — ใช้งานได้ แต่ไม่สะดวก · ต่ำ — ไม่เร่งด่วน |
| Summary | ตรวจสอบก่อนส่ง · rows หมวดงาน / อาการ / สถานที่ / รูปภาพ ({n} รูป) · link แก้ไข |
| Summary panel (desktop) (CR-002) | title สรุปการแจ้งซ่อม · ครบ {n} จาก 4 · rows หมวดงาน · อาการ / สถานที่ / รูปภาพ / ความเร่งด่วน · missing: ยังไม่ได้เลือก (หมวดงาน · อาการ, สถานที่) · ยังไม่ได้แนบ — อย่างน้อย 1 รูป (รูปภาพ) · uploading: กำลังอัปโหลด {n} รูป · photos done: {n} รูป · next step: งานจะเข้าคิวช่างหมวด{หมวดงาน} เราจะแจ้งเตือนเมื่อช่างรับงาน |
| Section status (desktop) (CR-002) | ครบแล้ว · ต้องแก้ {n} ช่อง |
| Floor hint before a building (CR-002) | เลือกอาคารก่อน |
| Team handled | switch label: ทีมของฉันแก้ปัญหานี้เรียบร้อยแล้ว · hint: งานจะปิดทันที ไม่เข้าคิวช่าง · fields: สิ่งที่ทีมทำ * (placeholder "เช่น เช็ดพื้นและวางป้ายระวังลื่นแล้ว") · รูปหลังทำ * |
| Buttons | ถัดไป · ส่งแจ้งซ่อม · บันทึกงานทีม · ยกเลิก (desktop) |
| QR banner (found) | เติมข้อมูลจาก QR แล้ว · {asset name} · {asset_code} · แก้ไขได้ถ้าไม่ตรง · link ไม่ใช่อุปกรณ์นี้ |
| QR banner (not found) | Alert title: ไม่พบอุปกรณ์นี้ · body: กรอกข้อมูลเองได้เลย |
| No categories configured | ยังไม่มีหมวดงานในระบบ ติดต่อ Admin |
| Send failed | Alert destructive above the bottom bar: ส่งไม่สำเร็จ / ลองอีกครั้ง ข้อมูลในฟอร์มยังอยู่ครบ |
| Error codes → message | see Validation below; others → `_common.md` §6 |

## States

| State | What shows |
|---|---|
| Loading | Skeleton of step 1 (heading, 6 category cards, chips row) while categories/buildings load; with `?asset` the QR banner shows a skeleton line until the lookup returns. |
| Empty | No categories → empty card with mascot `bust` + "ยังไม่มีหมวดงานในระบบ ติดต่อ Admin" + button "กลับหน้าแรก". |
| Error | Master data fails → whole-page error (`_common.md` §6). Asset lookup fails → treat as not found (Alert) and keep the form usable. Submit fails → Alert "ส่งไม่สำเร็จ" (form data kept). |
| Forbidden | — (every role can report). |
| Success feedback | No duplicates → S05 (`/repair/new/done?id={id}`). Duplicates → S04. Team handled → S05 team variant. |

## Interactions

- **Step navigation (mobile):** "ถัดไป" validates only the current step; on error stay, show messages, focus the first invalid field. Back arrow goes to the previous step without validating. Data survives moving between steps.
- **Category change** clears symptoms that do not belong to the new category.
- **Building change** clears ชั้น.
- **QR prefill (F13-B):** with `?asset` found → prefill หมวดงาน, อาคาร, ชั้น, จุดที่เกิด; all editable (BR-F13B-2); open at step 1 with symptoms to pick. "ไม่ใช่อุปกรณ์นี้" removes the asset link and banner but keeps the field values. The asset code survives the login redirect (F13-B) because it is part of the URL.
- **Leaving with any data entered** (back on step 1, ✕, browser back, nav) → discard dialog. Nothing entered → leave silently.
- **Submit:** validates all steps (mobile: jumps to the first step with an error). Then sends; the server runs the duplicate check (F03) first:
  - duplicates → open S04 with the list; nothing created yet
  - none → create → S05
- **Team handled (leads only, BR-F04-1/2/3):** switch on reveals two required fields; submit label "บันทึกงานทีม"; still goes through the duplicate check (S04).
- **Validation (field → rule → message):**
  - หมวดงาน → required → กรุณาเลือกหมวดงาน
  - อาการ → at least 1 → เลือกอาการอย่างน้อย 1 ข้อ
  - อาคาร → required → กรุณาเลือกอาคาร
  - ชั้น → required → กรุณาเลือกชั้น
  - จุดที่เกิด → max 100 → ไม่เกิน 100 ตัวอักษร
  - รูปภาพ → at least 1 (BR-F02-1) → แนบรูปอย่างน้อย 1 รูป · other photo messages: `_common.md` §5
  - รายละเอียด → max 500 → ไม่เกิน 500 ตัวอักษร
  - ความเร่งด่วน → required (has default) → กรุณาเลือกความเร่งด่วน
  - สิ่งที่ทีมทำ (switch on) → required, max 500 → กรุณาบอกสิ่งที่ทีมทำ
  - รูปหลังทำ (switch on) → at least 1 (BR-F04-2) → แนบรูปหลังทำอย่างน้อย 1 รูป
  - server says category/symptom/floor no longer exists → Alert: ข้อมูลบางอย่างเปลี่ยนไป กรุณาเลือกใหม่ + reload master data

## Acceptance checklist (Codex reports results in ../HANDOFF.md — does not edit this file)

- [ ] Matches `S03-report-form.html` at 375px (4 steps, QR banner, errors, team-handled) and `S03-report-form-desktop.html` at 1280px (sections + sticky summary panel) (CR-002)
- [ ] Summary panel tracks the 4 checklist rows live; clicking a row scrolls to the section; below 1280px it is a sticky bottom bar (CR-002)
- [ ] อาคาร / ชั้น follow the `ChoiceField` rule (pills / grid / Picker) (CR-002)
- [ ] Uses only design-system tokens and shadcn components; `brand` button only for "ส่งแจ้งซ่อม"
- [ ] Per-step validation on mobile, full validation on submit, exact messages
- [ ] Team-handled card renders only for `housekeeper_lead` / `security_lead`
- [ ] QR found / not found / "ไม่ใช่อุปกรณ์นี้" behave as above
- [ ] Discard dialog appears only when data was entered
- [ ] Submit keeps all data on failure; photo upload errors stay per tile
- [ ] Keyboard and screen-reader basics (radio cards and chips reachable by keyboard, labels, error text linked with `aria-describedby`)
- [ ] Works with mocks (`NEXT_PUBLIC_USE_MOCKS=true`), including a mock that returns duplicates and one asset code that is not found
