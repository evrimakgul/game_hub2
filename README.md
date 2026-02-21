# Game Hub 2 (MVP Foundation)

Web FRP hub foundation with:
- auth (register/login)
- role-based page flow (Connection -> Sign-Up -> Welcome -> Player/Master)
- campaign creation and invite flow
- role-based character visibility (GM vs Player)
- private chat recipient picker based on campaign members (Player + Master)
- master workspace actions (active/passive game views, ruleset usage view, local ruleset drafts)
- master ruleset drafts support edit, duplicate, and JSON preview
- quick event filter buttons (All/Rolls/Session/Character) and selected campaign highlighting
- local player-sheet layout draft save/load for non-API sections
- session timeline panel combining events + chat with source and text filters
- 10-section character sheet layout scaffold (Bio, Combat, Stats, Skills, Powers, Equipment, Merits/Flaws, Connections, Inventory, Notes)
- D10 success rolls
- session event feed
- JSON persistence across restarts

## Quick Start
1. Install dependencies:

```powershell
npm install
```

2. Start API + web:

```powershell
npm run dev:api
```

3. Open:
- `http://localhost:4000` for the minimal web UI
- `http://localhost:4000/api/v1/health` for API health

## Test

```powershell
npm run test:api
```

## Notes
- Data file location: `apps/api/data/store.json`
- Default ruleset: `d10-basic`
- This is MVP baseline architecture, not final production hardening.
- Events/chat auto-refresh uses SSE server push after a campaign is selected.
- Email sign-up requires only `email` + `password`.
- Discord sign-in button is currently a placeholder (not wired to OAuth yet).
- For real-group MVP validation, use `MVP_SESSION_VALIDATION_CHECKLIST.md`.

## API Routes (MVP)
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/campaigns`
- `GET /api/v1/campaigns`
- `GET /api/v1/campaigns/:campaignId/stream` (SSE stream, token can be sent in `Authorization` header or `?token=...`)
- `GET /api/v1/campaigns/:campaignId/summary`
- `POST /api/v1/campaigns/:campaignId/invites`
- `POST /api/v1/invites/accept`
- `GET /api/v1/campaigns/:campaignId/characters`
- `GET /api/v1/campaigns/:campaignId/characters/:characterId`
- `PUT /api/v1/campaigns/:campaignId/characters/me`
- `POST /api/v1/campaigns/:campaignId/rolls`
- `GET /api/v1/campaigns/:campaignId/events`
- `POST /api/v1/campaigns/:campaignId/chat/messages`
- `GET /api/v1/campaigns/:campaignId/chat/messages`
- `POST /api/v1/campaigns/:campaignId/session/state`

Event feed query options:
- `type` (single or comma-separated event types)
- `since` (epoch ms or ISO timestamp)
- `limit` (1-200)

Chat query options:
- `visibility` (`PUBLIC` or `PRIVATE`)
- `since` (epoch ms or ISO timestamp)
- `limit` (1-200)
