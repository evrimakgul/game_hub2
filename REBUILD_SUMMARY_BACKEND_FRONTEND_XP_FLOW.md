# Rebuild Summary and Reproduction Guide (Backend + Frontend XP Workflow)

## Purpose

This document is a detailed handoff and rebuild guide for the current character sheet and XP workflow changes.

Use this document for two tasks:
- summarize exactly what has been implemented
- reproduce the same behavior from scratch (backend and frontend separately)

This document is written in model-safe language:
- it separates `implemented` behavior from `direction` (future work)
- it defines important terms before using them
- it avoids hidden assumptions and ambiguous wording

## Status Labels (Read Carefully)

- `Implemented`: behavior exists in the current codebase.
- `Direction`: intended next steps; not guaranteed to exist yet.
- `Known gap`: intentionally not solved yet (or partially solved).
- `Compatibility note`: legacy behavior/endpoints still exist for compatibility, even if the preferred workflow changed.

## Model-Safe Working Rules (For Future ChatGPT / LLM Continuations)

1. Do not infer backend behavior from UI labels.
2. Keep these states distinct at all times:
   - local draft (browser-only, unsent)
   - pending request (server record, waiting for GM decision)
   - approved XP buy entries (server ledger rows already applied)
3. Use exact session state values only:
   - `active-live`
   - `active-offline`
   - `archived`
4. Keep the numeric triple definition explicit:
   - `base` = progression/formula value before modifiers
   - `bonus` = sum of positive/negative modifiers
   - `current` = `base + bonus`
5. Preserve endpoint paths and response shapes unless the user explicitly asks for API changes.
6. Prefer incremental refactors with tests after each phase.
7. When uncertain, inspect code first (`apps/api/src/*`, `apps/web/*`) before changing behavior.

## Scope of This Document

Included:
- Backend (`apps/api`) character/mechanics OOP-oriented refactor (partial but working)
- XP buy request -> GM approval workflow
- Character sheet numeric triple model (`current / base / bonus`)
- GM session XP assign/apply workflow
- GM character deletion UI + backend endpoint
- Realtime refresh fixes
- Session-state gating and safety rules
- Feed ordering/default-count UI changes
- Current direction (backend and frontend)

Not included:
- Full D10 ruleset internal class split (only seam/wrapper exists so far)
- TypeScript conversion
- Full frontend redesign of all sections
- Powers Section 6 triplet row UI (backend is prepared conceptually; frontend UI is not complete for per-power rows)

## Core Definitions (Required Vocabulary)

### Role, Member, Character

- `User`: account identity.
- `Membership`: a user attached to a campaign with a role (`GM` or `PLAYER`).
- `Role`: permissions in the campaign, not a character sheet.
- `Character`: a record tied to a `campaignId` and `userId`.

Important distinction:
- A role is not a character.
- A GM can still end up with a character record because some `characters/me` backend flows can auto-create one if not blocked by role checks.
- This is a known behavior/risk (see Known Gaps).

### Session State Terms

- `active-live`: live session is running; XP buy workflow is locked.
- `active-offline`: session is not live; XP buy workflow is available.
- `archived`: campaign inactive/archive state.

Normalization aliases exist in backend/frontend policy helpers (for compatibility with older names like `active`, `idle`, `paused`).

### XP Terms

- `Session XP`: XP awarded for a session.
- `XP Buy`: a progression change that spends XP (or can grant XP for flaws depending on rules).
- `XP Buy Entry`: persisted, applied ledger record.
- `XP Buy Request`: player-submitted request awaiting GM approval/denial.
- `XP Correction`: correction flow applied to an XP buy entry.
- `Preview Receipt`: cost preview stored on the request before final approval.

### Numeric Triple Terms

- `Base`: progression-derived or formula-derived value.
- `Bonus`: aggregated modifier total for the field; can be positive or negative.
- `Current`: final displayed/active value (`base + bonus`).

### Draft / Request / Applied State Terms

- `Staged Changes`: local browser-only changes built with `+/-` buttons on `Base` inputs.
- `Revert Staged Changes`: clears the local staged changes only.
- `Pending Request`: request exists on server with status `PENDING`.
- `Approved`: GM approved request; real XP buys were applied.
- `Denied`: request status changed, no XP buy entries created.

## Reference Design Input (Spreadsheet)

The user-provided spreadsheet is preserved as a design reference:
- `references/templates/NPC_Template4.xlsx`

How it informs the implementation:
- `base` values are the progression/formula values (analogous to the spreadsheet's XP-driven column usage)
- `bonus` is the sum of modifier columns/effects
- `current` is the computed active result shown on the sheet

Current implementation goal achieved (partially):
- Character sheet now supports `current/base/bonus` for key numeric sections in the web UI (combat/stats/skills)
- Full per-power row triplets (Section 6) are still a later frontend task

## What Has Been Implemented (High-Level Summary)

### Implemented: Backend (Character + Mechanics)

- OOP-oriented backend refactor for character/mechanics flows:
  - controllers
  - services
  - repositories
  - domain policies/factories
  - ruleset registry seam + D10 adapter wrapper seam
- XP buy request workflow added:
  - player submits request
  - GM approves/denies
  - approval applies real XP buy entries
- Session-state guard added:
  - GM cannot switch a campaign to `active-live` while there are pending XP buy requests
- Session XP apply flow improved:
  - GM can assign XP amount from dashboard and apply to selected character
- Character delete endpoint added (GM-only) with cleanup of related data
- Backend tests verified as passing (`npm --workspace @gamehub/api test`, expected `10/10` at handoff)

### Implemented: Frontend (Player + GM UX)

- `Current / Base / Bonus` triplet UI for numeric fields (combat/stats/skills)
- Base field `+/-` spinner-style controls for staging XP changes
- Player XP changes are staged locally (not applied immediately)
- Player submits `XP Change Request` to GM
- GM loads, approves, or denies XP requests in `Character Actions (GM)`
- GM `Session XP` input + `Apply Session XP (Selected Character)` button
- `Revert Staged Changes` button (local draft only)
- XP budget enforcement for staged stat/skill increases (UI disables invalid increases)
- Realtime-driven character refresh after approval/denial/session XP apply
- Events/chat/timeline show newest first and default list size `9`
- GM `Delete Selected Character` button

## Backend: Implemented Structure and Behavior (Detailed)

### Backend Architecture Direction (Implemented Foundation)

The backend now uses a layered structure for the character/mechanics feature area.

Layers used in code:
- HTTP layer (controllers + route registrar)
- Service layer (use cases / business rules)
- Repository layer (store access)
- Domain layer (policies / factories)
- Ruleset seam (registry + D10 adapter wrapper)

Important caveat (`Known gap`):
- `apps/api/src/rulesets.js` still contains a large D10 implementation in mostly functional style.
- The deep ruleset split into many D10 classes is not complete yet.
- The wrapper seam exists so this can be done later without changing route/service contracts.

### Backend File Map (Implemented)

#### HTTP Layer

- `apps/api/src/http/asyncHandler.js`
  - async route wrapper
- `apps/api/src/http/httpError.js`
  - normalized HTTP error helper
- `apps/api/src/http/routes/registerCharacterMechanicsRoutes.js`
  - registers character/mechanics/xp request routes

Controllers (HTTP mapping only):
- `apps/api/src/http/controllers/CharacterCatalogController.js`
- `apps/api/src/http/controllers/CharacterController.js`
- `apps/api/src/http/controllers/MechanicsController.js`
- `apps/api/src/http/controllers/SectionLockController.js`
- `apps/api/src/http/controllers/XpCorrectionController.js`
- `apps/api/src/http/controllers/XpBuyRequestController.js`

Controller responsibilities (`implemented pattern`):
- parse request params/body/query
- call service method
- map result to HTTP status/body
- publish realtime event when service returns event metadata (depending on route)

#### Services Layer

Character services:
- `apps/api/src/services/characters/CharacterCatalogService.js`
- `apps/api/src/services/characters/CharacterSheetService.js`
- `apps/api/src/services/characters/SectionLockService.js`
- `apps/api/src/services/characters/CharacterMechanicsSupport.js`

Mechanics services:
- `apps/api/src/services/mechanics/XpBuyService.js`
- `apps/api/src/services/mechanics/XpBuyRequestService.js`
- `apps/api/src/services/mechanics/XpSessionService.js`
- `apps/api/src/services/mechanics/XpCorrectionService.js`
- `apps/api/src/services/mechanics/GameSessionService.js`
- `apps/api/src/services/mechanics/DiceRollService.js`

Event services:
- `apps/api/src/services/events/SessionEventService.js`
- `apps/api/src/services/events/RealtimeHub.js`

Service responsibilities (`implemented pattern`):
- authorization checks
- session-state gating
- orchestration across repositories and ruleset adapter
- transaction boundaries via store transaction runner
- event payload creation

#### Repositories Layer

Implemented repositories:
- `apps/api/src/repositories/CampaignRepository.js`
- `apps/api/src/repositories/CharacterRepository.js`
- `apps/api/src/repositories/MembershipRepository.js`
- `apps/api/src/repositories/UserRepository.js`
- `apps/api/src/repositories/SessionEventRepository.js`
- `apps/api/src/repositories/XpLedgerRepository.js`
- `apps/api/src/repositories/XpCorrectionRepository.js`
- `apps/api/src/repositories/XpBuyRequestRepository.js`
- `apps/api/src/repositories/StoreTransactionRunner.js`

Repository responsibilities (`implemented pattern`):
- array lookups and mutations over `JsonStore` data
- sorting/filtering helpers
- store initialization (`ensureStore()` methods)

#### Domain Layer

Implemented policies/factories:
- `apps/api/src/domain/characters/CharacterAccessPolicy.js`
- `apps/api/src/domain/characters/CharacterRecordFactory.js`
- `apps/api/src/domain/characters/SectionLockState.js`
- `apps/api/src/domain/mechanics/CampaignSessionStatePolicy.js`
- `apps/api/src/domain/mechanics/XpBuyEntryCorrectionPolicy.js`

Purpose (`implemented`):
- centralize rules that should not live directly inside route handlers
- make behavior reusable and explicit

#### Ruleset Seam (Implemented, Partial)

- `apps/api/src/rulesets/index.js`
  - ruleset registry/factory seam
- `apps/api/src/rulesets/d10/D10RulesetAdapter.js`
  - wrapper/facade seam for D10 adapter access
- `apps/api/src/rulesets.js`
  - still contains the main D10 functional logic and normalization pipeline

Compatibility note:
- The project is in a hybrid state: OOP layers outside, functional-heavy internals inside D10 ruleset.

### Backend Route Composition (Implemented)

Route registration for character/mechanics uses the dedicated registrar:
- `apps/api/src/http/routes/registerCharacterMechanicsRoutes.js`

Composition pattern used:
1. Build transaction runner
2. Build repositories/support services
3. Build ruleset registry + D10 adapter access seam
4. Build domain policies/factories
5. Build feature services
6. Build controllers
7. Register routes on Express app

Result:
- `apps/api/src/app.js` is thinner for character/mechanics route wiring than before (though legacy code still exists elsewhere in the file)

### Backend Endpoint Set (Implemented)

Character and catalog routes:
- `GET /api/v1/campaigns/:campaignId/characters/schema`
- `GET /api/v1/campaigns/:campaignId/characters/powers/catalog`
- `GET /api/v1/campaigns/:campaignId/characters/merits-flaws/catalog`
- `GET /api/v1/campaigns/:campaignId/characters`
- `GET /api/v1/campaigns/:campaignId/characters/:characterId`
- `PUT /api/v1/campaigns/:campaignId/characters/me`
- `DELETE /api/v1/campaigns/:campaignId/characters/:characterId` (GM-only, added)

Mechanics and XP routes:
- `POST /api/v1/campaigns/:campaignId/characters/me/xp/buys` (legacy immediate path retained)
- `POST /api/v1/campaigns/:campaignId/characters/me/xp/buy-requests` (added)
- `GET /api/v1/campaigns/:campaignId/xp/buy-requests` (added)
- `POST /api/v1/campaigns/:campaignId/xp/buy-requests/:requestId/approve` (added)
- `POST /api/v1/campaigns/:campaignId/xp/buy-requests/:requestId/deny` (added)
- Existing XP correction routes remain
- Existing session XP claim/apply routes remain
- Existing game session advance route remains
- Existing dice roll route remains

### Backend Data Model and Store Changes (Implemented)

#### Store Additions and Normalization

In `apps/api/src/store.js`:
- `xpBuyRequests: []` was added to the top-level store shape.
- store normalization ensures the key exists when loading older store files.
- character normalization ensures `character.numericBonuses` exists as an object.

This is important for backward compatibility:
- older saved data can still load without manual migration scripts
- new features can assume the keys exist after normalization

#### Character Response Additions (Implemented)

Normalized character payloads can now include fields used by the frontend XP workflow:
- `numericBonuses`
- `numericTriples`
- `xpBuyStatus`

`xpBuyStatus` is used by the frontend to determine whether XP buy actions are available and why they may be blocked.

Expected concepts in `xpBuyStatus`:
- `lockedBySessionState`
- `frozenByPendingCorrection`
- `canBuy`

### Backend: Numeric Triple Model (`current/base/bonus`) (Implemented)

Implemented in D10 normalization path in `apps/api/src/rulesets.js`.

Key behavior:
1. Read progression-derived or formula-derived values (these are the `base` values conceptually).
2. Normalize `numericBonuses` (modifier map).
3. Build `numericTriples` for supported sections/fields.
4. Apply `current` values back into the display-oriented sheet sections.
5. Return normalized character with:
   - display sections using `current`
   - `numericTriples` for UI rendering
   - `numericBonuses` preserved/normalized

Why this design matters:
- existing field paths can keep working (display values remain numeric)
- UI can show triplets without a full schema rewrite
- future buff/debuff systems can update `numericBonuses` without redefining progression logic

Current frontend UI coverage (`implemented`):
- combat triplets
- stats triplets
- skills triplets

Known gap:
- per-power (Section 6) triplet row UI is not yet implemented in the frontend

### Backend: XP Buy Request Workflow (Implemented)

#### Repository: `XpBuyRequestRepository`

Implemented responsibilities:
- ensure request array exists
- add request records
- find a request by `campaignId + requestId`
- list/filter requests by campaign and optional filters

Expected list behavior:
- newest first (`createdAt` descending)

#### Service: `XpBuyRequestService`

Implemented public workflow methods:
- `createRequestForSelf(...)`
- `listRequests(...)`
- `approveRequest(...)`
- `denyRequest(...)`

##### Create Request (`implemented behavior`)

Validation and flow:
1. Verify campaign exists.
2. Verify actor membership (player path).
3. Require session state `active-offline`.
4. Ensure character exists for the player (`characters/me` semantics; may auto-create).
5. Reject if the character has a pending XP correction that freezes buys.
6. Validate and price each requested action using the ruleset adapter.
7. Save request with status `PENDING` and preview receipts.
8. Emit event `XP_BUY_REQUEST_CREATED`.

##### Approve Request (`implemented behavior`)

Validation and flow:
1. Verify campaign exists.
2. Verify actor has GM permissions.
3. Require session state `active-offline`.
4. Load request and require `PENDING` status.
5. Revalidate and reprice actions at approval time (do not trust preview only).
6. Create real XP buy entries (ledger records).
7. Update request status to `APPROVED`.
8. Persist receipts/applied entry metadata on the request record.
9. Emit event `XP_BUY_REQUEST_APPROVED`.

##### Deny Request (`implemented behavior`)

Validation and flow:
1. Verify GM permissions.
2. Load request and require `PENDING` status.
3. Update status to `DENIED`.
4. Emit event `XP_BUY_REQUEST_DENIED`.

### Backend: Session-State Gating and Safety Rules (Implemented)

#### Rule A: XP Buy Workflow Only in `active-offline`

Implemented across services/UI integration:
- player XP staging/request flow is available only while session state is `active-offline`
- attempts outside allowed state produce blocking messages/errors

#### Rule B: Block `active-live` When Pending XP Requests Exist

Implemented in the campaign session state update path (`apps/api/src/app.js`):
- before setting `sessionState = "active-live"`
- backend scans `data.xpBuyRequests` for that campaign
- if any request is `PENDING`, request is rejected with `400`

Rationale:
- prevents unresolved XP request workflow from being bypassed by state change

#### Rule C: Session XP Apply Locked During Live Session

Existing/retained rule in backend services:
- session XP application is blocked while session state is `active-live`

#### Compatibility Note: Section Locks

- Section lock endpoints and related code still exist.
- Current workflow direction is session-state gating for XP buys.
- The user explicitly requested to rely on session state for XP buy availability rather than per-section lock/unlock UX.
- Legacy immediate XP-buy path was adjusted to align with this direction (no special power/merit lock enforcement for the chosen workflow).

### Backend: Session XP Assign + Apply (GM Override) (Implemented)

Problem solved:
- GM needed a direct way to assign a session XP amount from the master dashboard while testing the flow.

Implemented behavior:
- GM can provide an `xp` value in the selected-character apply flow.
- The controller forwards `req.body.xp` to the service.
- `XpSessionService.claimForCharacter(...)` uses the override when present.
- If no override is provided, it falls back to the character sheet `bioSessionXp` value (legacy-compatible path).

Validation requirement (`implemented`):
- override must be a positive integer (service/controller path enforces this)

### Backend: Character Delete Endpoint (GM-Only) (Implemented)

Endpoint:
- `DELETE /api/v1/campaigns/:campaignId/characters/:characterId`

Authorization:
- GM membership required

Deletion cleanup performed (`implemented`):
- remove character record
- remove XP buy entries for that character
- remove XP corrections for that character
- remove XP buy requests for that character
- remove session award entries tied to that `characterId` (within session award records)

Event emitted:
- `CHARACTER_DELETED`

### Backend: Realtime Event Signals Relevant to This Workflow (Implemented)

Common events used in this work:
- `XP_BUY_REQUEST_CREATED`
- `XP_BUY_REQUEST_APPROVED`
- `XP_BUY_REQUEST_DENIED`
- `SESSION_XP_APPLIED`
- `CHARACTER_UPDATED`
- `CHARACTER_DELETED`

These events are recorded/audited and also used by the frontend realtime refresh logic.

### Backend: Validation and Regression Safety (Implemented Practice)

Primary validation command used during this work:
- `npm --workspace @gamehub/api test`

Expected result at handoff time:
- backend API tests pass (`10/10`)

High-value test areas (existing suite behavior to preserve):
- character schema/catalog/update flows
- XP buy and XP correction flows
- dice roll + event logging flows
- persistence/restart store behavior

## Frontend: Implemented Structure and Behavior (Detailed)

### Frontend Scope in This Work

Frontend files changed during this work:
- `apps/web/index.html`
- `apps/web/app.js`
- `apps/web/styles.css`

Primary goals implemented in frontend:
- display `Current / Base / Bonus` numeric triplets
- allow player to stage XP changes locally with `+/-` buttons
- submit staged changes as GM approval requests
- allow GM to review and approve/deny requests
- allow GM to assign and apply Session XP to selected character
- keep UI state synced with session state and realtime events

### Frontend: Character Sheet Numeric Triplet UI (Implemented)

Implemented UI behavior for supported numeric fields:
- three displayed inputs/fields per numeric object:
  - `Current`
  - `Base`
  - `Bonus`
- `Current` is display-oriented (computed backend value)
- `Base` is the XP/progression-driven value used for staging changes in stats/skills
- `Bonus` shows aggregated modifiers (including negative totals if present)

Current implemented UI coverage:
- combat summary fields (triplets shown; no XP buy +/-)
- stats fields (triplets + +/-)
- skills fields (triplets + +/-)

Known gap:
- Section 6 powers still uses selector-based XP request UI; no per-power triplet row table yet

### Frontend: Base Field Spinner Controls (Implemented)

User requirement implemented:
- `+/-` controls visually embedded with the Base input (spinner style)
- behavior is equivalent to a quantity spinner concept (increment/decrement within bounds)

Implementation notes:
- implemented in vanilla JS + CSS (not jQuery)
- visual embedding is CSS-based (buttons are siblings styled as part of the field)
- native browser number spinners were suppressed in the triplet fields to avoid double-spinner UI conflicts

Backup files created during spinner iterations:
- `backups/ui-triplet-spinner-before-change/app.js.bak`
- `backups/ui-triplet-spinner-before-change/styles.css.bak`
- `backups/ui-triplet-spinner-before-exact-style/styles.css.bak`

### Frontend: Player XP Draft Flow (Implemented)

This is the current intended UX.

#### Player Draft Flow (Stats/Skills)

1. Player opens character sheet.
2. If session state is `active-offline`, XP buy controls are enabled.
3. Player uses `+/-` on Base fields to stage changes locally.
4. UI tracks staged changes and computes a request payload.
5. Player clicks `Send XP Change Request to GM`.
6. Frontend submits a buy-request payload to the backend request endpoint.
7. On success, frontend clears or syncs staged state appropriately and waits for GM decision.

Important distinction:
- `+/-` does not immediately spend XP.
- XP is only actually spent when the GM approves the request.

#### Revert Local Draft (Implemented)

Button:
- `Revert Staged Changes`

Behavior:
- clears local unsent staged changes only
- restores displayed Base values to server state (last saved/actual character state)
- does not undo approved XP buys
- does not cancel a request that is already on the server

### Frontend: XP Budget Enforcement During Staging (Implemented)

Problem solved:
- player should not be able to stage increases that exceed available XP

Implemented behavior (stats/skills draft path):
- `+` button disables when the next staged increase would exceed available XP
- staging logic also rejects programmatic attempts (defensive check)

Important scope note:
- this enforcement is implemented in the staged draft UI for stats/skills
- final authority still remains backend validation at request creation/approval time

### Frontend: Session-State Gating (Implemented)

User intent implemented:
- XP buy workflow availability is tied to campaign session state, not per-section lock/unlock UX

Implemented frontend rule:
- XP buy staging/request controls are enabled only when session state is `active-offline`
- when session state is `active-live`, controls are disabled and UI shows blocking reason

Fixes applied during this work:
- player gating now reads the player campaign selection state (not a stale shared page state)
- GM session-state changes now sync immediate local state for both GM and player UI contexts
- realtime `SESSION_STATE_CHANGED` handling updates XP buy status and control states in the sheet

### Frontend: Auto-Revert Staged Draft on Session State Change (Implemented)

Safety rule implemented:
- if the session leaves `active-offline`, unsent staged changes are automatically cleared in the player UI

Reason:
- prevents stale/illegal offline-stage drafts from remaining active when the session becomes live or archived

### Frontend: XP Buy Request -> GM Approval UI (Implemented)

#### Player-Side Request Submission Controls

Implemented labels/actions include:
- `Send XP Change Request to GM`
- `Revert Staged Changes`

Player can send requests for:
- staged stat/skill changes
- selector-driven power/merit/flaw XP buys (submitted as requests, not immediate buys)

#### GM-Side Request Review Controls

Location:
- `Character Actions (GM)` panel

Implemented controls:
- `Load XP Requests`
- request list (filtered by selected character in GM character dropdown)
- per-request `Approve`
- per-request `Deny`

Important usage note:
- GM must select the intended character in the dropdown before loading/reviewing requests because the list is filtered to the selected character context.

### Frontend: Session XP Assignment by GM (Implemented)

Problem solved:
- GM needed a visible way to assign XP amount before applying session XP

Implemented in `Character Actions (GM)`:
- `Session XP` number input
- `Apply Session XP (Selected Character)` button

Behavior:
- if input has a number, frontend sends that amount to backend
- if input is empty, backend can fallback to the sheet `bioSessionXp` value

Practical test flow now possible:
- GM selects character
- enters XP amount (for example `50`)
- clicks `Apply Session XP (Selected Character)`
- backend records `SESSION_XP_APPLIED`

### Frontend: Character Delete Menu (Implemented)

User request implemented:
- GM can delete a character through UI

Location:
- `Character Actions (GM)` panel

Control:
- `Delete Selected Character`

Behavior:
- requires selected character
- shows browser confirmation prompt
- calls backend delete endpoint
- updates UI lists after success

### Frontend: Realtime Refresh Fixes (Implemented)

Problem fixed:
- GM approval of XP request could apply correctly in backend, but player sheet stayed stale (appeared to revert)

Implemented frontend fix:
- SSE session-event handler now triggers silent character refresh for important character-affecting events

Relevant event types used for refresh logic include:
- `XP_BUY_REQUEST_CREATED`
- `XP_BUY_REQUEST_APPROVED`
- `XP_BUY_REQUEST_DENIED`
- `SESSION_XP_APPLIED`
- `CHARACTER_UPDATED`
- (and related session events depending on flow)

Result:
- after GM approval, player sheet updates to approved values instead of appearing to revert

### Frontend: Player Tree / Navigation Stability Fixes (Implemented)

A startup crash in the triplet UI renderer caused multiple player features to fail (logout, campaign loading, navigation to sheet).

Root cause (implemented fix summary):
- DOM manipulation error while building triplet controls (moving/replacing nodes in wrong order)

Result after fix:
- player-side handlers complete wiring again
- logout works
- player campaign list loads
- campaign labels/session state render correctly
- character sheet navigation resumes

### Frontend: Feed Ordering and Default Counts (Implemented)

Changed display order and defaults for both player and GM panels:
- Events: newest first
- Chat: newest first
- Session Timeline: newest first (kept/aligned)
- default visible count = `9`

This replaces prior larger defaults (`50`, `50`, `80`).

### Frontend: Validation Checks Used During Implementation

Commands used:
- `node --check apps/web/app.js`

Expected result at handoff time:
- syntax check passes

## Exact Workflow Definitions (End-to-End, Model-Safe)

This section defines exact behavior for the most important user-visible workflows.

### Workflow A: Player XP Buy Request (Stats/Skills)

Preconditions:
- player is in a campaign
- player has/loads a character sheet
- campaign session state is `active-offline`
- no pending XP correction freeze blocks the character

Steps:
1. Player uses `+/-` buttons on `Base` values in stats/skills.
2. Frontend builds local staged draft only (no server write yet).
3. Frontend validates staged increases against remaining XP budget (UI-side guard).
4. Player clicks `Send XP Change Request to GM`.
5. Frontend sends a request payload to `POST /api/v1/campaigns/:campaignId/characters/me/xp/buy-requests`.
6. Backend validates and prices the actions and stores a `PENDING` request.
7. Backend emits `XP_BUY_REQUEST_CREATED`.
8. GM can now review it in the master panel.

Outcome:
- no XP is spent yet
- no applied XP buy entry exists yet
- a pending request exists on server

### Workflow B: GM Approves XP Buy Request

Preconditions:
- pending XP request exists
- GM is in same campaign
- session state is `active-offline`

Steps:
1. GM opens `Character Actions (GM)`.
2. GM selects the correct character in the dropdown.
3. GM clicks `Load XP Requests`.
4. GM clicks `Approve` for the target request.
5. Backend revalidates and reprices actions.
6. Backend creates real XP buy entries.
7. Backend marks request `APPROVED`.
8. Backend emits `XP_BUY_REQUEST_APPROVED`.
9. Frontend realtime handler refreshes character data.

Outcome:
- XP is spent/applied
- character progression updates
- sheet display updates (including triplets/current values)

### Workflow C: GM Denies XP Buy Request

Steps:
1. GM loads request list
2. GM clicks `Deny`
3. Backend marks request `DENIED`
4. Backend emits `XP_BUY_REQUEST_DENIED`
5. Frontend realtime handler refreshes relevant state

Outcome:
- no XP buy entries are created
- player can adjust and send a new request

### Workflow D: Session State Change Safety

Implemented rule set:
- XP draft/request/approval workflow is meant for `active-offline`
- session XP apply is blocked during `active-live`
- GM cannot switch to `active-live` while there are pending XP buy requests

What happens to local drafts:
- if session leaves `active-offline`, unsent player staged drafts are automatically cleared in UI

### Workflow E: GM Assigns and Applies Session XP

Steps:
1. GM opens `Character Actions (GM)`.
2. GM selects a character.
3. GM enters a number in `Session XP` input (optional but recommended for testing).
4. GM clicks `Apply Session XP (Selected Character)`.
5. Frontend sends request with optional `xp` override.
6. Backend validates session state and amount.
7. Backend writes award and emits `SESSION_XP_APPLIED`.
8. Frontend refreshes character/session UI.

Outcome:
- XP earned total increases for that selected character

Important caution:
- If GM accidentally selects a GM-owned character (auto-created behavior), session XP can be applied to that character.
- This is one reason the delete-character action was added.

### Workflow F: GM Deletes a Character

Steps:
1. GM selects character in `Character Actions (GM)`.
2. GM clicks `Delete Selected Character`.
3. User confirms browser prompt.
4. Frontend calls delete endpoint.
5. Backend deletes the character and related XP records/requests/corrections and session-award references.
6. Backend emits `CHARACTER_DELETED`.
7. Frontend refreshes character lists.

Outcome:
- character and associated workflow records are removed

## Known Gaps, Risks, and Clarifications (Important)

### Known Gap 1: Full D10 OOP Internal Split Is Not Finished

Implemented:
- OOP layers around the ruleset

Not yet implemented:
- full D10 internals split into classes such as separate sheet patch compiler, pricing engine, progression engine, etc.

Current state:
- `apps/api/src/rulesets.js` still contains the main D10 logic
- `apps/api/src/rulesets/index.js` and `apps/api/src/rulesets/d10/D10RulesetAdapter.js` provide the seam for future refactor

### Known Gap 2: Section 6 Powers Triplet UI Is Not Finished

Implemented:
- backend numeric triple concept supports the direction
- powers/merits/flaws can be sent via request workflow

Not yet implemented:
- a per-power row UI in the sheet showing `Current / Base / Bonus` with inline +/- controls

### Known Gap 3: GM Character Auto-Creation Is Still Possible

Clarification:
- Hosting a game does not intentionally create a GM character.
- However, some `characters/me` flows can auto-create a character record if called while logged in as GM.

Current mitigation implemented:
- GM can delete unwanted characters from the GM panel.

Future hardening direction:
- restrict `characters/me` auto-create/use to `PLAYER` role (if desired by user)
- or hide GM-owned characters from certain GM dropdowns (Session XP apply, etc.)

### Known Gap 4: UI Approval Notes Are Minimal

Implemented:
- request approve/deny actions work

Not yet implemented:
- richer GM note field and player note field in the UI (backend support may exist for storing notes depending on current service shape, but UI is minimal)

## Current Course of Direction (What To Build Next)

This section is the `Direction` summary requested by the user. These items are not all implemented yet.

### Direction A: Continue Backend OOP Refactor (Without Breaking API)

Priority goals:
- keep endpoint paths and response shapes stable
- continue shrinking business logic inside `apps/api/src/app.js`
- split `apps/api/src/rulesets.js` D10 internals behind the existing adapter seam

Suggested next backend targets:
- D10 sheet update internals
- D10 XP pricing/progression helpers
- D10 dice logic split into dedicated class/module collaborators
- unit/parity tests for ruleset behaviors before/after extraction

### Direction B: Expand Spreadsheet-Like Character Sheet UX

Priority goals:
- extend triplet UI to powers (Section 6)
- preserve `current/base/bonus` semantics everywhere numeric
- later support modifier-source management (multiple buffs/debuffs aggregated into bonus)

### Direction C: Keep Session-State-Based XP Access Rule

User direction accepted and implemented in current flow:
- XP buy availability is driven by session state (`active-offline` only)
- avoid reintroducing per-section lock/unlock UX for XP buying

### Direction D: Harden GM/Player Character Separation

Recommended next improvement:
- prevent accidental GM character creation or accidental GM XP application to GM-owned characters

This is not required for current workflow to function, but it improves safety and reduces confusion.

## Rebuild From Scratch Guide (Backend and Frontend Separately)

This section is written so another ChatGPT (or engineer) can reproduce the work with minimal ambiguity.

## Backend Rebuild Guide (Step-by-Step)

### Backend Step 0: Preserve Behavior Baseline

Before refactoring:
- run tests and note current pass status
- avoid changing endpoint shapes unless explicitly required
- keep `store.update(mutator)` transaction pattern (wrap it instead of replacing it)

Commands:
- `npm --workspace @gamehub/api test`

### Backend Step 1: Add OOP Layers Around Character/Mechanics Routes

Create these layers first (even if internally they still call older helpers):
- controllers (`apps/api/src/http/controllers/*`)
- services (`apps/api/src/services/*`)
- repositories (`apps/api/src/repositories/*`)
- domain policies/factories (`apps/api/src/domain/*`)
- route registrar (`apps/api/src/http/routes/registerCharacterMechanicsRoutes.js`)

Implementation rule:
- move HTTP parsing/response mapping into controllers
- move business rules into services
- move raw array operations into repositories
- keep legacy route behavior stable

### Backend Step 2: Add Ruleset Registry + D10 Adapter Seam

Create:
- `apps/api/src/rulesets/index.js`
- `apps/api/src/rulesets/d10/D10RulesetAdapter.js`

Goal:
- services call a ruleset adapter facade
- `apps/api/src/rulesets.js` can remain internally unchanged at first
- future D10 split becomes safer and incremental

### Backend Step 3: Add XP Buy Request Data Store and Repository

In `apps/api/src/store.js`:
- add `xpBuyRequests: []` to default store shape
- normalize existing stores so missing `xpBuyRequests` becomes an empty array

Add repository:
- `XpBuyRequestRepository` with `ensureStore`, `add`, `findById`, `listByCampaign`

### Backend Step 4: Implement XP Buy Request Service + Controller + Routes

Implement service methods:
- create request for self
- list requests (GM-facing)
- approve request
- deny request

Critical rules to implement exactly:
- request creation allowed only in `active-offline`
- approval allowed only in `active-offline`
- approval must revalidate actions (not trust preview receipts)
- request status transitions: `PENDING -> APPROVED` or `PENDING -> DENIED`

Add routes:
- `POST /characters/me/xp/buy-requests`
- `GET /xp/buy-requests`
- `POST /xp/buy-requests/:requestId/approve`
- `POST /xp/buy-requests/:requestId/deny`

Emit events:
- `XP_BUY_REQUEST_CREATED`
- `XP_BUY_REQUEST_APPROVED`
- `XP_BUY_REQUEST_DENIED`

### Backend Step 5: Add Numeric Triple Support (`current/base/bonus`)

In D10 normalization path (`apps/api/src/rulesets.js`):
- normalize `character.numericBonuses`
- build `numericTriples` for supported sections/fields
- apply `current` values to display sections
- return `numericBonuses` + `numericTriples` on normalized character

Also ensure new characters include:
- `numericBonuses: {}` via `CharacterRecordFactory`

Design constraint:
- do not break existing field value consumers; display values should remain numeric

### Backend Step 6: Add Session-State Safety Guard for Pending Requests

In campaign session-state update path:
- before allowing `active-live`
- scan campaign `xpBuyRequests` for any `PENDING`
- reject with `400` if any exist

Reason:
- prevent entering live session while request workflow is unresolved

### Backend Step 7: Add GM Session XP Override (Assign + Apply)

Extend session XP apply path (selected character) so the request can include an optional `xp` amount.

Rules:
- if `xp` is present, validate positive integer and use it
- if `xp` is absent, fallback to `bioSessionXp`
- still respect session-state restrictions (`active-live` blocked)

### Backend Step 8: Add GM Character Delete Endpoint

Add endpoint:
- `DELETE /api/v1/campaigns/:campaignId/characters/:characterId`

Implement GM authorization and cleanup of related records:
- character
- XP buys
- XP corrections
- XP buy requests
- session award references for that character

Emit:
- `CHARACTER_DELETED`

### Backend Step 9: Validate

Required checks:
- `npm --workspace @gamehub/api test`

Expected behavior checks:
- character/mechanics routes still work
- request approval flow works
- session-state guard blocks `active-live` with pending requests
- delete endpoint removes related data cleanly

## Frontend Rebuild Guide (Step-by-Step)

### Frontend Step 0: Preserve Existing App Structure

Files used:
- `apps/web/index.html`
- `apps/web/app.js`
- `apps/web/styles.css`

Constraint:
- implement changes without breaking existing login, campaign loading, and sheet navigation flows

### Frontend Step 1: Add Numeric Triplet Rendering (`Current / Base / Bonus`)

Goal:
- render triplets for combat, stats, skills using backend `numericTriples`

Rules:
- `Current` displays computed active value
- `Base` displays XP/formula base
- `Bonus` displays aggregated modifier total
- fallback gracefully if `numericTriples` is missing (do not crash the page)

Important implementation safety:
- build DOM carefully; avoid moving/replacing nodes in a way that breaks event wiring or throws during startup
- a renderer crash can break unrelated player features (logout/campaign loading/navigation)

### Frontend Step 2: Add Embedded Spinner-Like +/- Controls on Base Inputs

User requirement:
- buttons should look visually attached to the input (embedded spinner style)

Implementation pattern (vanilla JS + CSS):
- create a wrapper container for the Base input
- append separate up/down button elements as siblings
- use CSS positioning/border sharing to create an embedded visual effect
- hide native number spinners in that UI area to avoid double controls

Recommendation:
- create backup copies before major CSS/DOM spinner changes (this was done in this project)

### Frontend Step 3: Implement Local Staged XP Draft State

Add browser-local state for staged changes:
- per field target/base deltas for stats/skills
- derived request payload generation from staged changes

Rules:
- `+/-` only modifies local draft state, not the server
- `Revert Staged Changes` clears only local draft
- UI should reflect staged values immediately in Base/Current preview display (according to current design)

### Frontend Step 4: Enforce XP Budget During Staging (UI Guard)

Rules:
- disable `+` when next increase would exceed available XP
- also reject over-budget increment attempts in the click handler (defensive coding)

Important:
- backend remains final authority; frontend guard improves UX and prevents obvious invalid requests

### Frontend Step 5: Tie XP Workflow to Session State (`active-offline` Only)

Implement helper logic that reads the player campaign session state and returns a blocking reason for XP actions.

Rules to implement:
- enable XP staging/request controls only in `active-offline`
- disable and show reason in `active-live` / other states
- update when campaign/session state changes

Do not rely on:
- a stale shared UI variable that may not represent the currently selected player campaign

### Frontend Step 6: Add Player Request Submission UI and GM Review UI

Player UI controls:
- `Send XP Change Request to GM`
- `Revert Staged Changes`

GM UI controls in `Character Actions (GM)`:
- character selector dropdown
- `Load XP Requests`
- per-request `Approve`
- per-request `Deny`

Important filtering behavior:
- the request list is filtered by selected character; make selection state visible and clear

### Frontend Step 7: Add GM Session XP Amount Input + Apply Button

In `Character Actions (GM)`:
- add `Session XP` numeric input
- keep/add `Apply Session XP (Selected Character)` button

Behavior:
- send entered XP amount to backend as override for selected character apply path
- if empty, backend fallback path can still work

### Frontend Step 8: Add GM Delete Character Button

In `Character Actions (GM)`:
- add `Delete Selected Character`
- require selected character
- use confirmation dialog
- refresh lists after success

### Frontend Step 9: Add Realtime Refresh for Character-Affecting Events

In SSE session event handler:
- when receiving events such as `XP_BUY_REQUEST_APPROVED`, `XP_BUY_REQUEST_DENIED`, `SESSION_XP_APPLIED`, `CHARACTER_UPDATED`, refresh character data (not only events/chat/timeline lists)

Reason:
- prevents stale UI that appears to revert or block new valid requests

### Frontend Step 10: Session-State Sync and Draft Revert Safety

Implement two safety behaviors:
- when GM changes session state, update both GM and player local selection state in the current page session
- if session leaves `active-offline`, clear unsent player staged XP draft

This ensures UI lock/unlock behavior actually follows the session state.

### Frontend Step 11: Feed Order and Default Counts

Update panels (player and GM):
- Events newest first
- Chat newest first
- Session Timeline newest first
- default visible count inputs set to `9`

### Frontend Step 12: Validate

Required checks:
- `node --check apps/web/app.js`
- manual browser test (hard refresh recommended after JS/CSS changes)

Manual smoke test checklist:
1. Login/logout still works.
2. Player campaigns load.
3. Campaign labels show correct session state (for example `active-live`, `active-offline`).
4. Player can open character sheet.
5. In `active-offline`, player can stage stat/skill changes with `+/-`.
6. Over-budget `+` becomes disabled.
7. Player can send XP request.
8. GM can load requests and approve.
9. Player sheet updates after approval (realtime or refresh).
10. GM can apply Session XP with numeric input.
11. GM can delete selected character.

## Reproduction Priority Order (Recommended)

If rebuilding from zero, do this order:
1. Backend route/service/repository structure
2. XP buy request backend workflow + tests
3. Numeric triple backend response support
4. Frontend triplet rendering
5. Frontend staged draft and GM approval UI
6. Realtime refresh fixes
7. Session-state safety guards (backend + frontend sync)
8. GM session XP input/apply and delete character UI
9. Feed ordering/default count tweaks

Reason:
- this order reduces risk and makes failures easier to isolate

## Validation Summary at Handoff (What Was Verified During This Work)

Backend:
- `npm --workspace @gamehub/api test` -> passing (`10/10`)

Frontend:
- `node --check apps/web/app.js` -> passing

## Reference Files and Backups (Preserved)

Reference design asset:
- `references/templates/NPC_Template4.xlsx`

UI backup files (spinner iterations):
- `backups/ui-triplet-spinner-before-change/app.js.bak`
- `backups/ui-triplet-spinner-before-change/styles.css.bak`
- `backups/ui-triplet-spinner-before-exact-style/styles.css.bak`

Document backup (before this revision):
- `backups/docs/REBUILD_SUMMARY_BACKEND_FRONTEND_XP_FLOW.before_revision.md`

## Final Notes for Future ChatGPT Sessions

1. Treat this project as `hybrid`: OOP layers are in place, but the D10 ruleset internals are still partly monolithic.
2. Preserve `current/base/bonus` semantics exactly when expanding the sheet.
3. Preserve the distinction between `staged draft`, `pending request`, and `approved XP buy entries`.
4. Preserve session-state gating (`active-offline` only) as the main XP access rule unless the user changes that requirement.
5. Do not assume GM-owned characters are intended; verify role/auto-create behavior before changing GM dropdown or XP application flows.
