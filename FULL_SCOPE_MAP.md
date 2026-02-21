# Full Scope Map

## 1) End Product Goal
Build a web FRP hub where GM and players can run campaign play with private campaign data, live session support, character management, and expandable rulesets.

## 2) MVP Deliverable (First Buildable Target)
One campaign with 4-8 players can run at least 2 full live sessions using:
- GM invite-only access
- Character sheets with role-based visibility
- D10 success-based rolling
- Shared session event feed

## 3) Core Product Areas (End-State Direction)
1. Accounts and Roles
2. Campaign and Membership Management
3. Character Sheets and Progression
4. Session Runtime (dice, events, GM controls)
5. Ruleset Platform (D10 first, others later)
6. Data Reliability (save state, history, restore safety)
7. UX Growth (faster actions, richer controls, drag/drop in later phases)

## 4) Boundaries That Protect Future Changes
- Keep rules logic behind a `RulesetAdapter` interface.
- Keep session events separate from character storage.
- Keep campaign access control separate from rules logic.
- Keep GM/player permissions centralized (single policy layer).
- Keep API contracts stable and versionable for frontend changes.

## 5) What We Explicitly Defer (Not MVP)
- Built-in voice/video
- Advanced map/board VTT features
- Multi-ruleset full parity
- Public campaign discovery
- Heavy automation and drag/drop UX

## 6) Expansion Phases After MVP
1. Stability Phase: better validation, better session recovery, better UX quality.
2. Ruleset Phase: add second ruleset using same adapter contract.
3. Utility Phase: richer GM tools, automation helpers, optional chat/map modules.
4. Scale Phase: multiple campaigns/groups, stronger audit/observability controls.

## 7) Change-Safety Rule (For New Mechanics/Add-ons)
Before adding any new system/mechanic, classify it first:
- Access concern
- Campaign concern
- Character concern
- Session concern
- Ruleset concern

Then implement only inside that module boundary, or define a new boundary if needed.
