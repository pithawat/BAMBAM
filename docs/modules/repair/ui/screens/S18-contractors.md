# S18 — ช่างภายนอก (CR-005, F24)

Status: built by Claude 2026-10-15 (CR-005, no separate mockup) — waiting for acceptance

- **Who:** technician (add / edit), admin + executive (view). Others → forbidden state. Nav: sidebar "งานช่าง → ช่างภายนอก" (technician) and "จัดการงานซ่อม → ช่างภายนอก" (admin / executive); S09 header button.

## List `/repair/contractors`
- Header (service variant) "ช่างภายนอก" · subtitle "ประวัติงานและคะแนนของช่างนอกระบบ" · technician action "เพิ่มช่างภายนอก"
- Card: search "ค้นหาชื่อร้าน หรือผู้ติดต่อ" (debounced 300 ms) + checkbox "แสดงที่ปิดใช้งาน"
- Row: hard-hat avatar, name (+ "ปิดใช้งาน" badge), type badges, average stars + value + "(n งาน)" or "ยังไม่มีคะแนน", "{jobCount} งาน", phone → detail
- Empty: "ยังไม่มีช่างภายนอก" (+ hint for the technician) · search empty: `ไม่พบช่างภายนอกที่ตรงกับ "{q}"` · error inline + retry

## Detail `/repair/contractors/[id]`
- Bar header back to the list; card: name, types, คะแนนเฉลี่ย, จำนวนงาน, ผู้ติดต่อ, เบอร์ (tel: link), หมายเหตุ; technician "แก้ไข"
- "ประวัติงาน ({total})": ticketNo · category, "เสร็จเมื่อ …", contractor stars + comment, "ผู้แจ้งให้ n ดาว" → S07; "โหลดเพิ่ม" (20)
- Not found → "ไม่พบช่างภายนอกนี้"

## Form dialog (add / edit, also opened from S10 "เพิ่มใหม่")
- ชื่อร้าน / บริษัท* (≤ 100) · ประเภท* chips (multi) + "เพิ่มประเภทใหม่" input + เพิ่ม (Enter works; an existing name selects that type) · ผู้ติดต่อ (≤ 100) · เบอร์โทร (≤ 30) · หมายเหตุ (≤ 500) · edit only: "ใช้งานอยู่ (ปิดไว้เมื่อเลิกจ้าง ประวัติยังอยู่)"
- Description: "ข้อมูลนี้เห็นเฉพาะช่าง Admin และผู้บริหาร"
- Errors: กรุณากรอกชื่อร้าน / บริษัท · เลือกประเภทอย่างน้อย 1 ประเภท · length messages
