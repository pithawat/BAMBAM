# PROJECT.md

<!-- ไฟล์เดียวที่เก็บข้อมูลเฉพาะของโปรเจกต์นี้ (AGENTS.md ไม่ต้องแก้)
     ส่วนที่ยังมี ✏️ = ยังไม่ได้ข้อมูล -->

## Overview

- **Project name:** BAMBAM (Workplace Service Assistant) — client ID ใน SSO: `bam`
- **One-line purpose:** ศูนย์รวมบริการที่ทำงานของพนักงาน: แจ้งซ่อม จองรถ และจองห้องประชุม ใช้ได้ทั้งบนมือถือและ desktop
- **Organisation / client:** CPAC สำนักงานใหญ่ (บริษัท ผลิตภัณฑ์และวัตถุก่อสร้าง จำกัด, 1516 ถ.ประชาราษฎร์ 1 บางซื่อ) — ผู้ใช้เข้าผ่าน RMC SSO
- **Who uses it overall:** พนักงานทุกคน (แจ้ง/จอง), หัวหน้าแม่บ้าน, หัวหน้ารปภ., ช่างเทคนิค, Admin ~~, ผู้บริหาร~~ (repair CR-024) — role เดียวกันทุกระบบ (D-004); Superadmin ตั้งค่าระบบ (D-044)
- **Source material:** `docs/modules/repair/attachments/BAMBAM-User-Flow02.html` (flow F01–F20 จาก POC เดิม + ข้อกำหนด 13 ต.ค. 2569)

## Modules (systems)

| Key | Name (TH) | Purpose | Main users | Phase | Stage | Status |
|---|---|---|---|---|---|---|
| `repair` | ระบบแจ้งซ่อม | แจ้งปัญหา → ช่างรับงานจากคิว → ซ่อม → ผู้แจ้งตรวจรับ | ทุก role | P5 | 5 of 8 (next: 5B) | Stage 0 platform accepted 2026-10-14 (`platform-stage-0`); Stages 1 / 2 / 2R / 2N / 3 accepted 2026-10-26 (`repair-stage-1`, `-2`, `-2R`, `-2N`, `-3`; e2e for F02 / F06 / F07 / F21 / F22 / F24 all pass, CR-023 unique contractor names); Stage 2M (CR-014) accepted 2026-10-19 (`repair-stage-2M`); Stage 3D (CR-016–CR-018: S29 dashboard + 3D อาคาร 1 + equipment) accepted 2026-10-20 (`repair-stage-3D`); Stage 3U (CR-019: UI refresh + tiger mascot + S06 slim paging #35) accepted 2026-10-24 (`repair-stage-3U`); Stage 4 (F03 duplicates + follow, F04 team-handled, F05 hand over; CR-020–CR-022) accepted 2026-10-26 (`repair-stage-4`); Stage 4P (CR-025 place first + building types, CR-026 photos 0.25 + upload on submit) accepted 2026-10-29 (`repair-stage-4P`); Stage 4R (CR-024: no executive, no bell / notification copy) accepted 2026-10-29 (`repair-stage-4R`); Stage 3D-2 (CR-027 / CR-028: อาคาร 2 + site view) accepted 2026-10-29 (`repair-stage-3D-2`); Stage 3D-3 (CR-030: office-side real buildings + models) accepted 2026-10-29 (`repair-stage-3D-3`); Stage 3D-4 (CR-031 Riverside real buildings + models, CR-032 site roads / car parks) accepted 2026-10-30 (`repair-stage-3D-4`); Stage 3D-5 (CR-033: site view from the site plans / OSM, อาคาร 4 turned, in-map side button) accepted 2026-11-01 (`repair-stage-3D-5`); Stage 5P (CR-034: disabled ถัดไป + hint, navbar gear + stacked logo, in-house assignee #36, required reschedule reason, tracking needs `report`) accepted 2026-11-01 (`repair-stage-5P`); CR-035 (employee Home + S06 top row from the owner proposals, one `MascotPanel` mascot treatment app-wide) accepted 2026-11-01 (`repair-cr-035`); Stage 5 (F13-B QR scan → prefilled S03, CR-036: `/q/{code}`, S16, QR banner, สแกน QR on phones) accepted 2026-11-02 (`repair-stage-5`) |
| `car_booking` | ระบบจองรถ | จองรถส่วนกลาง | ✏️ | – | – | brief needed |
| `room_booking` | ระบบจองห้องประชุม | จองห้องประชุม | ✏️ | – | – | brief needed |
| `settings` | ตั้งค่าระบบ (Admin / Superadmin) | ตั้งค่า master ผังอาคาร อุปกรณ์ หมวดงาน role / สิทธิ์ และผู้ใช้ ใช้ร่วมทั้ง 3 ระบบ | `admin` (ข้อมูลกลาง), `super_admin` (ทั้งหมด) | P5 | 6 of 6 + 4P + R1 accepted (2026-11-01) | screens + plan + CR-007 approved 2026-10-16; CR-001–CR-004 (admin sidebar, Admin master data, asset types) applied 2026-10-26 (D-111); Stage 1 (roles as data, permission checks, administration shell; e2e F25 pass) accepted 2026-10-26 (`settings-stage-1`); Stages 2–6 built by Claude (D-115), accepted 2026-10-27 (`settings-stage-2`…`6`); Stage 4P (CR-005 building types) accepted 2026-10-29 (`settings-stage-4P`); CR-006 (platform-wide permissions + redesign, D-125) approved 2026-10-29 → Stage R1 (platform-wide permissions, guards G1–G3, CR-006 navbar, one repair permission table; UI by Claude D-133 / D-134) accepted 2026-11-01 (`settings-stage-R1`); R2 (page frame + restyle) pending |

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
| ~~ผู้บริหาร~~ | ~~`executive`~~ | ~~role~~ removed (repair CR-024: existing users → `employee`) (CR-024) |
| สลับบทบาท (dev/UAT) | `role_switcher` | เครื่องมือดู UI ในแต่ละ role ด้วยผู้ใช้ตัวอย่าง (D-005) |
| ผู้ใช้ตัวอย่าง | `demo_user` | บัญชี seed 1 คนต่อ role ใช้กับ role switcher เท่านั้น |
| งานแจ้งซ่อม / Ticket | `ticket` | 1 เรื่องที่แจ้งซ่อม |
| ผู้แจ้ง | `reporter` | ผู้สร้าง ticket คนเดียวที่ตรวจรับได้ |
| ผู้ติดตามเคสเดิม | `subscriber` | ผู้แจ้งเรื่องซ้ำที่ถูกผูกกับ ticket เดิม (F03) |
| หมวดงาน | `category` | ใช้แยกคิวของช่าง |
| อาการ | `symptom` | เลือกได้หลายข้อต่อ ticket |
| ความเร่งด่วน | `priority` | `critical` ฉุกเฉิน · `high` สูง · `medium` ปกติ · `low` ต่ำ ระบบกำหนดจากอาการตอนแจ้ง เป็นนโยบาย ไม่มีใครปรับภายหลัง และไม่ใช้เรียงงาน (CR-008, CR-015) |
| คิวงานช่าง | `queue` | ~~คิวงาน~~ ตัดออก (CR-005): ช่างเห็นทุกงานที่ยังไม่ปิด เรียงตามเวลาแจ้ง เก่าก่อน (CR-015) |
| รับงาน | `claim` | ช่างจอง ticket จากคิว |
| ตรวจรับ | `confirmation` | ผู้แจ้งยืนยันว่างานเสร็จ → closed |
| คะแนนความพึงพอใจ | `rating` | 1–5 ดาว ไม่บังคับ |
| งานที่ทีมดำเนินการเอง | `team_handled` | หัวหน้าแม่บ้าน/รปภ. ปิดเองทันที ไม่มีประเมิน (F04) |
| ส่งต่อให้ช่าง | `handover` | ส่ง ticket เดิมกลับเข้าคิวช่าง (F05) |
| อาคาร (ตึก) / ชั้น | `building` / `floor` | ตำแหน่งปัญหา ("ตึก" = "อาคาร" ระดับเดียวกัน) |
| ห้องหรือจุด | `room` | ห้อง / พื้นที่ในชั้น (`platform.rooms`, CR-014); ทุกชั้นมี "พื้นที่ส่วนกลางชั้น n" |
| อุปกรณ์ | `asset` | ของ 1 ชิ้นในห้อง เช่น แอร์ ไมค์ ลำโพง จอทีวี: รหัส (`code`, ไม่ซ้ำ) + ชื่อ, อยู่ในห้องเดียว (CR-016) |
| ประเภทอุปกรณ์ | `asset_type` | ชนิดของอุปกรณ์ (แอร์ ไมค์ …): ชื่อ, รหัสนำหน้า (`code_prefix`) ใช้ตั้งรหัสอุปกรณ์, ตำแหน่งติดตั้ง (`mount`), ไอคอน (CR-016, settings CR-002) |
| ประเภทอุปกรณ์ | `asset_type` | แอร์ / ไมค์ / ลำโพง / จอทีวี (CR-016) |
| ประเภทอาคาร | `building_type` | ชนิดของอาคาร (อาคารสำนักงาน · โกดังเก็บของ · พื้นที่ภายนอกอาคาร); อาคารทุกหลังมี 1 ประเภท และหมวดงานระบุประเภทอาคารที่ใช้ได้ — ฟอร์มแจ้งซ่อมแสดงหมวดตามประเภทอาคาร (repair CR-025, settings CR-005) |
| ผังชั้น | `floor_plan` | ขนาดชั้น + โมเดล 3D + เส้นขอบห้อง (`plan_shape`) (CR-016) |
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
- Devices: **มือถือและ desktop แบบ adaptive ไม่ใช่แค่ responsive** (D-008) — มือถือเป็นหลัก: พนักงานทั่วไป, หัวหน้าแม่บ้าน/รปภ., ช่างเทคนิค · desktop เป็นหลัก: Admin ~~, ผู้บริหาร~~ (repair CR-024)
- Browsers to support: ✏️
- Accessibility needs: ✏️
- Data retention / audit / PDPA: เก็บเฉพาะ claim จาก SSO ที่ใช้จริง ห้าม log token/ข้อมูลส่วนบุคคลทั้งก้อน (ตาม SSO handoff) · การเลื่อนลำดับคิวต้องบันทึกว่าใครทำ (D-006)
