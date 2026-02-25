# Rebuild Summary and Reproduction Guide (Backend + Frontend)

Purpose:
- This document is a full handoff and rebuild guide.
- It is written so another ChatGPT session (or any LLM) can reproduce the implemented work from scratch.
- It is also written for humans who need a precise summary of what exists and what direction to continue.

Scope:
- Backend (`apps/api`)
- Frontend (`apps/web`)
- XP buy request -> GM approval flow
- Character sheet numeric model (`current / base / bonus`)
- GM session XP assignment/apply workflow
- Related fixes (realtime refresh, session-state gating, draft safety, character deletion UI)

Important:
- This document separates `implemented behavior` from `future direction`.
- Treat anything described as `implemented` as code that currently exists.
- Treat anything described as `future`, `next`, or `direction` as not guaranteed to be implemented yet.

## 1. Model-Safe Reading Rules (For LLM Continuations)

Use these rules when continuing from this document:

- Do not infer hidden behavior from UI labels. Verify backend route behavior and guards.
- Keep these distinctions explicit:
  - local UI draft (unsent)
  - pending XP buy request (server record)
  - approved XP buy entries (ledger rows)
- Keep these definitions explicit:
  - `base` = progression/derived non-bonus value
  - `bonus` = modifier sum (positive or negative)
  - `current` = `base + bonus`
- Use exact session state values only:
  - `active-live`
  - `active-offline`
  - `archived`
- Assume compatibility matters unless user explicitly asks to break API contracts.
- Prefer incremental changes and verify after each change.

## 2. Definitions (Required Vocabulary)

### 2.1 Role vs Character

- `GM`: campaign member with Game Master permissions.
- `PLAYER`: campaign member with player permissions.
- `Character`: character sheet record tied to a `campaignId` and `userId`.

Important:
- Role is not the same thing as a character record.
- A GM can currently end up with a character record because some backend flows auto-create a character for `characters/me` requests.

### 2.2 XP Workflow Terms

- `Session XP`: XP awarded during/after a game session.
- `XP Buy`: a progression change that spends XP (or earns XP in flaw cases).
- `XP Buy Entry`: persisted ledger row for an applied XP buy.
- `XP Buy Request`: player-submitted request awaiting GM decision.
- `XP Correction`: GM correction flow for XP buy entries.

### 2.3 Numeric Triple Terms

- `Base`: progression-derived or formula-derived value before modifiers.
- `Bonus`: sum of all active modifiers for that field.
- `Current`: final active value shown to user, computed as `Base + Bonus`.

### 2.4 UI Draft Terms

- `Staged Changes`: local unsent XP draft built via `+/-` buttons.
- `Revert Staged Changes`: clears only the local draft; does not undo server-approved changes.

## 3. Current Implemented Product Rules

These are intentional and already implemented.

### 3.1 XP Buy Access Rule

XP buy workflow is available only when session state is `active-offline`.

This applies to:
- stat/skill `+/-` staging
- power/merit/flaw request submission
- GM approval of XP buy requests

### 3.2 Pending Request Safety Rule

GM cannot switch session state to `active-live` while any XP buy request in that campaign is still `PENDING`.

Backend response:
- `400`
- message equivalent to: `Cannot change session state to active-live while XP buy requests are pending.`

### 3.3 Player Draft Safety Rule

If session state leaves `active-offline`:
- unsent local staged XP changes are automatically cleared in the player UI.

### 3.4 Player XP Budget Rule (Stats/Skills Drafting)

Player cannot stage stat/skill increases beyond available XP left over.

UI behavior:
- `+` button disables when next staged increase would exceed XP budget.
- Staging logic also rejects over-budget attempts if triggered programmatically.

### 3.5 XP Approval Rule

- Player submits XP request to GM.
- GM approves or denies.
- Approval creates real XP buy entries and updates character progression.
- Denial changes request status only.

### 3.6 Numeric Field Rule (`current/base/bonus`)

For supported numeric fields:
- `current = base + bonus`
- `base` is the XP/progression or formula-driven value
- `bonus` can be positive or negative

Current UI coverage:
- Combat (triplet shown; no XP buttons)
- Stats (triplet shown; `+/-` on Base)
- Skills (triplet shown; `+/-` on Base)

## 4. What Was Implemented (Detailed, Current State)

### 4.1 Backend OOP-Oriented Refactor (Partial but Working)

The backend was refactored into layered components around character/mechanics flows:
- controllers (HTTP mapping)
- services (business logic / use cases)
- repositories (store array access)
- domain policies/factories
- ruleset registry + adapter seam

Important caveat:
- `apps/api/src/rulesets.js` still contains a large amount of D10 logic in mostly functional style.
- The OOP split of D10 internals is not complete.

### 4.2 XP Buy Request -> GM Approval Workflow

Implemented end-to-end:
- Player submits XP request (`PENDING`)
- GM lists requests and approves/denies
- Approval revalidates request and creates real XP buy entries
- Realtime event emitted and UI refreshes character data

### 4.3 Character Numeric Triples (`numericBonuses`, `numericTriples`)

Backend now exposes separate bonus/triple data and applies `current` values to the displayed sheet sections.

Result:
- UI can show `Current / Base / Bonus`
- backend keeps a path for future buff/debuff systems

### 4.4 Player Draft-Based XP UI

Player stats/skills no longer immediately call the legacy XP-buy endpoint.

Instead:
- `+/-` changes are staged locally
- player submits staged draft as request
- GM approves/denies

### 4.5 GM Session XP Assign + Apply

GM UI now has a `Session XP` amount input and can apply that amount directly to the selected character.

If the GM leaves the input empty:
- backend falls back to character `bioSessionXp` (legacy-compatible behavior)

### 4.6 GM Character Delete Action

GM can delete selected character from `Character Actions (GM)`.

Deletion includes cleanup of related XP records/requests/corrections for that character and emits a `CHARACTER_DELETED` event.

### 4.7 Realtime Character Refresh Fix

SSE session events now trigger silent character reloads for important event types (not only event/chat/timeline refresh).

This fixes stale UI after XP approval and other character-affecting actions.

### 4.8 Feed Ordering and Default Counts

Implemented frontend display changes:
- Events: latest first
- Chat: latest first
- Timeline: latest first (already sorted this way)
- Default visible count = `9` for player and master events/chat/timeline

## 5. Current Direction (What To Build Next)

This is the current direction, not all of it is implemented yet.

### 5.1 Backend Direction

- Continue OOP refactor on backend.
- Keep `apps/api/src/app.js` as composition root + minimal legacy route area.
- Split D10 internals in `apps/api/src/rulesets.js` into smaller classes behind stable adapter facade.

### 5.2 Frontend Direction

- Continue spreadsheet-like character sheet behavior.
- Extend `current/base/bonus` UI to powers (Section 6) with per-power rows.
- Later add modifier source management (buff/debuff entries -> aggregated `bonus`).

### 5.3 Workflow Direction

- Keep session-state-based XP workflow gating (`active-offline`) as primary rule.
- Keep GM approval for player XP requests.
- Avoid returning to per-section lock/unlock UX for this XP flow.

## 6. Backend Rebuild Guide (From Scratch)

This section explains how to rebuild the backend changes in a safe order.

### 6.1 Backend Prerequisites and Constraints

Stack assumptions:
- JavaScript (ESM)
- Express
- JSON-backed store (`JsonStore`)
- Vitest integration tests

Constraints:
- Preserve HTTP endpoint paths and response shapes unless user explicitly requests changes.
- Preserve `store.update(mutator)` transaction pattern for now.
- Prefer adding wrapper abstractions around existing behavior rather than rewriting everything at once.

### 6.2 Backend Layered Structure (Implemented)

Added/organized layers:

- `apps/api/src/http/`
  - `asyncHandler.js`
  - `httpError.js`
  - controllers
  - route registrars

- `apps/api/src/services/`
  - feature use-case services
  - shared orchestration support object
  - event/realtime services

- `apps/api/src/repositories/`
  - wrappers around store arrays
  - transaction runner

- `apps/api/src/domain/`
  - policies and factories

- `apps/api/src/rulesets/`
  - registry seam + D10 adapter wrapper seam

### 6.3 Key Backend Files and Responsibilities

#### HTTP Layer

- `apps/api/src/http/asyncHandler.js`
  - async route wrapper
- `apps/api/src/http/httpError.js`
  - normalized HTTP errors

Controllers (HTTP mapping only):
- `CharacterCatalogController.js`
- `CharacterController.js`
- `MechanicsController.js`
- `SectionLockController.js`
- `XpCorrectionController.js`
- `XpBuyRequestController.js`

Controller responsibilities:
- parse `req.params`, `req.body`, `req.query`
- call service methods
- publish realtime events if service returns one
- send response status/body

#### Services Layer

Character services:
- `CharacterCatalogService`
- `CharacterSheetService`
- `SectionLockService`
- `CharacterMechanicsSupport` (shared support/orchestration helper)

Mechanics services:
- `XpBuyService`
- `XpBuyRequestService`
- `XpSessionService`
- `XpCorrectionService`
- `GameSessionService`
- `DiceRollService`

Event services:
- `SessionEventService`
- `RealtimeHub`

Service responsibilities:
- authorization and business rules (often via support/policies)
- transactions (`StoreTransactionRunner`)
- data writes
- event emission payload creation

#### Repositories Layer

Repositories introduced:
- `CampaignRepository`
- `CharacterRepository`
- `MembershipRepository`
- `UserRepository`
- `SessionEventRepository`
- `XpLedgerRepository`
- `XpCorrectionRepository`
- `XpBuyRequestRepository`
- `StoreTransactionRunner`

Repository responsibilities:
- hide direct array filtering/mutations
- provide consistent sorting and lookup behavior

#### Domain Layer

Policies/factories introduced:
- `CharacterAccessPolicy`
- `CharacterRecordFactory`
- `SectionLockState`
- `CampaignSessionStatePolicy`
- `XpBuyEntryCorrectionPolicy`

Purpose:
- move policy logic out of routes and services where possible
- make authorization and rule checks explicit and reusable

### 6.4 Route Composition (Character + Mechanics)

Create a route registrar:
- `registerCharacterMechanicsRoutes({ app, auth, store, realtimeHub })`

Inside, build controllers through a composition function (example pattern used):
- `createCharacterMechanicsControllers({ store, realtimeHub })`

Composition sequence:
1. Create `StoreTransactionRunner`
2. Create ruleset registry (`createDefaultRulesetRegistry()`)
3. Create policies and support object
4. Create event service(s)
5. Create feature services
6. Create controllers
7. Register routes

### 6.5 Character/Mechanics Endpoints (Implemented Set)

Character / catalog endpoints:
- `GET /api/v1/campaigns/:campaignId/characters/schema`
- `GET /api/v1/campaigns/:campaignId/characters/powers/catalog`
- `GET /api/v1/campaigns/:campaignId/characters/merits-flaws/catalog`
- `GET /api/v1/campaigns/:campaignId/characters`
- `GET /api/v1/campaigns/:campaignId/characters/:characterId`
- `PUT /api/v1/campaigns/:campaignId/characters/me`
- `DELETE /api/v1/campaigns/:campaignId/characters/:characterId` (GM-only; added)

XP / mechanics endpoints:
- `POST /api/v1/campaigns/:campaignId/characters/me/xp/buys` (legacy immediate path still present)
- `POST /api/v1/campaigns/:campaignId/characters/me/xp/buy-requests`
- `GET /api/v1/campaigns/:campaignId/xp/buy-requests`
- `POST /api/v1/campaigns/:campaignId/xp/buy-requests/:requestId/approve`
- `POST /api/v1/campaigns/:campaignId/xp/buy-requests/:requestId/deny`
- XP correction routes
- Session XP claim/apply routes
- Game session advance route
- Dice roll route

### 6.6 Store and Data Model Changes (Backend)

#### 6.6.1 Store Top-Level Additions

In `apps/api/src/store.js`, add and normalize:
- `xpBuyRequests: []`

Also ensure on load/normalize:
- `character.numericBonuses` exists and is an object

#### 6.6.2 Normalized Character Response Additions

Character responses may now include:
- `numericBonuses`
- `numericTriples`
- `xpBuyStatus`

`xpBuyStatus` shape includes:
- `lockedBySessionState`
- `frozenByPendingCorrection`
- `canBuy`

### 6.7 XP Buy Request Workflow (Backend Implementation)

#### 6.7.1 Repository: `XpBuyRequestRepository`

Required methods used:
- `ensureStore()`
- `add(request)`
- `findById({ campaignId, requestId })`
- `listByCampaign({ campaignId, status, characterId, playerUserId })`

Sorting behavior:
- newest first by `createdAt`

#### 6.7.2 Service: `XpBuyRequestService`

Main methods:
- `createRequestForSelf(...)`
- `listRequests(...)`
- `approveRequest(...)`
- `denyRequest(...)`

Key logic for create:
- require campaign and membership
- require `active-offline`
- ensure own character exists
- reject if pending XP correction exists for character
- validate and price each action via ruleset adapter
- build preview receipts
- save request as `PENDING`
- emit `XP_BUY_REQUEST_CREATED`

Key logic for approve:
- require GM membership
- require `active-offline`
- require request status `PENDING`
- revalidate each action at approval time (do not trust preview only)
- create real XP buy entries
- update request status to `APPROVED`
- store applied entry ids / receipts
- emit `XP_BUY_REQUEST_APPROVED`

Key logic for deny:
- require GM membership
- require request status `PENDING`
- set status `DENIED`
- emit `XP_BUY_REQUEST_DENIED`

### 6.8 Numeric `current/base/bonus` Support (Backend)

Implemented in D10 normalization path (`apps/api/src/rulesets.js`):
- normalize bonus map
- build numeric triples from derived sections/progression
- apply `current` values back to displayed sheet sections

Conceptual data flow:
1. derive progression
2. derive base sheet sections
3. build `numericTriples` (`base`, `bonus`, `current`)
4. apply `current` to displayed sheet values
5. return normalized character with triples/bonuses included

Result:
- UI can render triplets without changing existing sheet field names everywhere

### 6.9 Session State Enforcement (Backend)

#### 6.9.1 Session policy helper

`CampaignSessionStatePolicy` centralizes:
- parsing aliases
- normalization
- `assertNotActiveLive(...)`
- `assertActiveOffline(...)`

#### 6.9.2 Block `active-live` when pending XP requests exist

In session state route (`apps/api/src/app.js`):
- before setting `target.sessionState = state`
- if `state === "active-live"`, scan `data.xpBuyRequests` for pending records in campaign
- reject if any exist

#### 6.9.3 Legacy section locks and workflow direction

Compatibility note:
- section-lock endpoints still exist
- current workflow direction is session-state gating for XP buys
- legacy immediate XP buy path no longer enforces power/merit section lock in the chosen workflow direction

### 6.10 Session XP GM Override (Assign + Apply)

Problem solved:
- GM needed to assign Session XP from the master dashboard before applying

Backend change:
- allow selected-character session XP claim endpoint to accept optional `{ xp }`
- controller passes `req.body.xp`
- `XpSessionService.claimForCharacter(..., options)` reads override
- if override present, validate positive integer and use it
- otherwise, use `bioSessionXp` on character as fallback

### 6.11 Character Delete Endpoint (GM-Only)

Implemented endpoint:
- `DELETE /api/v1/campaigns/:campaignId/characters/:characterId`

Authorization:
- GM membership required

Deletion cleanup includes:
- character record
- XP buy entries for that character
- XP buy corrections for that character
- XP buy requests for that character
- session award entries referencing that `characterId`

Event emitted:
- `CHARACTER_DELETED`

### 6.12 Backend Rebuild Validation

Required command:
- `npm --workspace @gamehub/api test`

Expected result at handoff time:
- backend tests pass (`10/10`)
