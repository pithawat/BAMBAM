@AGENTS.md

## Claude-specific

- Workflow skills (run as slash commands, in order):
  `/new-module <m>` → `/discovery <m>` → `/style-options` (once per project) → `/ui-spec <m>` → `/stage-plan <m>` → `/platform-setup` (once per project, before the first build) → `/build-stage <m> <n> prepare` → (Codex builds UI) → `/build-stage <m> <n> wire` → `/accept-stage <m> <n>`
  Any change to approved docs: `/change-request <m> "<what changed>"`
  System Atlas (`docs/atlas`): `/atlas sync <m>` after a stage is accepted or a CR is applied; `/atlas tour <m> <flow>` once a flow is accepted in every stage
- Use Plan mode for P1–P4 (no code is written in those phases).
- Use AskUserQuestion for interviews: max 4 questions per round, offer concrete options.
- Prefer subagents for wide searches so the main context stays small.
