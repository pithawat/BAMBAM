# S22 — หมวดงานและอาการ

Status: DRAFT

- **Flows:** F27 (see ../../02-flows.md)
- **Persona:** Superadmin on desktop (see ../../01-users.md)
- **Purpose of this screen (one sentence):** keep the category and symptom choices of the repair form clean and in the right order.
- **Route:** `/settings/categories` (desktop: first category selected) · `/settings/categories/[categoryId]` (mobile: the symptom list page)
- **Mockup:** none — same two-pane pattern as `../mockups/S20-buildings.html` (left = categories, right = symptoms)
- **Data:** `listCategories`, `createCategory`, `updateCategory`, `reorderCategories`, `setCategoryActive`, `deleteCategory`, `listSymptoms`, `createSymptom`, `updateSymptom`, `reorderSymptoms`, `setSymptomActive`, `deleteSymptom`

## Layout — mobile first

Mobile `/settings/categories`: white top bar "หมวดงานและอาการ" + `[+]` (เพิ่มหมวดงาน); `MasterList` "หมวดงาน ({n})", row = 40px icon circle (`bg-svc-repair/15`, icon `text-foreground`) · name · "{n} อาการ" · ⋯ · `›`.
Mobile `/settings/categories/[id]`: white top bar = category name, ⋯ = category menu; `MasterList` "อาการ ({n})" + "เพิ่มอาการ".

```
Desktop
┌ หมวดงานและอาการ                                     [เพิ่มหมวดงาน] ┐
│ ตัวเลือกหมวดงานและอาการในฟอร์มแจ้งซ่อม เรียงตามลำดับที่ผู้แจ้งเห็น      │
│ ┌ หมวดงาน (5) ───────────┐ ┌ (❄) ระบบปรับอากาศ ──────── [เพิ่มอาการ] ┐ │
│ │ ⠿ (❄) ระบบปรับอากาศ 5 › │ │ อาการ (5)                              │ │
│ │ ⠿ (💡) ไฟฟ้าและแสงสว่าง 4│ │ ⠿ แอร์ไม่เย็น                       ⋯ │ │
│ │ ⠿ (💧) ประปาและสุขภัณฑ์ 4│ │ ⠿ มีน้ำหยด                          ⋯ │ │
│ │ …                      │ │ …                                      │ │
│ └────────────────────────┘ └────────────────────────────────────────┘ │
```

Desktop (≥1024px): two panes 5 / 7 like S20. Right card header = icon circle + category name + "ปิดใช้งาน" badge; actions "เพิ่มอาการ" (primary sm), "แก้ไขหมวด" (outline sm).

## Components

| Area | Component | Notes |
|---|---|---|
| Lists | `MasterList` (`_common.md` §4) | |
| Category dialog | `Dialog` / `Sheet` | ชื่อหมวดงาน* (≤ 100) · ไอคอน* (`ChoiceField` grid of 12 icon buttons, 56px, selected = `bg-foreground text-white`) |
| Symptom dialog | `Dialog` / `Sheet` | ชื่ออาการ* (≤ 100) |
| Warning | inline `Alert` warning in the right pane | when the category has no active symptom |

Icon choices (lucide name → shown as icon only, accessible name in Thai): `wrench` ทั่วไป · `snowflake` ปรับอากาศ · `lightbulb` แสงสว่าง · `zap` ไฟฟ้า · `plug` ปลั๊ก · `droplets` น้ำ · `shower-head` สุขภัณฑ์ · `armchair` เฟอร์นิเจอร์ · `door-open` ประตู / อาคาร · `sparkles` ความสะอาด · `trash-2` ขยะ · `hammer` ซ่อมบำรุง. The map lives in one shared file used by the repair form too (see `../../03-plan.md`).

## Content and copy (exact Thai text)

| Element | Text |
|---|---|
| Title / subtitle | หมวดงานและอาการ / ตัวเลือกหมวดงานและอาการในฟอร์มแจ้งซ่อม เรียงตามลำดับที่ผู้แจ้งเห็น |
| Lists | หมวดงาน ({n}) · อาการ ({n}) |
| Buttons | เพิ่มหมวดงาน · เพิ่มอาการ · แก้ไขหมวด |
| Category dialog | เพิ่มหมวดงาน / แก้ไขหมวดงาน · ชื่อหมวดงาน * (placeholder: เช่น ระบบปรับอากาศ) · ไอคอน * |
| Symptom dialog | เพิ่มอาการ / แก้ไขอาการ · ชื่ออาการ * (placeholder: เช่น แอร์ไม่เย็น) · hint: อาการแสดงเป็นชื่องานซ่อม เช่น "แอร์ไม่เย็น · มีน้ำหยด" |
| No-active-symptom warning | หมวดนี้ไม่แสดงในฟอร์มแจ้งซ่อม เพราะยังไม่มีอาการที่เปิดใช้งาน |
| Deactivate category — extra line | อาการทั้งหมดในหมวดนี้จะไม่แสดงในฟอร์มด้วย |
| Deactivate / delete the last active symptom — extra line | นี่คืออาการสุดท้ายที่เปิดใช้งานของหมวด "{หมวด}" หมวดนี้จะไม่แสดงในฟอร์มแจ้งซ่อม |
| Empty — no categories | ยังไม่มีหมวดงาน / ผู้แจ้งต้องเลือกหมวดงานทุกครั้งที่แจ้งซ่อม · button เพิ่มหมวดงาน |
| Empty — no symptoms | ยังไม่มีอาการในหมวดนี้ / ฟอร์มแจ้งซ่อมบังคับเลือกอาการอย่างน้อย 1 ข้อ · button เพิ่มอาการ |
| Category not found | ไม่พบหมวดงานนี้ · button กลับไปรายการหมวดงาน |

## States

| State | What shows |
|---|---|
| Loading | left 5 skeleton rows with icon circles; right header + 5 rows |
| Empty | per copy above |
| Error | whole page shared copy; symptoms pane: inline `Alert` "โหลดรายการอาการไม่สำเร็จ" + ลองอีกครั้ง |
| Forbidden | `_common.md` §1 |

## Interactions

- No moving a symptom to another category (F27 Added by Claude) — the edit dialog has no category field.
- Category rows show "{n} อาการ" counting active symptoms only; 0 → text `text-warning` "ไม่มีอาการ".

## Acceptance checklist

- [ ] Same pattern as S20 at 375px and 1280px
- [ ] Icon picker shows the 12 icons with accessible names; the repair form renders the same icon
- [ ] Warning and extra dialog lines appear exactly when the category has no active symptom
- [ ] All states above with the exact copy
- [ ] Works with mocks
