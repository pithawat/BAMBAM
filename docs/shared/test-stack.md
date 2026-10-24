# Test stack — วิธีรัน System Atlas และ e2e

Playwright e2e และ System Atlas ใช้ **stack ทดสอบชุดเดียวกัน** ซึ่งแยกจาก dev ปกติ (D-092)
ค่าทั้งหมดอยู่ที่ `frontend/e2e/test-stack.cjs`

| | dev ปกติ (ไม่เปลี่ยน) | stack ทดสอบ (e2e + Atlas) |
|---|---|---|
| Database | `DATABASE_URL` ใน `backend/.env` | docker Postgres `bambam_e2e @ localhost:5433` (`E2E_DATABASE_URL`) |
| API | :8080 | :8090 (`E2E_API_URL`) |
| Web | :3000 (`.next`) | :3100 (`.next-e2e`) (`E2E_PORT`) |
| Login | RMC SSO | ไม่มี SSO — ใช้ session ของผู้ใช้ตัวอย่าง (`cmd/devsession`) |

ข้อมูลที่ e2e หรือ tour สร้างอยู่ใน `bambam_e2e` เท่านั้น ระบบตรวจ 3 ชั้นก่อนรันทุกครั้ง:
1. ห้ามเป็น dev database (เทียบกับ `backend/.env`)
2. แสดงปลายทางชัดเจน: `web … · API … · DB bambam_e2e @ localhost:5433`
3. API :8090 ต้องรับ session ที่สร้างใน `bambam_e2e` ได้ (พิสูจน์ว่าต่อ DB เดียวกัน)

## ต้องมีก่อน (ครั้งเดียว)

- Docker Desktop เปิดอยู่ (ขึ้น "Engine running", `docker ps` ไม่ error)
- `go`, `goose` อยู่ใน PATH (`go install github.com/pressly/goose/v3/cmd/goose@latest`)
- `cd frontend && npm install` และ browser ของ Playwright (`npx playwright install chromium`)

## 1. Database ทดสอบ

```powershell
cd frontend
npm run test:db        # docker compose up -d db → สร้าง bambam_e2e ถ้ายังไม่มี → goose up
```

ได้ `test database ready: bambam_e2e @ localhost:5433` = พร้อม

- รันซ้ำได้ทุกเมื่อ (migrate ต่อจากเดิม) — e2e และ Atlas เรียกให้เองตอนเปิด API ทดสอบอยู่แล้ว
- ข้อมูลเริ่มต้นมาจาก migration เท่านั้น (อาคาร 1, หมวดงาน, ผู้ใช้ตัวอย่าง) — ยังไม่มีงานซ่อม
- **ล้างให้เป็น DB ใหม่:**
  ```powershell
  docker compose exec -T db psql -U bambam -d postgres -c "DROP DATABASE bambam_e2e WITH (FORCE)"
  cd frontend; npm run test:db
  ```

## 2. System Atlas

### แบบง่าย (Atlas เปิด backend + frontend ทดสอบให้เอง)

```powershell
# ที่ root ของโปรเจค (หรือ cd frontend; npm run atlas)
node tools/atlas/cli.mjs serve
```

1. เปิด http://127.0.0.1:4400
2. แท็บ Flow → เลือก flow ที่มี "▶ รันได้" (ตรวจรับแล้วทุก stage + มี tour) → **▶ รันบนแอพจริง**
3. รอบแรก Atlas เปิด API :8090 และ web :3100 ให้ (1–2 นาที, popup บอกความคืบหน้า) แล้วตรวจ 3 ชั้นก่อนเริ่ม
4. กด **Space** หรือคลิกที่ภาพเพื่อไปทีละขั้น · **Esc** หยุด · กดกล่องที่มีป้าย ▶ เพื่อเริ่มจากขั้นนั้น
5. **Ctrl+C** ที่ terminal = ปิด Atlas พร้อม API/web ที่ Atlas เปิดเอง (ตัวที่เปิดไว้ก่อนแล้วไม่ถูกปิด)

### แบบเปิด backend / frontend เอง (อยากเห็น log)

```powershell
# terminal 1 — backend ทดสอบ
cd backend
$env:APP_ENV="development"; $env:DATABASE_URL="postgres://bambam:bambam@localhost:5433/bambam_e2e?sslmode=disable"; $env:HTTP_PORT="8090"; $env:ROLE_SWITCHER_ENABLED="true"
go run ./cmd/api

# terminal 2 — frontend ทดสอบ (NEXT_PUBLIC_USE_MOCKS ต้องเป็น false)
cd frontend
$env:API_INTERNAL_URL="http://localhost:8090"; $env:NEXT_DIST_DIR=".next-e2e"; $env:NEXT_PUBLIC_USE_MOCKS="false"; $env:NEXT_PUBLIC_ROLE_SWITCHER="true"
npx next dev --port 3100

# terminal 3 — Atlas (ใช้ :8090 / :3100 ที่เปิดอยู่)
node tools/atlas/cli.mjs serve
```

### เปิดแอพทดสอบดูเอง (ไม่มี tour)

หน้า Login ของ :3100 ใช้ไม่ได้ (SSO ลงทะเบียนเฉพาะ :3000) ให้เปิดผ่านคำสั่งนี้ — ได้ Chromium ที่ login เป็นผู้ใช้ตัวอย่างแล้ว:

```powershell
cd frontend
npm run test:browse              # admin
npm run test:browse -- technician   # employee | housekeeper_lead | security_lead | technician | admin | executive
```

### คำสั่ง Atlas อื่น

```powershell
node tools/atlas/cli.mjs check                 # ตรวจข้อมูลใน docs/atlas
node tools/atlas/cli.mjs verify                # รันทุก tour แบบ headless ไม่ต้องกด — ยังผ่านไหม
node tools/atlas/cli.mjs verify repair/F31     # เฉพาะ flow
node tools/atlas/cli.mjs export                # docs/atlas/dist/atlas.html ไฟล์เดียวสำหรับแชร์ (ดูอย่างเดียว)
```

## 3. e2e (Playwright)

```powershell
cd frontend
npx playwright test                              # ทั้งหมด (desktop + mobile)
npx playwright test e2e/repair/F31-assets.spec.ts --project=desktop
npx playwright test -g "AC2"                     # ตามชื่อ test
npx playwright test --headed --workers=1         # เห็น browser
npx playwright test --ui                         # โหมด UI ของ Playwright
npx playwright show-report                       # รายงานรอบล่าสุด
```

สิ่งที่เกิดเมื่อรัน:
1. ถ้า :8090 / :3100 **ยังไม่เปิด** — Playwright เปิดให้เอง (`webServer`): migrate `bambam_e2e` แล้วเปิด API :8090 และ web :3100 และปิดให้เมื่อรันจบ
   ถ้า **เปิดอยู่แล้ว** (ของคุณเองหรือของ Atlas) — ใช้ตัวนั้นต่อ
2. บรรทัดแรกบอกปลายทาง `e2e → web http://localhost:3100 · API http://localhost:8090 · DB bambam_e2e @ localhost:5433`
3. ตรวจ 3 ชั้น แล้วสร้าง session ของผู้ใช้ตัวอย่างทุก role ใน `bambam_e2e` (`e2e/.auth/*.json`)
4. รัน test — dev server :3000 / :8080 และ dev database ไม่ถูกแตะ

ใช้ DB หรือพอร์ตอื่น: ตั้ง env ก่อนรัน เช่น `$env:E2E_DATABASE_URL="postgres://bambam:bambam@localhost:5433/bambam_e2e2?sslmode=disable"` (ใช้กับ Atlas ได้เหมือนกัน)

## แก้ปัญหา

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| `test-stack prepare failed … dockerDesktopLinuxEngine` | Docker Desktop ยังไม่เปิด / engine ยังไม่พร้อม |
| `goose` not found | `go install github.com/pressly/goose/v3/cmd/goose@latest` แล้วเปิด terminal ใหม่ |
| `the API at http://localhost:8090 does not accept a session …` | มี API :8090 ที่ต่อ DB อื่นค้างอยู่ — ปิดตัวนั้นแล้วรันใหม่ |
| `E2E_DATABASE_URL points at the dev database` | ห้ามใช้ dev database — ใช้ database แยก เช่น `bambam_e2e` |
| `Another next dev server is already running` | มี web :3100 (`.next-e2e`) ค้างอยู่ — ใช้ตัวนั้นต่อ หรือปิด PID ที่ข้อความบอก |
| :3100 ติดหน้า Login | ปกติ (ไม่มี SSO) — ใช้ `npm run test:browse` หรือ Atlas |
| หน้าแอพไม่มีข้อมูล | `NEXT_PUBLIC_USE_MOCKS` ต้องเป็น `false`; DB ใหม่ยังไม่มีงานซ่อมจนกว่าจะมีคนแจ้งใน stack นี้ |
| tour หยุดกลางทาง | `node tools/atlas/cli.mjs verify <module>/<flow>` — บอกขั้นที่พังและที่อยู่ภาพหน้าจอในโฟลเดอร์ temp |
