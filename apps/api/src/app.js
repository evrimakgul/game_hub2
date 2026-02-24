import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { createAuthService, sanitizeUser } from "./auth.js";
import { registerCharacterMechanicsRoutes } from "./http/routes/registerCharacterMechanicsRoutes.js";
import { findMembership, isGm, canViewCharacter } from "./permissions.js";
import { getRulesetAdapter } from "./rulesets.js";
import { RealtimeHub } from "./services/events/RealtimeHub.js";
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

const DEFAULT_CAMPAIGN_SESSION_STATE = "active-offline";
const LIVE_CAMPAIGN_SESSION_STATE = "active-live";
const ALLOWED_CAMPAIGN_SESSION_STATES = new Set([
  "active-live",
  "active-offline",
  "archived"
]);
const CAMPAIGN_SESSION_STATE_ALIASES = Object.freeze({
  active: "active-live",
  "active-live": "active-live",
  idle: "active-offline",
  paused: "active-offline",
  "active-offline": "active-offline",
  ended: "archived",
  archived: "archived"
});
const TEMP_AUTH_BYPASS_ALLOWED_EMAILS = new Set([
  "evrimakgul@gmail.com",
  "argonatherthur@gmail.com"
]);

function parseCampaignSessionState(value) {
  const raw = String(value || "").trim().toLowerCase();
  return CAMPAIGN_SESSION_STATE_ALIASES[raw] || null;
}

function normalizeCampaignSessionState(value) {
  return parseCampaignSessionState(value) || DEFAULT_CAMPAIGN_SESSION_STATE;
}

function isLiveCampaignSessionState(value) {
  return normalizeCampaignSessionState(value) === LIVE_CAMPAIGN_SESSION_STATE;
}

function sanitizeCampaign(campaign, role) {
  return {
    id: campaign.id,
    name: campaign.name,
    rulesetId: campaign.rulesetId,
    gmUserId: campaign.gmUserId,
    sessionState: normalizeCampaignSessionState(campaign.sessionState),
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

function parseIntegerInRange(value, { field, min, max }) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < min || numeric > max) {
    throw httpError(
      400,
      `${field} must be an integer between ${min} and ${max}.`
    );
  }
  return numeric;
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

function createDefaultCharacterSheet({
  campaignId,
  userId,
  displayName,
  rulesetId,
  xpSessionAwards = [],
  xpBuyEntries = []
}) {
  const adapter = getRulesetAdapter(rulesetId);
  if (!adapter || typeof adapter.createDefaultCharacterSheetData !== "function") {
    throw httpError(500, "Ruleset adapter missing.");
  }

  const now = new Date().toISOString();
  return {
    id: createId(),
    campaignId,
    userId,
    ...adapter.createDefaultCharacterSheetData({
      displayName,
      xpSessionAwards,
      xpBuyEntries,
      characterContext: { campaignId, userId }
    }),
    sectionLocks:
      typeof adapter.getDefaultSectionLocks === "function"
        ? adapter.getDefaultSectionLocks()
        : {},
    createdAt: now,
    updatedAt: now
  };
}

function normalizeCharacterForCampaign(data, character, userById = new Map()) {
  const campaign = data.campaigns.find(
    (entry) => entry.id === character.campaignId
  );
  if (!campaign) {
    return character;
  }

  const adapter = getRulesetAdapter(campaign.rulesetId);
  if (!adapter || typeof adapter.normalizeCharacterSheet !== "function") {
    return character;
  }

  const displayName = userById.get(character.userId)?.displayName || "Adventurer";
  try {
    return adapter.normalizeCharacterSheet(character, {
      displayName,
      xpSessionAwards: data.xpSessionAwards || [],
      xpBuyEntries: data.xpBuyEntries || [],
      xpBuyCorrections: data.xpBuyCorrections || [],
      campaignSessionState: normalizeCampaignSessionState(campaign.sessionState)
    });
  } catch {
    return character;
  }
}

function findCharacterSheet(data, { campaignId, userId, characterId }) {
  return data.characterSheets.find((entry) => {
    if (entry.campaignId !== campaignId) {
      return false;
    }
    if (characterId) {
      return entry.id === characterId;
    }
    if (userId) {
      return entry.userId === userId;
    }
    return false;
  });
}

function ensureXpSessionAwardsStore(data) {
  if (!Array.isArray(data.xpSessionAwards)) {
    data.xpSessionAwards = [];
  }
  return data.xpSessionAwards;
}

function upsertXpSessionAwardRecord(data, { campaignId, sessionNumber, awardDate, award }) {
  const rows = ensureXpSessionAwardsStore(data);
  let record = rows.find(
    (entry) =>
      entry.campaignId === campaignId &&
      Number(entry.sessionNumber) === Number(sessionNumber)
  );

  if (!record) {
    record = {
      id: createId(),
      campaignId,
      sessionNumber: Number(sessionNumber),
      date: awardDate,
      awards: [],
      createdAt: awardDate,
      updatedAt: awardDate
    };
    rows.push(record);
  }

  const existingAward = Array.isArray(record.awards)
    ? record.awards.find((entry) => entry.userId === award.userId)
    : null;
  if (!Array.isArray(record.awards)) {
    record.awards = [];
  }
  if (existingAward) {
    existingAward.xp = Number(existingAward.xp || 0) + Number(award.xp || 0);
    existingAward.player = award.player || existingAward.player;
    existingAward.characterId = award.characterId || existingAward.characterId;
    existingAward.updatedAt = awardDate;
  } else {
    record.awards.push({
      userId: award.userId,
      player: award.player,
      characterId: award.characterId,
      xp: Number(award.xp || 0),
      createdAt: awardDate,
      updatedAt: awardDate
    });
  }
  record.date = awardDate;
  record.updatedAt = awardDate;
  return record;
}

function getXpAwardsForCampaign(data, campaignId) {
  return (data.xpSessionAwards || [])
    .filter((entry) => entry.campaignId === campaignId)
    .sort((a, b) => Number(a.sessionNumber || 0) - Number(b.sessionNumber || 0));
}

function ensureXpBuyEntriesStore(data) {
  if (!Array.isArray(data.xpBuyEntries)) {
    data.xpBuyEntries = [];
  }
  return data.xpBuyEntries;
}

function ensureXpBuyCorrectionsStore(data) {
  if (!Array.isArray(data.xpBuyCorrections)) {
    data.xpBuyCorrections = [];
  }
  return data.xpBuyCorrections;
}

function getCharacterXpBuyEntries(data, { campaignId, characterId, userId }) {
  return (data.xpBuyEntries || [])
    .filter((entry) => {
      if (!entry || entry.campaignId !== campaignId) return false;
      if (characterId && entry.characterId !== characterId) return false;
      if (userId && entry.userId !== userId) return false;
      return true;
    })
    .slice()
    .sort((a, b) => {
      const aTime = Date.parse(a.createdAt || 0) || 0;
      const bTime = Date.parse(b.createdAt || 0) || 0;
      if (aTime !== bTime) return aTime - bTime;
      return String(a.id || "").localeCompare(String(b.id || ""));
    });
}

function getCharacterXpCorrections(data, { campaignId, characterId }) {
  return (data.xpBuyCorrections || [])
    .filter(
      (entry) =>
        entry &&
        entry.campaignId === campaignId &&
        entry.characterId === characterId
    )
    .slice()
    .sort((a, b) => {
      const aTime = Date.parse(a.createdAt || 0) || 0;
      const bTime = Date.parse(b.createdAt || 0) || 0;
      return bTime - aTime;
    });
}

function hasPendingXpCorrection(data, { campaignId, characterId }) {
  return (data.xpBuyCorrections || []).some(
    (entry) =>
      entry &&
      entry.campaignId === campaignId &&
      entry.characterId === characterId &&
      String(entry.status || "").toUpperCase() === "PENDING"
  );
}

function ensureCharacterSectionLocks(character, adapter) {
  if (!character || !adapter || typeof adapter.getDefaultSectionLocks !== "function") {
    return {};
  }
  const defaults = adapter.getDefaultSectionLocks();
  const raw = character.sectionLocks && typeof character.sectionLocks === "object"
    ? character.sectionLocks
    : {};
  const next = {};
  for (const [sectionId, defaultEntry] of Object.entries(defaults)) {
    const current =
      raw[sectionId] && typeof raw[sectionId] === "object" ? raw[sectionId] : {};
    next[sectionId] = {
      locked:
        current.locked === undefined
          ? Boolean(defaultEntry.locked)
          : Boolean(current.locked),
      updatedAt: current.updatedAt || defaultEntry.updatedAt || null,
      updatedByUserId: current.updatedByUserId || defaultEntry.updatedByUserId || null
    };
  }
  character.sectionLocks = next;
  return character.sectionLocks;
}

function lockableSectionIds(adapter) {
  const schema =
    adapter && typeof adapter.getSheetSchema === "function"
      ? adapter.getSheetSchema()
      : null;
  return new Set(
    (schema?.sections || [])
      .filter((section) => section?.selectionSource?.lockable)
      .map((section) => section.id)
  );
}

function requireCampaignNotActive(campaign, message) {
  if (isLiveCampaignSessionState(campaign?.sessionState)) {
    throw httpError(
      400,
      message || "Action is locked while session state is active-live."
    );
  }
}

function patchXpBuyEntryForCorrection(entry, patch = {}) {
  if (!entry || !patch || typeof patch !== "object" || Array.isArray(patch)) {
    throw httpError(400, "Correction patch must be an object.");
  }
  const immutableKeys = new Set([
    "id",
    "campaignId",
    "characterId",
    "userId",
    "kind",
    "target",
    "fieldId",
    "tierId",
    "powerId",
    "traitId",
    "actorUserId",
    "actorRole",
    "createdAt"
  ]);
  for (const key of Object.keys(patch)) {
    if (immutableKeys.has(key)) {
      throw httpError(400, `Field '${key}' cannot be corrected.`);
    }
  }
  const next = {
    ...structuredClone(entry),
    ...patch
  };
  for (const key of ["fromLevel", "toLevel", "xpDeltaUsed", "xpDeltaEarned", "sessionNumber"]) {
    if (next[key] !== undefined && next[key] !== null) {
      const numeric = Number(next[key]);
      if (!Number.isInteger(numeric) || numeric < 0) {
        throw httpError(400, `${key} must be a non-negative integer.`);
      }
      next[key] = numeric;
    }
  }
  if (!Number.isInteger(next.toLevel)) {
    throw httpError(400, "Corrected entry must include integer toLevel.");
  }
  if (!Number.isInteger(next.fromLevel)) {
    throw httpError(400, "Corrected entry must include integer fromLevel.");
  }
  const used = Number(next.xpDeltaUsed || 0);
  const earned = Number(next.xpDeltaEarned || 0);
  if (!Number.isInteger(used) || !Number.isInteger(earned) || used < 0 || earned < 0) {
    throw httpError(400, "xpDeltaUsed and xpDeltaEarned must be non-negative integers.");
  }
  if ((used > 0 && earned > 0) || (used === 0 && earned === 0)) {
    throw httpError(400, "Exactly one of xpDeltaUsed or xpDeltaEarned must be positive.");
  }
  return next;
}

function addEvent(data, { campaignId, type, actorUserId, payload = {} }) {
  const event = {
    id: createId(),
    campaignId,
    type,
    actorUserId,
    payload,
    createdAt: new Date().toISOString()
  };
  data.sessionEvents.push(event);
  return event;
}

function writeSseEvent(res, type, payload) {
  res.write(`event: ${type}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function createRealtimeHub() {
  const subscribers = new Set();

  function unsubscribe(subscriber) {
    subscribers.delete(subscriber);
  }

  function subscribe(subscriber) {
    subscribers.add(subscriber);
    return () => unsubscribe(subscriber);
  }

  function publishSessionEvent(event) {
    if (!event) {
      return;
    }
    for (const subscriber of subscribers) {
      if (subscriber.campaignId !== event.campaignId) {
        continue;
      }
      try {
        writeSseEvent(subscriber.res, "session_event", event);
      } catch {
        unsubscribe(subscriber);
      }
    }
  }

  function publishChatMessage(message, userById) {
    if (!message) {
      return;
    }
    const payload = sanitizeChatMessage(message, userById);
    for (const subscriber of subscribers) {
      if (subscriber.campaignId !== message.campaignId) {
        continue;
      }
      if (!canReadChatMessage(message, subscriber.userId)) {
        continue;
      }
      try {
        writeSseEvent(subscriber.res, "chat_message", payload);
      } catch {
        unsubscribe(subscriber);
      }
    }
  }

  return {
    subscribe,
    publishSessionEvent,
    publishChatMessage
  };
}

export function createApp(options = {}) {
  const storeFile =
    options.storeFile || path.resolve(__dirname, "../data/store.json");
  const jwtSecret = options.jwtSecret || process.env.JWT_SECRET || "dev-secret";
  const tempAuthBypassEnabled =
    options.tempAuthBypassEnabled ?? process.env.NODE_ENV !== "production";
  const store = options.store || new JsonStore(storeFile);
  const auth = createAuthService({ store, jwtSecret });
  const realtimeHub = new RealtimeHub({
    sanitizeChatMessage,
    canReadChatMessage
  });
  const app = express();

  app.use(cors());
  app.use(express.json());

  registerCharacterMechanicsRoutes({
    app,
    auth,
    store,
    realtimeHub
  });

  app.get("/api/v1/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post(
    "/api/v1/auth/register",
    asyncHandler(async (req, res) => {
      const rawDisplayName = String(req.body.displayName || "").trim();
      const email = toLowerTrimmed(req.body.email);
      const password = String(req.body.password || "");
      const fallbackDisplayName = email.split("@")[0] || "user";
      const displayName = rawDisplayName || fallbackDisplayName;

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
    "/api/v1/auth/dev-bypass",
    asyncHandler(async (req, res) => {
      if (!tempAuthBypassEnabled) {
        throw httpError(404, "Not found.");
      }

      const email = toLowerTrimmed(req.body.email);
      if (!email) {
        throw httpError(400, "Email is required.");
      }
      if (!TEMP_AUTH_BYPASS_ALLOWED_EMAILS.has(email)) {
        throw httpError(403, "Temporary bypass is only allowed for configured accounts.");
      }

      const data = store.read();
      const user = data.users.find((entry) => entry.email === email);
      if (!user) {
        throw httpError(404, "Bypass account not found.");
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

      const created = store.update((data) => {
        const now = new Date().toISOString();
        const nextCampaign = {
          id: createId(),
          name,
          rulesetId: "d10-basic",
          gmUserId: req.user.id,
          sessionState: DEFAULT_CAMPAIGN_SESSION_STATE,
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
            displayName: req.user.displayName,
            rulesetId: nextCampaign.rulesetId,
            xpSessionAwards: data.xpSessionAwards || [],
            xpBuyEntries: data.xpBuyEntries || []
          })
        );

        const event = addEvent(data, {
          campaignId: nextCampaign.id,
          type: "CAMPAIGN_CREATED",
          actorUserId: req.user.id,
          payload: { campaignName: nextCampaign.name }
        });

        return { campaign: nextCampaign, event };
      });
      realtimeHub.publishSessionEvent(created.event);

      res.status(201).json({ campaign: sanitizeCampaign(created.campaign, "GM") });
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
    "/api/v1/campaigns/:campaignId/stream",
    (req, _res, next) => {
      const tokenFromQuery = String(req.query.token || "").trim();
      if (tokenFromQuery && !req.headers.authorization) {
        req.headers.authorization = `Bearer ${tokenFromQuery}`;
      }
      next();
    },
    auth.requireAuth,
    asyncHandler(async (req, res) => {
      const data = store.read();
      const campaignId = req.params.campaignId;
      const membership = findMembership(data, campaignId, req.user.id);
      if (!membership) {
        throw httpError(403, "Campaign access denied.");
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders?.();
      res.write("retry: 2000\n\n");

      const unsubscribe = realtimeHub.subscribe({
        campaignId,
        userId: req.user.id,
        res
      });

      writeSseEvent(res, "connected", {
        campaignId,
        userId: req.user.id,
        at: new Date().toISOString()
      });

      const heartbeatTimerId = setInterval(() => {
        try {
          res.write(": keepalive\n\n");
        } catch {
          // Connection close handler will clean up.
        }
      }, 25000);

      req.on("close", () => {
        clearInterval(heartbeatTimerId);
        unsubscribe();
      });
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

      const created = store.update((data) => {
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
        const event = addEvent(data, {
          campaignId,
          type: "PLAYER_INVITED",
          actorUserId: req.user.id,
          payload: { email: invitedEmail }
        });

        return { invite: nextInvite, event };
      });
      realtimeHub.publishSessionEvent(created.event);

      res.status(201).json({
        invite: {
          id: created.invite.id,
          campaignId: created.invite.campaignId,
          email: created.invite.email,
          status: created.invite.status,
          expiresAt: created.invite.expiresAt,
          token: created.invite.token
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
              displayName: req.user.displayName,
              rulesetId: campaign.rulesetId,
              xpSessionAwards: data.xpSessionAwards || [],
              xpBuyEntries: data.xpBuyEntries || []
            })
          );
        }

        invite.status = "ACCEPTED";
        invite.acceptedByUserId = req.user.id;
        invite.acceptedAt = new Date().toISOString();

        const event = addEvent(data, {
          campaignId: campaign.id,
          type: "PLAYER_JOINED",
          actorUserId: req.user.id,
          payload: { userId: req.user.id, email: req.user.email }
        });

        return { campaign, event };
      });
      realtimeHub.publishSessionEvent(accepted.event);

      res.json({ campaign: sanitizeCampaign(accepted.campaign, "PLAYER") });
    })
  );

  if (false) {
  app.get(
    "/api/v1/campaigns/:campaignId/characters/schema",
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

      const adapter = getRulesetAdapter(campaign.rulesetId);
      if (!adapter || typeof adapter.getSheetSchema !== "function") {
        throw httpError(500, "Ruleset adapter missing.");
      }

      res.json({
        rulesetId: campaign.rulesetId,
        schema: adapter.getSheetSchema()
      });
    })
  );

  app.get(
    "/api/v1/campaigns/:campaignId/characters/powers/catalog",
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

      const adapter = getRulesetAdapter(campaign.rulesetId);
      if (!adapter || typeof adapter.getPowerSystem !== "function") {
        throw httpError(500, "Ruleset power system missing.");
      }

      res.json({
        rulesetId: campaign.rulesetId,
        powerSystem: adapter.getPowerSystem()
      });
    })
  );

  app.get(
    "/api/v1/campaigns/:campaignId/characters/merits-flaws/catalog",
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

      const adapter = getRulesetAdapter(campaign.rulesetId);
      if (!adapter || typeof adapter.getMeritsFlawsSystem !== "function") {
        throw httpError(500, "Ruleset merits/flaws system missing.");
      }

      res.json({
        rulesetId: campaign.rulesetId,
        meritsFlawsSystem: adapter.getMeritsFlawsSystem()
      });
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
      const visibleCharacters =
        membership.role === "GM"
          ? allCharacters
          : allCharacters.filter((entry) => entry.userId === req.user.id);
      const userById = new Map(data.users.map((entry) => [entry.id, entry]));
      const characters = visibleCharacters.map((entry) =>
        normalizeCharacterForCampaign(data, entry, userById)
      );

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

      const userById = new Map(data.users.map((entry) => [entry.id, entry]));
      res.json({
        character: normalizeCharacterForCampaign(data, character, userById)
      });
    })
  );

  app.put(
    "/api/v1/campaigns/:campaignId/characters/me",
    auth.requireAuth,
    asyncHandler(async (req, res) => {
      const campaignId = req.params.campaignId;
      const payload = req.body || {};

      const updated = store.update((data) => {
        const campaign = data.campaigns.find((entry) => entry.id === campaignId);
        if (!campaign) {
          throw httpError(404, "Campaign not found.");
        }

        const membership = findMembership(data, campaignId, req.user.id);
        if (!membership) {
          throw httpError(403, "Campaign access denied.");
        }

        const adapter = getRulesetAdapter(campaign.rulesetId);
        if (!adapter || typeof adapter.applyCharacterSheetUpdate !== "function") {
          throw httpError(500, "Ruleset adapter missing.");
        }

        let character = data.characterSheets.find(
          (entry) =>
            entry.campaignId === campaignId && entry.userId === req.user.id
        );
        if (!character) {
          character = createDefaultCharacterSheet({
            campaignId,
            userId: req.user.id,
            displayName: req.user.displayName,
            rulesetId: campaign.rulesetId,
            xpSessionAwards: data.xpSessionAwards || [],
            xpBuyEntries: data.xpBuyEntries || []
          });
          data.characterSheets.push(character);
        }
        ensureCharacterSectionLocks(character, adapter);

        let nextCharacter;
        try {
          nextCharacter = adapter.applyCharacterSheetUpdate(character, payload, {
            displayName: req.user.displayName,
            actorRole: membership.role,
            xpSessionAwards: data.xpSessionAwards || [],
            xpBuyEntries: data.xpBuyEntries || [],
            xpBuyCorrections: data.xpBuyCorrections || [],
            campaignSessionState: campaign.sessionState
          });
        } catch (error) {
          throw httpError(
            400,
            error?.message || "Invalid character sheet update."
          );
        }
        Object.assign(character, nextCharacter);

        character.updatedAt = new Date().toISOString();

        const event = addEvent(data, {
          campaignId,
          type: "CHARACTER_UPDATED",
          actorUserId: req.user.id,
          payload: { characterId: character.id }
        });

        return { character, event };
      });
      realtimeHub.publishSessionEvent(updated.event);

      res.json({ character: updated.character });
    })
  );

  app.post(
    "/api/v1/campaigns/:campaignId/characters/me/xp/buys",
    auth.requireAuth,
    asyncHandler(async (req, res) => {
      const campaignId = req.params.campaignId;
      const payload = req.body || {};

      const updated = store.update((data) => {
        const campaign = data.campaigns.find((entry) => entry.id === campaignId);
        if (!campaign) {
          throw httpError(404, "Campaign not found.");
        }
        requireCampaignNotActive(
          campaign,
          "XP buy is locked while session state is active-live."
        );

        const membership = findMembership(data, campaignId, req.user.id);
        if (!membership) {
          throw httpError(403, "Campaign access denied.");
        }

        const adapter = getRulesetAdapter(campaign.rulesetId);
        if (
          !adapter ||
          typeof adapter.validateAndPriceXpBuyAction !== "function" ||
          typeof adapter.normalizeCharacterSheet !== "function"
        ) {
          throw httpError(500, "Ruleset XP buy support missing.");
        }

        ensureXpBuyEntriesStore(data);
        ensureXpBuyCorrectionsStore(data);

        let character = findCharacterSheet(data, {
          campaignId,
          userId: req.user.id
        });
        if (!character) {
          character = createDefaultCharacterSheet({
            campaignId,
            userId: req.user.id,
            displayName: req.user.displayName,
            rulesetId: campaign.rulesetId,
            xpSessionAwards: data.xpSessionAwards || [],
            xpBuyEntries: data.xpBuyEntries || []
          });
          data.characterSheets.push(character);
        }
        ensureCharacterSectionLocks(character, adapter);

        if (hasPendingXpCorrection(data, { campaignId, characterId: character.id })) {
          throw httpError(
            400,
            "XP buys are frozen while a GM correction is awaiting player confirmation."
          );
        }

        let priced;
        try {
          priced = adapter.validateAndPriceXpBuyAction(character, payload, {
            xpSessionAwards: data.xpSessionAwards || [],
            xpBuyEntries: data.xpBuyEntries || []
          });
        } catch (error) {
          throw httpError(400, error?.message || "Invalid XP buy.");
        }

        const kind = String(priced.receipt.kind || "").toUpperCase();
        if (kind === "POWER" && character.sectionLocks?.powersSpells?.locked) {
          throw httpError(400, "Powers / Spells is locked by GM.");
        }
        if (
          (kind === "MERIT" || kind === "FLAW") &&
          character.sectionLocks?.meritsFlaws?.locked
        ) {
          throw httpError(400, "Merits / Flaws is locked by GM.");
        }

        const now = new Date().toISOString();
        const normalizedBefore = adapter.normalizeCharacterSheet(character, {
          displayName: req.user.displayName,
          xpSessionAwards: data.xpSessionAwards || [],
          xpBuyEntries: data.xpBuyEntries || [],
          xpBuyCorrections: data.xpBuyCorrections || [],
          campaignSessionState: campaign.sessionState
        });
        const sessionNumber = Number(
          normalizedBefore.sheet?.sections?.bio?.bioGameSession || 0
        );
        const entryId = createId();
        const entry = {
          id: entryId,
          campaignId,
          characterId: character.id,
          userId: character.userId,
          kind,
          target: structuredClone(priced.receipt.target),
          fromLevel: priced.receipt.fromLevel,
          toLevel: priced.receipt.toLevel,
          xpDeltaUsed: priced.receipt.xpDeltaUsed,
          xpDeltaEarned: priced.receipt.xpDeltaEarned,
          actorUserId: req.user.id,
          actorRole: String(membership.role || "PLAYER").toUpperCase(),
          createdAt: now,
          sessionNumber: Number.isInteger(sessionNumber) ? sessionNumber : 0
        };
        if (entry.target?.fieldId) entry.fieldId = entry.target.fieldId;
        if (entry.target?.tierId) entry.tierId = entry.target.tierId;
        if (entry.target?.powerId) entry.powerId = entry.target.powerId;
        if (entry.target?.traitId) entry.traitId = entry.target.traitId;

        data.xpBuyEntries.push(entry);
        character.updatedAt = now;

        const normalizedAfter = adapter.normalizeCharacterSheet(character, {
          displayName: req.user.displayName,
          xpSessionAwards: data.xpSessionAwards || [],
          xpBuyEntries: data.xpBuyEntries || [],
          xpBuyCorrections: data.xpBuyCorrections || [],
          campaignSessionState: campaign.sessionState
        });
        Object.assign(character, normalizedAfter);

        const event = addEvent(data, {
          campaignId,
          type: "XP_BUY_CREATED",
          actorUserId: req.user.id,
          payload: {
            characterId: character.id,
            entryId,
            kind,
            target: entry.target,
            toLevel: entry.toLevel,
            xpDeltaUsed: entry.xpDeltaUsed,
            xpDeltaEarned: entry.xpDeltaEarned
          }
        });

        return {
          character,
          event,
          receipt: {
            ...priced.receipt,
            entryId
          }
        };
      });

      realtimeHub.publishSessionEvent(updated.event);
      res.status(201).json({
        character: updated.character,
        receipt: updated.receipt
      });
    })
  );

  app.post(
    "/api/v1/campaigns/:campaignId/characters/:characterId/section-locks",
    auth.requireAuth,
    asyncHandler(async (req, res) => {
      const campaignId = req.params.campaignId;
      const characterId = req.params.characterId;
      const sectionId = String(req.body?.sectionId || "").trim();
      const locked = Boolean(req.body?.locked);

      const updated = store.update((data) => {
        const campaign = data.campaigns.find((entry) => entry.id === campaignId);
        if (!campaign) {
          throw httpError(404, "Campaign not found.");
        }
        const membership = findMembership(data, campaignId, req.user.id);
        if (!isGm(membership)) {
          throw httpError(403, "Only GM can change section locks.");
        }
        const adapter = getRulesetAdapter(campaign.rulesetId);
        if (!adapter || typeof adapter.normalizeCharacterSheet !== "function") {
          throw httpError(500, "Ruleset adapter missing.");
        }
        const lockableSections = lockableSectionIds(adapter);
        if (!lockableSections.has(sectionId)) {
          throw httpError(400, `Section '${sectionId}' is not lockable.`);
        }

        const character = findCharacterSheet(data, { campaignId, characterId });
        if (!character) {
          throw httpError(404, "Character not found.");
        }
        const now = new Date().toISOString();
        const locks = ensureCharacterSectionLocks(character, adapter);
        locks[sectionId] = {
          locked,
          updatedAt: now,
          updatedByUserId: req.user.id
        };
        character.updatedAt = now;

        const user = data.users.find((entry) => entry.id === character.userId);
        const normalized = adapter.normalizeCharacterSheet(character, {
          displayName: user?.displayName || "Adventurer",
          xpSessionAwards: data.xpSessionAwards || [],
          xpBuyEntries: data.xpBuyEntries || [],
          xpBuyCorrections: data.xpBuyCorrections || [],
          campaignSessionState: campaign.sessionState
        });
        Object.assign(character, normalized);

        const event = addEvent(data, {
          campaignId,
          type: "SECTION_LOCK_CHANGED",
          actorUserId: req.user.id,
          payload: {
            characterId: character.id,
            sectionId,
            locked
          }
        });

        return { character, event };
      });
      realtimeHub.publishSessionEvent(updated.event);
      res.json({
        character: updated.character,
        sectionLocks: updated.character.sectionLocks
      });
    })
  );

  app.get(
    "/api/v1/campaigns/:campaignId/characters/:characterId/xp/corrections",
    auth.requireAuth,
    asyncHandler(async (req, res) => {
      const data = store.read();
      const campaignId = req.params.campaignId;
      const characterId = req.params.characterId;
      const membership = findMembership(data, campaignId, req.user.id);
      if (!membership) {
        throw httpError(403, "Campaign access denied.");
      }
      const character = findCharacterSheet(data, { campaignId, characterId });
      if (!character) {
        throw httpError(404, "Character not found.");
      }
      if (!canViewCharacter(membership, character)) {
        throw httpError(403, "Character access denied.");
      }
      res.json({
        corrections: getCharacterXpCorrections(data, { campaignId, characterId })
      });
    })
  );

  app.post(
    "/api/v1/campaigns/:campaignId/characters/:characterId/xp/corrections",
    auth.requireAuth,
    asyncHandler(async (req, res) => {
      const campaignId = req.params.campaignId;
      const characterId = req.params.characterId;
      const body = req.body || {};

      const updated = store.update((data) => {
        const campaign = data.campaigns.find((entry) => entry.id === campaignId);
        if (!campaign) {
          throw httpError(404, "Campaign not found.");
        }
        const membership = findMembership(data, campaignId, req.user.id);
        if (!isGm(membership)) {
          throw httpError(403, "Only GM can create XP corrections.");
        }
        const character = findCharacterSheet(data, { campaignId, characterId });
        if (!character) {
          throw httpError(404, "Character not found.");
        }
        if (hasPendingXpCorrection(data, { campaignId, characterId })) {
          throw httpError(400, "A pending XP correction already exists for this character.");
        }
        const targetEntryId = String(body.targetEntryId || "").trim();
        if (!targetEntryId) {
          throw httpError(400, "targetEntryId is required.");
        }
        ensureXpBuyEntriesStore(data);
        ensureXpBuyCorrectionsStore(data);
        const targetEntry = data.xpBuyEntries.find(
          (entry) =>
            entry &&
            entry.id === targetEntryId &&
            entry.campaignId === campaignId &&
            entry.characterId === characterId
        );
        if (!targetEntry) {
          throw httpError(404, "XP buy entry not found.");
        }
        const beforeState = structuredClone(targetEntry);
        const afterState = patchXpBuyEntryForCorrection(targetEntry, body.patch || {});
        Object.assign(targetEntry, afterState, {
          correctedAt: new Date().toISOString(),
          correctedByUserId: req.user.id
        });

        const now = new Date().toISOString();
        const correction = {
          id: createId(),
          campaignId,
          characterId,
          targetEntryId,
          beforeState,
          afterState: structuredClone(targetEntry),
          gmUserId: req.user.id,
          playerUserId: character.userId,
          userId: character.userId,
          sessionNumber: Number.isInteger(Number(targetEntry.sessionNumber))
            ? Number(targetEntry.sessionNumber)
            : 0,
          createdAt: now,
          status: "PENDING",
          appliedImmediately: true,
          note: String(body.note || "").trim(),
          playerConfirmation: {
            status: "PENDING",
            userId: null,
            at: null,
            note: ""
          }
        };
        data.xpBuyCorrections.push(correction);
        character.updatedAt = now;

        const event = addEvent(data, {
          campaignId,
          type: "XP_CORRECTION_CREATED",
          actorUserId: req.user.id,
          payload: {
            characterId,
            correctionId: correction.id,
            targetEntryId
          }
        });

        return { correction, event };
      });

      realtimeHub.publishSessionEvent(updated.event);
      res.status(201).json({ correction: updated.correction });
    })
  );

  app.post(
    "/api/v1/campaigns/:campaignId/characters/me/xp/corrections/:correctionId/confirm",
    auth.requireAuth,
    asyncHandler(async (req, res) => {
      const campaignId = req.params.campaignId;
      const correctionId = req.params.correctionId;

      const updated = store.update((data) => {
        const campaign = data.campaigns.find((entry) => entry.id === campaignId);
        if (!campaign) {
          throw httpError(404, "Campaign not found.");
        }
        const membership = findMembership(data, campaignId, req.user.id);
        if (!membership) {
          throw httpError(403, "Campaign access denied.");
        }
        const correction = (data.xpBuyCorrections || []).find(
          (entry) => entry && entry.id === correctionId && entry.campaignId === campaignId
        );
        if (!correction) {
          throw httpError(404, "XP correction not found.");
        }
        if (correction.playerUserId !== req.user.id) {
          throw httpError(403, "Only the affected player can confirm this correction.");
        }
        if (String(correction.status || "").toUpperCase() !== "PENDING") {
          throw httpError(400, "XP correction is not pending.");
        }
        const now = new Date().toISOString();
        correction.status = "CONFIRMED";
        correction.playerConfirmation = {
          status: "CONFIRMED",
          userId: req.user.id,
          at: now,
          note: String(req.body?.note || "").trim()
        };
        correction.confirmedAt = now;

        const event = addEvent(data, {
          campaignId,
          type: "XP_CORRECTION_CONFIRMED",
          actorUserId: req.user.id,
          payload: {
            characterId: correction.characterId,
            correctionId: correction.id,
            targetEntryId: correction.targetEntryId
          }
        });
        return { correction, event };
      });

      realtimeHub.publishSessionEvent(updated.event);
      res.json({ correction: updated.correction });
    })
  );

  app.post(
    "/api/v1/campaigns/:campaignId/characters/me/xp/corrections/:correctionId/deny",
    auth.requireAuth,
    asyncHandler(async (req, res) => {
      const campaignId = req.params.campaignId;
      const correctionId = req.params.correctionId;

      const updated = store.update((data) => {
        const campaign = data.campaigns.find((entry) => entry.id === campaignId);
        if (!campaign) {
          throw httpError(404, "Campaign not found.");
        }
        const membership = findMembership(data, campaignId, req.user.id);
        if (!membership) {
          throw httpError(403, "Campaign access denied.");
        }
        const correction = (data.xpBuyCorrections || []).find(
          (entry) => entry && entry.id === correctionId && entry.campaignId === campaignId
        );
        if (!correction) {
          throw httpError(404, "XP correction not found.");
        }
        if (correction.playerUserId !== req.user.id) {
          throw httpError(403, "Only the affected player can deny this correction.");
        }
        if (String(correction.status || "").toUpperCase() !== "PENDING") {
          throw httpError(400, "XP correction is not pending.");
        }
        const targetEntry = (data.xpBuyEntries || []).find(
          (entry) =>
            entry &&
            entry.id === correction.targetEntryId &&
            entry.campaignId === correction.campaignId &&
            entry.characterId === correction.characterId
        );
        if (!targetEntry) {
          throw httpError(404, "Corrected XP entry no longer exists.");
        }
        Object.assign(targetEntry, structuredClone(correction.beforeState), {
          revertedAt: new Date().toISOString(),
          revertedByUserId: req.user.id
        });
        const now = new Date().toISOString();
        correction.status = "DENIED_REVERTED";
        correction.revertedAt = now;
        correction.playerConfirmation = {
          status: "DENIED",
          userId: req.user.id,
          at: now,
          note: String(req.body?.note || "").trim()
        };

        const event = addEvent(data, {
          campaignId,
          type: "XP_CORRECTION_DENIED_REVERTED",
          actorUserId: req.user.id,
          payload: {
            characterId: correction.characterId,
            correctionId: correction.id,
            targetEntryId: correction.targetEntryId
          }
        });
        return { correction, event };
      });

      realtimeHub.publishSessionEvent(updated.event);
      res.json({ correction: updated.correction });
    })
  );

  app.post(
    "/api/v1/campaigns/:campaignId/characters/me/xp/session-claim",
    auth.requireAuth,
    asyncHandler(async (req, res) => {
      const campaignId = req.params.campaignId;

      const updated = store.update((data) => {
        const campaign = data.campaigns.find((entry) => entry.id === campaignId);
        if (!campaign) {
          throw httpError(404, "Campaign not found.");
        }
        requireCampaignNotActive(
          campaign,
          "Session XP apply is locked while session state is active-live."
        );
        const membership = findMembership(data, campaignId, req.user.id);
        if (!membership) {
          throw httpError(403, "Campaign access denied.");
        }

        const adapter = getRulesetAdapter(campaign.rulesetId);
        if (!adapter || typeof adapter.applyCharacterSheetUpdate !== "function") {
          throw httpError(500, "Ruleset adapter missing.");
        }

        let character = findCharacterSheet(data, {
          campaignId,
          userId: req.user.id
        });
        if (!character) {
          character = createDefaultCharacterSheet({
            campaignId,
            userId: req.user.id,
            displayName: req.user.displayName,
            rulesetId: campaign.rulesetId,
            xpSessionAwards: data.xpSessionAwards || [],
            xpBuyEntries: data.xpBuyEntries || []
          });
          data.characterSheets.push(character);
        }
        ensureCharacterSectionLocks(character, adapter);

        const normalized = adapter.normalizeCharacterSheet(character, {
          displayName: req.user.displayName,
          xpSessionAwards: data.xpSessionAwards || [],
          xpBuyEntries: data.xpBuyEntries || [],
          xpBuyCorrections: data.xpBuyCorrections || [],
          campaignSessionState: campaign.sessionState
        });
        const sessionXp = Number(normalized.sheet?.sections?.bio?.bioSessionXp || 0);
        if (!Number.isInteger(sessionXp) || sessionXp <= 0) {
          throw httpError(400, "Session XP must be greater than 0 to apply.");
        }
        const sessionNumber = Number(
          normalized.sheet?.sections?.bio?.bioGameSession || 0
        );
        const awardDate = new Date().toISOString();

        const awardRecord = upsertXpSessionAwardRecord(data, {
          campaignId,
          sessionNumber,
          awardDate,
          award: {
            userId: character.userId,
            player: req.user.displayName,
            characterId: character.id,
            xp: sessionXp
          }
        });

        const nextCharacter = adapter.applyCharacterSheetUpdate(
          character,
          {
            bioSessionXp: 0,
            bioDateTime: awardDate
          },
          {
            displayName: req.user.displayName,
            actorRole: "SYSTEM",
            xpSessionAwards: data.xpSessionAwards || [],
            xpBuyEntries: data.xpBuyEntries || [],
            xpBuyCorrections: data.xpBuyCorrections || [],
            campaignSessionState: campaign.sessionState
          }
        );
        Object.assign(character, nextCharacter);
        character.updatedAt = awardDate;

        const event = addEvent(data, {
          campaignId,
          type: "SESSION_XP_APPLIED",
          actorUserId: req.user.id,
          payload: {
            characterId: character.id,
            userId: character.userId,
            sessionNumber,
            xp: sessionXp
          }
        });

        return { character, event, awardRecord };
      });

      realtimeHub.publishSessionEvent(updated.event);
      res.json({
        character: updated.character,
        awardRecord: updated.awardRecord
      });
    })
  );

  app.post(
    "/api/v1/campaigns/:campaignId/characters/:characterId/xp/session-claim",
    auth.requireAuth,
    asyncHandler(async (req, res) => {
      const campaignId = req.params.campaignId;
      const characterId = req.params.characterId;

      const updated = store.update((data) => {
        const campaign = data.campaigns.find((entry) => entry.id === campaignId);
        if (!campaign) {
          throw httpError(404, "Campaign not found.");
        }
        requireCampaignNotActive(
          campaign,
          "Session XP apply is locked while session state is active-live."
        );
        const membership = findMembership(data, campaignId, req.user.id);
        if (!isGm(membership)) {
          throw httpError(403, "Only GM can apply Session XP for another player.");
        }

        const adapter = getRulesetAdapter(campaign.rulesetId);
        if (!adapter || typeof adapter.applyCharacterSheetUpdate !== "function") {
          throw httpError(500, "Ruleset adapter missing.");
        }

        const character = findCharacterSheet(data, { campaignId, characterId });
        if (!character) {
          throw httpError(404, "Character not found.");
        }

        const user = data.users.find((entry) => entry.id === character.userId);
        const displayName = user?.displayName || "Adventurer";
        const normalized = adapter.normalizeCharacterSheet(character, {
          displayName,
          xpSessionAwards: data.xpSessionAwards || [],
          xpBuyEntries: data.xpBuyEntries || [],
          xpBuyCorrections: data.xpBuyCorrections || [],
          campaignSessionState: campaign.sessionState
        });
        const sessionXp = Number(normalized.sheet?.sections?.bio?.bioSessionXp || 0);
        if (!Number.isInteger(sessionXp) || sessionXp <= 0) {
          throw httpError(400, "Session XP must be greater than 0 to apply.");
        }
        const sessionNumber = Number(
          normalized.sheet?.sections?.bio?.bioGameSession || 0
        );
        const awardDate = new Date().toISOString();

        const awardRecord = upsertXpSessionAwardRecord(data, {
          campaignId,
          sessionNumber,
          awardDate,
          award: {
            userId: character.userId,
            player: displayName,
            characterId: character.id,
            xp: sessionXp
          }
        });

        const nextCharacter = adapter.applyCharacterSheetUpdate(
          character,
          {
            bioSessionXp: 0,
            bioDateTime: awardDate
          },
          {
            displayName,
            actorRole: "SYSTEM",
            xpSessionAwards: data.xpSessionAwards || [],
            xpBuyEntries: data.xpBuyEntries || [],
            xpBuyCorrections: data.xpBuyCorrections || [],
            campaignSessionState: campaign.sessionState
          }
        );
        Object.assign(character, nextCharacter);
        character.updatedAt = awardDate;

        const event = addEvent(data, {
          campaignId,
          type: "SESSION_XP_APPLIED",
          actorUserId: req.user.id,
          payload: {
            characterId: character.id,
            userId: character.userId,
            sessionNumber,
            xp: sessionXp,
            appliedByRole: "GM"
          }
        });

        return { character, event, awardRecord };
      });

      realtimeHub.publishSessionEvent(updated.event);
      res.json({
        character: updated.character,
        awardRecord: updated.awardRecord
      });
    })
  );

  app.get(
    "/api/v1/campaigns/:campaignId/xp/session-awards",
    auth.requireAuth,
    asyncHandler(async (req, res) => {
      const data = store.read();
      const campaignId = req.params.campaignId;
      const membership = findMembership(data, campaignId, req.user.id);
      if (!membership) {
        throw httpError(403, "Campaign access denied.");
      }
      res.json({
        records: getXpAwardsForCampaign(data, campaignId)
      });
    })
  );

  app.post(
    "/api/v1/campaigns/:campaignId/game-session/advance",
    auth.requireAuth,
    asyncHandler(async (req, res) => {
      const campaignId = req.params.campaignId;

      const updated = store.update((data) => {
        const campaign = data.campaigns.find((entry) => entry.id === campaignId);
        if (!campaign) {
          throw httpError(404, "Campaign not found.");
        }
        const membership = findMembership(data, campaignId, req.user.id);
        if (!isGm(membership)) {
          throw httpError(403, "Only GM can advance game session.");
        }

        const adapter = getRulesetAdapter(campaign.rulesetId);
        if (!adapter || typeof adapter.applyCharacterSheetUpdate !== "function") {
          throw httpError(500, "Ruleset adapter missing.");
        }

        const campaignCharacters = data.characterSheets.filter(
          (entry) => entry.campaignId === campaignId
        );
        const userById = new Map(data.users.map((entry) => [entry.id, entry]));
        const xpSessionAwards = data.xpSessionAwards || [];
        const xpBuyEntries = data.xpBuyEntries || [];
        const xpBuyCorrections = data.xpBuyCorrections || [];
        const normalizedRows = campaignCharacters.map((character) => {
          const displayName = userById.get(character.userId)?.displayName || "Adventurer";
          ensureCharacterSectionLocks(character, adapter);
          const normalized = adapter.normalizeCharacterSheet(character, {
            displayName,
            xpSessionAwards,
            xpBuyEntries,
            xpBuyCorrections,
            campaignSessionState: campaign.sessionState
          });
          return { character, displayName, normalized };
        });

        const currentSession = normalizedRows.reduce((max, row) => {
          const value = Number(row.normalized.sheet?.sections?.bio?.bioGameSession || 0);
          return Number.isInteger(value) ? Math.max(max, value) : max;
        }, 0);
        const nextSession = currentSession + 1;
        if (nextSession > 9999) {
          throw httpError(400, "Game Session cannot exceed 9999.");
        }
        const now = new Date().toISOString();

        for (const row of normalizedRows) {
          const nextCharacter = adapter.applyCharacterSheetUpdate(
            row.character,
            {
              bioGameSession: nextSession,
              bioDateTime: now
            },
            {
              displayName: row.displayName,
              actorRole: "SYSTEM",
              xpSessionAwards,
              xpBuyEntries,
              xpBuyCorrections,
              campaignSessionState: campaign.sessionState
            }
          );
          Object.assign(row.character, nextCharacter);
          row.character.updatedAt = now;
        }

        const event = addEvent(data, {
          campaignId,
          type: "GAME_SESSION_ADVANCED",
          actorUserId: req.user.id,
          payload: {
            gameSession: nextSession,
            characterCount: normalizedRows.length
          }
        });

        return { gameSession: nextSession, characterCount: normalizedRows.length, event };
      });

      realtimeHub.publishSessionEvent(updated.event);
      res.json({
        gameSession: updated.gameSession,
        characterCount: updated.characterCount
      });
    })
  );

  app.post(
    "/api/v1/campaigns/:campaignId/rolls",
    auth.requireAuth,
    asyncHandler(async (req, res) => {
      const campaignId = req.params.campaignId;
      const pool = parseIntegerInRange(req.body.pool, {
        field: "Pool",
        min: 1,
        max: 20
      });
      const difficulty = parseIntegerInRange(
        req.body.difficulty === undefined ? 6 : req.body.difficulty,
        {
          field: "Difficulty",
          min: 2,
          max: 10
        }
      );
      const label = String(req.body.label || "").trim();

      const outcome = store.update((data) => {
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
        const event = addEvent(data, {
          campaignId,
          type: "DICE_ROLLED",
          actorUserId: req.user.id,
          payload: {
            label,
            ...roll
          }
        });

        return { roll, event };
      });
      realtimeHub.publishSessionEvent(outcome.event);

      res.status(201).json({ result: outcome.roll });
    })
  );
  }

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

      const created = store.update((data) => {
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
        let event = null;
        if (visibility === "PUBLIC") {
          event = addEvent(data, {
            campaignId,
            type: "CHAT_MESSAGE_PUBLIC",
            actorUserId: req.user.id,
            payload: {
              messageId: nextMessage.id
            }
          });
        }
        return { message: nextMessage, event };
      });

      const data = store.read();
      const userById = new Map(data.users.map((entry) => [entry.id, entry]));
      if (created.event) {
        realtimeHub.publishSessionEvent(created.event);
      }
      realtimeHub.publishChatMessage(created.message, userById);
      res.status(201).json({
        message: sanitizeChatMessage(created.message, userById)
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
      const state = parseCampaignSessionState(req.body.state);

      if (!state || !ALLOWED_CAMPAIGN_SESSION_STATES.has(state)) {
        throw httpError(400, "State must be active-live|active-offline|archived.");
      }

      const updated = store.update((data) => {
        const membership = findMembership(data, campaignId, req.user.id);
        if (!isGm(membership)) {
          throw httpError(403, "Only GM can change session state.");
        }

        const target = data.campaigns.find((entry) => entry.id === campaignId);
        if (!target) {
          throw httpError(404, "Campaign not found.");
        }

        if (state === "active-live") {
          const hasPendingXpBuyRequests = (data.xpBuyRequests || []).some(
            (entry) =>
              entry &&
              entry.campaignId === campaignId &&
              String(entry.status || "").toUpperCase() === "PENDING"
          );
          if (hasPendingXpBuyRequests) {
            throw httpError(
              400,
              "Cannot change session state to active-live while XP buy requests are pending."
            );
          }
        }

        target.sessionState = state;
        target.updatedAt = new Date().toISOString();

        const event = addEvent(data, {
          campaignId,
          type: "SESSION_STATE_CHANGED",
          actorUserId: req.user.id,
          payload: { state }
        });

        return { campaign: target, event };
      });
      realtimeHub.publishSessionEvent(updated.event);

      res.json({ campaign: sanitizeCampaign(updated.campaign, "GM") });
    })
  );

  const webDir = path.resolve(__dirname, "../../web");
  if (fs.existsSync(path.join(webDir, "index.html"))) {
    app.use("/", express.static(webDir));
    app.get(
      [
        "/login",
        "/login/",
        "/signup",
        "/signup/",
        "/home",
        "/home/",
        "/welcome",
        "/welcome/",
        "/player/menu",
        "/player/menu/",
        "/player/campaigns",
        "/player/campaigns/",
        "/player/character",
        "/player/character/",
        "/player/social",
        "/player/social/",
        "/master/menu",
        "/master/menu/",
        "/master/host",
        "/master/host/",
        "/master/rulesets",
        "/master/rulesets/",
        "/master/rulesets/new",
        "/master/rulesets/new/",
        "/master/games/passive",
        "/master/games/passive/",
        "/master/games/active",
        "/master/games/active/",
        "/master/game",
        "/master/game/"
      ],
      (_req, res) => {
        res.sendFile(path.join(webDir, "index.html"));
      }
    );
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
