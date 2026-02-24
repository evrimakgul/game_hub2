import { httpError } from "../../http/httpError.js";

export class XpBuyService {
  constructor({
    transactionRunner,
    support,
    sessionEventService,
    sectionLockService,
    campaignSessionStatePolicy,
    createId
  }) {
    this.transactionRunner = transactionRunner;
    this.support = support;
    this.sessionEventService = sessionEventService;
    this.sectionLockService = sectionLockService;
    this.campaignSessionStatePolicy = campaignSessionStatePolicy;
    this.createId = createId;
  }

  createBuyForSelf(campaignId, actorUser, payload = {}) {
    return this.transactionRunner.update((data) => {
      const repos = this.support.createRepositories(data);
      const campaign = this.support.requireCampaign(repos, campaignId);
      this.campaignSessionStatePolicy.assertNotActiveLive(
        campaign,
        "XP buy is locked while session state is active-live."
      );
      const membership = this.support.requireMembership(repos, campaignId, actorUser.id);

      const adapter = this.support.getAdapterForCampaign(campaign, {
        missingMessage: "Ruleset XP buy support missing."
      });
      if (
        typeof adapter.validateAndPriceXpBuyAction !== "function" ||
        typeof adapter.normalizeCharacterSheet !== "function"
      ) {
        throw httpError(500, "Ruleset XP buy support missing.");
      }

      repos.xpLedger.ensureXpBuyEntriesStore();
      repos.xpCorrections.ensureStore();

      const character = this.support.ensureOwnCharacter({
        data,
        repos,
        campaign,
        actorUser
      });
      this.support.ensureCharacterSectionLocks(character, adapter);

      if (repos.xpCorrections.hasPendingForCharacter({ campaignId, characterId: character.id })) {
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

      const now = new Date().toISOString();
      const normalizedBefore = this.support.normalizeCharacterWithAdapter(data, {
        campaign,
        character,
        displayName: actorUser.displayName,
        adapter
      });
      const sessionNumber = Number(
        normalizedBefore.sheet?.sections?.bio?.bioGameSession || 0
      );

      const entryId = this.createId();
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
        actorUserId: actorUser.id,
        actorRole: String(membership.role || "PLAYER").toUpperCase(),
        createdAt: now,
        sessionNumber: Number.isInteger(sessionNumber) ? sessionNumber : 0
      };
      if (entry.target?.fieldId) entry.fieldId = entry.target.fieldId;
      if (entry.target?.tierId) entry.tierId = entry.target.tierId;
      if (entry.target?.powerId) entry.powerId = entry.target.powerId;
      if (entry.target?.traitId) entry.traitId = entry.target.traitId;

      repos.xpLedger.addXpBuyEntry(entry);
      character.updatedAt = now;

      const normalizedAfter = this.support.normalizeCharacterWithAdapter(data, {
        campaign,
        character,
        displayName: actorUser.displayName,
        adapter
      });
      Object.assign(character, normalizedAfter);

      const event = this.sessionEventService.record(data, {
        campaignId,
        type: "XP_BUY_CREATED",
        actorUserId: actorUser.id,
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
  }
}
