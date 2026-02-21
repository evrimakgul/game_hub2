import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { createAuthService, sanitizeUser } from "./auth.js";
import { findMembership, isGm, canViewCharacter } from "./permissions.js";
import { getRulesetAdapter } from "./rulesets.js";
import { JsonStore } from "./store.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function createId() {
  return crypto.randomUUID();
}

function createInviteToken() {
  return crypto.randomBytes(16).toString("hex");
}

function toLowerTrimmed(value) {
  return String(value || "").trim().toLowerCase();
}

function sanitizeCampaign(campaign, role) {
  return {
    id: campaign.id,
    name: campaign.name,
    rulesetId: campaign.rulesetId,
    gmUserId: campaign.gmUserId,
    sessionState: campaign.sessionState,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
    role
  };
}

function parseSinceTimestamp(sinceRaw) {
  if (!sinceRaw) {
    return null;
  }
  const numeric = Number(sinceRaw);
  if (Number.isFinite(numeric)) {
    return numeric;
  }
  const parsed = Date.parse(sinceRaw);
  if (Number.isNaN(parsed)) {
    throw httpError(
      400,
      "Invalid 'since' value. Use epoch milliseconds or ISO date."
    );
  }
  return parsed;
}

function canReadChatMessage(message, userId) {
  if (message.visibility === "PUBLIC") {
    return true;
  }
  return (
    message.senderUserId === userId ||
    Array.isArray(message.recipientUserIds) &&
      message.recipientUserIds.includes(userId)
  );
}

function sanitizeChatMessage(message, userById) {
  const sender = userById.get(message.senderUserId);
  const recipientNames = (message.recipientUserIds || [])
    .map((userId) => userById.get(userId)?.displayName || "Unknown")
    .filter(Boolean);

  return {
    id: message.id,
    campaignId: message.campaignId,
    senderUserId: message.senderUserId,
    senderDisplayName: sender?.displayName || "Unknown",
    visibility: message.visibility,
    recipientUserIds: message.recipientUserIds || [],
    recipientNames,
    text: message.text,
    createdAt: message.createdAt
  };
}

function buildCampaignSummary(data, campaign, membership) {
  const activeMemberships = data.memberships.filter(
    (entry) =>
      entry.campaignId === campaign.id &&
      entry.status === "ACTIVE"
  );
  const userById = new Map(data.users.map((user) => [user.id, user]));
  const gmView = isGm(membership);

  const members = activeMemberships
    .map((entry) => {
      const user = userById.get(entry.userId);
      return {
        userId: entry.userId,
        displayName: user?.displayName || "Unknown",
        role: entry.role,
        joinedAt: entry.createdAt,
        ...(gmView ? { email: user?.email || null } : {})
      };
    })
    .sort((a, b) => {
      if (a.role === b.role) {
        return a.displayName.localeCompare(b.displayName);
      }
      return a.role === "GM" ? -1 : 1;
    });

  const pendingInviteRows = data.invites
    .filter(
      (entry) =>
        entry.campaignId === campaign.id &&
        entry.status === "PENDING" &&
        new Date(entry.expiresAt).getTime() >= Date.now()
    )
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return {
    campaign: sanitizeCampaign(campaign, membership.role),
    memberCount: members.length,
    members,
    pendingInvitesCount: pendingInviteRows.length,
    pendingInvites: gmView
      ? pendingInviteRows.map((entry) => ({
          id: entry.id,
          email: entry.email,
          token: entry.token,
          createdAt: entry.createdAt,
          expiresAt: entry.expiresAt
        }))
      : []
  };
}

function createDefaultCharacterSheet({ campaignId, userId, displayName }) {
  return {
    id: createId(),
    campaignId,
    userId,
    name: `${displayName}'s Adventurer`,
    notes: "",
    templateVersion: "v1",
    stats: {
      might: 1,
      agility: 1,
      mind: 1,
      spirit: 1,
      health: 10,
      stress: 0
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function normalizeStats(stats = {}) {
  const fallback = {
    might: 1,
    agility: 1,
    mind: 1,
    spirit: 1,
    health: 10,
    stress: 0
  };

  const bounds = {
    might: [0, 10],
    agility: [0, 10],
    mind: [0, 10],
    spirit: [0, 10],
    health: [0, 20],
    stress: [0, 20]
  };

  const next = {};
  for (const [key, [min, max]] of Object.entries(bounds)) {
    const raw = stats[key];
    const value = raw === undefined ? fallback[key] : Number(raw);
    if (!Number.isInteger(value) || value < min || value > max) {
      throw httpError(400, `Invalid stat '${key}'. Expected ${min}-${max}.`);
    }
    next[key] = value;
  }

  return next;
}

function addEvent(data, { campaignId, type, actorUserId, payload = {} }) {
  data.sessionEvents.push({
    id: createId(),
    campaignId,
    type,
    actorUserId,
    payload,
    createdAt: new Date().toISOString()
  });
}

export function createApp(options = {}) {
  const storeFile =
    options.storeFile || path.resolve(__dirname, "../data/store.json");
  const jwtSecret = options.jwtSecret || process.env.JWT_SECRET || "dev-secret";
  const store = options.store || new JsonStore(storeFile);
  const auth = createAuthService({ store, jwtSecret });
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/api/v1/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post(
    "/api/v1/auth/register",
    asyncHandler(async (req, res) => {
      const displayName = String(req.body.displayName || "").trim();
      const email = toLowerTrimmed(req.body.email);
      const password = String(req.body.password || "");

      if (!displayName || displayName.length < 2) {
        throw httpError(400, "Display name must be at least 2 characters.");
      }
      if (!email || !email.includes("@")) {
        throw httpError(400, "A valid email is required.");
      }
      if (password.length < 6) {
        throw httpError(400, "Password must be at least 6 characters.");
      }

      const passwordHash = await auth.hashPassword(password);
      const user = store.update((data) => {
        const exists = data.users.find((entry) => entry.email === email);
        if (exists) {
          throw httpError(409, "Email already registered.");
        }

        const nextUser = {
          id: createId(),
          displayName,
          email,
          passwordHash,
          createdAt: new Date().toISOString()
        };

        data.users.push(nextUser);
        return nextUser;
      });

      res.status(201).json({
        user: sanitizeUser(user),
        token: auth.issueToken(user)
      });
    })
  );

  app.post(
    "/api/v1/auth/login",
    asyncHandler(async (req, res) => {
      const email = toLowerTrimmed(req.body.email);
      const password = String(req.body.password || "");

      if (!email || !password) {
        throw httpError(400, "Email and password are required.");
      }

      const data = store.read();
      const user = data.users.find((entry) => entry.email === email);

      if (!user) {
        throw httpError(401, "Invalid credentials.");
      }

      const isValid = await auth.verifyPassword(password, user.passwordHash);
      if (!isValid) {
        throw httpError(401, "Invalid credentials.");
      }

      res.json({
        user: sanitizeUser(user),
        token: auth.issueToken(user)
      });
    })
  );

  app.post(
    "/api/v1/campaigns",
    auth.requireAuth,
    asyncHandler(async (req, res) => {
      const name = String(req.body.name || "").trim();

      if (!name || name.length < 3) {
        throw httpError(400, "Campaign name must be at least 3 characters.");
      }

      const campaign = store.update((data) => {
        const now = new Date().toISOString();
        const nextCampaign = {
          id: createId(),
          name,
          rulesetId: "d10-basic",
          gmUserId: req.user.id,
          sessionState: "idle",
          createdAt: now,
          updatedAt: now
        };

        data.campaigns.push(nextCampaign);
        data.memberships.push({
          id: createId(),
          campaignId: nextCampaign.id,
          userId: req.user.id,
          role: "GM",
          status: "ACTIVE",
          createdAt: now
        });

        data.characterSheets.push(
          createDefaultCharacterSheet({
            campaignId: nextCampaign.id,
            userId: req.user.id,
            displayName: req.user.displayName
          })
        );

        addEvent(data, {
          campaignId: nextCampaign.id,
          type: "CAMPAIGN_CREATED",
          actorUserId: req.user.id,
          payload: { campaignName: nextCampaign.name }
        });

        return nextCampaign;
      });

      res.status(201).json({ campaign: sanitizeCampaign(campaign, "GM") });
    })
  );

  app.get(
    "/api/v1/campaigns",
    auth.requireAuth,
    asyncHandler(async (req, res) => {
      const data = store.read();
      const memberships = data.memberships.filter(
        (entry) => entry.userId === req.user.id && entry.status === "ACTIVE"
      );
      const campaigns = memberships
        .map((membership) => {
          const campaign = data.campaigns.find(
            (entry) => entry.id === membership.campaignId
          );
          return campaign ? sanitizeCampaign(campaign, membership.role) : null;
        })
        .filter(Boolean);

      res.json({ campaigns });
    })
  );

  app.get(
    "/api/v1/campaigns/:campaignId/summary",
    auth.requireAuth,
    asyncHandler(async (req, res) => {
      const data = store.read();
      const campaignId = req.params.campaignId;
      const campaign = data.campaigns.find((entry) => entry.id === campaignId);
      if (!campaign) {
        throw httpError(404, "Campaign not found.");
      }

      const membership = findMembership(data, campaignId, req.user.id);
      if (!membership) {
        throw httpError(403, "Campaign access denied.");
      }

      res.json(buildCampaignSummary(data, campaign, membership));
    })
  );

  app.post(
    "/api/v1/campaigns/:campaignId/invites",
    auth.requireAuth,
    asyncHandler(async (req, res) => {
      const campaignId = req.params.campaignId;
      const invitedEmail = toLowerTrimmed(req.body.email);

      if (!invitedEmail || !invitedEmail.includes("@")) {
        throw httpError(400, "A valid invited email is required.");
      }

      const invite = store.update((data) => {
        const campaign = data.campaigns.find((entry) => entry.id === campaignId);
        if (!campaign) {
          throw httpError(404, "Campaign not found.");
        }

        const membership = findMembership(data, campaignId, req.user.id);
        if (!isGm(membership)) {
          throw httpError(403, "Only GM can invite players.");
        }

        const invitedUser = data.users.find((entry) => entry.email === invitedEmail);
        if (invitedUser) {
          const existingMembership = findMembership(
            data,
            campaignId,
            invitedUser.id
          );
          if (existingMembership) {
            throw httpError(409, "User is already in campaign.");
          }
        }

        const now = new Date();
        const nextInvite = {
          id: createId(),
          campaignId,
          email: invitedEmail,
          token: createInviteToken(),
          status: "PENDING",
          createdByUserId: req.user.id,
          createdAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
        };

        data.invites.push(nextInvite);
        addEvent(data, {
          campaignId,
          type: "PLAYER_INVITED",
          actorUserId: req.user.id,
          payload: { email: invitedEmail }
        });

        return nextInvite;
      });

      res.status(201).json({
        invite: {
          id: invite.id,
          campaignId: invite.campaignId,
          email: invite.email,
          status: invite.status,
          expiresAt: invite.expiresAt,
          token: invite.token
        }
      });
    })
  );

  app.post(
    "/api/v1/invites/accept",
    auth.requireAuth,
    asyncHandler(async (req, res) => {
      const token = String(req.body.token || "").trim();
      if (!token) {
        throw httpError(400, "Invite token is required.");
      }

      const accepted = store.update((data) => {
        const invite = data.invites.find((entry) => entry.token === token);
        if (!invite || invite.status !== "PENDING") {
          throw httpError(404, "Invite not found.");
        }
        if (new Date(invite.expiresAt).getTime() < Date.now()) {
          throw httpError(410, "Invite expired.");
        }
        if (invite.email !== req.user.email) {
          throw httpError(403, "Invite email does not match logged-in user.");
        }

        const campaign = data.campaigns.find(
          (entry) => entry.id === invite.campaignId
        );
        if (!campaign) {
          throw httpError(404, "Campaign not found.");
        }

        const existingMembership = findMembership(data, campaign.id, req.user.id);
        if (!existingMembership) {
          data.memberships.push({
            id: createId(),
            campaignId: campaign.id,
            userId: req.user.id,
            role: "PLAYER",
            status: "ACTIVE",
            createdAt: new Date().toISOString()
          });
        }

        const hasSheet = data.characterSheets.find(
          (entry) =>
            entry.campaignId === campaign.id && entry.userId === req.user.id
        );
        if (!hasSheet) {
          data.characterSheets.push(
            createDefaultCharacterSheet({
              campaignId: campaign.id,
              userId: req.user.id,
              displayName: req.user.displayName
            })
          );
        }

        invite.status = "ACCEPTED";
        invite.acceptedByUserId = req.user.id;
        invite.acceptedAt = new Date().toISOString();

        addEvent(data, {
          campaignId: campaign.id,
          type: "PLAYER_JOINED",
          actorUserId: req.user.id,
          payload: { userId: req.user.id, email: req.user.email }
        });

        return campaign;
      });

      res.json({ campaign: sanitizeCampaign(accepted, "PLAYER") });
    })
  );

  app.get(
    "/api/v1/campaigns/:campaignId/characters",
    auth.requireAuth,
    asyncHandler(async (req, res) => {
      const data = store.read();
      const campaignId = req.params.campaignId;
      const membership = findMembership(data, campaignId, req.user.id);

      if (!membership) {
        throw httpError(403, "Campaign access denied.");
      }

      const allCharacters = data.characterSheets.filter(
        (entry) => entry.campaignId === campaignId
      );
      const characters =
        membership.role === "GM"
          ? allCharacters
          : allCharacters.filter((entry) => entry.userId === req.user.id);

      res.json({ characters });
    })
  );

  app.get(
    "/api/v1/campaigns/:campaignId/characters/:characterId",
    auth.requireAuth,
    asyncHandler(async (req, res) => {
      const data = store.read();
      const campaignId = req.params.campaignId;
      const characterId = req.params.characterId;
      const membership = findMembership(data, campaignId, req.user.id);

      if (!membership) {
        throw httpError(403, "Campaign access denied.");
      }

      const character = data.characterSheets.find(
        (entry) =>
          entry.id === characterId && entry.campaignId === campaignId
      );

      if (!character) {
        throw httpError(404, "Character not found.");
      }
      if (!canViewCharacter(membership, character)) {
        throw httpError(403, "Character access denied.");
      }

      res.json({ character });
    })
  );

  app.put(
    "/api/v1/campaigns/:campaignId/characters/me",
    auth.requireAuth,
    asyncHandler(async (req, res) => {
      const campaignId = req.params.campaignId;
      const payload = req.body || {};

      const updatedCharacter = store.update((data) => {
        const membership = findMembership(data, campaignId, req.user.id);
        if (!membership) {
          throw httpError(403, "Campaign access denied.");
        }

        let character = data.characterSheets.find(
          (entry) =>
            entry.campaignId === campaignId && entry.userId === req.user.id
        );
        if (!character) {
          character = createDefaultCharacterSheet({
            campaignId,
            userId: req.user.id,
            displayName: req.user.displayName
          });
          data.characterSheets.push(character);
        }

        if (payload.name !== undefined) {
          const nextName = String(payload.name).trim();
          if (!nextName) {
            throw httpError(400, "Character name cannot be empty.");
          }
          character.name = nextName;
        }

        if (payload.notes !== undefined) {
          character.notes = String(payload.notes || "");
        }

        if (payload.stats !== undefined) {
          character.stats = normalizeStats(payload.stats);
        }

        character.updatedAt = new Date().toISOString();

        addEvent(data, {
          campaignId,
          type: "CHARACTER_UPDATED",
          actorUserId: req.user.id,
          payload: { characterId: character.id }
        });

        return character;
      });

      res.json({ character: updatedCharacter });
    })
  );

  app.post(
    "/api/v1/campaigns/:campaignId/rolls",
    auth.requireAuth,
    asyncHandler(async (req, res) => {
      const campaignId = req.params.campaignId;
      const pool = Number(req.body.pool);
      const difficulty =
        req.body.difficulty === undefined ? 6 : Number(req.body.difficulty);
      const label = String(req.body.label || "").trim();

      const result = store.update((data) => {
        const campaign = data.campaigns.find((entry) => entry.id === campaignId);
        if (!campaign) {
          throw httpError(404, "Campaign not found.");
        }

        const membership = findMembership(data, campaignId, req.user.id);
        if (!membership) {
          throw httpError(403, "Campaign access denied.");
        }

        const adapter = getRulesetAdapter(campaign.rulesetId);
        if (!adapter) {
          throw httpError(500, "Ruleset adapter missing.");
        }

        const roll = adapter.rollCheck({ pool, difficulty });
        addEvent(data, {
          campaignId,
          type: "DICE_ROLLED",
          actorUserId: req.user.id,
          payload: {
            label,
            ...roll
          }
        });

        return roll;
      });

      res.status(201).json({ result });
    })
  );

  app.get(
    "/api/v1/campaigns/:campaignId/events",
    auth.requireAuth,
    asyncHandler(async (req, res) => {
      const data = store.read();
      const campaignId = req.params.campaignId;
      const limitRaw = Number(req.query.limit || 50);
      const limit = Number.isInteger(limitRaw)
        ? Math.max(1, Math.min(200, limitRaw))
        : 50;
      const typeRaw = String(req.query.type || "").trim();
      const typeFilter = typeRaw
        ? new Set(
            typeRaw
              .split(",")
              .map((entry) => entry.trim())
              .filter(Boolean)
          )
        : null;
      const sinceRaw = String(req.query.since || "").trim();
      const sinceTimestamp = parseSinceTimestamp(sinceRaw);

      const membership = findMembership(data, campaignId, req.user.id);
      if (!membership) {
        throw httpError(403, "Campaign access denied.");
      }

      const events = data.sessionEvents
        .filter((entry) => entry.campaignId === campaignId)
        .filter(
          (entry) =>
            !typeFilter || typeFilter.has(String(entry.type || "").trim())
        )
        .filter(
          (entry) =>
            sinceTimestamp === null ||
            new Date(entry.createdAt).getTime() > sinceTimestamp
        )
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      res.json({ events: events.slice(-limit) });
    })
  );

  app.post(
    "/api/v1/campaigns/:campaignId/chat/messages",
    auth.requireAuth,
    asyncHandler(async (req, res) => {
      const campaignId = req.params.campaignId;
      const text = String(req.body.text || "").trim();
      const visibility = String(req.body.visibility || "PUBLIC")
        .trim()
        .toUpperCase();
      const rawRecipientIds = Array.isArray(req.body.recipientUserIds)
        ? req.body.recipientUserIds
        : [];

      if (!text) {
        throw httpError(400, "Chat message text is required.");
      }
      if (text.length > 1000) {
        throw httpError(400, "Chat message text must be <= 1000 characters.");
      }
      if (!new Set(["PUBLIC", "PRIVATE"]).has(visibility)) {
        throw httpError(400, "Visibility must be PUBLIC or PRIVATE.");
      }

      const message = store.update((data) => {
        const campaign = data.campaigns.find((entry) => entry.id === campaignId);
        if (!campaign) {
          throw httpError(404, "Campaign not found.");
        }

        const membership = findMembership(data, campaignId, req.user.id);
        if (!membership) {
          throw httpError(403, "Campaign access denied.");
        }

        let recipientUserIds = [];
        if (visibility === "PRIVATE") {
          recipientUserIds = [
            ...new Set(
              rawRecipientIds
                .map((value) => String(value || "").trim())
                .filter(Boolean)
            )
          ].filter((userId) => userId !== req.user.id);

          if (recipientUserIds.length < 1) {
            throw httpError(
              400,
              "Private message requires at least one recipient user ID."
            );
          }

          for (const recipientUserId of recipientUserIds) {
            const recipientMembership = findMembership(
              data,
              campaignId,
              recipientUserId
            );
            if (!recipientMembership) {
              throw httpError(
                400,
                `Recipient '${recipientUserId}' is not in this campaign.`
              );
            }
          }
        }

        const nextMessage = {
          id: createId(),
          campaignId,
          senderUserId: req.user.id,
          visibility,
          recipientUserIds,
          text,
          createdAt: new Date().toISOString()
        };

        data.chatMessages.push(nextMessage);
        if (visibility === "PUBLIC") {
          addEvent(data, {
            campaignId,
            type: "CHAT_MESSAGE_PUBLIC",
            actorUserId: req.user.id,
            payload: {
              messageId: nextMessage.id
            }
          });
        }
        return nextMessage;
      });

      const data = store.read();
      const userById = new Map(data.users.map((entry) => [entry.id, entry]));
      res.status(201).json({
        message: sanitizeChatMessage(message, userById)
      });
    })
  );

  app.get(
    "/api/v1/campaigns/:campaignId/chat/messages",
    auth.requireAuth,
    asyncHandler(async (req, res) => {
      const data = store.read();
      const campaignId = req.params.campaignId;
      const limitRaw = Number(req.query.limit || 50);
      const limit = Number.isInteger(limitRaw)
        ? Math.max(1, Math.min(200, limitRaw))
        : 50;
      const sinceTimestamp = parseSinceTimestamp(
        String(req.query.since || "").trim()
      );
      const visibilityFilter = String(req.query.visibility || "")
        .trim()
        .toUpperCase();
      if (
        visibilityFilter &&
        !new Set(["PUBLIC", "PRIVATE"]).has(visibilityFilter)
      ) {
        throw httpError(400, "Visibility filter must be PUBLIC or PRIVATE.");
      }

      const membership = findMembership(data, campaignId, req.user.id);
      if (!membership) {
        throw httpError(403, "Campaign access denied.");
      }

      const userById = new Map(data.users.map((entry) => [entry.id, entry]));
      const messages = data.chatMessages
        .filter((entry) => entry.campaignId === campaignId)
        .filter((entry) => canReadChatMessage(entry, req.user.id))
        .filter(
          (entry) =>
            !visibilityFilter || entry.visibility === visibilityFilter
        )
        .filter(
          (entry) =>
            sinceTimestamp === null ||
            new Date(entry.createdAt).getTime() > sinceTimestamp
        )
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        .slice(-limit)
        .map((entry) => sanitizeChatMessage(entry, userById));

      res.json({ messages });
    })
  );

  app.post(
    "/api/v1/campaigns/:campaignId/session/state",
    auth.requireAuth,
    asyncHandler(async (req, res) => {
      const campaignId = req.params.campaignId;
      const state = String(req.body.state || "").trim().toLowerCase();
      const allowedStates = new Set(["idle", "active", "paused", "ended"]);

      if (!allowedStates.has(state)) {
        throw httpError(400, "State must be idle|active|paused|ended.");
      }

      const campaign = store.update((data) => {
        const membership = findMembership(data, campaignId, req.user.id);
        if (!isGm(membership)) {
          throw httpError(403, "Only GM can change session state.");
        }

        const target = data.campaigns.find((entry) => entry.id === campaignId);
        if (!target) {
          throw httpError(404, "Campaign not found.");
        }

        target.sessionState = state;
        target.updatedAt = new Date().toISOString();

        addEvent(data, {
          campaignId,
          type: "SESSION_STATE_CHANGED",
          actorUserId: req.user.id,
          payload: { state }
        });

        return target;
      });

      res.json({ campaign: sanitizeCampaign(campaign, "GM") });
    })
  );

  const webDir = path.resolve(__dirname, "../../web");
  if (fs.existsSync(path.join(webDir, "index.html"))) {
    app.use("/", express.static(webDir));
  }

  app.use((error, _req, res, _next) => {
    const status = error.status || 500;
    const message =
      status >= 500 ? "Internal server error." : error.message || "Request failed.";
    res.status(status).json({ error: message });
  });

  app.locals.store = store;
  return app;
}
