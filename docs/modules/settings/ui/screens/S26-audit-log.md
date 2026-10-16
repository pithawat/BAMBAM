# S26 — ประวัติการเปลี่ยนแปลง

Status: DRAFT

- **Flows:** F30 (see ../../02-flows.md)
- **Persona:** Superadmin on desktop (see ../../01-users.md)
- **Purpose of this screen (one sentence):** see who changed which setting, when, and from what to what.
- **Route:** `/settings/audit` (`?type=&actor=&from=&to=&q=&page=`)
- **Mockup:** none — table pattern of `../mockups/S25-users.html`
- **Data:** `listAuditEntries` (filters, page), `listRoles` not needed; actor options from `listAuditActors`

## Layout — mobile first

```
┌──────────────────────────────┐
│ ‹   ประวัติการเปลี่ยนแปลง      │
│ [ทั้งหมด|Master|สิทธิ์|ผู้ใช้]   │ ← segmented
│ [ตัวกรอง 1]  [🔍 ค้นหารายการ ]  │ ← sheet with ผู้ทำ + ช่วงวันที่
│ วันนี้                         │ ← day group label (Small 600)
│ ┌──────────────────────────┐ │
│ │ (🛡) เปลี่ยนสิทธิ์ · ช่างเทคนิค│ │
│ │ + ปรับความเร่งด่วน          │ │
│ │ ปวีณา ศรีสุข · 10:42        │ │
│ ├──────────────────────────┤ │
│ │ (👥) เปลี่ยน role · ธนากร…  │ │
│ │ พนักงานทั่วไป → ช่างเทคนิค   │ │
│ │ ณัฐพล อินทรวงศ์ · 09:15     │ │
│ └──────────────────────────┘ │
│ [โหลดเพิ่ม]                    │
└──────────────────────────────┘
```

Desktop (≥1024px): H1 + subtitle; toolbar: segmented type · `FilterPill` "ผู้ทำ" · `FilterPill` "ช่วงวันที่" (7 วัน · 30 วัน · 90 วัน · ทั้งหมด, default 30 วัน) · search pill · "ล้างตัวกรอง". `Card` + `Table`:

| เวลา (`16 ต.ค. 2569 10:42`) | ผู้ทำ | การกระทำ (`Badge` muted) | รายการ (type label + name) | รายละเอียด (before → after) |

Rows 60px; details wrap; 50 per page with `Pagination`. Mobile uses "โหลดเพิ่ม" (50 at a time) and groups by day (วันนี้ · เมื่อวาน · {วันที่}).

**Detail text by action** (one line, values in `font-medium`):

| Action | Detail |
|---|---|
| `create` | เพิ่ม "{ชื่อ}" (+ "ใน {parent}" for floor / room / symptom) |
| `update` | {field label}: {เดิม} → {ใหม่} (one line per changed field) |
| `deactivate` / `activate` / `delete` | — |
| `reorder` | เรียงลำดับ{ชนิด}ใน {parent} ใหม่ |
| `role_change` | {role เดิม} → {role ใหม่} |
| `permissions_change` | เพิ่ม: {labels} · ถอด: {labels} |
| `floor_plan_upload` / `floor_plan_delete` | {ชื่อไฟล์} |

Field labels: ชื่อ · ไอคอน · คำอธิบาย · ลำดับ.

## Components

| Area | Component | Notes |
|---|---|---|
| Type filter | `SegmentedControl` | ทั้งหมด · Master · สิทธิ์ · ผู้ใช้ |
| Actor / date filters | `FilterPill` | mobile: inside the "ตัวกรอง" sheet |
| Table / list | `Card` + `Table` / `Card` list | icon circle by entity type (`_common.md` §2 icons; user = `Users`, role = `ShieldCheck`) |

## Content and copy (exact Thai text)

| Element | Text |
|---|---|
| Title / subtitle | ประวัติการเปลี่ยนแปลง / ทุกการเปลี่ยนในตั้งค่าระบบ ใครทำ เมื่อไหร่ เปลี่ยนจากอะไรเป็นอะไร · ไม่มีการลบประวัติ |
| Segments | ทั้งหมด · Master · สิทธิ์ · ผู้ใช้ |
| Filters | ผู้ทำ: ทุกคน / ผู้ทำ: {ชื่อ} · ช่วงวันที่: 30 วัน (7 วัน · 30 วัน · 90 วัน · ทั้งหมด) |
| Search placeholder | ค้นหาชื่อรายการ |
| Table headers | เวลา · ผู้ทำ · การกระทำ · รายการ · รายละเอียด |
| Action / entity labels | `_common.md` §3 |
| Empty | ยังไม่มีการเปลี่ยนแปลง / การเพิ่ม แก้ไข และเปลี่ยนสิทธิ์จะแสดงที่นี่ |
| Filter empty | ไม่พบรายการตามตัวกรอง · button ล้างตัวกรอง |
| Load more | โหลดเพิ่ม |

## States

| State | What shows |
|---|---|
| Loading | toolbar + 8 skeleton rows |
| Empty | per copy (mascot `face` small card) |
| Error | whole page shared copy; load more failure: inline `Alert` under the list + ลองอีกครั้ง |
| Forbidden | `_common.md` §1 |

## Interactions

- Read-only (BR-F30-2): no row actions.
- "รายการ" links to the item when it still exists (building → S20, floor → S21, category → S22, role → S24 `?tab=roles`, user → S25 `?user=`); deleted items show the stored name without a link.
- Technicians creating contractor types inline appear here too (F30 Added by Claude); actor shows their name.

## Acceptance checklist

- [ ] Matches the described layout at 375px and 1280px
- [ ] Filters combine and live in the URL; default range 30 วัน
- [ ] Detail text follows the action table
- [ ] All states above with the exact copy
- [ ] Works with mocks
