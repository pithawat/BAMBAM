# DECISIONS.md

<!-- Append-only. One line per decision. Agents add to this; humans can too.
     Format: D-### | YYYY-MM-DD | module (or "all") | decision | why -->

| ID | Date | Module | Decision | Why |
|---|---|---|---|---|
| D-001 | | all | Use sqlc + pgx instead of GORM | Explicit, reviewable SQL; compile-time type safety; no AutoMigrate in production |
| D-002 | | all | One Postgres schema per module | Hard boundary between the systems in this repo |
