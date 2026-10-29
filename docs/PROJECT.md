# PROJECT.md

<!-- ไฟล์เดียวที่เก็บข้อมูลเฉพาะของโปรเจกต์นี้ (AGENTS.md ไม่ต้องแก้)
     ส่วนที่ยังมี ✏️ = ยังไม่ได้ข้อมูล -->

## Overview

- **Project name:** BAMBAM (Workplace Service Assistant) — client ID ใน SSO: `bam`
- **One-line purpose:** ศูนย์รวมบริการที่ทำงานของพนักงาน: แจ้งซ่อม จองรถ และจองห้องประชุม ใช้ได้ทั้งบนมือถือและ desktop
- **Organisation / client:** CPAC สำนักงานใหญ่ (บริษัท ผลิตภัณฑ์และวัตถุก่อสร้าง จำกัด, 1516 ถ.ประชาราษฎร์ 1 บางซื่อ) — ผู้ใช้เข้าผ่าน RMC SSO
- **Who uses it overall:** พนักงานทุกคน (แจ้ง/จอง), หัวหน้าแม่บ้าน, หัวหน้ารปภ., ช่างเทคนิค, Admin, ผู้บริหาร — role เดียวกันทุกระบบ (D-004); Superadmin ตั้งค่าระบบ (D-044)
- **Source material:** `docs/modules/repair/attachments/BAMBAM-User-Flow02.html` (flow F01–F20 จาก POC เดิม + ข้อกำหนด 13 ต.ค. 2569)

## Modules (systems)

| Key | Name (TH) | Purpose | Main users | Phase | Stage | Status |
|---|---|---|---|---|---|---|
| `repair` | ระบบแจ้งซ่อม | แจ้งปัญหา → ช่างรับงานจากคิว → ซ่อม → ผู้แจ้งตรวจรับ | ทุก role | P5 | 2M of 8 (next 3) | Stage 0 platform accepted 2026-10-14 (`platform-stage-0`); Stage 2M (CR-014) accepted 2026-10-19 (`repair-stage-2M`); Stages 1 / 2 / 2R / 2N built, waiting acceptance |
| `car_booking` | ระบบจองรถ | จองรถส่วนกลาง | ✏️ | – | – | brief needed |
| `room_booking` | ระบบจองห้องประชุม | จองห้องประชุม | ✏️ | – | – | brief needed |
| `settings` | ตั้งค่าระบบ (Superadmin) | ตั้งค่า master ผังอาคาร role / สิทธิ์ และผู้ใช้ ใช้ร่วมทั้ง 3 ระบบ | `super_admin` | P5 | 0 of 6 | screens + plan + CR-007 approved 2026-10-16; Stage 1 next |

Cross-module dependencies: ผู้ใช้และ role อยู่ที่ `platform` ใช้ร่วมกันทั้ง 3 ระบบ (D-003, D-004); role / สิทธิ์ / ผู้ใช้ และ master (อาคาร ชั้น ห้อง หมวดงาน ประเภทผู้รับเหมา) ตั้งค่าในโมดูล `settings` (D-043–D-047). หน้าแรก (Home) รวมบริการทั้ง 3 ระบบ

## Stack (fixed)

- **Frontend:** Next.js 16.x (App Router) · TypeScript strict · shadcn/ui · Tailwind · next/font/google
- **Backend:** Go · Gin · 3-tier (controller / service / repository) · sqlc + pgx/v5 · goose migrations
- **Database:** PostgreSQL 17 (dev: `docker-compose.yml` at repo root)
- **Auth:** RMC SSO (OIDC + PKCE) — `docs/shared/integrations/sso.md`. Roles เก็บใน BAMBAM ไม่ได้มาจาก SSO (D-003)
- **Package manager:** npm

## Environments

| | development | UAT | production |
|---|---|---|---|
| Frontend URL | http://localhost:3000 | ✏️ | ✏️ (ยังไม่ได้ลงทะเบียนกับ SSO) |
| API URL | http://localhost:8080 | ✏️ | ✏️ |
| Database | local docker | ✏️ | ✏️ |
| SSO | RMC SSO client `bam` (DEV) | ✏️ | RMC SSO client `bam` (PROD) |
| Role switcher | เปิด (D-005) | เปิด (D-005) | **ไม่มี** |
| How it gets there | `make run` + `npm run dev` | ✏️ | ✏️ |

## Locale

- UI language: Thai (TH/EN switch มีใน flow F19 — ยังไม่อยู่ในช่วงแรก)
- Timezone: Asia/Bangkok
- Date display: 13 ต.ค. 2569 (พ.ศ., ตามรูปแบบในไฟล์ flow) ✏️ ยืนยัน
- Currency / number format: ✏️

## Glossary

<!-- agent ใช้ชื่อจากตารางนี้ตั้งชื่อ table, type, route ให้ตรงกันทุกที่ -->

| คำไทย (ที่ user ใช้) | Name in code | Meaning |
|---|---|---|
| รหัสพนักงาน (claim `USER` จาก SSO) | `employee_code` | ตัวระบุผู้ใช้ที่ไม่ซ้ำ ใช้ผูก role |
| พนักงานทั่วไป | `employee` | role เริ่มต้นของทุกคนที่ login ครั้งแรก |
| หัวหน้าแม่บ้าน | `housekeeper_lead` | role |
| หัวหน้ารปภ. | `security_lead` | role |
| ช่างเทคนิค | `technician` | role |
| Admin | `admin` | role |
| ผู้บริหาร | `executive` | role |
| สลับบทบาท (dev/UAT) | `role_switcher` | เครื่องมือดู UI ในแต่ละ role ด้วยผู้ใช้ตัวอย่าง (D-005) |
| ผู้ใช้ตัวอย่าง | `demo_user` | บัญชี seed 1 คนต่อ role ใช้กับ role switcher เท่านั้น |
| งานแจ้งซ่อม / Ticket | `ticket` | 1 เรื่องที่แจ้งซ่อม |
| ผู้แจ้ง | `reporter` | ผู้สร้าง ticket คนเดียวที่ตรวจรับได้ |
| ผู้ติดตามเคสเดิม | `subscriber` | ผู้แจ้งเรื่องซ้ำที่ถูกผูกกับ ticket เดิม (F03) |
| หมวดงาน | `category` | ใช้แยกคิวของช่าง |
| อาการ | `symptom` | เลือกได้หลายข้อต่อ ticket |
| ความเร่งด่วน | `priority` | `critical` ฉุกเฉิน · `high` สูง · `medium` ปกติ · `low` ต่ำ (ผู้แจ้งเลือก, Admin ปรับได้) |
| คิวงานช่าง | `queue` | ticket ที่ยังไม่มีช่างรับ เรียง priority → เวลาแจ้ง หรือตามที่ Admin จัด |
| รับงาน | `claim` | ช่างจอง ticket จากคิว |
| ตรวจรับ | `confirmation` | ผู้แจ้งยืนยันว่างานเสร็จ → closed |
| คะแนนความพึงพอใจ | `rating` | 1–5 ดาว ไม่บังคับ |
| งานที่ทีมดำเนินการเอง | `team_handled` | หัวหน้าแม่บ้าน/รปภ. ปิดเองทันที ไม่มีประเมิน (F04) |
| ส่งต่อให้ช่าง | `handover` | ส่ง ticket เดิมกลับเข้าคิวช่าง (F05) |
| อาคาร / ชั้น | `building` / `floor` | ตำแหน่งปัญหา |
| Superadmin | `super_admin` | role ของระบบ มีทุกสิทธิ์เสมอ ใช้โมดูล `settings` ได้คนเดียว (D-044) |
| ตั้งค่าระบบ | `settings` | โมดูลหน้าตั้งค่าของ Superadmin |
| สิทธิ์ | `permission` | การกระทำ 1 อย่างที่ role ทำได้ เช่น `repair.ticket.close_any`; รายการกำหนดในโค้ด (D-045) |
| Matrix สิทธิ์ | `role_permission` | role × สิทธิ์ ที่ Superadmin ติ๊ก |
| ห้อง / โซน | `room` | พื้นที่ในชั้น (ห้องประชุมของระบบจองห้องจะอ้างอิงจากนี้) |
| ผังชั้น | `floor_plan` | รูปผังของชั้น 1 รูป ดูอย่างเดียว |
| ปิดใช้งาน | `is_active = false` | ซ่อนจากตัวเลือกใหม่ ไม่ลบ (D-047) |
| ประวัติการเปลี่ยนแปลง | `audit_log` | บันทึกทุกการเปลี่ยนในโมดูล `settings` (F30) |

## Non-functional requirements

- Expected users / concurrent users: ✏️
- Devices: **มือถือและ desktop แบบ adaptive ไม่ใช่แค่ responsive** (D-008) — มือถือเป็นหลัก: พนักงานทั่วไป, หัวหน้าแม่บ้าน/รปภ., ช่างเทคนิค · desktop เป็นหลัก: Admin, ผู้บริหาร
- Browsers to support: ✏️
- Accessibility needs: ✏️
- Data retention / audit / PDPA: เก็บเฉพาะ claim จาก SSO ที่ใช้จริง ห้าม log token/ข้อมูลส่วนบุคคลทั้งก้อน (ตาม SSO handoff) · การเลื่อนลำดับคิวต้องบันทึกว่าใครทำ (D-006)
