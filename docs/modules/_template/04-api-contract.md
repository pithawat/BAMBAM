# <Module name> — API contract

Status: DRAFT

<!-- Written by Claude in /stage-plan. Single source for backend DTOs and frontend types.ts.
     Conventions (envelope, errors, dates, pagination): docs/shared/architecture.md -->

## Endpoints

| Method | Path | Purpose | Roles | Stage |
|---|---|---|---|---|
| GET | `/api/v1/<m>/items` | list | | 1 |

---

### GET /api/v1/<m>/items

Query: `page`, `pageSize`, `q`, `sort`

Response 200
```json
{
  "data": [{ "id": "", "createdAt": "2026-10-13T03:00:00Z" }],
  "meta": { "page": 1, "pageSize": 20, "total": 0 }
}
```

Errors
| Status | code | When |
|---|---|---|
| 403 | `FORBIDDEN` | |

## Error codes (module-wide)

| code | Meaning | Thai message (shown in UI) |
|---|---|---|
| | | |
