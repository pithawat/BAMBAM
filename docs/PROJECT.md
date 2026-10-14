# PROJECT.md

<!-- ไฟล์เดียวที่เก็บข้อมูลเฉพาะของโปรเจกต์นี้ (AGENTS.md ไม่ต้องแก้)
     กรอกส่วนที่มี ✏️ ก่อนเริ่ม Phase 0 เขียนภาษาไทยได้ -->

## Overview ✏️

- **Project name:**
- **One-line purpose:**
- **Organisation / client:**
- **Who uses it overall:** (สรุปสั้นๆ รายละเอียดอยู่ใน 01-users.md ของแต่ละ module)

## Modules (systems) ✏️

<!-- 1 แถว = 1 ระบบย่อย. key = ชื่อภาษาอังกฤษสั้น ตัวเล็ก ใช้เป็นชื่อโฟลเดอร์/schema/route
     Phase/Stage/Status ให้ agent อัปเดตเองตอนจบแต่ละ stage -->

| Key | Name (TH) | Purpose | Main users | Phase | Stage | Status |
|---|---|---|---|---|---|---|
| `module_a` | | | | P1 | – | not started |
| `module_b` | | | | – | – | not started |
| `module_c` | | | | – | – | not started |

Cross-module dependencies: (เช่น module_b ใช้ข้อมูลพนักงานจาก module_a)

## Stack (fixed)

- **Frontend:** Next.js 16.x (App Router) · TypeScript strict · shadcn/ui · Tailwind · next/font/google
- **Backend:** Go · Gin · 3-tier (controller / service / repository) · sqlc + pgx/v5 · goose migrations
- **Database:** PostgreSQL ✏️ version: ___  (ถ้าไม่ใช่ Postgres ให้แก้ตรงนี้และใน backend/AGENTS.md)
- **Auth:** SSO — `docs/shared/integrations/sso.md`
- **Package manager:** npm ✏️ (หรือ pnpm)

## Environments ✏️

| | development | production |
|---|---|---|
| Frontend URL | http://localhost:3000 | |
| API URL | http://localhost:8080 | |
| Database | local docker | |
| SSO | (dev tenant / client id) | (prod tenant / client id) |
| How it gets there | `make run` + `npm run dev` | (เช่น merge เข้า main → CI build + deploy) |

## Locale ✏️

- UI language: Thai
- Timezone: Asia/Bangkok
- Date display: (เช่น 13 ต.ค. 2569 / 13/10/2026)
- Currency / number format: (เช่น THB, 1,234.50)

## Glossary ✏️

<!-- สำคัญมาก: agent จะใช้ชื่อจากตารางนี้ตั้งชื่อ table, type, route ให้ตรงกันทุกที่ -->

| คำไทย (ที่ user ใช้) | Name in code | Meaning |
|---|---|---|
| | | |

## Non-functional requirements ✏️

- Expected users / concurrent users:
- Devices: (มือถือ / desktop / tablet)
- Browsers to support:
- Accessibility needs: (เช่น ผู้ใช้สูงอายุ ต้องการตัวอักษรใหญ่)
- Data retention / audit / PDPA:
