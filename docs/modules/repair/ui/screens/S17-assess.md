# S17 — ประเมินงาน (CR-005)

Status: built by Claude 2026-10-15 (CR-005, no separate mockup) — waiting for acceptance

- **Who:** technician · **Where:** dialog from the S07 action bar (`ticket-actions.tsx` `AssessDialog`) · **Flow:** F21 BR-F21-2
- Title: "ประเมินงาน" (first time) / "แก้การประเมิน" (already assessed); description "ผู้แจ้งจะเห็นวันที่คาดว่าจะเสร็จและผู้ดำเนินการในหน้าติดตามงาน (เดิม {d MMM yyyy})"
- Fields (CR-006): วันที่คาดว่าจะเสร็จ* — native date input, `min` = today (Asia/Bangkok) · **ผู้ดำเนินการ*** segmented ช่างในระบบ / ช่างภายนอก · for ช่างภายนอก: Picker "ช่างภายนอก*" (active contractors, description = types) + "เพิ่มใหม่" (the S18 form dialog; the new contractor is selected)
- Errors: "เลือกวันที่คาดว่าจะเสร็จ" (empty) · "เลือกวันนี้หรือหลังจากนี้" (past, server `PAST`) · "เลือกช่างภายนอก"
- Changing the contractor clears the old contractor's score on this ticket; every save is a timeline event (ประเมินงาน / ช่างเลื่อนวันคาดว่าเสร็จ)
- Buttons: ยกเลิก (ghost) · บันทึก (primary, spinner while saving)
- Success: toast "บันทึกการประเมินแล้ว", S07 updates in place (tracker → กำลังซ่อม, chip "คาดว่าจะเสร็จ …")
- `TICKET_CLOSED` / `INVALID_STATE`: toast with the contract copy and the dialog closes
- Mobile: bottom-sheet look (full width, rounded top); desktop: centred dialog
