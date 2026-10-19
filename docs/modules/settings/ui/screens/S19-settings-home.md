# S19 — ตั้งค่าระบบ (หน้ารวม)

Status: APPROVED (2026-10-16) — user approved screens + plan; visual style follows the new design direction (repair CR-008, pending)

- **Flows:** F25 step 3 (see ../../02-flows.md)
- **Persona:** Superadmin on desktop; on mobile from โปรไฟล์ (see ../../01-users.md)
- **Purpose of this screen (one sentence):** one place to reach every settings section and see its size at a glance.
- **Route:** `/settings`
- **Mockup:** none — card grid like the Home service cards (repair `S02`), styles in `../mockups/S24-roles-permissions.html` (desktop shell)
- **Data:** `getSettingsSummary` (counts per section)

## Layout — mobile first

```
┌──────────────────────────────┐
│ bg-brand short header         │
│  ตั้งค่าระบบ                   │
│  สำหรับ Superadmin            │
│ ┌──────────────────────────┐ │ ← card overlaps header
│ │ (🏢) อาคารและชั้น         › │ │
│ │      2 อาคาร · 9 ชั้น       │ │
│ ├──────────────────────────┤ │
│ │ (🏷) หมวดงานและอาการ      › │ │
│ │      5 หมวด · 20 อาการ      │ │
│ ├──────────────────────────┤ │
│ │ (⛑) ประเภทผู้รับเหมา      › │ │
│ │      5 ประเภท               │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ (🛡) Role และสิทธิ์       › │ │
│ │      7 role                │ │
│ ├──────────────────────────┤ │
│ │ (👥) ผู้ใช้               › │ │
│ │      421 คน                │ │
│ ├──────────────────────────┤ │
│ │ (🕘) ประวัติการเปลี่ยนแปลง › │ │
│ │      ล่าสุด 10:42 · ปวีณา   │ │
│ └──────────────────────────┘ │
│ [bottom nav]                 │
└──────────────────────────────┘
```

Desktop (≥1024px): H1 "ตั้งค่าระบบ" + subtitle; two titled groups side by side in a 2-column grid of cards — "ข้อมูลหลัก (Master)" (3 cards) and "ผู้ใช้และสิทธิ์" (3 cards). Each card: 44px icon circle `bg-secondary text-primary`, title H3, count line Small muted, `›`. Whole card is the link. Card min-height 96px.

## Components

| Area | Component | Notes |
|---|---|---|
| Header (mobile) | `bg-brand` short header (repair `_common.md` §1) | |
| Section cards | `Card` list rows (mobile) / `Card` grid (desktop) | lucide icons from `_common.md` §2 |

## Content and copy (exact Thai text)

| Element | Text |
|---|---|
| Title | ตั้งค่าระบบ |
| Subtitle | ตั้งค่าข้อมูลกลาง สิทธิ์ และผู้ใช้ของทุกระบบ (mobile header: สำหรับ Superadmin) |
| Group titles (desktop) | ข้อมูลหลัก (Master) · ผู้ใช้และสิทธิ์ |
| อาคารและชั้น | {b} อาคาร · {f} ชั้น |
| หมวดงานและอาการ | {c} หมวด · {s} อาการ |
| ประเภทผู้รับเหมา | {t} ประเภท |
| Role และสิทธิ์ | {r} role |
| ผู้ใช้ | {u} คน |
| ประวัติการเปลี่ยนแปลง | ล่าสุด {เวลา} · {ชื่อผู้ทำ} / ยังไม่มีการเปลี่ยนแปลง |

Counts include active items only.

## States

| State | What shows |
|---|---|
| Loading | the six cards with skeleton count lines (titles visible) |
| Empty | n/a — counts show 0 (e.g. "0 อาคาร · 0 ชั้น") |
| Error | cards stay usable without counts; inline `Alert` "โหลดข้อมูลสรุปไม่สำเร็จ" + ลองอีกครั้ง above them |
| Forbidden | `_common.md` §1 |

## Interactions

- Click / tap a card → its route.

## Acceptance checklist

- [ ] Matches the layout at 375px and 1280px
- [ ] Uses only design-system tokens and shadcn components
- [ ] All states above with the exact copy
- [ ] Non-super_admin gets the forbidden state; the sidebar group and profile row are hidden for them
- [ ] Works with mocks (`NEXT_PUBLIC_USE_MOCKS=true`)
