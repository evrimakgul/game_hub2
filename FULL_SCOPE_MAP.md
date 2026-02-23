# Full Scope Map

## Goal
Build a web FRP hub for friend-group play first. Keep it extensible for later growth.

## MVP Success Definition
MVP is successful only when one campaign (4-8 players) runs 2 full live sessions with:
- GM invite-only access
- one fixed sheet template
- D10 success rolling
- shared session event feed
- stable save/load between sessions

## Master Priority Order (Architecture + Design)
1. P0 Core Architecture
- Design schema-driven sheets first.
- Bridge ruleset data to sheet behavior with one section spike, then reuse pattern.
- Build ruleset model, storage/versioning, GM APIs, lifecycle, calculations, and SSE updates.
- Run dual-mode (fixed + schema-driven), then remove fixed sheets after schema-driven confirmation.
- Add integration tests.
2. P1 Stability
- Harden validation and continuity.
- Run no-regression tests.
3. Deferred Validation Gate
- Run full `MVP_SESSION_VALIDATION_CHECKLIST.md` after P0 and P1.
4. P2 Rich Session
- Map baseline + first automation helper.
5. P3 Advanced GM Toolkit
- Initiative, encounter, NPC, loot/economy, advanced map-linked combat.
6. P4 Ruleset Expansion
- Multi-ruleset support + stronger publish/version history.
7. P5 Designer Toolkit (Late)
- Unified visual + mechanical designer with validate/preview/publish.

## Current Direction Locks
### Flow/Auth
- Role flow: Connection -> Sign-Up -> Welcome -> Player/Master.
- Email auth is current priority.
- Discord sign-in stays placeholder/deferred for now.

### Character Sheets
- Locked sections: Bio, Combat, Stats, Skills, Powers/Spells, Equipment, Merits/Flaws, Connections, Inventory, Notes.
- Migration rule: dual-mode first, then remove fixed sheets after confirmation.
- Merits/Flaws workflow (planned): section remains locked by default; GM can unlock; player sees an edit action only while unlocked; selectable merits/flaws options come from ruleset definitions (ruleset -> sheet linkage required).

### Mechanics
- D10 baseline: success when `roll >= difficulty`; count multiple successes.
- Keep mechanics extensible.

## Architecture Guardrails
- Keep rules behind `RulesetAdapter`.
- One campaign -> one active ruleset.
- Centralize permission policy.
- Keep typed event stream model (`session`, `chat`, `map`).
- Keep rendering schema-driven and mechanics data-driven.
- Keep async-compatible timestamped event/state persistence.
- Keep API contracts versionable.

## Non-Goals (Now)
- No built-in voice/audio stack.
- No enterprise-grade security target yet.
- No hyperscale performance target.
- No mobile app requirement for scope success.
