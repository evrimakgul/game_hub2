# Milestones

Use this file to choose rollback points quickly.

## Legend
- `tag`: named snapshot of project history.
- `rollback`: opening that snapshot in a new branch.

## Milestone Log

### milestone-00-bootstrap
- Date: 2026-02-21
- Commit: `0f87a87`
- What was done:
  - Local Git repository initialized on `main`.
  - GitHub remote connected and first push completed.
  - Daily commit workflow and tracking files added (`AGENTS.md`, `LEARNING_NOTES.md`, `TODO.md`, `WORKFLOW.md`).
- Rollback command:
```powershell
git switch -c restore/milestone-00 milestone-00-bootstrap
```

### milestone-01-scope-map
- Date: 2026-02-21
- Commit: `ec91928`
- What was done:
  - Full end-product scope map added (`FULL_SCOPE_MAP.md`).
  - MVP boundaries and deferred scope were made explicit to avoid architecture dead-ends.
  - Core module boundaries and change-safety rule were defined for future add-ons/mechanics changes.
- Rollback command:
```powershell
git switch -c restore/milestone-01 milestone-01-scope-map
```

### milestone-02-full-scope-lock
- Date: 2026-02-21
- Commit: `35b4ae4`
- What was done:
  - Full-scope Q&A decisions were locked into `FULL_SCOPE_MAP.md`.
  - End-product direction now includes map, text chat (public/private), animations, and automation in later phases.
  - Ruleset strategy was finalized: one ruleset per campaign, many rulesets over time, GM ruleset creator as a late milestone.
  - Async play was left as an open future door, with realtime as primary mode.
- Rollback command:
```powershell
git switch -c restore/milestone-02 milestone-02-full-scope-lock
```

### milestone-03-mvp-foundation
- Date: 2026-02-21
- Commit: `5a5bee5`
- What was done:
  - Implemented MVP foundation code in `apps/api` and `apps/web`.
  - Added auth, campaign/invite flow, role-based sheet visibility, D10 roll engine, and session event feed.
  - Added JSON persistence and automated API tests (3 scenario tests passing).
  - Added workspace package setup and run/test instructions in `README.md`.
- Rollback command:
```powershell
git switch -c restore/milestone-03 milestone-03-mvp-foundation
```

### milestone-04-designer-scope
- Date: 2026-02-21
- Commit: `f113f98`
- What was done:
  - Locked a new end-product requirement: unified designer toolkit.
  - Defined two designer capabilities: graphical character-sheet layout design and mechanical rules/mechanics design.
  - Marked this toolkit as explicitly non-MVP and late-phase.
  - Added architecture guardrails so this can be added later without rebuilding core modules.
- Rollback command:
```powershell
git switch -c restore/milestone-04 milestone-04-designer-scope
```

### milestone-05-session-controls
- Date: 2026-02-21
- Commit: `a3c1f3a`
- What was done:
  - Added session state controls to the web UI (idle/active/paused/ended).
  - Added API test that confirms only GM can change session state.
  - Added route list in `README.md` for easier API navigation.
- Rollback command:
```powershell
git switch -c restore/milestone-05 milestone-05-session-controls
```
