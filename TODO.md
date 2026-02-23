# Project TODO (Master Priority Outline)

## P0 Core Architecture (Now)
- [x] Design schema-driven sheet v1 (10 sections, fields, validation).
- [ ] Bridge one section from ruleset data to sheet behavior, then lock reuse pattern.
- [ ] Merits/Flaws ruleset-bridge spike: GM unlocks section, player gets edit button + ruleset-driven dropdown choices, lock back after submit/approval flow.
- [ ] Define ruleset model v1 aligned to sheet design.
- [ ] Add ruleset storage/versioning (one active ruleset per campaign).
- [ ] Build GM ruleset create/edit APIs with centralized permission checks.
- [ ] Implement ruleset lifecycle: draft -> validate -> activate.
- [ ] Implement rules calculations (derived fields, checks, effect resolution).
- [ ] Run dual-mode sheets (fixed + schema-driven) until confirmed.
- [ ] Remove fixed-sheet path after schema-driven confirmation.
- [ ] Push ruleset changes live to sheets via SSE.
- [ ] Add integration tests (ruleset -> sheet -> SSE).
- [ ] Create tag `milestone-13-core-ruleset-foundation` + update `MILESTONES.md`.

## P1 Stability
- [ ] Harden validation/error messages.
- [ ] Add reconnect/resume continuity pass.
- [ ] Re-run no-regression API tests.

## Deferred Validation Gate (After P0 + P1)
- [ ] Run full `MVP_SESSION_VALIDATION_CHECKLIST.md` (2 sessions).
- [ ] Fix blocker issues found.

## P2 Rich Session
- [ ] Add map baseline events.
- [ ] Add first rule-aware automation helper.

## P3 Advanced GM Toolkit
- [ ] Initiative, encounters, NPC manager/creator, loot/economy, advanced map combat.

## P4 Ruleset Expansion
- [ ] Multi-ruleset support with stronger publish/version history.

## P5 Designer Toolkit (Late)
- [ ] Unified visual + mechanical designer with validation/preview/publish.

## Ops (Recurring)
- [ ] Commit/push at least daily.
- [ ] Tag milestones and log them in `MILESTONES.md`.

## Done
- [x] MVP foundation + polishing baseline.
- [x] Milestones `milestone-00-bootstrap` to `milestone-12-sse-sheet-validation`.
