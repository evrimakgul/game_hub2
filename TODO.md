# Project TODO

## Current
- [x] Initialize local Git repository (`main` branch).
- [x] Create GitHub repository and add `origin` remote.
- [x] Push `main` to GitHub.
- [ ] Commit and push at least once per day.
- [x] Create first milestone tag (`milestone-00-bootstrap`).
- [x] Create planning milestone tag (`milestone-01-scope-map`).
- [x] Create full-scope lock milestone tag (`milestone-02-full-scope-lock`).
- [x] Create MVP foundation milestone tag (`milestone-03-mvp-foundation`).
- [x] Create designer scope milestone tag (`milestone-04-designer-scope`).
- [x] Create session controls milestone tag (`milestone-05-session-controls`).
- [x] Create dashboard flow milestone tag (`milestone-06-dashboard-flow`).
- [x] Create chat basics milestone tag (`milestone-07-chat-basics`).
- [x] Create live polling milestone tag (`milestone-08-live-polling`).
- [x] Create polling reliability milestone tag (`milestone-09-polling-fix`).
- [x] Create A/B/C direction lock milestone tag (`milestone-10-abc-direction-lock`).
- [x] Create role-based flow milestone tag (`milestone-11-role-flow-ui`).
- [x] Create SSE/sheet/validation milestone tag (`milestone-12-sse-sheet-validation`).
- [x] Lock unified designer toolkit as end-product scope (`FULL_SCOPE_MAP.md`).
- [x] Create milestone tracking file with plain-language summaries (`MILESTONES.md`).
- [ ] Create milestone tags at key checkpoints.
- [x] If/when a second top-level folder is added, create and save a VS Code workspace.
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

## MVP Polishing Tasks
- [x] Add GM session-state control flow (UI + API test coverage + route docs).
- [x] Improve campaign dashboard flow (summary API, member/invite visibility, event filtering).
- [x] Add basic text chat (public/private) with access-safe API and UI.
- [x] Improve private chat UX with member recipient pickers (Player + Master forms).
- [x] Add quick event filter buttons and selected-campaign highlighting in Player/Master lists.
- [x] Add auto-refresh polling for events/chat during live sessions.
- [x] Add stricter roll input validation (`pool`/`difficulty`) with 400-level API errors and tests.
- [x] Make Master dashboard actions usable (active/passive game views, ruleset usage view, local ruleset drafts panel).

## Next Tasks
- [ ] Complete MVP validation by running 2 full real sessions with your group.
- [ ] Use `MVP_SESSION_VALIDATION_CHECKLIST.md` while running those 2 sessions.
- [x] Replace polling with server-push realtime updates (WebSocket or SSE).

## Direction-Locked Implementation Tasks
- [x] Lock A/B/C direction decisions in project docs (`A_B_C_DIRECTION_LOCK.md`).
- [x] Build role-based page flow: Connection -> Sign-Up Info -> Welcome -> Player/Master branches.
- [x] Implement separate Player and Master views.
- [x] Build Master Dashboard shell with locked options.
- [x] Start character sheet redesign by adding the 10 locked sections (layout first).
- [x] Keep D10 baseline mechanics (`roll >= difficulty`, count successes) while preparing extension hooks.
