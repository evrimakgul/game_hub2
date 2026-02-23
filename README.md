# Game Hub 2

## Overview
Web FRP hub MVP with auth, campaigns/invites, role-based Player/Master views, sheets, D10 rolls, chat, SSE realtime updates, and JSON persistence.

## Quick Start
```powershell
npm install
npm run dev:api
```

Open:
- `http://localhost:4000`
- `http://localhost:4000/api/v1/health`

## Test
```powershell
npm run test:api
```

## Workflow
Daily:
```powershell
git add -A
git commit -m "daily: YYYY-MM-DD short note"
git push
```

Milestone example:
```powershell
git tag -a milestone-13-core-ruleset-foundation -m "Milestone 13: core ruleset foundation"
git push origin milestone-13-core-ruleset-foundation
git switch -c restore/milestone-13 milestone-13-core-ruleset-foundation
```

## Notes
- Data store: `apps/api/data/store.json`
- Default ruleset: `d10-basic`
- Character sheet: schema-driven v2 (10 sections + field validation, grouped stats)
- Realtime uses SSE
- Email sign-up is active (`email` + `password`)
- Discord sign-in is placeholder/deferred
- Temporary login bypass is enabled in `apps/web/app.js` (`TEMP_LOGIN_BYPASS_ENABLED = true`) for local dev; set it to `false` later to restore manual login.
- Run `MVP_SESSION_VALIDATION_CHECKLIST.md` after P0 + P1

## API Routes (MVP)
Auth:
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`

Campaign:
- `POST /api/v1/campaigns`
- `GET /api/v1/campaigns`
- `GET /api/v1/campaigns/:campaignId/summary`
- `POST /api/v1/campaigns/:campaignId/invites`
- `POST /api/v1/invites/accept`

Character:
- `GET /api/v1/campaigns/:campaignId/characters/schema`
- `GET /api/v1/campaigns/:campaignId/characters`
- `GET /api/v1/campaigns/:campaignId/characters/:characterId`
- `PUT /api/v1/campaigns/:campaignId/characters/me`

Session/Events:
- `GET /api/v1/campaigns/:campaignId/stream`
- `GET /api/v1/campaigns/:campaignId/events`
- `POST /api/v1/campaigns/:campaignId/rolls`
- `POST /api/v1/campaigns/:campaignId/session/state`

Chat:
- `POST /api/v1/campaigns/:campaignId/chat/messages`
- `GET /api/v1/campaigns/:campaignId/chat/messages`
