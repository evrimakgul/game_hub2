# Full Scope Map

## 1) Product Goal
Build a web FRP hub for your own group first, with room for new friends later.
Commercial potential is allowed, but it is not a scope-success criterion.

## 2) MVP Success Definition
MVP is successful when one campaign (4-8 players) can run at least 2 full live sessions with:
- GM invite-only campaign access
- One fixed character sheet template
- D10 success-based rolling
- Shared session event feed
- Stable save/load between sessions

## 3) End-Product Feature Direction
1. Campaign Hub
- Campaign creation, membership, role control, multi-campaign support.
2. Character System
- MVP: one template.
- End state: customizable per campaign/ruleset.
3. Session Runtime
- Realtime as primary mode.
- Async option remains possible (not mandatory now).
4. Communication
- Text chat with public and private channels.
- No Discord-like built-in voice/audio.
5. Map and Visual Layer
- Interactive map tools.
- Sound and visual animation support.
6. Automation
- Rule-aware helpers and combat/session automation.
7. GM Toolkit
- Initiative tracker
- Encounter builder
- NPC manager
- NPC creator
- Loot/economy helpers
- Advanced combat manager with map interactions (long-term target)
8. Ruleset Platform
- One ruleset per campaign.
- D10 first.
- Many rulesets supported over time.
- End state includes GM/DM ruleset creation toolkit.
9. Data and Ownership
- Players can export their own data/sheets.

## 4) Scope Constraints and Non-Goals
- Security level target: basic (not enterprise-grade initially).
- Mobile app is optional, not required for scope success.
- Performance target is practical for friend-group scale, not hyperscale.

## 5) Scale Target (Near-to-Mid Horizon)
- Several active campaigns is expected.
- Mostly concurrent users in live sessions.
- New users should be easy to onboard.

## 6) Architecture Guardrails (to Prevent Future Dead-Ends)
- Keep rules logic behind a `RulesetAdapter` contract.
- Keep one campaign -> one active ruleset assignment.
- Keep permission policy centralized for GM/player boundaries.
- Keep session events, chat, and map events as separate event types in the same event stream model.
- Keep character template/rendering separate from rules calculation.
- Keep API contracts versionable to avoid breaking future clients.
- Keep async compatibility door open by storing timestamped session events and resumable state.

## 7) Delivery Strategy by Phases
1. MVP Phase
- Core manager, sheets, D10 rolls, session feed, reliability basics.
2. Stabilization Phase
- Better validation, error handling, and session continuity.
3. Rich Session Phase
- Text chat, map baseline, first automation helpers.
4. Advanced GM Phase
- Encounter/NPC/combat management depth and map-linked control.
5. Ruleset Expansion Phase
- Additional rulesets and GM ruleset creation toolkit.

## 8) Change-Safety Rule
Before any new add-on/mechanic/system change, classify it first:
- Access
- Campaign
- Character
- Session
- Ruleset
- Map/Visual
- Chat

Then implement only within that boundary, or define a new boundary intentionally.
