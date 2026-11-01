# ตั้งค่าระบบ (Superadmin) — Users

Status: APPROVED (2026-10-16) · CR-001 applied 2026-10-26 (Admin persona, fixed settings permissions)

<!-- Written by Claude in discovery (2026-10-15) from 00-brief.md + 3 interview rounds. User reviews and approves. -->

## Persona: Superadmin (`super_admin`)

- **Who:** ผู้ดูแลระบบ BAMBAM 1–2 คน (✏️ ฝ่ายไหน: IT / ฝ่ายอาคาร) คุ้นกับหน้าจอหลังบ้านและ Excel
- **Where and on what:** desktop ที่โต๊ะทำงาน (D-008: admin ใช้ desktop เป็นหลัก) บางครั้งเปิดบนมือถือเพื่อเปลี่ยน role ด่วน
- **How often:** ช่วงเริ่มใช้งานตั้งค่าอาคาร หมวดงาน role ครั้งใหญ่ 1–2 วัน หลังจากนั้นเดือนละไม่กี่ครั้ง (พนักงานย้ายตำแหน่ง, มีช่างใหม่, ปรับห้อง)
- **Jobs to be done:**
  - ใส่อาคาร ชั้น ห้อง และรูปผังชั้นให้ตรงของจริง เพื่อให้ฟอร์มแจ้งซ่อมและภาพรวมอาคาร (repair S12) ถูกต้อง
  - ดูแลหมวดงาน อาการ และประเภทผู้รับเหมาให้ตัวเลือกในฟอร์มสะอาด
  - สร้าง/ปรับ role และติ๊กสิทธิ์ว่า role ไหนทำอะไรได้
  - เปลี่ยน role ของพนักงาน (เช่น ช่างใหม่, หัวหน้าแม่บ้านคนใหม่)
  - ตรวจย้อนหลังว่าใครเปลี่ยนอะไร
- **A day with this task:** หัวหน้าแจ้งว่ามีช่างใหม่เริ่มงานวันนี้ → Superadmin ให้ช่างลองเข้า BAMBAM ด้วย SSO หนึ่งครั้ง (ได้ role พนักงานทั่วไปอัตโนมัติ) → เปิด "ผู้ใช้" ค้นด้วยรหัสพนักงาน → เปลี่ยน role เป็น "ช่างเทคนิค" → ช่างรีเฟรชหน้าแล้วเห็นเมนูงานซ่อมทันที อีกวันฝ่ายอาคารแจ้งว่าชั้น 5 กั้นห้องประชุมใหม่ → เปิด "อาคารและชั้น" → อาคารหลัก ชั้น 5 → เพิ่มห้อง "ห้องประชุม 5C" และอัปโหลดรูปผังชั้นใหม่
- **Frustrations today:** ต้องขอนักพัฒนาแก้ seed ทุกครั้งที่ role หรือ master เปลี่ยน, ไม่รู้ว่าใครเปลี่ยนสิทธิ์ใคร
- **Success looks like:** เปลี่ยน role พนักงาน 1 คนได้ในไม่เกิน 30 วินาที; เพิ่มห้องในชั้นได้ในไม่เกิน 1 นาที; ไม่มีการแก้ seed/โค้ดเพื่อเปลี่ยนข้อมูลกลางหลังขึ้น production
- **Words they use:** ตั้งค่า, ผู้ใช้, บทบาท / Role, สิทธิ์, อาคาร, ชั้น, ห้อง / โซน, ผังชั้น, ปิดใช้งาน

## Persona: Admin (`admin`) — ข้อมูลกลาง (CR-001)

- **Who:** Admin งานซ่อม / ผู้ดูแลอาคาร (2 คนในข้อมูลตัวอย่าง) ใช้ dashboard S29 เป็นหน้าแรกอยู่แล้ว
- **Jobs to be done:** แก้ชื่อห้องให้ตรงป้ายจริง, เพิ่ม/ย้าย/ปิดใช้งานอุปกรณ์ในห้อง, เพิ่มประเภทอุปกรณ์ใหม่, ปรับหมวดงาน อาการ และความเร่งด่วน
- **Never:** จัดการผู้ใช้ role หรือสิทธิ์ (เมนูไม่แสดง เปิด URL ตรงได้หน้า "ไม่มีสิทธิ์")
- **Success looks like:** เพิ่มอุปกรณ์ 1 ชิ้นในห้องที่ถูกต้องได้ในไม่เกิน 1 นาที โดยไม่ต้องขอ Superadmin

## ผู้ที่ได้รับผลกระทบ (ไม่ได้ใช้หน้านี้)

- พนักงานทุก role: เมื่อ role หรือสิทธิ์ของตัวเองถูกเปลี่ยน เมนูและปุ่มเปลี่ยนตามทันทีในการโหลดหน้าครั้งถัดไป
- ผู้แจ้งซ่อม / ช่าง: เห็นตัวเลือกอาคาร ชั้น หมวดงาน อาการ ประเภทผู้รับเหมาตามที่ Superadmin ตั้งไว้

## Anti-persona

- ~~Admin งานซ่อม (`admin`) ไม่ได้ใช้โมดูลนี้ ยังจัดการงานซ่อมตามเดิม~~ (CR-001: Admin ใช้ส่วนข้อมูลกลาง — persona ด้านบน)
- ไม่ออกแบบให้ตั้งค่าแบบ bulk/import ไฟล์ และไม่ทำ workflow อนุมัติการเปลี่ยนสิทธิ์ (Superadmin เปลี่ยนได้ทันที)

## Roles and permissions

~~ทุกการกระทำในโมดูลนี้ทำได้เฉพาะ `super_admin` (role อื่นได้ 403 และไม่เห็นเมนู)~~ (CR-001)

| Action | super_admin | admin (CR-001) | role อื่นทุก role |
|---|---|---|---|
| เห็นเมนู "ตั้งค่าระบบ" (F25) | ✅ | ✅ (เฉพาะกลุ่มข้อมูลกลาง) | ❌ |
| ~~จัดการอาคาร ชั้น ห้อง รูปผังชั้น~~ แก้ชื่ออาคาร/ห้อง, อุปกรณ์ในห้อง, ประเภทอุปกรณ์ (F26, CR-002) | ✅ | ✅ | ❌ |
| จัดการหมวดงาน อาการ ความเร่งด่วน (F27) | ✅ | ✅ | ❌ |
| จัดการประเภทผู้รับเหมา (F28) | ✅ | ❌ | ❌ (ช่างยังสร้างประเภทใหม่ตอนประเมินได้ตาม D-041) |
| เพิ่ม/แก้/ลบ role, ติ๊กสิทธิ์ (F29) | ✅ | ❌ | ❌ |
| ค้นหาผู้ใช้, เปลี่ยน role (F15) | ✅ | ❌ | ❌ |
| ดูประวัติการเปลี่ยนแปลง (F30) | ✅ | ❌ | ❌ |

`super_admin` ยังมีทุกสิทธิ์ของทุกระบบ (เช่น ดูงานซ่อมทุกงาน ปิดงาน) เพราะเป็น role ที่มีสิทธิ์ครบเสมอ

## Permission catalog — ค่าตั้งต้นของ Role matrix (F05)

รายการสิทธิ์กำหนดในโค้ด (เพิ่มได้ตอนพัฒนาเท่านั้น) ค่าตั้งต้นต้องให้ผลเหมือนพฤติกรรมของ repair วันนี้ทุก role (หลัง CR-005/CR-006) เพื่อให้วันที่เปิดโมดูลนี้ไม่มีใครเห็นอะไรเปลี่ยน

**สิทธิ์พื้นฐาน (ทุก role มีเสมอ ติ๊กออกไม่ได้):** เข้าสู่ระบบและโปรไฟล์, ~~แจ้งซ่อม / สแกน QR / ติดตามเคสเดิม (repair F02, F03, F13-B)~~ (CR-006: now `repair.ticket.report`), ดูงานที่ตัวเองแจ้งหรือติดตาม (F06) ~~, แจ้งเตือนของตัวเอง (F19-B)~~ (repair CR-024) — ตรงกับ D-004 "ทุก role ทำสิ่งที่ `employee` ทำได้"

**กฎที่ไม่ใช่สิทธิ์ (อยู่ในโค้ด ไม่อยู่ใน matrix):** ตรวจรับ / ให้คะแนน / ส่งกลับให้แก้ได้เฉพาะผู้แจ้งของงานนั้น (repair F07)

| Key | สิทธิ์ (ระบบแจ้งซ่อม) | employee | housekeeper_lead | security_lead | technician | admin | super_admin |
|---|---|---|---|---|---|---|---|
| `repair.ticket.view_all` | ดูงานซ่อมทุกงาน รวมชื่อและคะแนนช่างภายนอก (F06, F22, F24 ดู) | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ 🔒 |
| `repair.ticket.work` | ประเมินงานและบันทึกผลซ่อม (F21) | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ 🔒 |
| `repair.contractor.manage` | เพิ่ม/แก้ช่างภายนอก (F24) | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ 🔒 |
| `repair.ticket.team_handle` | บันทึกงานที่ทีมทำเอง และส่งต่องานที่ตัวเองบันทึก (F04, F05) | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ 🔒 |
| `repair.ticket.handover_any` | ส่งต่องานทีมทุกงานให้ช่าง (F05) | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ 🔒 |
| ~~`repair.ticket.set_priority`~~ | ~~ปรับความเร่งด่วน (F22)~~ — removed by repair CR-015 (priority is policy, no ticket-level change) | | | | | | |
| `repair.ticket.close_any` | ปิดงานใดก็ได้ (F08-B) | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ 🔒 |
| `repair.overview.view` | ภาพรวมอาคาร (F23) | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ 🔒 |

(repair CR-024) The `executive` column was removed from both tables.

🔒 = แก้ไม่ได้ ระบบจองรถ / จองห้องจะเพิ่มกลุ่มสิทธิ์ของตัวเองเมื่อถึง discovery ของระบบนั้น

**กลุ่ม "ตั้งค่าระบบ" (CR-001) — ทุกช่องล็อก ผูกกับ role key ไม่เก็บใน matrix ไม่ถูกคัดลอก**

| Key | สิทธิ์ | employee | housekeeper_lead | security_lead | technician | admin | super_admin | role ใหม่ |
|---|---|---|---|---|---|---|---|---|
| `settings.locations.manage` | อาคารและห้อง (แก้ชื่อ) | ❌ | ❌ | ❌ | ❌ | ✅ 🔒 | ✅ 🔒 | ❌ 🔒 |
| `settings.assets.manage` | อุปกรณ์และประเภทอุปกรณ์ (รวมจัดวางใน S29) | ❌ | ❌ | ❌ | ❌ | ✅ 🔒 | ✅ 🔒 | ❌ 🔒 |
| `settings.categories.manage` | หมวดงานและอาการ | ❌ | ❌ | ❌ | ❌ | ✅ 🔒 | ✅ 🔒 | ❌ 🔒 |
| `settings.contractor_types.manage` | ประเภทผู้รับเหมา | ❌ | ❌ | ❌ | ❌ | ❌ 🔒 | ✅ 🔒 | ❌ 🔒 |
| `settings.users.manage` | ผู้ใช้ | ❌ | ❌ | ❌ | ❌ | ❌ 🔒 | ✅ 🔒 | ❌ 🔒 |
| `settings.roles.manage` | Role และสิทธิ์ | ❌ | ❌ | ❌ | ❌ | ❌ 🔒 | ✅ 🔒 | ❌ 🔒 |
| `settings.audit.view` | ประวัติการเปลี่ยนแปลง | ❌ | ❌ | ❌ | ❌ | ❌ 🔒 | ✅ 🔒 | ❌ 🔒 |

**CR-006 (2026-10-29) — platform-wide catalog.** Full tables, defaults and guard rules: `changes/CR-006.md`. (CR-006)

- New keys: `repair.ticket.report` แจ้งซ่อม (F02, F03, F13-B) · `car_booking.use` ใช้ระบบจองรถ · `room_booking.use` ใช้ระบบจองห้องประชุม — default ✅ every role except `technician` · `repair.building3d.view` ดูโมเดล 3D อาคาร (sub-permission of `repair.overview.view`) — default `admin` · `settings.users.view` ดูรายชื่อผู้ใช้ — default `admin` (CR-006)
- The settings group is **no longer fixed**: its 8 keys are stored and tickable; default `admin` has all 8, custom roles none; `super_admin` always all (🔒) (CR-006)
- The "ตั้งค่าระบบ" table above (locked by role key) is superseded by CR-006 (CR-006)
- Guard rules for anyone but Superadmin: G1 not their own role / own role change · G2 never Superadmin · G3 grant / assign only within their own permissions · G4 audited (CR-006)

## Open questions

- ✏️ รหัสพนักงานของ Superadmin คนแรก (ใส่ใน env ของแต่ละ environment) — ต้องมีก่อน UAT
- ✏️ Superadmin อยู่ฝ่ายไหน และมีกี่คน (ไม่บล็อก)
- เมนูของ repair (เช่น "งานทั้งหมด" S11 ของ admin กับ "งานซ่อม" S09 ของช่าง) จะผูกกับสิทธิ์ไหน — ตัดสินใน P3/P4 ถ้าค่าตั้งต้นทำให้เมนูไม่เหมือนวันนี้ จะเพิ่มสิทธิ์ย่อยให้ตรง
