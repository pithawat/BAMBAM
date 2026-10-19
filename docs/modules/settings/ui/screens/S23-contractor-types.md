# S23 — ประเภทผู้รับเหมา

Status: APPROVED (2026-10-16) — user approved screens + plan; visual style follows the new design direction (repair CR-008, pending)

- **Flows:** F28 (see ../../02-flows.md)
- **Persona:** Superadmin on desktop (see ../../01-users.md)
- **Purpose of this screen (one sentence):** tidy the contractor types that technicians pick (and create) when assessing a job.
- **Route:** `/settings/contractor-types`
- **Mockup:** none — `MasterList` single card (`_common.md` §4); desktop rows as in the S20 left pane, plus columns
- **Data:** `listContractorTypes`, `createContractorType`, `updateContractorType`, `setContractorTypeActive`, `deleteContractorType`

## Layout — mobile first

```
┌──────────────────────────────┐
│ ‹    ประเภทผู้รับเหมา      [+] │
│ ┌──────────────────────────┐ │
│ │ ประเภท (5) [แสดงที่ปิดใช้งาน]│ │
│ │ ไฟฟ้า                   ⋯ │ │
│ │ 3 ผู้รับเหมา               │ │
│ │ งานโครงสร้าง  [สร้างโดยช่าง] ⋯│ │
│ │ ยังไม่มีผู้รับเหมา          │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

Desktop (≥1024px): H1 + subtitle + "เพิ่มประเภท" (primary). One `Card` with a `Table`: ประเภท (name + badges) · ผู้รับเหมา (count, text only — repair S18 has no type filter) · สร้างโดย (name · date) · menu. Sorted by name (Thai collation); no manual order (types are a tag list, not a form order).

## Components

| Area | Component | Notes |
|---|---|---|
| List | `Card` + `Table` (desktop) / `MasterList` without drag (mobile) | |
| Dialog | `Dialog` / `Sheet` | ชื่อประเภท* (≤ 50) |
| Search | `Input` with `Search` icon, pill, in the card header | filters client-side |

## Content and copy (exact Thai text)

| Element | Text |
|---|---|
| Title / subtitle | ประเภทผู้รับเหมา / ประเภทที่ช่างเลือกตอนประเมินงาน ช่างเพิ่มประเภทใหม่เองได้ด้วย |
| Card title | ประเภท ({n}) |
| Search placeholder | ค้นหาประเภท |
| Table headers | ประเภท · ผู้รับเหมา · สร้างโดย |
| Count | {n} ผู้รับเหมา / ยังไม่มีผู้รับเหมา |
| Created by | {ชื่อ} · {วันที่} (+ badge "สร้างโดยช่าง" when the creator is not super_admin) |
| Dialog | เพิ่มประเภท / แก้ไขประเภท · ชื่อประเภท * · placeholder: เช่น ไฟฟ้า, ประปา, ลิฟต์ · hint: ชื่อซ้ำไม่ได้ (ไม่สนตัวพิมพ์เล็ก-ใหญ่) |
| Deactivate — extra line | ผู้รับเหมาที่มีประเภทนี้อยู่แล้วยังแสดงประเภทนี้ ช่างเลือกประเภทนี้ให้ผู้รับเหมาใหม่ไม่ได้ |
| Empty | ยังไม่มีประเภทผู้รับเหมา / ช่างจะเพิ่มได้เองตอนประเมินงาน หรือเพิ่มไว้ล่วงหน้าที่นี่ · button เพิ่มประเภท |
| Search empty | ไม่พบประเภทที่ตรงกับ "{q}" · button ล้างการค้นหา |

## States

| State | What shows |
|---|---|
| Loading | 5 skeleton rows |
| Empty | per copy |
| Error | whole page shared copy |
| Forbidden | `_common.md` §1 |

## Interactions

- `inUse` = linked to any contractor ever → delete disabled (`_common.md` §4).
- Repair side (no UI change here, BR-F28 edge case): a technician typing the name of a deactivated type reuses and re-activates it.

## Acceptance checklist

- [ ] Matches the described layout at 375px and 1280px
- [ ] Case-insensitive duplicate shows "ชื่อนี้มีอยู่แล้ว"
- [ ] All states above with the exact copy
- [ ] Works with mocks
