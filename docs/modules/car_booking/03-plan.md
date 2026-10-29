# ระบบจองรถ — Build plan

Status: DRAFT

<!-- Written by Claude in /stage-plan. Stages are vertical slices that can be demoed.
     Each stage should fit in one focused session (Claude part + Codex part). -->

## Stages

| Stage | Goal (demoable) | Flows | Screens | Status |
|---|---|---|---|---|
| 1 | | F01 (happy path) | S01, S02 | pending |
| 2 | | | | pending |

---

## Stage 1 — <goal>

**Scope**
- Flows: F01 happy path
- Screens: S01, S02
- Out of this stage:

**Backend (Claude)**
- [ ] Migration:
- [ ] Queries:
- [ ] Service rules: BR-F01-1 …
- [ ] Endpoints (see 04-api-contract.md):
- [ ] Tests:

**Frontend contract (Claude)**
- [ ] `types.ts`, `mocks.ts`, `api.ts` for the endpoints above
- [ ] `ui/HANDOFF.md` updated for this stage

**Frontend UI (Codex)**
- [ ] S01
- [ ] S02

**Wiring + e2e (Claude)**
- [ ] Real API connected, mocks off
- [ ] `e2e/<m>/F01-*.spec.ts`

**Acceptance criteria** (each must be checkable)
- [ ] AC1:
- [ ] AC2:

**Demo script**
1.
