# Milestones

Use tags as rollback checkpoints.

## Rollback Pattern
```powershell
git switch -c restore/<short-name> <tag>
```

## Milestone Log
| Tag | Date | Summary | Rollback |
|---|---|---|---|
| `milestone-00-bootstrap` | 2026-02-21 | Git + GitHub bootstrap | `git switch -c restore/milestone-00 milestone-00-bootstrap` |
| `milestone-01-scope-map` | 2026-02-21 | Full scope map created | `git switch -c restore/milestone-01 milestone-01-scope-map` |
| `milestone-02-full-scope-lock` | 2026-02-21 | Scope decisions locked | `git switch -c restore/milestone-02 milestone-02-full-scope-lock` |
| `milestone-03-mvp-foundation` | 2026-02-21 | MVP foundation implemented | `git switch -c restore/milestone-03 milestone-03-mvp-foundation` |
| `milestone-04-designer-scope` | 2026-02-21 | Designer toolkit scope added | `git switch -c restore/milestone-04 milestone-04-designer-scope` |
| `milestone-05-session-controls` | 2026-02-21 | Session state controls added | `git switch -c restore/milestone-05 milestone-05-session-controls` |
| `milestone-06-dashboard-flow` | 2026-02-21 | Dashboard summary/filter improvements | `git switch -c restore/milestone-06 milestone-06-dashboard-flow` |
| `milestone-07-chat-basics` | 2026-02-21 | Public/private chat baseline | `git switch -c restore/milestone-07 milestone-07-chat-basics` |
| `milestone-08-live-polling` | 2026-02-21 | Auto-refresh polling added | `git switch -c restore/milestone-08 milestone-08-live-polling` |
| `milestone-09-polling-fix` | 2026-02-21 | Polling reliability fix | `git switch -c restore/milestone-09 milestone-09-polling-fix` |
| `milestone-10-abc-direction-lock` | 2026-02-21 | Direction locks captured | `git switch -c restore/milestone-10 milestone-10-abc-direction-lock` |
| `milestone-11-role-flow-ui` | 2026-02-21 | Role-based flow UI built | `git switch -c restore/milestone-11 milestone-11-role-flow-ui` |
| `milestone-12-sse-sheet-validation` | 2026-02-21 | SSE + sheet scaffold + validation checklist | `git switch -c restore/milestone-12 milestone-12-sse-sheet-validation` |
