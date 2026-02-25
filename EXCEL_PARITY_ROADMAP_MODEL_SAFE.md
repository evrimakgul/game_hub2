# Excel Parity Roadmap (Model-Safe, ChatGPT-Ready)

## Purpose

This document is a roadmap from the current implementation state to the target functionality represented by `references/templates/NPC_Template4.xlsx`.

This roadmap is written to be fed to another ChatGPT session (or another engineer) and should be treated as a decision-complete implementation plan.

It is intentionally model-safe:
- it separates `current state` from `target state`
- it defines terms before using them
- it uses exact state names and explicit rules
- it marks assumptions and chosen defaults
- it avoids hidden requirements and vague wording

## Status Labels (Use Exactly)

- `Implemented`: exists in current codebase.
- `Partial`: some behavior exists but Excel parity is incomplete.
- `Planned`: roadmap item, not implemented yet.
- `Blocked by design decision`: do not implement until user confirms a listed choice.

## How to Use This Roadmap (For ChatGPT / Implementer)

1. Read `REBUILD_SUMMARY_BACKEND_FRONTEND_XP_FLOW.md` first (current implemented behavior).
2. Read this roadmap second (what remains to reach Excel parity).
3. Implement phases in order unless this roadmap explicitly says a phase can be parallelized.
4. Preserve current API behavior and current working XP request flow unless this roadmap explicitly changes it.
5. After each phase, run the phase acceptance tests before continuing.

## Scope Definition

### In Scope (Target Parity)

Target parity means reproducing the Excel template's functional behavior in the web application, not necessarily pixel-perfect Excel UI.

In scope:
- numeric value model `current / base / bonus` everywhere relevant
- multi-source bonus mechanics (equipment, buffs, debuffs, specials, etc.)
- stats/skills/powers progression and XP tracking parity
- combat summary values derived from base stats/skills/powers + modifiers
- equipment bonus contribution behavior
- XP spent / roll helper values where represented in sheet behavior
- GM/player workflow needed to support the above in the app
- backend persistence and realtime updates for the above

### Out of Scope (For This Roadmap)

- Exact Excel layout replication (merged cells, visual spreadsheet formatting)
- Generic Excel import engine (do not build parser-driven import first)
- Multi-ruleset abstraction beyond current D10-first path
- TypeScript migration
- Mobile app-specific redesign

## Source of Truth Inputs

### Current App Source of Truth
- `REBUILD_SUMMARY_BACKEND_FRONTEND_XP_FLOW.md`
- `apps/api/src/*`
- `apps/web/*`

### Excel Reference Source of Truth
- `references/templates/NPC_Template4.xlsx`

### Observed Excel Functional Areas (From Template Inspection)

The workbook includes at least these functional groups on `CharacterSheet`:
- Header identity and biography fields
- XP summary (`XP Used`, `CR`, `Rank`) and meta counters (`Positive Karma`, `Negative Karma`, `Money`, `Inspiration`)
- Combat summary rows with `Current`, `Base`, and multiple bonus source columns
- Equipment slot bonus matrix and total rows
- Extra bonus rows (manual or named bonus sources)
- Stats group rows (`Physical`, `Social`, `Mental`) with `Current`, `Base`, source columns (e.g. racial, XP buy, equipment, buff), XP spent, roll
- Powers rows (T1 supernatural powers shown in template) with current/base/xp and roll interactions with stats
- Skills rows with base/total and multiple source columns, match-up, roll, and sub-rows
- Helper/reference sheet (`References`) with XP progression tables for skills and stats

Important note:
- The workbook uses many formulas and helper cells (sheet dimension extends far beyond the visible labeled rows).
- The goal is functional parity, not cell-by-cell formula parity.
- This roadmap also includes one intentional `Excel-plus` extension required by product direction:
  - items and other modifier sources must be able to buff `powers`, even though the current Excel template mainly demonstrates buff columns for combat summary, stats, and skills.

## Definitions (Use Exactly)

### Core Numeric Terms

- `Base`: progression-derived or formula-derived value before modifiers.
- `Bonus`: sum of all active modifiers for a field; may be positive or negative.
- `Current`: active displayed value computed as `Base + Bonus`.

### Bonus Source Terms

- `Bonus Source`: one named modifier contribution (example: equipment item, buff, debuff, racial bonus).
- `Bonus Channel`: a UI-visible grouping of bonus sources (example: `Equipment`, `Buff`, `Racial`).
- `Aggregated Bonus`: the total sum of all bonus sources applied to a field.

### XP Workflow Terms

- `Staged Draft`: local browser-only XP changes built with `+/-`; not yet sent.
- `XP Buy Request`: server record with player request pending GM decision.
- `XP Buy Entry`: applied ledger row created after GM approval (or legacy immediate flow).
- `XP Correction`: correction flow for applied entries.

### Parity Terms

- `Excel Parity`: app produces the same gameplay-relevant result as the Excel sheet for the same inputs.
- `Visual Parity`: app looks like the spreadsheet layout. This roadmap does not require full visual parity.

## Current State Snapshot (Starting Point)

This roadmap starts from the current state already implemented.

### Implemented (Current)

Backend:
- OOP-oriented route/service/repository/policy structure for character/mechanics flows (partial refactor but working)
- XP buy request -> GM approve/deny flow
- Session-state gating for XP workflow (`active-offline`)
- Pending-request guard blocking `active-live`
- Session XP assign/apply by GM (selected character)
- Character delete endpoint + cleanup
- Numeric triple support (`numericTriples`, `numericBonuses`) in backend normalization
- Realtime events for XP request workflow and character/session updates

Frontend:
- Triplet UI (`Current / Base / Bonus`) for combat, stats, skills
- Spinner-style +/- on Base fields (stats/skills)
- Player local XP draft staging
- Player request submission to GM
- GM request approval/denial UI in `Character Actions (GM)`
- GM `Session XP` input + apply button
- Realtime character refresh on relevant session events
- Session-state-driven lock/unlock for XP workflow controls
- Over-budget staging guard for stats/skills

### Partial (Current)

- Powers (Section 6) use request workflow but do not yet have inline triplet rows with full `current/base/bonus`
- Bonus model exists as aggregate (`numericBonuses`) but not full source-level bonus management UI/data model
- Combat/stat/skill formula coverage is partial compared to Excel's multi-source and helper columns
- Equipment bonus matrix behavior is not fully represented in app UI/backend model

## Progress Estimate (Functional, Not Visual)

This is an estimate, not a test result.

- Core XP workflow parity: `70-80%`
- Numeric triple model parity (`current/base/bonus` concept): `50-60%`
- Full Excel functionality parity (entire template behavior): `30-40%`

Reason for the gap:
- The core direction is correct and stable.
- Most missing work is in detailed multi-source modifier behavior, powers parity, equipment bonus attribution, and formula-level derived value parity.

## Gap Matrix: Current App vs Excel Functional Behavior

This section is the most important planning bridge. It shows what exists and what remains.

### A. Header, Bio, and Meta Summary

Target Excel behaviors:
- Character identity fields (name, age, biography text blocks)
- XP summary (`XP Used`, `CR`, `Rank`)
- Meta counters (`Positive Karma`, `Negative Karma`, `Money`, `Inspiration`)

Current app status:
- `Partial`
- Basic character sheet fields and derived XP summary values exist
- Some Excel meta counters are not mapped as first-class structured fields with parity behavior

Roadmap outcome required:
- Explicit field mapping for all user-facing header/meta values used in play
- Derived fields (`CR`, `Rank`) must match ruleset formulas/logic
- Meta counters must be persisted and editable under correct permissions

### B. Combat Summary Rows (Current/Base/Bonus + Multi-Source)

Target Excel behaviors:
- Combat summary shows `Current`, `Base`, and multiple source columns
- Current is computed from base + all relevant bonuses
- Equipment and extra bonuses contribute to combat summary totals

Current app status:
- `Partial`
- Triplets shown in UI (`Current/Base/Bonus`)
- Backend computes aggregate bonus and current values
- No full source breakdown UI or equipment matrix parity yet

Roadmap outcome required:
- Add source-level bonus attribution model
- Add combat derivation engine that consumes stats/skills/powers/equipment/modifiers
- Render source columns or equivalent expandable source breakdown

### C. Stats Groups (Physical / Social / Mental)

Target Excel behaviors:
- Stats rows show `Current`, `Base`, source columns (`Racial`, `XP Buy`, `Equipment`, buffs, etc.)
- XP spent and roll helper values reflect progression state

Current app status:
- `Partial`
- Triplets (`current/base/bonus`) shown and working
- XP draft and request flow for base changes works
- No source breakdown columns or bonus-source management
- No explicit `XP Buy` source column parity in UI
- No Excel-like `roll` helper column parity in UI

Roadmap outcome required:
- Track and compute per-source contributions (at least internally)
- Show source breakdown in UI (grid or expandable rows)
- Add optional helper/derived columns (`XP spent`, `roll`) or equivalent display widgets

### D. Powers / Spells (Section 6)

Target Excel behaviors:
- Powers rows with current/base/xp and roll interactions
- Powers may depend on linked stats for roll totals
- XP costs and totals visible by row/group

Current app status:
- `Partial` (low)
- Powers catalog and XP request flow exist
- No per-power triplet row table in player sheet
- No full source breakdown for powers
- No Excel-like roll helper presentation for powers

Roadmap outcome required:
- Per-power row table in sheet UI with `Current/Base/Bonus`
- Inline +/- staging for power base values (subject to XP rules)
- Derived roll helper values shown for powers using linked stat(s)
- Source breakdown support for power modifiers
- Priority note:
  - this phase is promoted earlier than a pure Excel-first ordering because the product requires items/buffs to affect powers too

### E. Skills (including grouped and sub-rows)

Target Excel behaviors:
- Skills with base/total/current and source contributions
- Some rows are grouped/derived sub-rows (e.g., social attack/defense breakdowns)
- Roll helper values by row

Current app status:
- `Partial`
- Main skills triplets and XP staging exist
- Grouped/sub-row parity is not fully represented
- No explicit source columns or roll helper parity in UI

Roadmap outcome required:
- Model skill row types (primary row, derived sub-row, grouped header row)
- Render grouped skills and sub-skills in schema-driven layout
- Compute row-level roll helper values and display them

### F. Equipment Slots and Bonus Matrix

Target Excel behaviors:
- Equipment slots with explicit stat/skill/combat bonus contributions
- Totals row aggregates equipment contributions into many target fields
- Equipment bonuses flow into current values across sheet

Current app status:
- `Partial` (low)
- Equipment section exists conceptually in app, but not Excel-style matrix behavior
- Equipment bonus contribution mapping is not first-class in current data model/UI

Roadmap outcome required:
- Define equipment item modifier schema
- Add equipment slot model with modifiers
- Add bonus aggregation pipeline from equipment -> target fields
- Add GM/player equipment UI sufficient to manage modifiers and view impact

### G. Extra Bonuses / Buffs / Debuffs / Special Sources

Target Excel behaviors:
- Multiple named bonus rows and columns contribute to totals
- Positive and negative modifiers are supported

Current app status:
- `Partial` (concept only)
- Aggregated `numericBonuses` exists
- No structured source list management per character
- No UI to add/remove named effects and inspect contributions

Roadmap outcome required:
- Introduce `modifier source` records (named, typed, scoped, active/inactive)
- Aggregate to field-level bonuses in backend normalization
- UI to manage active effects and inspect resulting totals

### H. XP Cost Reference Tables / Progression Rules

Target Excel behaviors:
- XP costs follow lookup tables (see `References` sheet for skills/stats examples)
- Display and totals match those progression rules

Current app status:
- `Partial`
- D10 ruleset pricing exists and works for current XP buy flows
- No explicit parity harness against the Excel reference examples

Roadmap outcome required:
- Build parity tests comparing D10 XP pricing outputs to workbook reference values (for covered levels)
- Ensure UI/helper displays use the same backend pricing source of truth

### I. Approval, Session, and Persistence Workflow

Target Excel behaviors:
- Excel itself is not a workflow app; this area is an app-layer enhancement
- Must support game-safe process around changes

Current app status:
- `Implemented` / `Better than Excel`
- Request/approval flow exists
- Session-state gating exists
- Realtime updates exist

Roadmap outcome required:
- Keep this workflow while expanding Excel feature parity
- Do not regress approval and session-state safety behavior

## Architecture Strategy to Reach Excel Parity (Chosen Design)

This roadmap chooses a normalized application design instead of copying spreadsheet columns literally.

### Chosen Design Principle

Do not model the Excel sheet as a literal set of fixed columns in app state.

Instead:
- store normalized character data (progression + modifiers + equipment + derived values)
- compute parity outputs in backend ruleset normalization
- render Excel-like views in frontend from normalized data

Why this is chosen:
- easier to maintain
- easier to test
- compatible with current OOP/refactor direction
- avoids hard-coding spreadsheet-specific column layouts into persistence

### Required Runtime Data Layers (Target)

1. `Progression/Base Layer`
- XP-driven values (stats, skills, powers)
- formula-derived non-modifier values (combat base, etc.)

2. `Modifier Source Layer`
- equipment bonuses
- buff/debuff effects
- racial/special bonuses
- manual adjustments (GM only, if enabled)

3. `Aggregation Layer`
- combine modifier sources into per-field `bonus`
- produce `current = base + bonus`
- preserve source breakdown for UI/debug/parity

4. `Presentation Layer`
- section schemas and row models (including grouped rows)
- helper values (`roll`, `XP spent`, totals)
- player/GM views

## Locked Decisions (To Avoid Future Ambiguity)

These are selected defaults for the roadmap.

- Language/runtime: JavaScript ESM (no TypeScript migration in this roadmap)
- Backend framework: Express (existing app)
- Store: keep `JsonStore` and `store.update(mutator)` transaction pattern
- Ruleset strategy: D10-first; preserve `RulesetAdapter` seam for future expansion
- Workflow: keep player request -> GM approval for XP changes
- Session-state rule: XP buy workflow available only in `active-offline`
- UI strategy: functional parity first, not pixel-perfect spreadsheet layout parity
- Formula source of truth: backend ruleset logic, not frontend duplicated formulas
- Realtime: preserve SSE behavior and extend it when new sheet-affecting events are added
- Excel-plus extension lock: support modifier/equipment effects that target `powers.*` even where the current Excel workbook does not show explicit power-buff columns

## Implementation Roadmap (Current State -> Excel Functional Parity)

Phases are intentionally incremental. Each phase must keep the app runnable and keep current XP request workflow working.

### Phase 0: Freeze the Current Baseline (No Behavior Changes)

Status: `Planned`

Goal:
- establish a verified baseline before expanding Excel parity features

Backend tasks:
- run API tests and record current pass status
- add/confirm tests for XP buy request approval path, session-state guard, character deletion, session XP apply

Frontend tasks:
- smoke test player and GM flows listed in `REBUILD_SUMMARY_BACKEND_FRONTEND_XP_FLOW.md`
- capture screenshots of current triplet UI and GM actions panel (optional but recommended)

Acceptance criteria:
- backend tests pass
- no new functionality yet
- current working flows confirmed not broken

### Phase 1: Introduce Structured Modifier Sources (Backend Foundation)

Status: `Planned`

Goal:
- move from aggregate-only bonus storage (`numericBonuses`) to source-aware bonus modeling while preserving current behavior

#### New Backend Data Model (Required)

Add a new character-level collection (chosen name):
- `character.modifierSources`

`modifierSources` record shape (decision-complete default):
- `id`: string (UUID)
- `kind`: enum string
  - `equipment`
  - `buff`
  - `debuff`
  - `racial`
  - `special`
  - `manual-gm`
- `label`: string (human readable, example `Legendary Tuxedo`, `Magic Strength Buff`)
- `active`: boolean
- `createdAt`: ISO timestamp
- `updatedAt`: ISO timestamp
- `createdByUserId`: string | null
- `notes`: string (optional, default empty)
- `modifiers`: array of modifier entries

Modifier entry shape:
- `targetFieldId`: string (canonical field key, e.g. `stats.physical.strength`)
- `amount`: number (integer for current roadmap; can be negative)
- `channel`: enum string
  - `equipment`
  - `buff`
  - `debuff`
  - `racial`
  - `special`
  - `manual`

Compatibility rule:
- continue returning `numericBonuses` and `numericTriples`
- derive `numericBonuses` from `modifierSources` + legacy `numericBonuses` during migration phase

#### Backend Logic Tasks

- add `ModifierSourceRepository` (or extend `CharacterRepository` methods if repository count is kept small)
- add normalization of `character.modifierSources` in `apps/api/src/store.js`
- add aggregation helper in D10 ruleset normalization path:
  - source list -> `numericBonuses` aggregate map
  - source breakdown map for UI/debug
- preserve current `numericTriples` generation behavior

#### Frontend Tasks (Minimal in Phase 1)

- no major UI changes yet
- ensure existing triplet UI still works from aggregated bonuses

Acceptance criteria:
- characters without `modifierSources` still normalize correctly
- current triplet UI unchanged and working
- backend tests still pass
- new unit tests cover aggregation of positive + negative modifiers

### Phase 2: Add Modifier Source Management API (Backend + Minimal GM UI)

Status: `Planned`

Goal:
- create app-level equivalent of Excel bonus columns/rows through structured modifier sources

#### Public API Additions (Chosen)

Add endpoints (campaign + character scoped):
- `GET /api/v1/campaigns/:campaignId/characters/:characterId/modifier-sources`
- `POST /api/v1/campaigns/:campaignId/characters/:characterId/modifier-sources`
- `PUT /api/v1/campaigns/:campaignId/characters/:characterId/modifier-sources/:sourceId`
- `DELETE /api/v1/campaigns/:campaignId/characters/:characterId/modifier-sources/:sourceId`
- `POST /api/v1/campaigns/:campaignId/characters/:characterId/modifier-sources/:sourceId/toggle`

Authorization defaults (locked):
- GM can manage all modifier sources
- Player can manage only `buff`/`debuff` sources if user later requests it; for now default to GM-only management for safety

#### Backend Tasks

- new `ModifierSourceService`
- controller + route registration in character/mechanics route registrar
- validation rules for target field IDs and amount types
- event emission:
  - `MODIFIER_SOURCE_CREATED`
  - `MODIFIER_SOURCE_UPDATED`
  - `MODIFIER_SOURCE_DELETED`
  - `MODIFIER_SOURCE_TOGGLED`
- realtime publish so sheet updates after modifier changes

#### Frontend Tasks (GM Minimal)

Add a simple GM panel in `Character Actions (GM)`:
- load list of modifier sources for selected character
- create source (label, kind)
- add/edit modifier rows (target field + amount)
- toggle active
- delete source

Phase 2 UI requirement:
- functional editor is enough; do not optimize layout yet

Acceptance criteria:
- GM can add an effect like `Magic Strength Buff +3`
- player sheet `Strength` current value updates via realtime refresh
- GM can add an effect targeting a power field (for example `Shadow Control +1`) and the backend aggregation accepts it (UI display parity lands in the promoted powers phase)
- negative modifiers work
- `current = base + bonus` remains correct

### Phase 3: Section 6 Powers/Spells Triplet Parity (High Priority, Promoted)

Status: `Planned`

Goal:
- bring Powers/Spells section to the same `current/base/bonus` pattern used by stats/skills
- make powers a first-class modifier target before equipment/item parity work expands

#### Backend Tasks

- ensure `numericTriples` includes per-power rows with stable field IDs
- ensure `numericBreakdowns` includes powers breakdowns
- add helper values for power roll calculations (linked stat contribution) in normalized payload
- ensure canonical modifier target IDs for powers are finalized early (example: `powers.shadow_control`)

Proposed new normalized helper property (optional):
- `powerHelpers[powerId] = { rollBase, linkedStatFieldId, linkedStatValue, totalRoll }`

#### Frontend Tasks

Replace selector-only powers XP UI with row-based table (keep selectors temporarily as fallback during migration):
- columns:
  - Power Name
  - Current
  - Base
  - Bonus
  - Roll (helper)
  - XP/Cost (helper, optional if available)
  - `+/-` actions for base
- stage power base changes into the same XP request draft model
- preserve existing request submission button flow

Migration strategy (locked):
- support both old selector controls and new row table in one release behind a local UI flag or temporary dual render
- remove selector-only path after parity validation

Acceptance criteria:
- player can stage power increases via inline `+/-`
- GM approves request and power base/current values update
- power roll helper reflects linked stat + power values
- no regression in existing power buy request route behavior
- power values can receive modifier-source contributions (including item/equipment sources) through the same aggregation pipeline

### Phase 4: Stats/Skills Source Breakdown Parity (Frontend + Backend Presentation)

Status: `Planned`

Goal:
- represent Excel-style source columns for stats/skills in the app without hard-coding spreadsheet columns into persistence

#### Backend Tasks

Return source breakdown metadata in normalized character payload (new optional property):
- `numericBreakdowns`

Proposed `numericBreakdowns` shape:
- `numericBreakdowns.stats[groupId][fieldId] = { channels: {...}, sources: [...] }`
- `numericBreakdowns.skills[fieldId] = { channels: {...}, sources: [...] }`
- `numericBreakdowns.combat[fieldId] = { channels: {...}, sources: [...] }`

`channels` should provide summed values by channel (for Excel-like columns):
- `racial`
- `equipment`
- `buff`
- `debuff`
- `special`
- `manual`
- optional `xpBuy` (derived from base/progression, not modifier source)

#### Frontend Tasks

Stats and Skills UI enhancements:
- add optional “expanded breakdown” row or panel for each field
- display channel totals (Excel-like column parity) while preserving current compact triplet layout
- keep Base `+/-` controls as current interaction method

Decision chosen:
- do not switch the whole sheet to a wide spreadsheet grid immediately
- add collapsible/per-field breakdown first (faster, safer, mobile-friendly)

Acceptance criteria:
- for any stat/skill, GM/player can inspect which channels/sources create the total bonus
- numbers match `current = base + sum(all source amounts)`
- existing XP request draft flow still works

### Phase 5: Combat Summary Formula Parity and Source Attribution

Status: `Planned`

Goal:
- make combat summary values functionally match Excel-style derived behavior (base + source bonuses + dependencies)

#### Backend Tasks

- define a combat derivation map in D10 ruleset code (or extracted D10 collaborator if refactor is underway)
- compute combat `base` values from stats/skills/powers/formulas
- add equipment and modifier-source contributions to combat `bonus`
- expose `numericBreakdowns.combat` with channel/source details

Examples (must be ruleset-defined, not UI-defined):
- initiative based on stats
- AC based on Dex (or ruleset equivalent)
- melee/ranged attack and damage values
- power/spell damage/healing summary values where applicable

#### Frontend Tasks

- enhance combat UI to display helper/breakdown details for each combat row
- keep compact triplet layout as default
- allow expanding source breakdown for debug/parity verification

Acceptance criteria:
- combat rows update automatically when source stats/skills/powers/equipment/modifiers change
- current values match backend formula outputs
- breakdown shows where bonuses came from

### Phase 6: Equipment Slot Model and Bonus Matrix Parity

Status: `Planned`

Goal:
- implement app-native equivalent of Excel equipment slot bonus matrix and totals rows

#### Backend Data Model Additions (Chosen)

Add structured equipment model to character (if not already present in sufficient form):
- `character.equipmentSlots`

Slot record shape (default):
- `slotId`: enum string (e.g. `head`, `neck`, `body`, `rightHand`, `leftHand`, etc.)
- `itemId`: string | null
- `itemName`: string
- `rarity`: string | null
- `description`: string
- `modifiers`: same modifier-entry shape used by `modifierSources`
- `active`: boolean

Design rule (locked):
- equipment modifiers must feed the same modifier aggregation pipeline as buffs/debuffs
- do not build a separate parallel bonus system for equipment

#### Backend Tasks

- add equipment slot repository/service methods
- map equipment modifiers into `modifierSources` or aggregate pipeline (pick one and stay consistent)
- emit equipment-related events that trigger sheet refresh

Chosen implementation path:
- equipment remains a distinct section in stored data
- normalization compiles equipment slot modifiers into aggregation input each time
- do not duplicate equipment modifiers as persisted generic modifier sources

#### Frontend Tasks

- build equipment slot editor/view
- allow editing item metadata and modifiers per slot
- show equipment contribution summary (equivalent to Excel equipment totals row)
- show impact on stats/skills/combat through existing triplets/breakdowns

Acceptance criteria:
- equipping an item with multiple modifiers updates all affected rows correctly
- removing/toggling item reverts contributions cleanly
- equipment contributions appear in breakdown under `equipment` channel

### Phase 7: Skills Row-Type Parity (Grouped Rows and Derived Sub-Rows)

Status: `Planned`

Goal:
- support the mixed row structure seen in Excel skills section (headers, grouped rows, derived sub-rows, roll helpers)

#### Backend Tasks

- extend skills schema/normalization to include row metadata:
  - `rowType`: `groupHeader | primarySkill | derivedSkill | spacer | totalRow`
  - `parentSkillId` (for derived rows)
  - `matchup`/linked stat metadata
  - roll helper metadata
- compute derived sub-row values from parent/base/linkage rules

#### Frontend Tasks

- render row types differently (indentation, muted rows, non-editable rows, header rows)
- keep +/- only on editable base rows
- show roll helper values for row types that use them

Acceptance criteria:
- grouped skills display correctly without breaking current primary skill editing
- derived rows recalculate when parent or linked stats change
- row type metadata is stable and testable

### Phase 8: Meta Summary and Helper Fields Parity (CR/Rank/Karma/Money/Inspiration)

Status: `Planned`

Goal:
- complete the Excel-style top summary/meta area functionally

#### Backend Tasks

- ensure derived `CR` and `Rank` match ruleset formula definitions used by the project
- add structured fields for meta counters (if not already schema-backed) with permission rules
- expose helper totals (`XP Used`, `XP Earned`, `XP Leftover`) consistently in normalized character payload

#### Frontend Tasks

- render top summary panel with stable fields:
  - XP Earned / Used / Leftover
  - CR
  - Rank
  - Positive Karma / Negative Karma
  - Money
  - Inspiration
- enforce correct edit permissions (GM-only vs player-editable, as decided by product rules)

Acceptance criteria:
- summary numbers reconcile with applied XP buys and session awards
- rank changes when thresholds are crossed
- meta counters persist and reload correctly

### Phase 9: Formula Parity Harness (Workbook-Inspired Test Fixtures)

Status: `Planned`

Goal:
- prevent silent divergence from Excel parity while continuing refactors

#### Backend Test Tasks

Create a parity fixture suite (JSON fixtures derived from representative spreadsheet scenarios, not live Excel parsing in tests):
- base character with no modifiers
- equipment-only bonuses
- mixed buffs/debuffs
- XP progression changes for stats/skills/powers
- combat formula impacts

Compare backend normalized outputs to expected values for:
- `base`
- `bonus`
- `current`
- helper roll values
- XP spent totals
- CR/Rank thresholds

#### Frontend Test/QA Tasks

- snapshot/DOM checks for triplet rendering and breakdown rows (if test stack supports it)
- manual parity QA checklist against spreadsheet examples

Acceptance criteria:
- parity fixtures pass for all covered scenarios
- no regressions in existing API integration tests

### Phase 10: UI Refinement Pass (Optional After Functional Parity)

Status: `Planned`

Goal:
- improve usability after parity is functionally correct

Tasks:
- optional spreadsheet-style wide view toggle
- bulk modifier editing UX improvements
- inline explanations/tooltips for derived values and XP costs
- better request diff preview before player submits to GM

Important rule:
- do not block functional parity work on UI polish

### Phase 11: D10 Ruleset Internal OOP Split (Can Run in Parallel After Phase 4)

Status: `Planned`

Goal:
- complete deeper OOP refactor of `apps/api/src/rulesets.js` internals without changing behavior

This is architecture debt reduction, not Excel parity by itself.

Suggested split targets:
- progression engine
- XP pricing engine
- sheet normalization/patch compiler
- combat derivation engine
- modifier aggregation engine
- power helper/roll derivation engine

Rule:
- only do this with parity tests in place (Phase 9 or equivalent)

## Public API / Interface Changes (Planned Additions)

This section defines the API additions the implementer should create for Excel parity features.

### New/Extended Character Response Fields (Planned)

These fields should be added in a backward-compatible way (optional keys; do not remove current keys).

1. `numericBreakdowns` (new)
- per-field source/channel breakdown for stats/skills/combat/powers
- used by UI to show Excel-like source columns/breakdowns

2. `powerHelpers` (new)
- per-power helper roll metadata and linked-stat information

3. `summaryMetrics` (optional new wrapper; may also reuse current top-level fields)
- `xpEarned`
- `xpUsed`
- `xpLeftOver`
- `cr`
- `rank`
- `positiveKarma`
- `negativeKarma`
- `money`
- `inspiration`

Compatibility rule:
- If top-level legacy fields already exist and are used by UI, do not remove them.
- `summaryMetrics` can be additive, then UI can migrate gradually.

### New Modifier Source Endpoints (Planned)

- `GET /api/v1/campaigns/:campaignId/characters/:characterId/modifier-sources`
- `POST /api/v1/campaigns/:campaignId/characters/:characterId/modifier-sources`
- `PUT /api/v1/campaigns/:campaignId/characters/:characterId/modifier-sources/:sourceId`
- `DELETE /api/v1/campaigns/:campaignId/characters/:characterId/modifier-sources/:sourceId`
- `POST /api/v1/campaigns/:campaignId/characters/:characterId/modifier-sources/:sourceId/toggle`

### New Equipment Endpoints (Planned, If Current Section APIs Are Insufficient)

If current character update endpoint is not enough for structured slot editing, add:
- `GET /api/v1/campaigns/:campaignId/characters/:characterId/equipment`
- `PUT /api/v1/campaigns/:campaignId/characters/:characterId/equipment/slots/:slotId`
- `POST /api/v1/campaigns/:campaignId/characters/:characterId/equipment/slots/:slotId/toggle`

Decision rule:
- Prefer extending `PUT /characters/me` if existing payload model cleanly supports structured equipment edits.
- Add dedicated endpoints only if payload complexity becomes error-prone.

### Event Types to Add (Planned)

Add only if corresponding APIs are implemented:
- `MODIFIER_SOURCE_CREATED`
- `MODIFIER_SOURCE_UPDATED`
- `MODIFIER_SOURCE_DELETED`
- `MODIFIER_SOURCE_TOGGLED`
- `EQUIPMENT_SLOT_UPDATED`
- `EQUIPMENT_SLOT_TOGGLED`

Realtime rule:
- any event that changes character displayed values must trigger frontend character refresh logic

## Backend Implementation Details (Decision-Complete Defaults)

### Canonical Field ID Scheme (Locked)

Use stable string keys for modifier targets and breakdown lookups.

Examples:
- `stats.physical.strength`
- `stats.social.charisma`
- `skills.melee`
- `skills.social_attack_cha_persuasion` (choose stable ID, document once)
- `powers.awareness`
- `powers.shadow_control`
- `combat.hp`
- `combat.ac`

Rule:
- IDs must be canonical and ruleset-owned (do not derive from UI labels at runtime)

### Modifier Aggregation Algorithm (Locked)

For each target field:
1. Start with `base` from progression/formula layer.
2. Collect active modifiers from all active sources and active equipment slots.
3. Sum by source and by channel.
4. Compute aggregated `bonus`.
5. Compute `current = base + bonus`.
6. Store breakdown details for UI inspection.

Numeric rule:
- modifiers are integer values for current roadmap
- negative values are valid and expected

### XP Buy and Modifier Interaction Rule (Locked)

- XP buys change `base` (or progression data that derives `base`)
- Modifiers never directly change `base`
- `current` always reflects both `base` and modifiers

This must remain true across stats/skills/powers/combat summary derivations.

### Session-State Rule (Preserve)

- XP buy request creation/approval only in `active-offline`
- session XP apply blocked in `active-live`
- cannot switch to `active-live` while pending XP requests exist

Do not weaken these guards while implementing Excel parity.

## Frontend Implementation Details (Decision-Complete Defaults)

### UI Strategy (Locked)

Use a progressive disclosure UI strategy:
- default view remains compact triplets (`Current/Base/Bonus`)
- source breakdown is shown on expand/click or in a side panel
- do not force a full-width spreadsheet grid for all users by default

Reason:
- preserves current usability and reduces regression risk
- still provides Excel-equivalent transparency

### Triplet Rendering Rules (Preserve and Extend)

For every numeric row that reaches parity:
- `Current` = read-only display (computed backend output)
- `Base` = XP/formula base value (editable only if rules allow)
- `Bonus` = read-only aggregated modifier total

Editable behavior:
- stats/skills/powers `Base` fields use `+/-` staging controls when XP buy is allowed
- combat summary base values are typically derived and not directly editable

### Row-Type Rendering (Required for Skills/Powers Parity)

Introduce row rendering modes:
- `editableNumericRow`
- `derivedNumericRow`
- `groupHeaderRow`
- `spacerRow`
- `summaryRow`

Renderer rule:
- renderer behavior must come from backend row metadata / schema, not hard-coded label checks where possible

### Modifier Source UI (GM First)

Minimum viable UI (Phase 2):
- source list for selected character
- create/edit/delete source
- add modifier entries (target field + amount)
- toggle active/inactive

Later UI refinement (not required for functional parity):
- bulk edit grid
- templates/presets
- drag-to-reorder display

### Realtime Refresh Rule (Preserve and Extend)

When receiving events that can change displayed character values, frontend must refresh character data.

This includes current and planned events:
- XP request approval/denial/creation
- session XP apply
- character updates
- modifier source changes
- equipment updates

## Testing Plan (Required for Roadmap Completion)

## Phase-by-Phase Validation (Required)

After each phase:
- run backend tests (`npm --workspace @gamehub/api test`)
- run frontend syntax check (`node --check apps/web/app.js`)
- execute a small manual smoke test for touched flows

## Critical Functional Test Scenarios (Must Exist Before Declaring Excel Parity)

### Scenario 1: Base + Mixed Modifiers on Stat

Input example:
- Base STR = 6
- Equipment bonus STR +2
- Debuff STR -1
- Buff STR +3

Expected:
- Bonus = `(+2) + (-1) + (+3) = 4`
- Current STR = `6 + 4 = 10`
- Breakdown shows each source and channel contribution

### Scenario 2: XP Buy Changes Base but Not Bonus

Input:
- STR base increases from 6 -> 7 via approved XP request
- active modifier total remains +4

Expected:
- New current STR = `11`
- modifier breakdown unchanged
- XP ledger entries reflect only base/progression change

### Scenario 3: Modifier Toggle Reverts Current Value

Input:
- Toggle off buff source `+3 STR`

Expected:
- Bonus decreases by 3
- Current recalculates immediately after realtime refresh
- Base unchanged

### Scenario 4: Equipment Slot Multi-Target Effect

Input:
- Equip item with `DEX +1`, `STA +1`, `Ranged Skill +1`

Expected:
- All affected rows update
- equipment channel shows contributions in breakdowns
- removing item reverts all contributions cleanly

### Scenario 5: Pending Request Blocks Live Session Transition

Input:
- Player submits XP request, status `PENDING`
- GM attempts session state change to `active-live`

Expected:
- backend returns `400`
- no session state change occurs

### Scenario 6: Powers Inline Triplet XP Request Flow

Input:
- Player stages power base increase with `+/-` in new powers table
- submits request
- GM approves

Expected:
- power base/current values update
- XP ledger/request states update
- power helper roll value updates if linked stat contributes

### Scenario 7: Derived Combat Summary Update

Input:
- Increase relevant stat/skill and/or equipment modifier

Expected:
- combat summary base and/or bonus/current recompute according to ruleset formulas
- no manual combat edits required

## Parity Validation Against Excel (Recommended Method)

Do not attempt full live Excel formula execution in test suite.

Recommended method:
1. Extract representative scenarios from Excel into JSON fixtures.
2. Encode expected gameplay outputs (not raw cell references).
3. Compare backend normalized outputs to expected results.
4. Keep fixtures versioned with descriptive names.

Reason:
- stable tests
- no runtime dependency on Excel parser library
- clearer intent than cell-based comparisons

## Migration and Compatibility Rules

### Data Migration Rules (Locked)

- Existing characters with only `numericBonuses` must continue working.
- `modifierSources` should default to `[]` on load if missing.
- During migration period, aggregate bonuses can be composed from both:
  - legacy `numericBonuses`
  - new `modifierSources`

Migration direction:
- once modifier source UI and backend are stable, stop writing new legacy-only bonus edits
- keep reading legacy values for backward compatibility

### API Compatibility Rules (Locked)

- Do not remove existing XP request endpoints.
- Do not break current character response fields used by frontend.
- Add new response keys in backward-compatible form.
- Keep event names already used by current frontend refresh logic.

### UI Compatibility Rules (Locked)

- Keep current stats/skills triplet UI working while adding breakdowns.
- Keep current XP request buttons working while powers inline table is introduced.
- Prefer dual-render migration for powers section until parity is verified.

## Risks and Failure Modes (Must Be Managed)

### Risk 1: Double-Counting Bonuses

Cause:
- aggregating both equipment and generic modifier sources incorrectly

Mitigation:
- one aggregation pipeline
- explicit source IDs and channels
- parity tests with known totals

### Risk 2: Frontend/Backend Formula Drift

Cause:
- duplicated formulas in frontend

Mitigation:
- backend is formula source of truth
- frontend displays helper values from normalized payload

### Risk 3: Regressing Current XP Approval Flow

Cause:
- changing row editing/state logic while expanding powers/skills UI

Mitigation:
- preserve request payload builder contract
- phase-by-phase smoke tests
- keep current buttons until new UI path verified

### Risk 4: UI Complexity Explosion

Cause:
- trying to replicate spreadsheet layout literally

Mitigation:
- compact triplet + expandable breakdown strategy
- functional parity first

## Final Acceptance Criteria (Project-Level, Excel Functionality Parity)

The project reaches the target of this roadmap when all of the following are true:

1. Stats, skills, powers, and combat summary rows support `current/base/bonus` semantics consistently.
2. Multiple modifier sources (equipment, buffs, debuffs, special/racial/manual) can be represented and aggregated correctly.
3. Equipment slot modifiers update all affected values through the same aggregation pipeline.
4. Derived combat and helper values recompute correctly from ruleset logic.
5. Player XP changes for stats/skills/powers use the request -> GM approval workflow without regression.
6. Session-state guards (`active-offline` only for XP workflow) remain enforced.
7. Parity fixtures for representative Excel scenarios pass.
8. Existing backend API tests continue to pass.
9. Frontend player/GM flows remain stable (login, campaign load, sheet load, realtime updates).

## Execution Order Summary (Strict)

Implement in this order unless blocked:
1. Phase 0 (baseline)
2. Phase 1 (modifier source backend foundation)
3. Phase 2 (modifier source API + minimal GM UI)
4. Phase 3 (powers inline triplet parity, promoted for item -> power modifier support)
5. Phase 4 (stats/skills breakdown parity)
6. Phase 5 (combat formula/source parity)
7. Phase 6 (equipment slot bonus matrix parity)
8. Phase 7 (skills row-type parity)
9. Phase 8 (meta summary/helper parity)
10. Phase 9 (parity test harness)
11. Phase 10 (UI refinement)
12. Phase 11 (internal D10 OOP split, optional parallel after parity tests exist)

## Handoff Notes for the Next ChatGPT Session

When using this roadmap to continue implementation, the next ChatGPT should:
- read `REBUILD_SUMMARY_BACKEND_FRONTEND_XP_FLOW.md` first
- treat this roadmap as the implementation sequence for Excel parity
- keep changes incremental and test after each phase
- preserve current working XP request and session-state behavior
- document any deviation from this roadmap explicitly before implementing it

