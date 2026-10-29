# Style brief

Status: DONE — direction chosen 2026-10-14 → `../design-system.md` (D-018)

<!-- Drafted by Claude from the kickoff on 2026-10-14. ✏️ = still needed from the user. -->

## In your own words

- บนมือถืออยากได้สไตล์แบบแอป "เป๋าตัง" (Paotang) — ต้องดูจากภาพหน้าจอจริงใน `references/` เท่านั้น
- ไม่ใช่แค่ responsive: ออกแบบให้เหมาะทั้งมือถือและ desktop แยกกัน หลายหน้าใช้บนมือถือเป็นหลัก (D-008)
- มีมาสคอตเป็นเสือดาวหิมะสีขาวลายจุดเทาดำ ใส่เสื้อกั๊กกรมท่า + เสื้อเชิ้ตฟ้า มีป้ายชื่อ BAMBAM ถือแท็บเล็ตไอคอน 3 บริการ (`mascot-bambam-leopard.png`, PNG พื้นใส 1254×1254)
- โลโก้ BAM เป็นตัวอักษรไล่สีฟ้า → ม่วง

## Feel — choose and adjust

| Dimension | ← | → | Your pick (1–5) |
|---|---|---|---|
| Density | spacious, few items per screen | dense, lots of data | 2 (Option A) |
| Tone | friendly, rounded | formal, sharp | 1 (Option A) |
| Color | calm, mostly neutral | bold, colorful | 5 (Option A) |
| Feel | classic, familiar | modern, trendy | 4 (Option A) |

## Reference apps / sites

| App / site | Screenshot file in references/ | What to take | What NOT to take |
|---|---|---|---|
| เป๋าตัง — หน้าแรก | `paotang-02-home.jpg` | แถบบน (avatar · ชื่อ · กระดิ่ง), แถบชิปเลือกบริการแนวนอน, การ์ดใหญ่มุมโค้งมีไอคอนภาพประกอบในวงกลมพื้นอ่อน + ป้าย 2 บรรทัด, แถบเมนูล่าง 5 ช่องที่มี **ปุ่มสแกนกลมยกขึ้นตรงกลาง** (→ สแกน QR แจ้งซ่อม F13-B) | แบนเนอร์โฆษณา |
| เป๋าตัง — หน้าบริการหลัก | `paotang-03-pay-home.jpg` | หัวหน้าไล่สีฟ้า/ฟ้าอมเขียวมีรูปทรงโค้ง, คำทักทายชื่อผู้ใช้, การ์ดขาวมุมโค้งใหญ่มีเงาซ้อนทับหัว, ปุ่มหลักทรงแคปซูล, กริดไอคอน 4 คอลัมน์ | ยอดเงิน / คูปอง |
| เป๋าตัง — บริการย่อยมีสีของตัวเอง | `paotang-05-service-gold-themed.jpg`, `paotang-08-service-health-themed.jpg` | แต่ละบริการมีสีหัวของตัวเอง (ทอง, เขียว) หัวมุมล่างโค้ง ปุ่มไอคอนวงกลมขาว 4 ปุ่มบนหัว มีจุดแดงแจ้งเตือน → ใช้ให้ แจ้งซ่อม / จองรถ / จองห้อง มีสีประจำระบบ | ภาพประกอบโฆษณา |
| เป๋าตัง — หน้ารายการ | `paotang-06-service-wallet-list.jpg`, `paotang-04-service-lottery.jpg` | การ์ดขาวแยกส่วน หัวข้อการ์ด + ลูกศร ">" ไปต่อ, รายการมีไอคอนสถานะสี + เวลาใต้ชื่อ | ตัวเลขการเงิน |
| เป๋าตัง — ฟอร์ม | `paotang-09-form.jpg` | หัวหน้า: ปุ่มกลับ + ชื่อหน้ากึ่งกลาง, ช่องกรอกขอบมนใหญ่ สูงแตะง่าย, ดรอปดาวน์มีลูกศร, รายการเช็กถูกสีเขียว | แบนเนอร์ |
| เป๋าตัง — อื่นๆ | `paotang-01-hero.jpg`, `paotang-07-chart-bottomnav.jpg` | ไอคอนสไตล์ 3D นุ่ม, ปุ่มเต็มความกว้าง, แถบล่างแบบ 5 ช่อง | กราฟการเงิน |

ที่มาภาพเป๋าตัง: ภาพประกอบในหน้า App Store ทางการ (id1324902182) ดึงเมื่อ 2026-10-14 — ใช้อ้างอิงภายในเท่านั้น ห้ามนำภาพ/ไอคอน/โลโก้ของเป๋าตังไปใช้ในแอป
| โลโก้ BAM | `bam-logo.png` | สีแบรนด์ (ดูด้านล่าง) | — |
| มาสคอต BAMBAM | `mascot-bambam-leopard.png` | ตัวละครท่าโบกมือ สำหรับหน้าแรก / สถานะว่าง / สำเร็จ / ผิดพลาด; สีกรมท่า + ฟ้าของชุดเข้ากับสีแบรนด์ | ตอนนี้มีท่าเดียว — ท่าอื่นใช้ภาพเดิม crop (full / bust / face) |

## Must have

- Brand colors (sampled from `bam-logo.png`, left → right): `#1075FA` → `#2741FA` → `#7930FA`
- Font preference: Prompt (หัวข้อ) + Anuphan (เนื้อหา) — เลือกจาก Option A (D-018)
- Light / dark mode: light only — ไม่มี dark mode (D-018)
- Main device: ทั้งสองแบบ — มือถือเป็นหลักสำหรับพนักงาน หัวหน้าแม่บ้าน/รปภ. ช่าง · desktop เป็นหลักสำหรับ Admin ผู้บริหาร
- ทุก mockup มีตัวสลับบทบาท (dev/UAT) ให้เห็นหน้าจอของแต่ละ role (D-005)

## Must avoid

- ภาพ/ไอคอน/โลโก้ของเป๋าตัง (ผู้ใช้ไม่มีข้อเพิ่ม 2026-10-14)

## Key screen to use for the style comparison

เสนอ: **หน้าแรก (Home) ของพนักงาน** — บริการ 3 ระบบ (แจ้งซ่อม / จองรถ / จองห้องประชุม) + งานของฉันที่ยังไม่ปิด
แสดงคู่กัน: มือถือ 375px (แบบแอป) และ desktop 1280px (แบบเว็บแอป) — ใช้แล้วใน options
