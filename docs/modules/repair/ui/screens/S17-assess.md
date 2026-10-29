# S17 — ประเมินงาน (CR-005)

Status: built by Claude 2026-10-15 (CR-005, no separate mockup) — waiting for acceptance

> **CR-009 (approved 2026-10-18):** title `เริ่มดำเนินการ` (`กำหนดวันที่คาดว่าจะเสร็จและใครซ่อม`) · after a send back `รับแก้ไขและกำหนดวันเสร็จใหม่` · change `เลื่อนวันที่คาดว่าจะเสร็จ` · buttons `เริ่มดำเนินการ` / `บันทึกวันใหม่` · toast `เริ่มดำเนินการแล้ว ผู้แจ้งจะได้รับแจ้งเตือนวันที่คาดว่าจะเสร็จ`.


> **CR-008 (approved 2026-10-16):** title `รับเรื่องและกำหนดวันเสร็จ` (change: `เลื่อนวันที่คาดว่าจะเสร็จ`; after a send back `รับแก้ไขและกำหนดวันเสร็จใหม่`) · `คาดว่าจะเสร็จ *` chips `วันนี้` · `พรุ่งนี้` · `อีก 3 วัน` · `เลือกวัน` (native date, today or later) · `ใครซ่อม *` segmented `ช่างของบริษัท | ช่างภายนอก` (+ picker, `+ เพิ่มช่างภายนอกใหม่`) · on a change: `เหตุผลที่เลื่อน` (optional ≤ 100, `ผู้แจ้งเห็นข้อความนี้`) · buttons `รับเรื่อง` / `บันทึกวันใหม่`. Mockup: `../../changes/CR-008/ticket-detail.html`.


- **Who:** technician · **Where:** dialog from the S07 action bar (`ticket-actions.tsx` `AssessDialog`) · **Flow:** F21 BR-F21-2
- Title: "ประเมินงาน" (first time) / "แก้การประเมิน" (already assessed); description "ผู้แจ้งจะเห็นวันที่คาดว่าจะเสร็จและผู้ดำเนินการในหน้าติดตามงาน (เดิม {d MMM yyyy})"
- Fields (CR-006): วันที่คาดว่าจะเสร็จ* — native date input, `min` = today (Asia/Bangkok) · **ผู้ดำเนินการ*** segmented ช่างในระบบ / ช่างภายนอก · for ช่างภายนอก: Picker "ช่างภายนอก*" (active contractors, description = types) + "เพิ่มใหม่" (the S18 form dialog; the new contractor is selected)
- Errors: "เลือกวันที่คาดว่าจะเสร็จ" (empty) · "เลือกวันนี้หรือหลังจากนี้" (past, server `PAST`) · "เลือกช่างภายนอก"
- Changing the contractor clears the old contractor's score on this ticket; every save is a timeline event (ประเมินงาน / ช่างเลื่อนวันคาดว่าเสร็จ)
- Buttons: ยกเลิก (ghost) · บันทึก (primary, spinner while saving)
- Success: toast "บันทึกการประเมินแล้ว", S07 updates in place (tracker → กำลังซ่อม, chip "คาดว่าจะเสร็จ …")
- `TICKET_CLOSED` / `INVALID_STATE`: toast with the contract copy and the dialog closes
- Mobile: bottom-sheet look (full width, rounded top); desktop: centred dialog
