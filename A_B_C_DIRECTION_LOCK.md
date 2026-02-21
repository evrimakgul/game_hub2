# A/B/C Direction Lock

This file locks the direction decisions before the next UI/UX implementation phase.

## A) Page Design and Role-Based Flow

## A.1 Core Rules
- One account can be both `Player` and `Master` (GM/DM) in different campaigns.
- Views are role-specific after login.

## A.2 Connection and Entry Flow
1. `Connection Page`
- Main login entry.
- Supports:
  - Discord sign-in path (simplest possible UX for now).
  - Email sign-in path.
2. `Sign-Up Info Page` (if user is signing up)
- If Discord sign-up: no extra required fields.
- If email sign-up: required fields are only:
  - email
  - password
3. `Welcome Page` (after successful login/sign-up)
- Two explicit options:
  - `Player`
  - `Master`

## A.3 Branching Tree
- `Player` -> Player Character Sheet page.
- `Master` -> Master Dashboard page.

## A.4 Master Dashboard Options (locked)
- Host a New Game
- Create a New Ruleset
- My Rulesets
- Passive / Old Games
- Active Games

The flow should continue as a tree, with role-specific pages diverging over time.

## B) Character Sheet Direction

## B.1 Character Sheet Main Sections (locked)
1. Bio / General Info
2. Combat Summary
3. Stats
4. Skills
5. Powers / Spells
6. Equipment
7. Merits / Flaws
8. Connections
9. Inventory
10. Notes

## B.2 Current Scope Rule
- MVP can stay simple.
- Full section structure above is the directional target for upcoming sheet redesign.

## C) Game Mechanics Direction

## C.1 D10 Baseline Rule (locked)
- Check success condition: `roll >= difficulty`.
- Multiple successes are counted.

## C.2 Future Mechanics Rule
- Additional mechanics will be layered later.
- Baseline D10 logic must stay extensible for future additions.
