# ระบบแจ้งซ่อม — API contract

Status: APPROVED (2026-10-14) · CR-005 applied 2026-10-15 · CR-008 applied 2026-10-16 · CR-014 applied 2026-10-19 · CR-015, CR-016 applied 2026-10-19

<!-- Written by Claude in /stage-plan (2026-10-14). Single source for backend DTOs and frontend types.ts.
     Conventions (envelope, errors, dates, pagination): docs/shared/architecture.md
     Changes after approval → CR. -->

## Conventions used here (from architecture.md)

- Success `{ "data": … }`, lists add `"meta": { "page", "pageSize", "total" }`. Error `{ "error": { "code", "message", "fields" } }`.
- `camelCase` JSON, RFC 3339 UTC times (examples: `2026-10-14T03:15:00Z` = 14 ต.ค. 2569 10:15 น.), list query `page`, `pageSize` (default 20, max 100), `q`, `sort`.
- IDs are UUID strings (D-021). `ticketNo` is the human number (`RP-2569-000142`) and is display-only.
- Field validation errors: `400 VALIDATION_FAILED` with `fields: { "<field>": "<FIELD_CODE>" }`. Field codes: `REQUIRED`, `TOO_LONG`, `MIN_ITEMS`, `MAX_ITEMS`, `INVALID`, `PAST` (a date before today, CR-005). The FE maps `field + code` to the message in the screen spec.
- Every endpoint needs a session (`401 UNAUTHENTICATED` otherwise, handled by `lib/http.ts` → S01 `?reason=expired`).
- Roles: `employee`, `housekeeper_lead`, `security_lead`, `technician`, `admin`, `executive`. "all" = every role. Permission checks are in the service layer; the FE never decides permissions (it renders `allowedActions`).

## Endpoints

| # | Method | Path | Purpose | Roles | Stage |
|---|---|---|---|---|---|
| P1 | GET | `/api/v1/me` | current user, role (platform) | all | 0 |
| P2 | GET | `/api/v1/dev/demo-users` | demo user per role for the role switcher (platform, dev/UAT only) | all | 0 |
| P3 | POST | `/api/v1/dev/role-switch` | switch session to a demo user (platform, dev/UAT only) | all | 0 |
| 1 | GET | `/api/v1/repair/categories` | categories with symptoms + priorities (S03, CR-008) + `isOther`, `areaTypes` (CR-014) | all | 1 (CR-014: 2M) |
| 2 | GET | `/api/v1/repair/buildings` | buildings with floors (S03, S09, S11, S12) + rooms per floor (CR-014) | all | 1 (CR-014: 2M) |
| 3 | POST | `/api/v1/repair/photos` | upload one photo (S03, S08, S10, S04) | all | 1 |
| 4 | GET | `/api/v1/repair/photos/{id}` | photo file (`?size=thumb\|full`) | all (who can see the ticket / the uploader) | 1 |
| 5 | POST | `/api/v1/repair/tickets` | create ticket → `in_progress`, waiting for assessment (CR-005); priority set by the system (CR-008) | all (team handled: leads) | 1 (team: 4) |
| 6 | GET | `/api/v1/repair/tickets` | list tickets (`scope=mine\|all`, `status`, `step`, filters) | mine: all · all: technician, admin, executive (CR-005) | 1 |
| 7 | GET | `/api/v1/repair/tickets/counts` | counts per status / step | mine: all · all: technician, admin, executive | 1 |
| 8 | GET | `/api/v1/repair/tickets/{id}` | ticket detail + timeline + allowed actions | who can see it (BR-F06-1) | 1 |
| 9 | POST | `/api/v1/repair/tickets/{id}/assess` | set / change the expected finish date + who does the work (CR-005, CR-006) + optional reason for a change (CR-008) | technician | 2 |
| 10 | POST | `/api/v1/repair/tickets/{id}/resolve` | result + photos (+ contractor rating) → `resolved` (CR-005, CR-006) | technician | 2 |
| 11 | POST | `/api/v1/repair/tickets/{id}/confirm` | reporter rates 1–5 (required) → `closed` (CR-005) | reporter | 2 |
| 12 | POST | `/api/v1/repair/tickets/{id}/send-back` | reporter sends the work back → reworking (CR-005) | reporter | 2 |
| 13 | GET | `/api/v1/repair/contractor-types` | contractor types (F24) | technician, admin, executive | 2 |
| 14 | POST | `/api/v1/repair/contractor-types` | add a type (existing name → that type) | technician | 2 |
| 15 | GET | `/api/v1/repair/contractors` | contractors with job count + average score | technician, admin, executive | 2 |
| 16 | POST | `/api/v1/repair/contractors` | add a contractor | technician | 2 |
| 17 | GET | `/api/v1/repair/contractors/{id}` | one contractor | technician, admin, executive | 2 |
| 18 | PUT | `/api/v1/repair/contractors/{id}` | edit / deactivate a contractor | technician | 2 |
| 19 | GET | `/api/v1/repair/contractors/{id}/jobs` | job history with scores (S18) | technician, admin, executive | 2 |
| ~~20~~ | ~~PATCH~~ | ~~`/api/v1/repair/tickets/{id}/priority`~~ | ~~change priority~~ — **removed (CR-015)**: priority is policy only, never changed after creation | — | — |
| 21 | POST | `/api/v1/repair/tickets/{id}/close` | admin closes any open ticket | admin | 3 |
| 22 | GET | `/api/v1/repair/tickets/duplicates` | open tickets on the same floor + category + room (S04, CR-014) | all | 4 |
| 23 | POST | `/api/v1/repair/tickets/{id}/follow` | follow an existing case with note + photos | all | 4 |
| 24 | POST | `/api/v1/repair/tickets/{id}/handover` | team-handled ticket → back to the technician (`in_progress`, CR-005) | lead who recorded it, admin | 4 |
| 25 | GET | `/api/v1/repair/assets/{code}` | asset lookup for QR / manual code | all | 5 |
| 26 | GET | `/api/v1/repair/home` | Home widgets per role (S02) | all | 6 |
| P4 | GET | `/api/v1/notifications` | my notifications, newest first (platform) | all | 6 |
| P5 | GET | `/api/v1/notifications/unread-count` | bell count (platform) | all | 6 |
| P6 | POST | `/api/v1/notifications/{id}/read` | mark one read (platform) | all | 6 |
| P7 | POST | `/api/v1/notifications/read-all` | mark all read (platform) | all | 6 |
| 27 | GET | `/api/v1/repair/admin/overview` | S29 dashboard (admin / executive Home): key numbers, buildings → floors with open counts, attention list (CR-016 replaces the CR-008 S27 shape) | admin, executive | 3D (CR-016) |
| 29 | GET | `/api/v1/repair/asset-types` | equipment types for the palette (CR-016) | admin, executive (+ super_admin) | 3D |
| 30 | GET | `/api/v1/repair/floors/{id}/plan` | floor plan: size, rooms with outlines + open counts, active assets (CR-016) | admin, executive (+ super_admin) | 3D |
| 31 | POST | `/api/v1/repair/assets` | add an asset to a room (CR-016) | admin (+ super_admin) | 3D |
| 32 | PUT | `/api/v1/repair/assets/{id}` | edit code / name, move (room + position) (CR-016) | admin (+ super_admin) | 3D |
| 33 | POST | `/api/v1/repair/assets/{id}/deactivate` | remove = deactivate (CR-016) | admin (+ super_admin) | 3D |
| 34 | GET | `/api/v1/repair/assets/suggest-code?assetTypeId=&floorId=` | next free code for the add dialog (CR-016) | admin (+ super_admin) | 3D |
| 28 | GET | `/api/v1/repair/me/recent-places` | the caller's last 3 distinct places (building · floor · room · location detail) for "ที่เคยแจ้ง" (S03, CR-008, CR-014) | all | 2R (CR-014: 2M) |

S12's floor ticket list reuses #6 (`scope=all&floorId=…&status=in_progress,resolved`).

**Removed by CR-005** (one in-house technician, no queue): my-work, technician queue, claim, give-back, start (reserved job), admin queue categories / queue / position. Error codes `TICKET_ALREADY_CLAIMED`, `TECHNICIAN_BUSY`, `RESERVED_TICKET_WAITING`, `NOT_IN_CATEGORY`, `NOT_HOLDER`, `NOT_RESERVED_FOR_YOU`, `QUEUE_CHANGED`, `TICKET_RESERVED` are gone. Endpoints 9–21 were renumbered.

---

## Shared objects

### `Ref`
```json
{ "id": "6f1c2a90-4d1e-4b7a-9c55-0e2b7f3a1d01", "name": "ระบบปรับอากาศ" }
```

### `PersonRef`
```json
{ "id": "a3d9e2b4-1f6c-4e8a-b2d7-5c9f0e1a2b33", "name": "วรรณา สุขประเสริฐ", "department": "ฝ่ายบัญชี" }
```

### `Photo`
```json
{ "id": "c7e4b1d2-8a3f-4c6e-9d10-2b5a7f8e9c44", "thumbUrl": "/api/v1/repair/photos/c7e4b1d2-8a3f-4c6e-9d10-2b5a7f8e9c44?size=thumb", "url": "/api/v1/repair/photos/c7e4b1d2-8a3f-4c6e-9d10-2b5a7f8e9c44?size=full" }
```

### `TicketSummary` (lists, cards) (CR-005)
```json
{
  "id": "0b9c6a1e-5f3d-4c1a-9a51-2f7e8d1c4a10",
  "ticketNo": "RP-2569-000142",
  "status": "resolved",
  "step": "awaiting_rating",
  "closedReason": null,
  "priority": "high",
  "category": { "id": "6f1c2a90-4d1e-4b7a-9c55-0e2b7f3a1d01", "name": "ระบบปรับอากาศ" },
  "categoryOther": null,
  "symptoms": [ { "id": "11a0…", "name": "แอร์ไม่เย็น" }, { "id": "11a1…", "name": "มีน้ำหยด" } ],
  "symptomOther": null,
  "prioritySource": "symptom",
  "building": { "id": "b1…", "name": "อาคารหลัก" },
  "floor": { "id": "f5…", "name": "5" },
  "room": { "id": "r5b…", "name": "ห้องประชุม 5B" },
  "locationDetail": "ฝั่งหน้าต่าง",
  "thumbUrl": "/api/v1/repair/photos/c7e4…?size=thumb",
  "reporter": { "id": "a3d9…", "name": "วรรณา สุขประเสริฐ", "department": "ฝ่ายบัญชี" },
  "technician": { "id": "d2e8…", "name": "ธนากร พึ่งบุญ", "department": "ฝ่ายอาคารสถานที่" },
  "viewerRelation": "reporter",
  "awaitingMyConfirmation": true,
  "expectedDoneOn": "2026-10-15",
  "workBy": "contractor",
  "contractor": null,
  "contractorTypes": ["แอร์"],
  "autoCloseAt": "2026-10-17T02:10:00Z",
  "sendBackCount": 0,
  "rating": null,
  "createdAt": "2026-10-13T09:10:00Z",
  "assessedAt": "2026-10-13T10:00:00Z",
  "resolvedAt": "2026-10-14T02:10:00Z",
  "closedAt": null,
  "updatedAt": "2026-10-14T02:10:00Z"
}
```

- `status`: `in_progress` · `resolved` · `closed` (`new` removed by CR-005). `closedReason`: `confirmed` · `auto_closed` · `team_handled` · `admin_closed` · `null`.
- `step` (derived, CR-005): `awaiting_assessment` (in progress, no expected date) · `in_repair` · `reworking` (in progress after a send back) · `awaiting_rating` (resolved) · `closed`. Lists, badges and the tracker use `step`.
- `priority`: `critical` · `high` · `medium` · `low`.
- `prioritySource` (CR-008): `symptom` (highest priority of the picked symptoms) · `category` (only "อื่นๆ" symptom → the category's default) · `default` (category "อื่นๆ" → `medium`) · `admin` (removed, CR-015) · `reporter` (tickets created before CR-008).
- `category` is `null` and `categoryOther` holds the typed category when the reporter picked "อื่นๆ" (CR-008); `symptomOther` = the typed symptom (with or without listed symptoms). Titles join the symptom names, then `symptomOther`.
- (CR-014) New tickets always have `category`; `categoryOther` is the optional typed name under the `isOther` category (shown as `อื่น ๆ · {categoryOther}`). `category: null` remains only on tickets created before CR-014.
- (CR-014) `room`: the picked room (`Ref`); `null` only on tickets created before CR-014. `locationDetail` is now the optional extra spot (`บอกจุดเพิ่มเติม`). Location line: `{building} ชั้น {floor} · {room}` (+ ` · {locationDetail}` when set); old tickets keep `ชั้น {floor} · {locationDetail}`.
- `viewerRelation`: `reporter` · `subscriber` · `technician` (any technician, CR-005) · `none` (admin / executive viewing).
- `floor.name` is the display name of the floor ("5"); the FE renders `{building} ชั้น {floor}`.
- `technician`: who assessed / resolved it (`null` before the assessment).
- `expectedDoneOn`: `YYYY-MM-DD` (Asia/Bangkok) from the assessment, else `null`.
- `workBy` (`in_house` · `contractor` · `null` until assessed, CR-006). `contractor` (`Ref`) is sent to technician / admin / executive only; others get `null` and see `contractorTypes` (BR-F24-4).

### `TicketDetail` = `TicketSummary` +
```json
{
  "details": "น้ำหยดใส่โต๊ะประชุม เริ่มตั้งแต่เช้า แอร์เปิดแล้วลมไม่เย็น",
  "photos": [ { "id": "c7e4…", "thumbUrl": "…", "url": "…" } ],
  "asset": { "code": "AC-05-012", "name": "เครื่องปรับอากาศ ห้องประชุม 5B" },
  "subscriberCount": 2,
  "result": {
    "note": "ล้างแผงคอยล์เย็น เปลี่ยนท่อน้ำทิ้งที่อุดตัน ทดสอบเปิด 30 นาที เย็นปกติ ไม่มีน้ำหยด",
    "photos": [ { "id": "e1…", "thumbUrl": "…", "url": "…" } ],
    "by": { "id": "d2e8…", "name": "ธนากร พึ่งบุญ", "department": "ฝ่ายอาคารสถานที่" },
    "at": "2026-10-14T02:10:00Z",
    "contractorRating": null,
    "contractorRatingComment": null
  },
  "ratingComment": null,
  "timeline": [ "TimelineEvent", "…newest first" ],
  "allowedActions": ["confirm", "send_back"],
  "blockedActions": {}
}
```

- `asset`, `result` may be `null`. `result` is the latest resolution; earlier ones stay in the timeline (`resolved` events with their photos). `contractorRating` / `contractorRatingComment` are staff-only (`null` for others).
- `allowedActions` values: `assess` · `resolve` (technician, `in_progress`) · `confirm` · `send_back` (reporter, `resolved`) · later: `handover` · `close` (CR-015: no `change_priority`).
- `blockedActions`: `{ "resolve": "ASSESSMENT_REQUIRED" }` while the technician has not assessed yet (no expected date or no `workBy`) → disabled "บันทึกผลซ่อม" + helper.

### `TimelineEvent`
```json
{
  "id": "9a7f…",
  "type": "assessed",
  "actor": { "id": "d2e8…", "name": "ธนากร พึ่งบุญ", "department": "ฝ่ายอาคารสถานที่" },
  "at": "2026-10-14T03:20:00Z",
  "note": null,
  "photos": [],
  "data": { "expectedDoneOn": "2026-10-15" }
}
```

`type` → S07 label: `created` · `subscribed` · `assessed` / `assessment_changed` (`data.expectedDoneOn`, `data.workBy`) · `resolved` (`note` = result, photos = result photos) · `sent_back` (`note` = reason, photos) · `confirmed` (`data.rating`, `note` = comment) · `auto_closed` · `team_handled` · `handed_over` · `admin_closed`  (CR-015: no `priority_changed`; existing rows, if any, stay readable).

---

## Platform (Stage 0 / 7) — owned by `internal/platform`, listed so `types.ts` matches

### P1 GET /api/v1/me
```json
{ "data": {
  "id": "a3d9e2b4-1f6c-4e8a-b2d7-5c9f0e1a2b33", "employeeCode": "600123", "name": "วรรณา สุขประเสริฐ",
  "position": "พนักงานบัญชีอาวุโส", "department": "ฝ่ายบัญชี", "division": "แผนกบัญชีทั่วไป", "email": "wanna.s@example.co.th",
  "role": "employee", "technicianCategories": [], "isDemoUser": false, "environment": "UAT"
} }
```
`technicianCategories`: `Ref[]` (technicians only). `environment`: `DEV` · `UAT` · `null` in production.

### P2 GET /api/v1/dev/demo-users
```json
{ "data": [ { "role": "employee", "name": "วรรณา สุขประเสริฐ" }, { "role": "technician", "name": "ธนากร พึ่งบุญ" } ] }
```
Not registered in production (404).

### P3 POST /api/v1/dev/role-switch
Request `{ "role": "technician" }` → 200 `{ "data": <P1 me> }` and a new session cookie. Errors: 400 `VALIDATION_FAILED` (`role: INVALID`).

---

## Stage 1 — report and view

### 1. GET /api/v1/repair/categories
```json
{ "data": [
  { "id": "6f1c2a90-…", "name": "ระบบปรับอากาศ", "icon": "snowflake",
    "defaultPriority": "medium", "isOther": false, "areaTypes": ["meeting_room", "office"],
    "symptoms": [ { "id": "11a0…", "name": "แอร์ไม่เย็น", "priority": "medium" }, { "id": "11a1…", "name": "มีน้ำหยด", "priority": "high" }, { "id": "11a2…", "name": "มีเสียงดัง", "priority": "medium" } ] }
] }
```
`icon` = lucide icon name (FE falls back to `wrench`). Only active categories/symptoms. `defaultPriority` and symptom `priority` (CR-008) are set by the admin in settings S22; the FE shows them next to each symptom and explains the resulting priority.
(CR-014) `isOther`: exactly one category (`อื่น ๆ`) is `true`; only it accepts `categoryOther` in #5; listed last. `areaTypes`: room area types where this category's problems usually happen — S03 lists matching rooms first (a hint, never a filter). Area types: `meeting_room` · `restroom` · `office` · `pantry` · `common_area` · `parking` · `other`. The master is loaded from `attachments/REPAIR-CATEGORY-SYMPTOM-MASTER.md` by migration; the list items `อื่นๆ` / `อื่นๆ โปรดระบุ` are not symptom rows (they are `symptomOther`).

### 2. GET /api/v1/repair/buildings
```json
{ "data": [
  { "id": "b1…", "name": "อาคารหลัก", "floors": [ { "id": "f1…", "name": "1", "level": 1, "rooms": [] },
    { "id": "f5…", "name": "5", "level": 5, "rooms": [ { "id": "r5b…", "name": "ห้องประชุม 5B", "areaType": "meeting_room" }, { "id": "r5c…", "name": "พื้นที่ส่วนกลางชั้น 5", "areaType": "common_area" } ] } ] },
  { "id": "b2…", "name": "อาคารด้านหลัง", "floors": [ { "id": "f8…", "name": "1", "level": 1 }, { "id": "f9…", "name": "2", "level": 2 } ] }
] }
```
Floors ordered by `level` (bottom first). S12 builds the model from this list.
(CR-014) `rooms`: active rooms of the floor (`platform.rooms`), ordered by `sort_order`; every floor has a `common_area` room `พื้นที่ส่วนกลางชั้น {floor}`. A floor with no active room is not offered in S03.

### 3. POST /api/v1/repair/photos
`multipart/form-data`, field `file`. Image types only (`image/jpeg`, `image/png`, `image/webp`, `image/heic`); max 10 MB (D-022). The FE resizes before upload (long edge 1920px, JPEG).
Response 201 `{ "data": <Photo> }`. An uploaded photo that is not attached to anything within 24 h is deleted.

| Status | code | When | Thai message |
|---|---|---|---|
| 400 | `PHOTO_TYPE_NOT_ALLOWED` | not an allowed image type | รองรับเฉพาะไฟล์รูปภาพ |
| 400 | `PHOTO_TOO_LARGE` | over the limit | รูปนี้ใหญ่เกิน 10 MB |

### 4. GET /api/v1/repair/photos/{id}?size=thumb|full
Returns the image bytes (`Cache-Control: private, max-age=86400`). 403 `FORBIDDEN` when the viewer cannot see the ticket (or is not the uploader of an unattached photo); 404 `PHOTO_NOT_FOUND`.

### 5. POST /api/v1/repair/tickets
Request (normal):
```json
{
  "categoryId": "6f1c2a90-…",
  "symptomIds": ["11a0…", "11a1…"],
  "buildingId": "b1…",
  "floorId": "f5…",
  "roomId": "r5b…",
  "locationDetail": "ฝั่งหน้าต่าง",
  "details": "น้ำหยดใส่โต๊ะประชุม เริ่มตั้งแต่เช้า",
  "categoryOther": null,
  "symptomOther": null,
  "photoIds": ["c7e4…", "c7e5…"],
  "assetCode": "AC-05-012",
  "teamHandled": null
}
```
Team handled (Stage 5, leads only, BR-F04-1/2): `"teamHandled": { "note": "เช็ดพื้นและวางป้ายระวังลื่นแล้ว", "photoIds": ["d1…"] }` → ticket is created `closed` / `team_handled`.

Rules (CR-008): **no `priority` in the request** — the server sets it (highest symptom priority → category default when only `symptomOther` → `medium` for category "อื่นๆ") and stores `prioritySource`. Required: `categoryId` **or** `categoryOther` (1–100, then `symptomIds` must be empty and `symptomOther` is required); with `categoryId`: ≥ 1 symptom of that category **or** `symptomOther` (1–100); building, floor of that building, 1–5 photos. A `priority` field sent by an old client is ignored. `locationDetail` ≤ 100, `details` ≤ 500, `teamHandled.note` ≤ 500 and 1–5 photos. Ticket number per BR-F02-4/5. New ticket goes after same-priority tickets in its category queue (BR-F02-3, BR-F22-2). The duplicate check is a separate call (#22) made by the FE before this one.

(CR-014) Replaces the category part of the rules above: `categoryId` is **always required** (an active category); `categoryOther` (optional, 1–100) is allowed only with the `isOther` category; ≥ 1 symptom of that category **or** `symptomOther` for every category, including `อื่น ๆ`. **`roomId` required**: an active room of `floorId`, else `MASTER_DATA_CHANGED`. `locationDetail` (optional ≤ 100) is the extra spot. Priority: highest symptom priority → the category default when only `symptomOther` (`อื่น ๆ` default `medium`).

Response 201 `{ "data": <TicketDetail> }`.

| Status | code | When | Thai message |
|---|---|---|---|
| 400 | `VALIDATION_FAILED` | fields: `categoryId` REQUIRED (no `categoryOther` either) · `categoryOther` TOO_LONG · `symptomIds` MIN_ITEMS (no `symptomOther` either) · `symptomOther` REQUIRED (category "อื่นๆ") / TOO_LONG · `buildingId` REQUIRED · `floorId` REQUIRED · `roomId` REQUIRED (CR-014) · `categoryOther` NOT_ALLOWED (not the `isOther` category, CR-014) · `locationDetail` TOO_LONG · `photoIds` MIN_ITEMS/MAX_ITEMS · `details` TOO_LONG · `teamHandled.note` REQUIRED/TOO_LONG · `teamHandled.photoIds` MIN_ITEMS (CR-008) | per field, S03 Validation |
| 422 | `MASTER_DATA_CHANGED` | category/symptom/floor/room (CR-014) inactive or mismatched | ข้อมูลบางอย่างเปลี่ยนไป กรุณาเลือกใหม่ |
| 422 | `PHOTO_NOT_FOUND` | a photo id is unknown, expired or not the caller's | มีรูปที่อัปโหลดไม่สำเร็จ ลองใหม่หรือลบรูปนั้น |
| 409 | `DUPLICATE_FOUND` | an open ticket matches (BR-F03-1, CR-009, Stage 4); `details.tickets` = the matches | S03 blocking dialog: ติดตามเคสเดิม / ยกเลิกการแจ้ง |
| 409 | `OWN_TICKET_AWAITING_RATING` | the match is the caller's own ticket waiting for ประเมินตรวจงาน (BR-F03-4, CR-009, Stage 4); `details.ticketId` | คุณแจ้งเรื่องนี้ไว้แล้ว ช่างซ่อมเสร็จแล้ว ไปประเมินตรวจงานที่งานเดิม |
| 403 | `TEAM_HANDLED_NOT_ALLOWED` | `teamHandled` sent by a non-lead | คุณไม่มีสิทธิ์ทำรายการนี้ |

### 6. GET /api/v1/repair/tickets
Query: `scope=mine|all` (default `mine`) · `status` (comma list of statuses) · `step` (comma list of steps, CR-005) · `closedReason` · `q` (ticket no or location text) · `createdFrom`, `createdTo` (RFC 3339) · `relation=all|reported|following` (mine only) · `categoryId`, `buildingId`, `floorId`, `priority` (all only) · `page`, `pageSize` · `sort`: `updatedAt:desc` (default) · `createdAt:desc` · `createdAt:asc` · `closedAt:desc` (default for `status=closed`). ~~`priority:asc`~~ removed (CR-015): S09 / S11 open lists use `createdAt:asc`; an unknown sort → 400.

- `mine` = tickets I reported or follow (BR-F06-1). In `status=resolved`, tickets awaiting my confirmation come first (BR-F06-2).
- `all` = every ticket (technician, admin, executive — CR-005).

```json
{ "data": [ <TicketSummary> ], "meta": { "page": 1, "pageSize": 20, "total": 3 } }
```

| Status | code | When |
|---|---|---|
| 403 | `FORBIDDEN` | `scope=all` by other roles |
| 400 | `VALIDATION_FAILED` | bad filter value |

### 7. GET /api/v1/repair/tickets/counts
Query: `scope`, `q` and the same filters as #6 except `status`.
```json
{ "data": { "inProgress": 2, "resolved": 1, "closed": 12, "awaitingAssessment": 1, "inRepair": 1, "awaitingMyConfirmation": 1 } }
```
`inProgress` = `awaitingAssessment + inRepair` (`inRepair` includes reworking). S06 "กำลังดำเนินการ" = `inProgress`; S09 tabs use `awaitingAssessment`, `inRepair`, `resolved`.

### 8. GET /api/v1/repair/tickets/{id}
Response `{ "data": <TicketDetail> }`. Who can see it: reporter, subscribers, the technician (every ticket, CR-005), admin, executive.

| Status | code | When | UI |
|---|---|---|---|
| 404 | `TICKET_NOT_FOUND` | unknown id | ไม่พบงานนี้ (S07 not-found state) |
| 403 | `FORBIDDEN` | not allowed to see | S07 forbidden state |

---

### 28. GET /api/v1/repair/me/recent-places (CR-008, Stage 2R)
The caller's own reported tickets, newest first, distinct by building + floor + location detail, max 3; only active buildings / floors. (CR-014) Distinct by building + floor + room; each item adds `"room": { "id", "name" }`; tickets without a room or with an inactive room are skipped.
```json
{ "data": [ { "building": { "id": "b1…", "name": "อาคารฝั่ง Office" }, "floor": { "id": "f5…", "name": "5" }, "locationDetail": "ห้องประชุม 5B", "lastReportedAt": "2026-10-14T01:40:00Z" } ] }
```
Empty list for a first-time reporter. S03 shows them as one-tap shortcuts, never preselected.

## Stage 2 — technician work, reporter rating, contractors (CR-005)

Every action locks the ticket row first; a closed ticket → 409 `TICKET_CLOSED`, a ticket in another status → 409 `INVALID_STATE`. Each returns 200 `{ "data": <TicketDetail> }`.

### 9. POST /api/v1/repair/tickets/{id}/assess
Request `{ "expectedDoneOn": "2026-10-20", "workBy": "contractor", "contractorId": "5c0a…", "reason": "รออะไหล่" }` — `reason` optional ≤ 100, kept only on a change (event `assessment_changed` `data.reason`, shown to the reporter in the S07 timeline, CR-008); `expectedDoneOn` today or later (Asia/Bangkok); `workBy` `in_house` · `contractor`; `contractorId` (active contractor) required for `contractor`, ignored for `in_house` (CR-006). First call → event `assessed`; later calls → `assessment_changed` (event `data`: `expectedDoneOn`, `workBy`). Sets `technician` = me. Allowed while `in_progress` (also during rework). Changing the contractor clears the previous contractor's rating on this ticket.

| Status | code | When | Thai message |
|---|---|---|---|
| 400 | `VALIDATION_FAILED` | `expectedDoneOn` REQUIRED / INVALID / PAST · `workBy` REQUIRED / INVALID · `contractorId` REQUIRED / INVALID | เลือกวันที่คาดว่าจะเสร็จ · เลือกวันนี้หรือหลังจากนี้ · เลือกผู้ดำเนินการ · เลือกช่างภายนอก |
| 403 | `NOT_TECHNICIAN` | caller is not a technician | เฉพาะช่างเท่านั้นที่ทำรายการนี้ได้ |
| 422 | `CONTRACTOR_NOT_FOUND` | unknown or inactive contractor | ไม่พบช่างภายนอกนี้ หรือถูกปิดใช้งานแล้ว |

### 10. POST /api/v1/repair/tickets/{id}/resolve
Request:
```json
{ "note": "ล้างแผงคอยล์เย็น เปลี่ยนท่อน้ำทิ้ง", "photoIds": ["e1…"], "contractorRating": 4, "contractorRatingComment": "มาตรงเวลา" }
```
`note` 1–500 and photos 1–5 required (BR-F21-4). Who did the work comes from the assessment (CR-006). For a **contractor job** `contractorRating` 1–5 is required unless this ticket already has one (a second resolve after a send back keeps it; a new value replaces it), comment ≤ 500 optional (BR-F24-3); for an in-house job both are ignored. → `resolved`, `autoCloseAt` = now + 72 h (BR-F07-4); event `resolved` carries the note and the photos.

| Status | code | When | Thai message |
|---|---|---|---|
| 400 | `VALIDATION_FAILED` | `note` REQUIRED/TOO_LONG · `photoIds` MIN_ITEMS/MAX_ITEMS · `contractorRating` REQUIRED/INVALID · `contractorRatingComment` TOO_LONG | S10 messages |
| 403 | `NOT_TECHNICIAN` | | เฉพาะช่างเท่านั้นที่ทำรายการนี้ได้ |
| 422 | `ASSESSMENT_REQUIRED` | no expected date or no `workBy` yet | ประเมินงาน (วันที่คาดว่าจะเสร็จ และผู้ดำเนินการ) ก่อนบันทึกผล |
| 422 | `PHOTO_NOT_FOUND` | | มีรูปที่อัปโหลดไม่สำเร็จ ลองใหม่หรือลบรูปนั้น |

### 11. POST /api/v1/repair/tickets/{id}/confirm
Request `{ "rating": 4, "comment": "ช่างมาไว และอธิบายสิ่งที่ทำ" }` — `rating` 1–5 **required** (BR-F07-2, CR-005), `comment` ≤ 500 optional → `closed` / `confirmed`; event `confirmed` (`data.rating`, `note` = comment).

| Status | code | When | Thai message |
|---|---|---|---|
| 400 | `VALIDATION_FAILED` | `rating` REQUIRED/INVALID · `comment` TOO_LONG | กรุณาให้คะแนน |
| 403 | `NOT_REPORTER` | caller is not the reporter (BR-F07-1) | เฉพาะผู้แจ้งเท่านั้นที่ประเมินงานได้ |
| 409 | `TICKET_CLOSED` | auto-closed / admin-closed meanwhile | งานนี้ปิดไปแล้ว |

### 12. POST /api/v1/repair/tickets/{id}/send-back
Request `{ "reason": "ยังมีน้ำหยดตอนเปิดแอร์เกิน 1 ชั่วโมง", "photoIds": [] }` (reason 1–500 required, photos 0–5) → `in_progress`, `sendBackCount` + 1, step `reworking`; event `sent_back` with the reason and photos. The tracker moves forward (ส่งกลับให้แก้ → แก้ไขเสร็จ), it does not go back (CR-005).

Errors: 400 `VALIDATION_FAILED` (`reason` REQUIRED → กรุณาบอกสิ่งที่ยังไม่เรียบร้อย), 403 `NOT_REPORTER`, 409 `TICKET_CLOSED`, 409 `INVALID_STATE`, 422 `PHOTO_NOT_FOUND`.

**Auto-close job (no endpoint):** at API start and every 15 min, `resolved` tickets with `autoCloseAt <= now` → `closed` / `auto_closed`, event `auto_closed` without actor (BR-F07-4). Stage 6 adds the reminder notification 24 h before.

### `Contractor` (F24)
```json
{ "id": "5c0a…", "name": "ร้านแอร์เย็นฉ่ำ", "types": [ { "id": "t1…", "name": "แอร์" } ],
  "contactName": "คุณสมชาย", "phone": "081-234-5678", "note": null, "isActive": true,
  "jobCount": 7, "ratedCount": 6, "avgRating": 4.3,
  "createdAt": "2026-10-15T03:00:00Z", "updatedAt": "2026-10-15T03:00:00Z" }
```
`avgRating` is `null` until the contractor has a rating. Contractors are never deleted (deactivate, BR-F24-1).

### 13. GET /api/v1/repair/contractor-types → `{ "data": [ <Ref> ] }` sorted by name. 403 for other roles.

### 14. POST /api/v1/repair/contractor-types
Request `{ "name": "แอร์" }` (1–50, spaces collapsed). An existing name (case-insensitive) returns that type (BR-F24-2). → 200 `{ "data": <Ref> }`. 400 `name` REQUIRED/TOO_LONG, 403 `NOT_TECHNICIAN`.

### 15. GET /api/v1/repair/contractors
Query: `q` (name / contact), `typeId`, `includeInactive=true`, `page`, `pageSize`. Active first, then by name. → `{ "data": [ <Contractor> ], "meta": … }`. 403 for other roles.

### 16. POST /api/v1/repair/contractors
Request `{ "name": "ร้านแอร์เย็นฉ่ำ", "typeIds": ["t1…"], "contactName": "คุณสมชาย", "phone": "081-234-5678", "note": "" }` → 201 `{ "data": <Contractor> }`.

| Status | code | When |
|---|---|---|
| 400 | `VALIDATION_FAILED` | `name` REQUIRED/TOO_LONG (100) · `typeIds` MIN_ITEMS/INVALID · `contactName` TOO_LONG (100) · `phone` TOO_LONG (30) · `note` TOO_LONG (500) |
| 422 | `CONTRACTOR_TYPE_NOT_FOUND` | a type id does not exist |
| 403 | `NOT_TECHNICIAN` | |

### 17. GET /api/v1/repair/contractors/{id} → `{ "data": <Contractor> }`. 404 `CONTRACTOR_NOT_FOUND`.

### 18. PUT /api/v1/repair/contractors/{id}
Same body as #16 plus `isActive` (default `true`) → 200 `<Contractor>`. Errors as #16 + 404 `CONTRACTOR_NOT_FOUND`.

### 19. GET /api/v1/repair/contractors/{id}/jobs?page=&pageSize=
Tickets done by the contractor, newest first:
```json
{ "data": [ { "ticketId": "0b9c…", "ticketNo": "RP-2569-000142", "status": "closed", "category": { "id": "6f1c…", "name": "ระบบปรับอากาศ" },
  "resolvedAt": "2026-10-14T02:10:00Z", "contractorRating": 4, "contractorRatingComment": "มาตรงเวลา", "reporterRating": 5 } ],
  "meta": { "page": 1, "pageSize": 20, "total": 7 } }
```

---

## Stage 3 — admin (CR-005: the admin queue endpoints are removed)

### 20. ~~PATCH /api/v1/repair/tickets/{id}/priority~~ — removed (CR-015)
Not built. `priority` is set by the system at creation (BR-F02-2) and never changed; lists are not ordered by it (#6 default for `scope=all` work lists = `createdAt:asc`; `priority:asc` stays accepted but unused by the FE).

### 21. POST /api/v1/repair/tickets/{id}/close
Request `{ "reason": "ส่งเรื่องเปลี่ยนเครื่องใหม่ผ่านฝ่ายจัดซื้อแล้ว" }` (1–500) → 200 `<TicketDetail>` (`closed` / `admin_closed`). Errors: 400 `VALIDATION_FAILED` (`reason` REQUIRED → กรุณาใส่เหตุผล, TOO_LONG), 403 `FORBIDDEN`, 404 `TICKET_NOT_FOUND`, 409 `TICKET_CLOSED`.
Built in Stage 3: works from any open status (BR-F08B-1); writes event `admin_closed` with `note` = reason; `allowedActions` has `close` for admin on every open ticket (never for the executive).

---

## Stage 4 — duplicates, follow, team handled, hand over

### 22. GET /api/v1/repair/tickets/duplicates?categoryId=&floorId=&roomId= (CR-014: `roomId` replaces `locationDetail`)
Open tickets (`in_progress`, `resolved`) with the same category, floor and room / spot (BR-F03-1, CR-009: trimmed case-insensitive text; an empty spot on either side matches), newest first. (CR-014) Match by `roomId`; old tickets without a room match on the same floor only when their `locationDetail` equals the room name (trimmed, case-insensitive).
```json
{ "data": [ <TicketSummary + "subscriberCount": 2> ] }
```
`viewerRelation` tells the FE to show "คุณแจ้งเคสนี้เอง" / "คุณติดตามเคสนี้อยู่แล้ว".

### 23. POST /api/v1/repair/tickets/{id}/follow
Request `{ "note": "น้ำหยดใส่โต๊ะประชุม", "photoIds": ["c7e4…"] }` (note ≤ 500, photos 0–5) → 200 `<TicketDetail>`; event `subscribed` with the note and photos (F03).

| Status | code | When | Thai message |
|---|---|---|---|
| 409 | `TICKET_CLOSED` | closed meanwhile | เคสนี้ปิดไปแล้ว |
| 409 | `ALREADY_FOLLOWING` | already subscriber or reporter | คุณติดตามเคสนี้อยู่แล้ว |

### 24. POST /api/v1/repair/tickets/{id}/handover
Request `{ "reason": "ทีมเช็ดแล้วแต่ยังมีน้ำซึมจากฝ้า" }` (1–500) → 200 `<TicketDetail>` (same ticket → `in_progress`, waiting for the technician's assessment, BR-F05-1/3, CR-005). Event `handed_over`.

| Status | code | When | Thai message |
|---|---|---|---|
| 422 | `NOT_TEAM_HANDLED` | not `closed` / `team_handled` | งานนี้มีการเปลี่ยนแปลง โหลดข้อมูลล่าสุดให้แล้ว |
| 403 | `FORBIDDEN` | lead who did not record it, or other roles (BR-F05-2) | คุณไม่มีสิทธิ์ทำรายการนี้ |

---

## Stage 5 — QR

### 25. GET /api/v1/repair/assets/{code}
```json
{ "data": { "code": "AC-05-012", "name": "เครื่องปรับอากาศ ห้องประชุม 5B",
  "category": { "id": "6f1c…", "name": "ระบบปรับอากาศ" }, "building": { "id": "b1…", "name": "อาคารหลัก" },
  "floor": { "id": "f5…", "name": "5" }, "locationDetail": "ห้องประชุม 5B" } }
```
404 `ASSET_NOT_FOUND` → S03 "ไม่พบอุปกรณ์นี้" / S16 "ไม่พบอุปกรณ์รหัสนี้". Code is matched case-insensitively.
(CR-014) Assets belong to a room: the response adds `"room": { "id", "name" }` and S03 prefills it; `locationDetail` becomes the optional extra spot. Shape fixed in Stage 5.

**QR content (D-024):** `{FRONTEND_URL}/repair/new?asset={code}`. S16 accepts a QR whose origin equals the current origin and whose path is `/repair/new` with `asset`.

---

## Stage 6 — Home and notifications

### 26. GET /api/v1/repair/home
Fields depend on the role; absent blocks are `null`.
```json
{ "data": {
  "openCount": 3,
  "awaiting": [ <TicketSummary>, "…max 2" ],
  "myOpen": [ <TicketSummary>, "…max 3, excluding awaiting" ],
  "technician": { "awaitingAssessment": 3, "inRepair": 4, "top": [ <TicketSummary>, "…max 5 by priority" ] },
  "admin": { "counts": { "inProgress": 14, "resolved": 3, "criticalOpen": 1 }, "urgent": [ <TicketSummary>, "…max 5, critical/high open" ] }
} }
```

### P4 GET /api/v1/notifications?page=&pageSize=30
```json
{ "data": [ {
  "id": "5d1e…", "type": "ticket_resolved", "readAt": null, "createdAt": "2026-10-14T03:15:00Z",
  "ticket": { "id": "0b9c…", "ticketNo": "RP-2569-000142" },
  "params": { "technicianName": "ธนากร", "categoryName": "ระบบปรับอากาศ", "title": "แอร์ไม่เย็น · มีน้ำหยด", "location": "อาคารหลัก ชั้น 5", "reason": null, "autoCloseAt": null }
} ], "meta": { "page": 1, "pageSize": 30, "total": 9 } }
```
`type` → S13 template: `ticket_new` (technician) · `ticket_assessed` · `ticket_resolved` (reporter) · `ticket_resolved_subscriber` · `ticket_sent_back` · `ticket_auto_close_reminder` · `ticket_auto_closed` · `ticket_admin_closed`. The FE builds the Thai text (F19-A language switch later).

### P5 GET /api/v1/notifications/unread-count → `{ "data": { "count": 2 } }`
### P6 POST /api/v1/notifications/{id}/read → 204 · 404 `NOTIFICATION_NOT_FOUND` (also for others' notifications)
### P7 POST /api/v1/notifications/read-all → 204

---

## Stage 7 — building overview

### 27. GET /api/v1/repair/admin/overview?status=&categoryId=
`status` = comma list of open statuses (default all three).
```json
{ "data": {
  "totals": { "open": 21, "awaitingAssessment": 6, "inRepair": 12, "resolved": 3, "critical": 2 },
  "buildings": [ { "id": "b1…", "name": "อาคารหลัก", "floors": [
    { "id": "f2…", "name": "2", "level": 2, "openCount": 4, "highestPriority": "critical", "byPriority": { "critical": 1, "high": 1, "medium": 2, "low": 0 } }
  ] } ]
} }
```
Floors with no open tickets are included (`openCount: 0`, `highestPriority: null`). 403 for other roles.

---

## Stage 3D — dashboard Home + assets + 3D อาคาร 1 (CR-016)

Assets live in `platform.assets` (like `platform.rooms`, CR-014) but are served by the repair module until settings Stage 4 moves locations to `platform` (D-073 precedent). Permission: admin now; `super_admin` (always) and a future `asset.manage` permission when settings Stage 1 lands. Executive: read only (#27, #29, #30).

### `Asset`
```json
{ "id": "a55e…", "code": "AC-1-003", "name": "แอร์ห้อง HR ตัวซ้าย", "type": { "id": "…", "key": "aircon", "name": "เครื่องปรับอากาศ" },
  "room": { "id": "r1…", "name": "HR" }, "x": 26.4, "z": 1.2, "rotationDeg": 180, "openTickets": 1 }
```
`x`, `z` = metres on the floor plan (origin top-left, x right, z down); both `null` when not placed yet. `openTickets` counts open tickets with this `asset_id`.

### 27. GET /api/v1/repair/admin/overview (CR-016 shape, replaces the CR-008 one below)
```json
{ "data": {
  "counts": { "open": 12, "awaitingAssessment": 4, "inRepair": 5, "reworking": 1, "awaitingRating": 3, "overdue": 2, "reportedToday": 3, "closedToday": 2,
              "closedLast7Days": 18, "ratingAvgLast7Days": 4.6, "oldestAwaitingAssessmentAt": "2026-10-17T02:00:00Z", "nextAutoCloseAt": "2026-10-20T03:10:00Z" },
  "buildings": [ { "id": "b1…", "name": "อาคาร 1", "hasModel": true, "floors": [
    { "id": "f1…", "name": "1", "level": 1, "openCount": 3, "highestPriority": "high" } ] } ],
  "attention": [ "<TicketSummary> × ≤ 5: overdue first, then reworking, then critical / high, oldest first" ]
} }
```
`overdue` = open with `expectedDoneOn` < today (Asia/Bangkok). Every number equals S11 with the same filter (BR-F23-1). 403 for other roles.
(CR-018) `floors[]` also carry `criticalCount` (open ฉุกเฉิน tickets — the emergency marker on the model).
(CR-017) `floors[]` also carry `steps: { awaitingAssessment, inRepair, awaitingRating }` (open tickets per S11 step, `inRepair` includes reworking — they colour the model); `buildings[]` carry `widthM` / `depthM` (footprint = the largest floor plan of the building, `null` without a plan) so the model is built from the database.
(CR-016, D-083, Stage 3D prepare) Added for the approved S29 sub-lines: `reworking` (part of `inRepair`, S11 กำลังดำเนินการ), `closedLast7Days` + `ratingAvgLast7Days` (closed since Bangkok midnight 6 days ago; average of the reporter ratings, one decimal, `null` without ratings), `oldestAwaitingAssessmentAt` and `nextAutoCloseAt` (`null` when none). `overdue` counts **in-progress** tickets only (a resolved ticket waits for the reporter, not the technician). "Today" starts at Bangkok midnight. `attention` rows are in-progress tickets that are overdue, reworking, or critical / high.

### 29. GET /api/v1/repair/asset-types → `{ "data": [ { "id", "key", "name", "codePrefix", "icon", "mount" } ] }`
Active types by sort order. Seed: `aircon` เครื่องปรับอากาศ `AC` wall · `microphone` ไมโครโฟน `MIC` floor · `speaker` ลำโพง `SPK` ceiling · `tv` จอทีวี `TV` wall.

### 30. GET /api/v1/repair/floors/{id}/plan
```json
{ "data": {
  "floor": { "id": "f1…", "name": "1", "level": 1 }, "building": { "id": "b1…", "name": "อาคาร 1" },
  "widthM": 32, "depthM": 15, "modelUrl": null,
  "rooms": [ { "id": "r1…", "name": "Data and Digitization", "areaType": "office",
               "shape": [[0,0],[12,0],[12,6],[0,6]], "openCount": 1, "highestPriority": "medium" } ],
  "assets": [ "<Asset>" ]
} }
```
`widthM` / `depthM` / `shape` are `null` for a floor without a plan (the UI shows the list instead). Only active rooms and assets. 404 `FLOOR_NOT_FOUND`.

### 31. POST /api/v1/repair/assets
Request `{ "assetTypeId", "code", "name", "roomId", "x": 26.4, "z": 1.2, "rotationDeg": 0 }` (`x`, `z`, `rotationDeg` optional) → 201 `<Asset>`.
Errors: 400 `VALIDATION_FAILED` (`code` REQUIRED / TOO_LONG > 50 / INVALID (letters, digits, `-`, `_` only); `name` REQUIRED / TOO_LONG > 100; `x` / `z` INVALID outside the plan) · 409 `ASSET_CODE_TAKEN` · 422 `POINT_OUTSIDE_ROOM` (point not inside the room outline) · 422 `MASTER_DATA_CHANGED` (type / room inactive) · 403.

### 32. PUT /api/v1/repair/assets/{id}
Same body as #31 except `assetTypeId` (type never changes) → 200 `<Asset>`. Moving = new `roomId` / `x` / `z`. 404 `ASSET_NOT_FOUND` (also for inactive), other errors as #31.

### 33. POST /api/v1/repair/assets/{id}/deactivate → 204
`is_active = false`; tickets keep their `asset_id`; the code stays taken (a new asset cannot reuse it). 404 `ASSET_NOT_FOUND`.

### 34. GET /api/v1/repair/assets/suggest-code?assetTypeId=&floorId= → `{ "data": { "code": "AC-1-003" } }`
`{codePrefix}-{floor name}-{lowest free 3-digit number}`; only a suggestion, the user may type any free code.

Every #31–#33 writes `platform.audit_log` (`asset.created` / `asset.updated` / `asset.deactivated`, data = before / after).

---

## Error codes (module-wide)

| code | Status | Meaning | Thai message (shown in UI) |
|---|---|---|---|
| `UNAUTHENTICATED` | 401 | no / expired session | (redirect to S01 `?reason=expired`) |
| `VALIDATION_FAILED` | 400 | field errors in `fields` | per field, from the screen spec |
| `FORBIDDEN` | 403 | role / ownership not allowed | คุณไม่มีสิทธิ์ทำรายการนี้ (action) · forbidden state (page) |
| `TICKET_NOT_FOUND` | 404 | | ไม่พบงานนี้ |
| `PHOTO_NOT_FOUND` | 404 / 422 | missing or not attachable | มีรูปที่อัปโหลดไม่สำเร็จ ลองใหม่หรือลบรูปนั้น |
| `PHOTO_TYPE_NOT_ALLOWED` | 400 | | รองรับเฉพาะไฟล์รูปภาพ |
| `PHOTO_TOO_LARGE` | 400 | | รูปนี้ใหญ่เกิน 10 MB |
| `MASTER_DATA_CHANGED` | 422 | category / symptom / floor changed | ข้อมูลบางอย่างเปลี่ยนไป กรุณาเลือกใหม่ |
| `TEAM_HANDLED_NOT_ALLOWED` | 403 | non-lead sent `teamHandled` | คุณไม่มีสิทธิ์ทำรายการนี้ |
| `NOT_TECHNICIAN` | 403 | technician-only action | เฉพาะช่างเท่านั้นที่ทำรายการนี้ได้ |
| `NOT_REPORTER` | 403 | confirm / send back by non-reporter | เฉพาะผู้แจ้งเท่านั้นที่ประเมินงานได้ |
| `TICKET_CLOSED` | 409 | ticket closed meanwhile | S08/S04: งานนี้ปิดไปแล้ว / เคสนี้ปิดไปแล้ว · S10/S17: งานนี้ถูกปิดไปแล้ว |
| `INVALID_STATE` | 409 | status moved on | งานนี้มีการเปลี่ยนแปลง โหลดข้อมูลล่าสุดให้แล้ว |
| `ASSET_CODE_TAKEN` | 409 | code used by another asset, active or not (CR-016) | รหัสนี้มีอุปกรณ์อื่นใช้แล้ว |
| `POINT_OUTSIDE_ROOM` | 422 | drop point not inside the room (CR-016) | วางอุปกรณ์ในห้องที่เลือกเท่านั้น |
| `FLOOR_NOT_FOUND` | 404 | (CR-016) | ไม่พบชั้นนี้ |
| `ASSESSMENT_REQUIRED` | 422 | resolve before assessing | ประเมินงาน (วันที่คาดว่าจะเสร็จ และผู้ดำเนินการ) ก่อนบันทึกผล |
| `CONTRACTOR_NOT_FOUND` | 404 / 422 | unknown, or inactive on resolve | ไม่พบช่างภายนอกนี้ หรือถูกปิดใช้งานแล้ว |
| `CONTRACTOR_TYPE_NOT_FOUND` | 422 | unknown type id | ประเภทช่างบางรายการไม่มีในระบบแล้ว เลือกใหม่อีกครั้ง |
| `ALREADY_FOLLOWING` | 409 | | คุณติดตามเคสนี้อยู่แล้ว |
| `NOT_TEAM_HANDLED` | 422 | hand over a non-team ticket | งานนี้มีการเปลี่ยนแปลง โหลดข้อมูลล่าสุดให้แล้ว |
| `ASSET_NOT_FOUND` | 404 | | ไม่พบอุปกรณ์นี้ (S03) · ไม่พบอุปกรณ์รหัสนี้ (S16) |
| `NOTIFICATION_NOT_FOUND` | 404 | | (silently refetch) |
| any other / network | 5xx | | ทำรายการไม่สำเร็จ ลองอีกครั้ง |
