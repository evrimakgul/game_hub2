import { httpError } from "../../http/httpError.js";

const ALLOWED_SOURCE_KINDS = new Set([
  "equipment",
  "buff",
  "debuff",
  "racial",
  "special",
  "manual-gm"
]);

const ALLOWED_CHANNELS = new Set([
  "equipment",
  "buff",
  "debuff",
  "racial",
  "special",
  "manual",
  "manual-gm"
]);

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeTargetFieldId(targetFieldId) {
  const raw = normalizeString(targetFieldId);
  if (!raw) return "";
  if (raw.startsWith("powers.")) {
    const parts = raw.split(".");
    if (parts.length === 2) {
      return `powers.t1.${parts[1]}`;
    }
    if (parts.length === 3) {
      return `powers.${parts[1]}.${parts[2]}`;
    }
  }
  return raw;
}

function canonicalModifierChannel(kind, channel) {
  const rawChannel = normalizeString(channel).toLowerCase();
  if (ALLOWED_CHANNELS.has(rawChannel)) {
    return rawChannel === "manual-gm" ? "manual" : rawChannel;
  }
  const rawKind = normalizeString(kind).toLowerCase();
  if (rawKind === "manual-gm") return "manual";
  return ALLOWED_CHANNELS.has(rawKind) ? rawKind : "manual";
}

function buildSupportedTargetSet(normalizedCharacter) {
  const supported = new Set();
  for (const fieldId of Object.keys(normalizedCharacter?.numericTriples?.combat || {})) {
    supported.add(`combat.${fieldId}`);
    supported.add(fieldId);
  }
  for (const [groupId, rows] of Object.entries(normalizedCharacter?.numericTriples?.stats || {})) {
    for (const fieldId of Object.keys(rows || {})) {
      supported.add(`stats.${groupId}.${fieldId}`);
      supported.add(fieldId);
    }
  }
  for (const fieldId of Object.keys(normalizedCharacter?.numericTriples?.skills || {})) {
    supported.add(`skills.${fieldId}`);
    supported.add(fieldId);
  }
  for (const [tierId, rows] of Object.entries(normalizedCharacter?.numericTriples?.powers || {})) {
    for (const powerId of Object.keys(rows || {})) {
      supported.add(`powers.${tierId}.${powerId}`);
      if (tierId === "t1") {
        supported.add(`powers.${powerId}`);
      }
    }
  }
  return supported;
}

function sortSources(sources) {
  return [...(Array.isArray(sources) ? sources : [])].sort((a, b) => {
    const aTime = Date.parse(a?.createdAt || 0) || 0;
    const bTime = Date.parse(b?.createdAt || 0) || 0;
    if (aTime !== bTime) return bTime - aTime;
    return String(a?.id || "").localeCompare(String(b?.id || ""));
  });
}

export class ModifierSourceService {
  constructor({ transactionRunner, support, sessionEventService, createId }) {
    this.transactionRunner = transactionRunner;
    this.support = support;
    this.sessionEventService = sessionEventService;
    this.createId = createId;
  }

  listModifierSources(campaignId, characterId, actorUser) {
    return this.transactionRunner.read((data) => {
      const repos = this.support.createRepositories(data);
      const campaign = this.support.requireCampaign(repos, campaignId);
      this.support.requireGmMembership(
        repos,
        campaignId,
        actorUser.id,
        "Only GM can manage modifier sources."
      );
      const character = this.support.requireCharacterById(repos, campaignId, characterId);
      const adapter = this.support.getAdapterForCampaign(campaign, {
        requiredMethod: "normalizeCharacterSheet",
        missingMessage: "Ruleset adapter missing."
      });
      const displayName =
        repos.users.findById?.(character.userId)?.displayName ||
        repos.users.createUserMap().get(character.userId)?.displayName ||
        "Adventurer";
      const normalizedCharacter = this.support.normalizeCharacterWithAdapter(data, {
        campaign,
        character,
        displayName,
        adapter
      });
      return {
        modifierSources: sortSources(character.modifierSources || []),
        character: normalizedCharacter
      };
    });
  }

  createModifierSource(campaignId, characterId, actorUser, body = {}) {
    return this.transactionRunner.update((data) => {
      const { repos, campaign, character, normalizedCharacter } = this.#loadAndAuthorizeForUpdate(
        data,
        campaignId,
        characterId,
        actorUser
      );
      const now = new Date().toISOString();
      const source = this.#buildSourceRecord(body, {
        actorUserId: actorUser.id,
        now,
        supportedTargets: buildSupportedTargetSet(normalizedCharacter)
      });
      character.modifierSources = Array.isArray(character.modifierSources)
        ? character.modifierSources
        : [];
      character.modifierSources.push(source);
      character.updatedAt = now;

      const updatedCharacter = this.support.normalizeCharacterWithAdapter(data, {
        campaign,
        character,
        displayName:
          repos.users.createUserMap().get(character.userId)?.displayName || "Adventurer",
        adapter: this.support.getAdapterForCampaign(campaign, {
          requiredMethod: "normalizeCharacterSheet",
          missingMessage: "Ruleset adapter missing."
        })
      });
      const event = this.sessionEventService.record(data, {
        campaignId,
        type: "MODIFIER_SOURCE_CREATED",
        actorUserId: actorUser.id,
        payload: { characterId: character.id, sourceId: source.id }
      });
      return {
        modifierSource: source,
        modifierSources: sortSources(character.modifierSources || []),
        character: updatedCharacter,
        event
      };
    });
  }

  updateModifierSource(campaignId, characterId, sourceId, actorUser, body = {}) {
    return this.transactionRunner.update((data) => {
      const { repos, campaign, character, normalizedCharacter } = this.#loadAndAuthorizeForUpdate(
        data,
        campaignId,
        characterId,
        actorUser
      );
      const list = Array.isArray(character.modifierSources) ? character.modifierSources : [];
      const existing = list.find((entry) => entry?.id === sourceId);
      if (!existing) {
        throw httpError(404, "Modifier source not found.");
      }
      const now = new Date().toISOString();
      const replacement = this.#buildSourceRecord(body, {
        actorUserId: existing.createdByUserId || actorUser.id,
        now,
        supportedTargets: buildSupportedTargetSet(normalizedCharacter),
        existing
      });
      const idx = list.indexOf(existing);
      list[idx] = replacement;
      character.modifierSources = list;
      character.updatedAt = now;

      const updatedCharacter = this.support.normalizeCharacterWithAdapter(data, {
        campaign,
        character,
        displayName:
          repos.users.createUserMap().get(character.userId)?.displayName || "Adventurer",
        adapter: this.support.getAdapterForCampaign(campaign, {
          requiredMethod: "normalizeCharacterSheet",
          missingMessage: "Ruleset adapter missing."
        })
      });
      const event = this.sessionEventService.record(data, {
        campaignId,
        type: "MODIFIER_SOURCE_UPDATED",
        actorUserId: actorUser.id,
        payload: { characterId: character.id, sourceId }
      });
      return {
        modifierSource: replacement,
        modifierSources: sortSources(list),
        character: updatedCharacter,
        event
      };
    });
  }

  deleteModifierSource(campaignId, characterId, sourceId, actorUser) {
    return this.transactionRunner.update((data) => {
      const { repos, campaign, character } = this.#loadAndAuthorizeForUpdate(
        data,
        campaignId,
        characterId,
        actorUser
      );
      const list = Array.isArray(character.modifierSources) ? character.modifierSources : [];
      const existing = list.find((entry) => entry?.id === sourceId);
      if (!existing) {
        throw httpError(404, "Modifier source not found.");
      }
      character.modifierSources = list.filter((entry) => entry?.id !== sourceId);
      character.updatedAt = new Date().toISOString();

      const updatedCharacter = this.support.normalizeCharacterWithAdapter(data, {
        campaign,
        character,
        displayName:
          repos.users.createUserMap().get(character.userId)?.displayName || "Adventurer",
        adapter: this.support.getAdapterForCampaign(campaign, {
          requiredMethod: "normalizeCharacterSheet",
          missingMessage: "Ruleset adapter missing."
        })
      });
      const event = this.sessionEventService.record(data, {
        campaignId,
        type: "MODIFIER_SOURCE_DELETED",
        actorUserId: actorUser.id,
        payload: { characterId: character.id, sourceId }
      });
      return {
        deletedSourceId: sourceId,
        modifierSources: sortSources(character.modifierSources),
        character: updatedCharacter,
        event
      };
    });
  }

  toggleModifierSource(campaignId, characterId, sourceId, actorUser) {
    return this.transactionRunner.update((data) => {
      const { repos, campaign, character } = this.#loadAndAuthorizeForUpdate(
        data,
        campaignId,
        characterId,
        actorUser
      );
      const list = Array.isArray(character.modifierSources) ? character.modifierSources : [];
      const existing = list.find((entry) => entry?.id === sourceId);
      if (!existing) {
        throw httpError(404, "Modifier source not found.");
      }
      existing.active = !Boolean(existing.active);
      existing.updatedAt = new Date().toISOString();
      character.updatedAt = existing.updatedAt;

      const updatedCharacter = this.support.normalizeCharacterWithAdapter(data, {
        campaign,
        character,
        displayName:
          repos.users.createUserMap().get(character.userId)?.displayName || "Adventurer",
        adapter: this.support.getAdapterForCampaign(campaign, {
          requiredMethod: "normalizeCharacterSheet",
          missingMessage: "Ruleset adapter missing."
        })
      });
      const event = this.sessionEventService.record(data, {
        campaignId,
        type: "MODIFIER_SOURCE_TOGGLED",
        actorUserId: actorUser.id,
        payload: { characterId: character.id, sourceId, active: existing.active }
      });
      return {
        modifierSource: structuredClone(existing),
        modifierSources: sortSources(list),
        character: updatedCharacter,
        event
      };
    });
  }

  #loadAndAuthorizeForUpdate(data, campaignId, characterId, actorUser) {
    const repos = this.support.createRepositories(data);
    const campaign = this.support.requireCampaign(repos, campaignId);
    this.support.requireGmMembership(
      repos,
      campaignId,
      actorUser.id,
      "Only GM can manage modifier sources."
    );
    const character = this.support.requireCharacterById(repos, campaignId, characterId);
    const adapter = this.support.getAdapterForCampaign(campaign, {
      requiredMethod: "normalizeCharacterSheet",
      missingMessage: "Ruleset adapter missing."
    });
    const normalizedCharacter = this.support.normalizeCharacterWithAdapter(data, {
      campaign,
      character,
      displayName:
        repos.users.createUserMap().get(character.userId)?.displayName || "Adventurer",
      adapter
    });
    return { repos, campaign, character, normalizedCharacter };
  }

  #buildSourceRecord(body, { actorUserId, now, supportedTargets, existing = null }) {
    const kind = normalizeString(body.kind || existing?.kind || "manual-gm").toLowerCase();
    if (!ALLOWED_SOURCE_KINDS.has(kind)) {
      throw httpError(400, "Invalid modifier source kind.");
    }
    const label = normalizeString(body.label || existing?.label || "");
    if (!label) {
      throw httpError(400, "Modifier source label is required.");
    }
    const notes = normalizeString(body.notes ?? existing?.notes ?? "");
    const active =
      body.active === undefined
        ? existing?.active === undefined
          ? true
          : Boolean(existing.active)
        : Boolean(body.active);

    const rawModifiers = Array.isArray(body.modifiers)
      ? body.modifiers
      : Array.isArray(existing?.modifiers)
        ? existing.modifiers
        : [];
    if (rawModifiers.length < 1) {
      throw httpError(400, "At least one modifier entry is required.");
    }

    const modifiers = rawModifiers.map((entry, index) => {
      const targetFieldId = normalizeTargetFieldId(entry?.targetFieldId || "");
      if (!targetFieldId) {
        throw httpError(400, `Modifier ${index + 1} targetFieldId is required.`);
      }
      if (supportedTargets && !supportedTargets.has(targetFieldId)) {
        throw httpError(400, `Unsupported modifier target '${targetFieldId}'.`);
      }
      const amount = Number(entry?.amount);
      if (!Number.isInteger(amount)) {
        throw httpError(400, `Modifier ${index + 1} amount must be an integer.`);
      }
      return {
        id: normalizeString(entry?.id || "") || this.createId(),
        targetFieldId,
        amount,
        channel: canonicalModifierChannel(kind, entry?.channel)
      };
    });

    return {
      id: normalizeString(body.id || existing?.id || "") || this.createId(),
      kind,
      label,
      active,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      createdByUserId: existing?.createdByUserId || actorUserId || null,
      notes,
      modifiers
    };
  }
}

