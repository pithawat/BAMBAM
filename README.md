# Web App Starter Kit — Claude Code + Codex

ชุดไฟล์ตั้งต้นสำหรับสร้าง web app แบบ "จบงานได้จริง" ด้วย agent:
requirement → user flow → style → UI spec → plan → build ทีละ stage พร้อมด่านตรวจรับ
ความจำของโปรเจกต์อยู่ในไฟล์ (ไม่ใช่ในแชต) ทั้ง Claude Code และ Codex อ่านชุดเดียวกัน

Stack: Next.js 16 · TypeScript · shadcn/ui · Go + Gin (controller / service / repository) · sqlc + pgx · PostgreSQL

---

## เริ่มโปรเจกต์ใหม่

1. Copy ทั้งโฟลเดอร์นี้เป็นโปรเจกต์ใหม่ (แนะนำ: เก็บ kit เป็น GitHub template repository แล้วกด **Use this template**)
2. `git init`
3. กรอกส่วน ✏️ ใน `docs/PROJECT.md` และวางเอกสาร SSO ของคุณแทน `docs/shared/integrations/sso.md`
4. (ถ้าใช้ Obsidian) Open folder as vault → เลือกโฟลเดอร์ `docs/`

## ชั้นของไฟล์ — อะไรใช้ซ้ำได้

| ชั้น | ไฟล์ | ใช้ซ้ำ |
|---|---|---|
| ส่วนตัว | `~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md` | ทุกโปรเจกต์ (เช่น "ตอบเป็นภาษาไทย") |
| Workflow กลาง | `AGENTS.md`, `CLAUDE.md`, `.claude/`, `.agents/` | ทุกโปรเจกต์ — **ห้ามใส่ข้อมูลเฉพาะโปรเจกต์** |
| Stack | `backend/AGENTS.md`, `frontend/AGENTS.md` | ทุกโปรเจกต์ที่ใช้ stack นี้ |
| โปรเจกต์ | `docs/PROJECT.md`, `docs/shared/` | เฉพาะโปรเจกต์นี้ |
| Module (ระบบย่อย) | `docs/modules/<key>/` | เฉพาะระบบนั้น |

ปรับปรุง kit: แก้ที่ kit repo แล้ว copy ไฟล์ชั้น "Workflow กลาง" และ "Stack" ทับในโปรเจกต์เดิมได้เลย ไม่กระทบ `docs/`

## Workflow

### ครั้งเดียวต่อโปรเจกต์

| # | คุณทำ | สั่ง Claude Code |
|---|---|---|
| 1 | กรอก PROJECT.md + sso.md | — |
| 2 | สร้างทั้ง 3 ระบบ | `/new-module inventory "ระบบคลังสินค้า"` (ทำซ้ำต่อ module) |
| 3 | กรอก `00-brief.md` + วางไฟล์ใน `attachments/` | — |
| 4 | ตอบคำถาม แล้วอ่าน/แก้ flow | `/discovery inventory` → ✋ approve |
| 5 | กรอก `docs/shared/style/brief.md` + วางภาพแอปที่ชอบใน `references/` | `/style-options` → เปิด `options/index.html` เลือก → ✋ approve |
| 6 | ดู screen inventory + mockup | `/ui-spec inventory` → ✋ approve |
| 7 | ดูแผน stage + API | `/stage-plan inventory` → ✋ approve |
| 8 | ตรวจรับ app เปล่าที่ login ได้ | `/platform-setup` → ✋ ตรวจรับ Stage 0 |

### วนต่อ stage

| # | ที่ไหน | ทำอะไร |
|---|---|---|
| 1 | Claude Code (session ใหม่) | `/build-stage inventory 1 prepare` — backend + types/mocks + HANDOFF |
| 2 | Codex | วาง prompt ที่ Claude ให้มา (ดูด้านล่าง) |
| 3 | Claude Code | `/build-stage inventory 1 wire` — รีวิว UI, ต่อ API จริง, e2e, รายงาน |
| 4 | คุณ | ทำตาม demo script ใน PROGRESS.md → ✋ ตรวจรับ |
| 5 | Claude Code | `/accept-stage inventory 1` แล้ว `/clear` |

Module ถัดไปเริ่มที่ขั้น 3 (ข้าม style และ platform)
ระหว่างที่ module A อยู่ใน build loop ทำ discovery ของ module B ไปพร้อมกันได้ใน session แยก

### เปลี่ยน flow / หน้าจอ กลางทาง

`/change-request inventory "เพิ่มขั้นอนุมัติโดยหัวหน้าก่อนรับของ"` หรือพิมพ์บอกเฉยๆ ก็ได้ skill นี้ Claude เรียกเองได้
Claude จะวิเคราะห์ผลกระทบ (S / M / L) ก่อน แล้วรอคุณอนุมัติ จึงจะแก้เอกสารและแผน

## Prompt สำหรับ Codex

```
Use the implement-ui skill. Read docs/modules/inventory/ui/HANDOFF.md and implement the Stage 1 screens. Follow it exactly.
```

ถ้า Codex เวอร์ชันของคุณยังไม่เห็น skill ใน `.agents/skills/` ใช้ prompt นี้แทน (ผลเหมือนกัน):

```
Read docs/modules/inventory/ui/HANDOFF.md and every file in its "Read in this order" list.
Implement the Stage 1 screens. Edit only the paths under "You may edit".
Use shadcn components and design tokens only. Implement every state with the exact copy.
Compare with the mockups at 375px and 1280px, run lint + typecheck,
then fill "Checklist results", "Differences" and "Open questions" in HANDOFF.md. Never guess.
```

## Obsidian

- ใช้ `docs/` เป็น vault — เป็นไฟล์ชุดเดียวกับที่ agent อ่าน ไม่มีสำเนาซ้ำ
- `docs/.obsidian/app.json` ตั้งให้ใช้ลิงก์ markdown มาตรฐานแล้ว (agent ตามลิงก์ `[[wikilink]]` ไม่ได้)
- Mermaid ใน `02-flows.md` แสดงเป็นภาพใน Obsidian ทันที
- บันทึกประชุมดิบ / ความรู้ข้ามโปรเจกต์ เก็บใน vault ส่วนตัวแยกต่างหาก แล้วสรุปเฉพาะที่ agent ต้องใช้เข้ามาใน `docs/`

## ประหยัด token

- กฎที่โหลดทุก session (`AGENTS.md`) เขียนเป็นอังกฤษ เพราะข้อความไทยมักใช้ token มากกว่าเมื่อเทียบความหมายเท่ากัน เนื้อหาที่คุณกรอก (brief, persona, copy บนหน้าจอ) เขียนไทยได้ตามปกติ
- Skill ทุกตัว (ยกเว้น `change-request`, `sso-login`) ตั้ง `disable-model-invocation` ไว้ จึงไม่กิน context จนกว่าคุณจะเรียก
- 1 stage = 1 session แล้ว `/clear` เสมอ ความต่อเนื่องอยู่ใน `PROGRESS.md`
- P1–P4 ใช้ Plan mode และโมเดลตัวแรงได้ (ยังไม่มีโค้ด จึงใช้ token น้อย) ส่วน build ที่ตรงไปตรงมาใช้โมเดลที่เบากว่าได้ (`/model`)
- ตรวจ context ด้วย `/context` ถ้าเกินครึ่งให้ปิดงานย่อยนั้นแล้วเริ่ม session ใหม่

## สิ่งที่ตั้งไว้ให้แล้ว

- `.claude/settings.json` — ห้าม Claude อ่าน `.env`, `.env.local`, `*.pem` และห้ามแก้โค้ดที่ sqlc generate
- `.claude/hooks/format.mjs` — format อัตโนมัติหลัง Claude แก้ไฟล์ (gofmt สำหรับ .go, prettier สำหรับ frontend) ต้องมี Node และ Go ในเครื่อง ถ้าไม่มี hook จะข้ามเงียบๆ ไม่ขัดการทำงาน
- `frontend/.env.development` / `.env.production` — commit ได้ (ไม่มีความลับ) · `backend/.env.example` — copy เป็น `.env` ใช้ในเครื่อง
