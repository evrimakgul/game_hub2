# Project TODO

## Current
- [x] Initialize local Git repository (`main` branch).
- [x] Create GitHub repository and add `origin` remote.
- [x] Push `main` to GitHub.
- [ ] Commit and push at least once per day.
- [x] Create first milestone tag (`milestone-00-bootstrap`).
- [x] Create planning milestone tag (`milestone-01-scope-map`).
- [x] Create full-scope lock milestone tag (`milestone-02-full-scope-lock`).
- [x] Create milestone tracking file with plain-language summaries (`MILESTONES.md`).
- [ ] Create milestone tags at key checkpoints.
- [ ] If/when a second top-level folder is added, create and save a VS Code workspace.
- [x] Define project scope and first deliverable (`FULL_SCOPE_MAP.md`).
- [x] Lock full-scope feature decisions from Q&A (`FULL_SCOPE_MAP.md`).
- [x] Break first deliverable into small implementation tasks.

## MVP Build Tasks
- [x] Scaffold project structure (`apps/api`, `apps/web`) and root workspace scripts.
- [x] Implement API auth basics (register/login + bearer auth middleware).
- [x] Implement campaign model (create campaign, invite token, accept invite).
- [x] Implement role policy (GM sees all sheets, player sees own sheet).
- [x] Implement fixed character sheet template (MVP v1).
- [x] Implement D10 success roll endpoint through `RulesetAdapter`.
- [x] Implement session event feed (rolls + sheet updates + membership events).
- [x] Implement persistence for save/load continuity between sessions.
- [x] Build minimal web UI for login, campaign creation, sheet view, and dice rolls.
- [x] Add automated API tests for core MVP scenarios.
- [x] Write run/setup instructions in `README.md`.
