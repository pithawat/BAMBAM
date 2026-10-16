# S21 — รายละเอียดชั้น (ห้อง / โซน และผังชั้น)

Status: DRAFT

- **Flows:** F26 steps 3–4 (see ../../02-flows.md)
- **Persona:** Superadmin on desktop (see ../../01-users.md)
- **Purpose of this screen (one sentence):** keep one floor's rooms / zones and its floor-plan image up to date.
- **Route:** `/settings/buildings/[buildingId]/floors/[floorId]`
- **Mockup:** `../mockups/S20-buildings.html` → section "S21" (desktop two columns, lightbox, mobile)
- **Data:** `getFloor`, `updateFloor`, `listRooms`, `createRoom`, `updateRoom`, `reorderRooms`, `setRoomActive`, `deleteRoom`, `uploadFloorPlan`, `deleteFloorPlan`

## Layout — mobile first

```
┌──────────────────────────────┐
│ ‹   อาคารหลัก ชั้น 5        ⋯ │ ← ⋯ = แก้ไขชั้น / ปิดใช้งาน / ลบ
│ ┌──────────────────────────┐ │
│ │ ผังชั้น                    │ │
│ │ ┌──────────────────────┐ │ │
│ │ │      floor plan img   │ │ │ ← 4:3 box, object-contain, tap = lightbox
│ │ └──────────────────────┘ │ │
│ │ ผังชั้น5.png · 1.2 MB      │ │
│ │ อัปเดต 14 ต.ค. 2569 โดยปวีณา│ │
│ │ [เปลี่ยนรูป]  [ลบรูป]       │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ ห้อง / โซน (8)      [+ เพิ่ม]│ │
│ │ ห้องประชุม 5A          ⋯ │ │
│ │ ห้องประชุม 5B          ⋯ │ │
│ │ …                         │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

Desktop (≥1024px): breadcrumb above the title "อาคารและชั้น › อาคารหลัก › ชั้น 5" (links); H1 "อาคารหลัก ชั้น 5" + "ปิดใช้งาน" badge if inactive; header actions "แก้ไขชั้น" (outline) and ⋯ (ปิดใช้งาน / ลบ). Two columns (grid 5 / 7): **left** `MasterList` "ห้อง / โซน ({n})"; **right** "ผังชั้น" card with a large preview (max-height 520px, `object-contain`, `bg-muted` letterbox, radius 16px).

## Components

| Area | Component | Notes |
|---|---|---|
| Rooms | `MasterList` (`_common.md` §4) | no `›` (rooms have no page) |
| Add / edit room | `Dialog` / `Sheet` | field: ชื่อห้อง / โซน* (≤ 100) |
| Floor plan empty | dashed drop zone (`border-input`, radius 16px, 4:3) with `ImagePlus` 32px | click or drop a file |
| Floor plan set | image + meta + buttons | "เปลี่ยนรูป" (outline), "ลบรูป" (ghost destructive) |
| Upload progress | progress bar under the image box + dimmed preview | button disabled while uploading |
| Lightbox | `Dialog` full screen, `bg-foreground/90`, pinch / wheel zoom, close ✕ 44px | Esc closes |

## Content and copy (exact Thai text)

| Element | Text |
|---|---|
| Title | {อาคาร} ชั้น {ชั้น} |
| Rooms card | ห้อง / โซน ({n}) · button เพิ่มห้อง / โซน · hint under title: ยังไม่ใช้ในฟอร์มแจ้งซ่อม ใช้แสดงรายละเอียดชั้น และเตรียมไว้ให้ระบบจองห้องประชุม |
| Room dialog | title: เพิ่มห้อง / โซน / แก้ไขห้อง / โซน · label: ชื่อห้อง / โซน * · placeholder: เช่น ห้องประชุม 5B, ห้องน้ำหญิง, ฝ่ายบัญชี |
| Plan card title | ผังชั้น |
| Plan empty | ยังไม่มีผังชั้น / ลากรูปมาวาง หรือ คลิกเพื่อเลือกรูป · JPG, PNG ไม่เกิน 10 MB |
| Plan meta | {ชื่อไฟล์} · {ขนาด} MB · อัปเดต {วันเวลา} โดย{ชื่อ} |
| Plan buttons | เปลี่ยนรูป · ลบรูป · (on image hover, desktop) ดูเต็มจอ |
| Delete plan dialog | title: ลบผังชั้นนี้? · body: ภาพรวมอาคารจะไม่มีผังให้เปิดดูสำหรับชั้นนี้ · ยกเลิก · **ลบรูป** |
| Upload errors | รองรับ JPG, PNG ไม่เกิน 10 MB (`INVALID_FILE`, `FILE_TOO_LARGE`) · อัปโหลดไม่สำเร็จ ลองอีกครั้ง (others) — under the plan box; the old plan stays |
| Toasts | อัปโหลดผังชั้นแล้ว · ลบผังชั้นแล้ว |
| Empty rooms | ยังไม่มีห้องในชั้นนี้ / เพิ่มห้องหรือโซน เช่น ห้องประชุม ห้องน้ำ แผนก · button เพิ่มห้อง / โซน |
| Floor not found | ไม่พบชั้นนี้ · button กลับไปรายการชั้น |

## States

| State | What shows |
|---|---|
| Loading | title skeleton; rooms 5 skeleton rows; plan box skeleton 4:3 |
| Empty | rooms empty card; plan drop zone |
| Error | whole page: shared copy; rooms or plan only: inline `Alert` in that card ("โหลดรายการห้องไม่สำเร็จ" / "โหลดผังชั้นไม่สำเร็จ") + ลองอีกครั้ง |
| Forbidden | `_common.md` §1 |

## Interactions

- Pick a file → client checks type and size first (no resize: plans must stay sharp) → uploads at once → replaces the preview when done.
- Upload is one request per file; replacing does not ask for confirmation (the old one is kept in history only as an audit row, not as a file).
- Deactivated floor: page stays editable; an info `Alert` at the top "ชั้นนี้ปิดใช้งานอยู่ — ไม่แสดงในฟอร์มแจ้งซ่อม" + button "เปิดใช้งาน".

## Acceptance checklist

- [ ] Matches the mockup at 375px and 1280px
- [ ] Upload, replace, delete and lightbox work; wrong type / size show the message without uploading
- [ ] Rooms list follows `MasterList` rules (order, deactivate, delete only if unused)
- [ ] All states above with the exact copy
- [ ] Lightbox: focus trapped, Esc closes, image has alt "ผังชั้น {อาคาร} ชั้น {ชั้น}"
- [ ] Works with mocks
