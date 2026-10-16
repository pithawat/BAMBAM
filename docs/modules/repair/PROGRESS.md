# ระบบแจ้งซ่อม — Progress

<!-- The module's memory. Agents update it at the end of every task. Keep under ~60 lines. -->

**Phase:** P5 Build   **Stage:** 1–2 of 8 (re-planned by CR-005)   **Updated:** 2026-10-15

## Now

- **CR-006 applied** (inside Stage 2): ผู้ดำเนินการ (ช่างในระบบ / ช่างภายนอก) is chosen at the assessment, resolve only rates the contractor; migration `20261015000002` applied to the dev DB
- **CR-005 APPROVED + applied** (one technician, assess = expected date, contractors, rating required, forward-only send back) — Stages 1 and 2 built by Claude on the real API, **waiting for user acceptance** (no tests this round, user's call)
- `ui/HANDOFF.md` = `BUILT BY CLAUDE — Stages 1–2 (CR-005)`; Codex has nothing to build for Stages 1–2
- **CR-004 PROPOSED** (Home: light blocks) — options in `changes/CR-004/home-options.html`; waiting for the user's pick + approval
- ER diagram: `er-diagram.dbml` (regenerated after CR-005, 21 tables)

## Next

1. User runs the Stage 2 demo script (`03-plan.md`) on the dev DB: apply migrations (`goose … up`, needs a writable DB user — the shared DB returned "read-only transaction"), log in, use the role switcher (พนักงาน → ช่างเทคนิค → Admin)
2. On acceptance: commit, tag `repair-stage-1` + `repair-stage-2`, update `docs/PROJECT.md`; then Stage 3 (admin all-tickets, priority, close) — re-spec S11 first
3. Real seed files (categories + symptoms, the technician account, buildings / floors, assets) — by Stage 8 at the latest

## Done (current stage)

- Backend: migration `20261015000001_repair_cr005` · endpoints 1–19 (assess, resolve, confirm, send-back, contractor types, contractors + jobs) · technician sees all (`scope=all`), contractor name / score staff-only · auto-close worker (start + every 15 min) · `step` derived field + filter + counts
- Frontend: types / api / errors for 9–19; S06 / S07 step labels + forward-only tracker; S07 action bar + dialogs (S17 assess, S08 rate / send back); S09 `/repair/work`; S10 `/repair/tickets/[id]/resolve`; S18 `/repair/contractors[/id]`; nav for technician (sidebar + bottom-nav slot) and admin / executive
- Checks: `go vet`, `go test ./...`, `tsc`, `eslint`, `next build` pass; DBML validated with `@dbml/cli`
- Dev logging: compact text handler in development (`middleware/slog_dev.go`); `SSO_CLOCK_SKEW` (D-037)

## Open issues / questions

- Profile page (S14, `app/(app)/profile/page.tsx`) still shows "หมวดงานที่รับผิดชอบ" for the technician — leftover from before CR-005 (no technician categories, BR-F21-1); remove when touching the profile (settings Stage 1 refactors this page)
- **CR-007 PROPOSED (M)** from the new `settings` module (D-043–D-051): permission checks instead of role names (built in settings Stage 1), buildings / floors move to `platform` (settings Stage 4), contractor type re-activate + audit (settings Stage 5), S12 floor plan button (repair Stage 7) — waiting for approval with the settings plan
- **No tests for CR-005** (assess / resolve / confirm / send back / contractors / auto-close, e2e F02 / F06 / F21 / F07): user skipped them this round — add before UAT (Stage 8 task); existing unit tests were only adjusted
- Mock mode does not cover Stage 2 endpoints (actions, contractors call the API even with `NEXT_PUBLIC_USE_MOCKS=true`)
- Shared dev DB `bam_workspace` (192.168.1.196) rejects DDL ("read-only transaction") — need a writable user / primary host from the DBA before migrations can run
- RMC SSO server clock ~2m11s ahead of NTP (D-037) — ask the SSO team to fix, then drop `SSO_CLOCK_SKEW`
- Admin sidebar "งานทั้งหมด" still points to `/repair/admin/queue` (Stage 3 page, not built)
- Nav item "ติดตามงานซ่อม" is repair-specific; revisit a cross-service name when car / room booking start (CR-003)
- Postgres integration tests not run locally (Docker Desktop engine returned 500); they run in CI
- `teamHandled` is rejected for everyone (403) until Stage 4; `assetCode` is stored but `asset` stays null until Stage 5
- Photo 10 MB limit is checked on the resized file (client) and on the upload (server); `_common.md` §5 proposed "before resize" — confirm
- HEIC uploads have no server thumbnail (original served as thumb)
- Search `q` uses ILIKE without a trigram index — fine at phase-1 volume
- Persona details (✏️ in 01-users.md) — non-blocking
- S12: confirm floor count / names / rear building before Stage 7 (`attachments/cpac-building.png`)
- Deploy target for UAT / production (persistent volume for `PHOTO_STORAGE_DIR`, backups)
- Stage 5: QR decoder library (BarcodeDetector + fallback proposed)

## Stage log

- P1 approved 2026-10-14 (+CR-001) · P2 approved 2026-10-14 (D-018) · P3 approved 2026-10-14 (D-019, D-020) · P4 approved 2026-10-14 (D-021–D-025) · Stage 0 platform accepted 2026-10-14, tag `platform-stage-0` (D-026–D-031)
- Stage 1 built 2026-10-14 (+CR-002, CR-003) · CR-005 approved + applied 2026-10-15 (D-038–D-041): re-plan, Stage 1 rework + Stage 2 built
- 2026-10-16: docs catch-up — `01-users.md` personas + permission matrix and 3 leftover lines in `02-flows.md` now match the CR-005 / CR-006 code
