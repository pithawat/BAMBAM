# ระบบแจ้งซ่อม — Progress

<!-- The module's memory. Agents update it at the end of every task. Keep under ~60 lines. -->

**Phase:** P5 Build   **Stage:** 1 of 9   **Updated:** 2026-10-14

## Now

- P4 APPROVED 2026-10-14: `03-plan.md` (Stages 1–9), `04-api-contract.md` (27 repair + 7 platform endpoints)
- Decisions D-021 UUID ids · D-022 photo storage (local dir, 10 MB, client resize) · D-023 platform screens (S01/S14/S15 + AppShell in Stage 0; S02/S13 in Stage 7) · D-024 QR URL · D-025 dnd-kit + SVG 3D
- `ui/HANDOFF.md` Stage column filled; `docs/shared/00-platform.md` checklist extended with S01/S14/S15/AppShell/shared components
- Stage 1 prepare in progress (branch `repair/stage-1`)

## Next

1. `/build-stage repair 1 prepare` → Codex builds S03, S05, S06, S07 → `/build-stage repair 1 wire`
2. Real seed files (categories + symptoms, technician ↔ category, buildings/floors, assets) — by Stage 9 at the latest

## Done (current stage)

- P1 flows, P2 style, P3 UI spec (S01–S16 + `_common.md` + 5 mockups), P4 plan + contract — all approved 2026-10-14

## Open issues / questions

- Persona details (✏️ in 01-users.md) — non-blocking
- Seed data: real files pending; sample data from `ui/screens/_common.md` §8 until then
- S12: confirm floor count / names / rear building before Stage 8 (`attachments/cpac-building.png`)
- Deploy target for UAT / production (persistent volume for `PHOTO_STORAGE_DIR`, backups)
- Stage 6: QR decoder library (BarcodeDetector + fallback proposed)

## Stage log

- P1 approved 2026-10-14 (+CR-001) · P2 approved 2026-10-14 (D-018) · P3 approved 2026-10-14 (D-019, D-020) · P4 approved 2026-10-14 (D-021–D-025) · Stage 0 platform accepted 2026-10-14, tag `platform-stage-0` (D-026–D-031)
