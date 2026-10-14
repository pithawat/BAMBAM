# ระบบแจ้งซ่อม — API contract

Status: APPROVED (2026-10-14)

<!-- Written by Claude in /stage-plan (2026-10-14). Single source for backend DTOs and frontend types.ts.
     Conventions (envelope, errors, dates, pagination): docs/shared/architecture.md
     Changes after approval → CR. -->

## Conventions used here (from architecture.md)

- Success `{ "data": … }`, lists add `"meta": { "page", "pageSize", "total" }`. Error `{ "error": { "code", "message", "fields" } }`.
- `camelCase` JSON, RFC 3339 UTC times (examples: `2026-10-14T03:15:00Z` = 14 ต.ค. 2569 10:15 น.), list query `page`, `pageSize` (default 20, max 100), `q`, `sort`.
- IDs are UUID strings (D-021). `ticketNo` is the human number (`RP-2569-000142`) and is display-only.
- Field validation errors: `400 VALIDATION_FAILED` with `fields: { "<field>": "<FIELD_CODE>" }`. Field codes: `REQUIRED`, `TOO_LONG`, `MIN_ITEMS`, `MAX_ITEMS`, `INVALID`. The FE maps `field + code` to the message in the screen spec.
- Every endpoint needs a session (`401 UNAUTHENTICATED` otherwise, handled by `lib/http.ts` → S01 `?reason=expired`).
- Roles: `employee`, `housekeeper_lead`, `security_lead`, `technician`, `admin`, `executive`. "all" = every role. Permission checks are in the service layer; the FE never decides permissions (it renders `allowedActions`).

## Endpoints

| # | Method | Path | Purpose | Roles | Stage |
|---|---|---|---|---|---|
| P1 | GET | `/api/v1/me` | current user, role, technician categories (platform) | all | 0 |
| P2 | GET | `/api/v1/dev/demo-users` | demo user per role for the role switcher (platform, dev/UAT only) | all | 0 |
| P3 | POST | `/api/v1/dev/role-switch` | switch session to a demo user (platform, dev/UAT only) | all | 0 |
| 1 | GET | `/api/v1/repair/categories` | categories with symptoms (S03) | all | 1 |
| 2 | GET | `/api/v1/repair/buildings` | buildings with floors (S03, S09, S11, S12) | all | 1 |
| 3 | POST | `/api/v1/repair/photos` | upload one photo (S03, S08, S10, S04) | all | 1 |
| 4 | GET | `/api/v1/repair/photos/{id}` | photo file (`?size=thumb\|full`) | all (who can see the ticket / the uploader) | 1 |
| 5 | POST | `/api/v1/repair/tickets` | create ticket (normal or team handled) | all (team handled: leads) | 1 (team: 5) |
| 6 | GET | `/api/v1/repair/tickets` | list tickets (`scope=mine\|all`, filters) | mine: all · all: admin, executive | 1 (all: 4) |
| 7 | GET | `/api/v1/repair/tickets/counts` | counts per status for tabs | mine: all · all: admin, executive | 1 (all: 4) |
| 8 | GET | `/api/v1/repair/tickets/{id}` | ticket detail + timeline + allowed actions | who can see it (BR-F06-1, BR-F21-1) | 1 |
| 9 | GET | `/api/v1/repair/my-work` | technician: categories, current job, reserved job, claim block reason | technician | 2 |
| 10 | GET | `/api/v1/repair/queue` | technician queue in queue order (`buildingId` filter) | technician | 2 |
| 11 | POST | `/api/v1/repair/tickets/{id}/claim` | claim from queue | technician | 2 |
| 12 | POST | `/api/v1/repair/tickets/{id}/resolve` | record result → `resolved` | technician (holder) | 2 |
| 13 | POST | `/api/v1/repair/tickets/{id}/give-back` | give back to queue | technician (holder) | 2 |
| 14 | POST | `/api/v1/repair/tickets/{id}/confirm` | reporter confirms (+ rating) → `closed` | reporter | 3 |
| 15 | POST | `/api/v1/repair/tickets/{id}/send-back` | reporter sends back to the same technician | reporter | 3 |
| 16 | POST | `/api/v1/repair/tickets/{id}/start` | technician starts a ticket reserved for them | technician (reserved for) | 3 |
| 17 | GET | `/api/v1/repair/admin/queue/categories` | categories with `new` counts + has-technician flag (S11 left card) | admin, executive | 4 |
| 18 | GET | `/api/v1/repair/admin/queue` | one category's queue: reserved group + queue order (S11) | admin, executive | 4 |
| 19 | PUT | `/api/v1/repair/admin/queue/{ticketId}/position` | move a queue item | admin | 4 |
| 20 | PATCH | `/api/v1/repair/tickets/{id}/priority` | change priority | admin | 4 |
| 21 | POST | `/api/v1/repair/tickets/{id}/close` | admin closes any open ticket | admin | 4 |
| 22 | GET | `/api/v1/repair/tickets/duplicates` | open tickets on the same floor + category (S04) | all | 5 |
| 23 | POST | `/api/v1/repair/tickets/{id}/follow` | follow an existing case with note + photos | all | 5 |
| 24 | POST | `/api/v1/repair/tickets/{id}/handover` | team-handled ticket → back to the technician queue | lead who recorded it, admin | 5 |
| 25 | GET | `/api/v1/repair/assets/{code}` | asset lookup for QR / manual code | all | 6 |
| 26 | GET | `/api/v1/repair/home` | Home widgets per role (S02) | all | 7 |
| P4 | GET | `/api/v1/notifications` | my notifications, newest first (platform) | all | 7 |
| P5 | GET | `/api/v1/notifications/unread-count` | bell count (platform) | all | 7 |
| P6 | POST | `/api/v1/notifications/{id}/read` | mark one read (platform) | all | 7 |
| P7 | POST | `/api/v1/notifications/read-all` | mark all read (platform) | all | 7 |
| 27 | GET | `/api/v1/repair/admin/overview` | buildings → floors with open counts + highest priority (S12) | admin, executive | 8 |

S12's floor ticket list reuses #6 (`scope=all&floorId=…&status=new,in_progress,resolved`).

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

### `TicketSummary` (lists, cards, queue rows)
```json
{
  "id": "0b9c6a1e-5f3d-4c1a-9a51-2f7e8d1c4a10",
  "ticketNo": "RP-2569-000142",
  "status": "resolved",
  "closedReason": null,
  "priority": "high",
  "category": { "id": "6f1c2a90-4d1e-4b7a-9c55-0e2b7f3a1d01", "name": "ระบบปรับอากาศ" },
  "symptoms": [ { "id": "11a0…", "name": "แอร์ไม่เย็น" }, { "id": "11a1…", "name": "มีน้ำหยด" } ],
  "building": { "id": "b1…", "name": "อาคารหลัก" },
  "floor": { "id": "f5…", "name": "5" },
  "locationDetail": "ห้องประชุม 5B",
  "thumbUrl": "/api/v1/repair/photos/c7e4…?size=thumb",
  "reporter": { "id": "a3d9…", "name": "วรรณา สุขประเสริฐ", "department": "ฝ่ายบัญชี" },
  "technician": { "id": "d2e8…", "name": "ธนากร พึ่งบุญ", "department": "ฝ่ายอาคารสถานที่" },
  "reservedFor": null,
  "viewerRelation": "reporter",
  "awaitingMyConfirmation": true,
  "autoCloseAt": "2026-10-17T02:10:00Z",
  "queuePosition": null,
  "manuallyOrdered": false,
  "sendBackCount": 0,
  "rating": null,
  "createdAt": "2026-10-13T09:10:00Z",
  "claimedAt": "2026-10-14T01:30:00Z",
  "resolvedAt": "2026-10-14T02:10:00Z",
  "closedAt": null,
  "updatedAt": "2026-10-14T02:10:00Z"
}
```

- `status`: `new` · `in_progress` · `resolved` · `closed`. `closedReason`: `confirmed` · `auto_closed` · `team_handled` · `admin_closed` · `null`.
- `priority`: `critical` · `high` · `medium` · `low`.
- `viewerRelation`: `reporter` · `subscriber` · `technician` (holder or category technician) · `none` (admin / executive viewing).
- `floor.name` is the display name of the floor ("5"); the FE renders `{building} ชั้น {floor}`.
- `queuePosition`: position in the viewer's queue (technician queue, admin queue), else `null`. `manuallyOrdered` true when admin placed it (BR-F22-2).
- `sendBackCount` is returned only to admin / executive (otherwise `0`).

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
    "at": "2026-10-14T02:10:00Z"
  },
  "ratingComment": null,
  "timeline": [ "TimelineEvent", "…newest first" ],
  "allowedActions": ["confirm", "send_back"],
  "blockedActions": {}
}
```

- `asset`, `result` may be `null`. `rating` (1–5) and `ratingComment` are set after a rated confirmation.
- `allowedActions` values: `confirm` · `send_back` · `claim` · `start` · `resolve` · `give_back` · `handover` · `close` · `change_priority`.
- `blockedActions`: actions the viewer would have but cannot do now, with the reason code, e.g. `{ "claim": "TECHNICIAN_BUSY", "heldTicketId": "…" }` → S07 disabled button + helper. Keys: `claim`, `start`; reasons `TECHNICIAN_BUSY`, `RESERVED_TICKET_WAITING`. `heldTicketId` points the "ไปที่งานปัจจุบัน" link.

### `TimelineEvent`
```json
{
  "id": "9a7f…",
  "type": "sent_back",
  "actor": { "id": "a3d9…", "name": "วรรณา สุขประเสริฐ", "department": "ฝ่ายบัญชี" },
  "at": "2026-10-14T03:20:00Z",
  "note": "ยังมีน้ำหยดตอนเปิดแอร์เกิน 1 ชั่วโมง",
  "photos": [],
  "data": { "reservedFor": { "id": "d2e8…", "name": "ธนากร พึ่งบุญ" } }
}
```

`type` → S07 label: `created` · `subscribed` · `claimed` · `given_back` · `resolved` · `sent_back` · `started` · `confirmed` (`data.rating`) · `auto_closed` · `team_handled` · `handed_over` · `admin_closed` · `priority_changed` (`data.from`, `data.to`) · `queue_moved` (`data.fromPosition`, `data.toPosition`; returned only to admin / executive, BR-F06-3).

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
    "symptoms": [ { "id": "11a0…", "name": "แอร์ไม่เย็น" }, { "id": "11a1…", "name": "มีน้ำหยด" }, { "id": "11a2…", "name": "มีเสียงดัง" } ] }
] }
```
`icon` = lucide icon name (FE falls back to `wrench`). Only active categories/symptoms.

### 2. GET /api/v1/repair/buildings
```json
{ "data": [
  { "id": "b1…", "name": "อาคารหลัก", "floors": [ { "id": "f1…", "name": "1", "level": 1 }, { "id": "f5…", "name": "5", "level": 5 } ] },
  { "id": "b2…", "name": "อาคารด้านหลัง", "floors": [ { "id": "f8…", "name": "1", "level": 1 }, { "id": "f9…", "name": "2", "level": 2 } ] }
] }
```
Floors ordered by `level` (bottom first). S12 builds the model from this list.

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
  "locationDetail": "ห้องประชุม 5B ฝั่งหน้าต่าง",
  "details": "น้ำหยดใส่โต๊ะประชุม เริ่มตั้งแต่เช้า",
  "priority": "high",
  "photoIds": ["c7e4…", "c7e5…"],
  "assetCode": "AC-05-012",
  "teamHandled": null
}
```
Team handled (Stage 5, leads only, BR-F04-1/2): `"teamHandled": { "note": "เช็ดพื้นและวางป้ายระวังลื่นแล้ว", "photoIds": ["d1…"] }` → ticket is created `closed` / `team_handled`.

Rules: BR-F02-1 (required: category, ≥ 1 symptom of that category, building, floor of that building, priority, 1–5 photos), `locationDetail` ≤ 100, `details` ≤ 500, `teamHandled.note` ≤ 500 and 1–5 photos. Ticket number per BR-F02-4/5. New ticket goes after same-priority tickets in its category queue (BR-F02-3, BR-F22-2). The duplicate check is a separate call (#22) made by the FE before this one.

Response 201 `{ "data": <TicketDetail> }`.

| Status | code | When | Thai message |
|---|---|---|---|
| 400 | `VALIDATION_FAILED` | fields: `categoryId` REQUIRED · `symptomIds` MIN_ITEMS · `buildingId` REQUIRED · `floorId` REQUIRED · `locationDetail` TOO_LONG · `photoIds` MIN_ITEMS/MAX_ITEMS · `details` TOO_LONG · `priority` REQUIRED · `teamHandled.note` REQUIRED/TOO_LONG · `teamHandled.photoIds` MIN_ITEMS | per field, S03 Validation |
| 422 | `MASTER_DATA_CHANGED` | category/symptom/floor inactive or mismatched | ข้อมูลบางอย่างเปลี่ยนไป กรุณาเลือกใหม่ |
| 422 | `PHOTO_NOT_FOUND` | a photo id is unknown, expired or not the caller's | มีรูปที่อัปโหลดไม่สำเร็จ ลองใหม่หรือลบรูปนั้น |
| 403 | `TEAM_HANDLED_NOT_ALLOWED` | `teamHandled` sent by a non-lead | คุณไม่มีสิทธิ์ทำรายการนี้ |

### 6. GET /api/v1/repair/tickets
Query: `scope=mine|all` (default `mine`) · `status` (comma list of statuses) · `closedReason` · `q` (ticket no or location text) · `createdFrom`, `createdTo` (RFC 3339) · `relation=all|reported|following` (mine only) · `categoryId`, `buildingId`, `floorId`, `priority` (all only) · `page`, `pageSize` · `sort` (default per tab, see S06 / S11).

- `mine` = tickets I reported or follow (BR-F06-1). In `status=resolved`, tickets awaiting my confirmation come first (BR-F06-2).
- `all` = every ticket (admin, executive).

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
{ "data": { "new": 1, "inProgress": 1, "resolved": 1, "closed": 12, "awaitingMyConfirmation": 1 } }
```
S06 tab "กำลังดำเนินการ" = `new + inProgress`.

### 8. GET /api/v1/repair/tickets/{id}
Response `{ "data": <TicketDetail> }`. Who can see it: reporter, subscribers, technicians of its category, the holder / reserved technician, admin, executive.

| Status | code | When | UI |
|---|---|---|---|
| 404 | `TICKET_NOT_FOUND` | unknown id | ไม่พบงานนี้ (S07 not-found state) |
| 403 | `FORBIDDEN` | not allowed to see | S07 forbidden state |

---

## Stage 2 — technician queue

### 9. GET /api/v1/repair/my-work
```json
{ "data": {
  "categories": [ { "id": "6f1c…", "name": "ระบบปรับอากาศ" }, { "id": "7a2d…", "name": "ไฟฟ้าและแสงสว่าง" } ],
  "current": <TicketSummary | null>,
  "reserved": <TicketSummary | null>,
  "reservedReason": "ยังไม่เย็นตอนบ่าย อุณหภูมิไม่ลดต่ำกว่า 27 องศา",
  "claimBlockedReason": "TECHNICIAN_BUSY",
  "queueCount": 12
} }
```
`claimBlockedReason`: `null` · `TECHNICIAN_BUSY` · `RESERVED_TICKET_WAITING`. `categories: []` → "ยังไม่ได้กำหนดหมวดงาน ติดต่อ Admin".

### 10. GET /api/v1/repair/queue
Query: `buildingId` (optional), `page`, `pageSize` (default 30). Returns `new` tickets in my categories, not reserved for others, in queue order (BR-F21-1, BR-F22-1/2). `queuePosition` = position in my full queue (unchanged by the filter, BR-F21-7).
```json
{ "data": [ <TicketSummary with queuePosition> ], "meta": { "page": 1, "pageSize": 30, "total": 12 } }
```
403 `FORBIDDEN` for non-technicians.

### 11. POST /api/v1/repair/tickets/{id}/claim
No body. → 200 `{ "data": <TicketDetail> }` (`in_progress`, holder = me).

| Status | code | When | Thai message |
|---|---|---|---|
| 409 | `TICKET_ALREADY_CLAIMED` | someone claimed first / not `new` any more (BR-F21-2) | งานนี้มีช่างรับไปแล้ว |
| 422 | `TECHNICIAN_BUSY` | I hold an `in_progress` ticket (BR-F21-3) | จบงานปัจจุบันก่อน (บันทึกผล หรือ คืนงาน) |
| 422 | `RESERVED_TICKET_WAITING` | a sent-back ticket waits for me (BR-F21-3) | เริ่มงานที่ส่งกลับให้แก้ก่อน จึงรับงานใหม่ได้ |
| 403 | `NOT_IN_CATEGORY` | ticket not in my categories / reserved for someone else | คุณไม่มีสิทธิ์ทำรายการนี้ |
| 404 | `TICKET_NOT_FOUND` | | ไม่พบงานนี้ |

The busy check and the claim run in one transaction with a row lock, so two devices cannot both succeed.

### 12. POST /api/v1/repair/tickets/{id}/resolve
Request `{ "note": "ล้างแผงคอยล์เย็น เปลี่ยนท่อน้ำทิ้ง ทดสอบแล้วเย็นปกติ", "photoIds": ["e1…"] }` (note 1–1000, photos 1–5, BR-F21-4) → 200 `<TicketDetail>` (`resolved`, `autoCloseAt` = resolvedAt + 72 h, BR-F07-4).

| Status | code | When | Thai message |
|---|---|---|---|
| 400 | `VALIDATION_FAILED` | `note` REQUIRED/TOO_LONG · `photoIds` MIN_ITEMS/MAX_ITEMS | S10 messages |
| 403 | `NOT_HOLDER` | I am not holding this ticket | บันทึกผลได้เฉพาะช่างที่รับงานนี้ |
| 409 | `TICKET_CLOSED` | admin closed it meanwhile | งานนี้ถูกปิดโดย Admin แล้ว |
| 422 | `PHOTO_NOT_FOUND` | | มีรูปที่อัปโหลดไม่สำเร็จ ลองใหม่หรือลบรูปนั้น |

### 13. POST /api/v1/repair/tickets/{id}/give-back
Request `{ "reason": "ต้องรออะไหล่คอมเพรสเซอร์" }` (1–500) → 200 `<TicketDetail>` (`new`, original queue position, BR-F21-5). Errors: 400 `VALIDATION_FAILED` (`reason` REQUIRED → กรุณาใส่เหตุผล), 403 `NOT_HOLDER`, 409 `TICKET_CLOSED`.

---

## Stage 3 — confirm, send back, reserved start, auto-close

### 14. POST /api/v1/repair/tickets/{id}/confirm
Request `{ "rating": 4, "comment": "ช่างมาไว และอธิบายสิ่งที่ทำ" }` (`rating` 1–5 or null, `comment` ≤ 500, both optional, BR-F07-2) → 200 `<TicketDetail>` (`closed` / `confirmed`).

| Status | code | When | Thai message |
|---|---|---|---|
| 403 | `NOT_REPORTER` | caller is not the reporter (BR-F07-1) | เฉพาะผู้แจ้งเท่านั้นที่ตรวจรับได้ |
| 409 | `TICKET_CLOSED` | auto-closed / admin-closed meanwhile | งานนี้ปิดไปแล้ว |
| 409 | `INVALID_STATE` | not `resolved` | งานนี้มีการเปลี่ยนแปลง โหลดข้อมูลล่าสุดให้แล้ว |

### 15. POST /api/v1/repair/tickets/{id}/send-back
Request `{ "reason": "ยังมีน้ำหยดตอนเปิดแอร์เกิน 1 ชั่วโมง", "photoIds": [] }` (reason 1–500 required, photos 0–5) → 200 `<TicketDetail>`:
- same technician free → `in_progress` (holder = that technician)
- same technician busy → `new` with `reservedFor` = that technician (BR-F07-3, CR-001)

Errors: 400 `VALIDATION_FAILED` (`reason` REQUIRED → กรุณาบอกสิ่งที่ยังไม่เรียบร้อย), 403 `NOT_REPORTER`, 409 `TICKET_CLOSED`, 409 `INVALID_STATE`.

### 16. POST /api/v1/repair/tickets/{id}/start
No body → 200 `<TicketDetail>` (`in_progress`, holder = me, `reservedFor` cleared).

| Status | code | When | Thai message |
|---|---|---|---|
| 422 | `TECHNICIAN_BUSY` | I still hold another ticket | จบงานปัจจุบันก่อน (บันทึกผล หรือ คืนงาน) |
| 403 | `NOT_RESERVED_FOR_YOU` | reserved for someone else / not reserved | คุณไม่มีสิทธิ์ทำรายการนี้ |
| 409 | `TICKET_CLOSED` | | งานนี้ถูกปิดโดย Admin แล้ว |

**Auto-close job (no endpoint):** every 15 min, `resolved` tickets with `autoCloseAt <= now` → `closed` / `auto_closed`, event `auto_closed` (BR-F07-4). Stage 7 adds the reminder notification 24 h before.

---

## Stage 4 — admin queue

### 17. GET /api/v1/repair/admin/queue/categories
```json
{ "data": [
  { "id": "6f1c…", "name": "ระบบปรับอากาศ", "newCount": 5, "hasTechnician": true },
  { "id": "9c3e…", "name": "ความสะอาด", "newCount": 0, "hasTechnician": false }
] }
```

### 18. GET /api/v1/repair/admin/queue?categoryId=
```json
{ "data": {
  "category": { "id": "6f1c…", "name": "ระบบปรับอากาศ", "hasTechnician": true },
  "reserved": [ <TicketSummary with reservedFor> ],
  "items": [ <TicketSummary with queuePosition, manuallyOrdered> ],
  "queueVersion": "2026-10-14T03:40:12.511Z#41"
} }
```
Not paged (one category's open queue). `manuallyOrdered` items expose who moved them in the timeline (`queue_moved`). 403 for other roles; 400 `VALIDATION_FAILED` without `categoryId`.

### 19. PUT /api/v1/repair/admin/queue/{ticketId}/position
Request `{ "position": 2, "queueVersion": "2026-10-14T03:40:12.511Z#41" }` (`position` 1-based in the category queue; "ย้ายไปบนสุด" = 1) → 200 `{ "data": <same as #18> }`. Logged as `queue_moved` (BR-F22-3). Undo = another call with the old position.

| Status | code | When | Thai message |
|---|---|---|---|
| 409 | `QUEUE_CHANGED` | `queueVersion` is stale | ลำดับคิวเปลี่ยนไปแล้ว โหลดใหม่ให้แล้ว |
| 409 | `TICKET_ALREADY_CLAIMED` | ticket is not `new` any more (BR-F22-5) | งานนี้มีช่างรับไปแล้ว |
| 422 | `TICKET_RESERVED` | reserved tickets cannot move | คุณไม่มีสิทธิ์ทำรายการนี้ |
| 403 | `FORBIDDEN` | not admin (executive read-only, BR-F22-6) | คุณไม่มีสิทธิ์ทำรายการนี้ |

### 20. PATCH /api/v1/repair/tickets/{id}/priority
Request `{ "priority": "high" }` → 200 `<TicketDetail>`. A manually ordered ticket returns to automatic order (BR-F22-4). Event `priority_changed`. Errors: 403 `FORBIDDEN`, 409 `TICKET_CLOSED`, 400 `VALIDATION_FAILED`.

### 21. POST /api/v1/repair/tickets/{id}/close
Request `{ "reason": "ส่งเรื่องเปลี่ยนเครื่องใหม่ผ่านฝ่ายจัดซื้อแล้ว" }` (1–500) → 200 `<TicketDetail>` (`closed` / `admin_closed`; holder becomes free, BR-F21-8). Errors: 400 `VALIDATION_FAILED` (`reason` REQUIRED → กรุณาใส่เหตุผล), 403 `FORBIDDEN`, 409 `TICKET_CLOSED`.

---

## Stage 5 — duplicates, follow, team handled, hand over

### 22. GET /api/v1/repair/tickets/duplicates?categoryId=&floorId=
Open tickets (`new`, `in_progress`, `resolved`) with the same category and floor (BR-F03-1), newest first.
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
Request `{ "reason": "ทีมเช็ดแล้วแต่ยังมีน้ำซึมจากฝ้า" }` (1–500) → 200 `<TicketDetail>` (same ticket → `new`, queued by priority, BR-F05-1/3). Event `handed_over`.

| Status | code | When | Thai message |
|---|---|---|---|
| 422 | `NOT_TEAM_HANDLED` | not `closed` / `team_handled` | งานนี้มีการเปลี่ยนแปลง โหลดข้อมูลล่าสุดให้แล้ว |
| 403 | `FORBIDDEN` | lead who did not record it, or other roles (BR-F05-2) | คุณไม่มีสิทธิ์ทำรายการนี้ |

---

## Stage 6 — QR

### 25. GET /api/v1/repair/assets/{code}
```json
{ "data": { "code": "AC-05-012", "name": "เครื่องปรับอากาศ ห้องประชุม 5B",
  "category": { "id": "6f1c…", "name": "ระบบปรับอากาศ" }, "building": { "id": "b1…", "name": "อาคารหลัก" },
  "floor": { "id": "f5…", "name": "5" }, "locationDetail": "ห้องประชุม 5B" } }
```
404 `ASSET_NOT_FOUND` → S03 "ไม่พบอุปกรณ์นี้" / S16 "ไม่พบอุปกรณ์รหัสนี้". Code is matched case-insensitively.

**QR content (D-024):** `{FRONTEND_URL}/repair/new?asset={code}`. S16 accepts a QR whose origin equals the current origin and whose path is `/repair/new` with `asset`.

---

## Stage 7 — Home and notifications

### 26. GET /api/v1/repair/home
Fields depend on the role; absent blocks are `null`.
```json
{ "data": {
  "openCount": 3,
  "awaiting": [ <TicketSummary>, "…max 2" ],
  "myOpen": [ <TicketSummary>, "…max 3, excluding awaiting" ],
  "technician": { "categories": [ <Ref> ], "current": null, "reserved": null, "reservedReason": null, "queueTop": [ <TicketSummary> ], "queueCount": 12 },
  "admin": { "counts": { "new": 14, "inProgress": 4, "resolved": 3, "criticalOpen": 1 }, "urgent": [ <TicketSummary>, "…max 5, critical/high new" ] }
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
`type` → S13 template: `ticket_new_in_category` · `ticket_claimed` · `ticket_given_back` · `ticket_resolved` (reporter) · `ticket_resolved_subscriber` · `ticket_sent_back` · `ticket_auto_close_reminder` · `ticket_auto_closed` · `ticket_admin_closed`. The FE builds the Thai text (F19-A language switch later).

### P5 GET /api/v1/notifications/unread-count → `{ "data": { "count": 2 } }`
### P6 POST /api/v1/notifications/{id}/read → 204 · 404 `NOTIFICATION_NOT_FOUND` (also for others' notifications)
### P7 POST /api/v1/notifications/read-all → 204

---

## Stage 8 — building overview

### 27. GET /api/v1/repair/admin/overview?status=&categoryId=
`status` = comma list of open statuses (default all three).
```json
{ "data": {
  "totals": { "open": 21, "new": 14, "inProgress": 4, "resolved": 3, "critical": 2 },
  "buildings": [ { "id": "b1…", "name": "อาคารหลัก", "floors": [
    { "id": "f2…", "name": "2", "level": 2, "openCount": 4, "highestPriority": "critical", "byPriority": { "critical": 1, "high": 1, "medium": 2, "low": 0 } }
  ] } ]
} }
```
Floors with no open tickets are included (`openCount: 0`, `highestPriority: null`). 403 for other roles.

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
| `TICKET_ALREADY_CLAIMED` | 409 | claim race / no longer `new` | งานนี้มีช่างรับไปแล้ว |
| `TECHNICIAN_BUSY` | 422 | holding another job | จบงานปัจจุบันก่อน (บันทึกผล หรือ คืนงาน) |
| `RESERVED_TICKET_WAITING` | 422 | must start the sent-back job first | เริ่มงานที่ส่งกลับให้แก้ก่อน จึงรับงานใหม่ได้ |
| `NOT_IN_CATEGORY` | 403 | ticket outside my categories | คุณไม่มีสิทธิ์ทำรายการนี้ |
| `NOT_HOLDER` | 403 | not the technician holding it | บันทึกผลได้เฉพาะช่างที่รับงานนี้ |
| `NOT_RESERVED_FOR_YOU` | 403 | start on a ticket not reserved for me | คุณไม่มีสิทธิ์ทำรายการนี้ |
| `NOT_REPORTER` | 403 | confirm / send back by non-reporter | เฉพาะผู้แจ้งเท่านั้นที่ตรวจรับได้ |
| `TICKET_CLOSED` | 409 | ticket closed meanwhile | S08/S04: งานนี้ปิดไปแล้ว / เคสนี้ปิดไปแล้ว · S10, start: งานนี้ถูกปิดโดย Admin แล้ว · others: งานนี้มีการเปลี่ยนแปลง โหลดข้อมูลล่าสุดให้แล้ว |
| `INVALID_STATE` | 409 | status moved on | งานนี้มีการเปลี่ยนแปลง โหลดข้อมูลล่าสุดให้แล้ว |
| `QUEUE_CHANGED` | 409 | stale `queueVersion` | ลำดับคิวเปลี่ยนไปแล้ว โหลดใหม่ให้แล้ว |
| `TICKET_RESERVED` | 422 | moving a reserved ticket | คุณไม่มีสิทธิ์ทำรายการนี้ |
| `ALREADY_FOLLOWING` | 409 | | คุณติดตามเคสนี้อยู่แล้ว |
| `NOT_TEAM_HANDLED` | 422 | hand over a non-team ticket | งานนี้มีการเปลี่ยนแปลง โหลดข้อมูลล่าสุดให้แล้ว |
| `ASSET_NOT_FOUND` | 404 | | ไม่พบอุปกรณ์นี้ (S03) · ไม่พบอุปกรณ์รหัสนี้ (S16) |
| `NOTIFICATION_NOT_FOUND` | 404 | | (silently refetch) |
| any other / network | 5xx | | ทำรายการไม่สำเร็จ ลองอีกครั้ง |
