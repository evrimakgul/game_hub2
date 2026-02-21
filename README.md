# Game Hub 2 (MVP Foundation)

Web FRP hub foundation with:
- auth (register/login)
- campaign creation and invite flow
- role-based character visibility (GM vs Player)
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

## API Routes (MVP)
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/campaigns`
- `GET /api/v1/campaigns`
- `POST /api/v1/campaigns/:campaignId/invites`
- `POST /api/v1/invites/accept`
- `GET /api/v1/campaigns/:campaignId/characters`
- `GET /api/v1/campaigns/:campaignId/characters/:characterId`
- `PUT /api/v1/campaigns/:campaignId/characters/me`
- `POST /api/v1/campaigns/:campaignId/rolls`
- `GET /api/v1/campaigns/:campaignId/events`
- `POST /api/v1/campaigns/:campaignId/session/state`
