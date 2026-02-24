import { httpError } from "../../http/httpError.js";

export class XpSessionService {
  constructor({ transactionRunner, support, sessionEventService, campaignSessionStatePolicy }) {
    this.transactionRunner = transactionRunner;
    this.support = support;
    this.sessionEventService = sessionEventService;
    this.campaignSessionStatePolicy = campaignSessionStatePolicy;
  }

  listSessionAwards(campaignId, actorUser) {
    return this.transactionRunner.read((data) => {
      const repos = this.support.createRepositories(data);
      this.support.requireMembership(repos, campaignId, actorUser.id);
      return { records: repos.xpLedger.listSessionAwards(campaignId) };
    });
  }

  claimOwnSessionXp(campaignId, actorUser) {
    return this.#claim(campaignId, null, actorUser, {});
  }

  claimForCharacter(campaignId, characterId, actorUser, options = {}) {
    return this.#claim(campaignId, characterId, actorUser, options);
  }

  #claim(campaignId, characterId, actorUser, options = {}) {
    return this.transactionRunner.update((data) => {
      const repos = this.support.createRepositories(data);
      const campaign = this.support.requireCampaign(repos, campaignId);
      this.campaignSessionStatePolicy.assertNotActiveLive(
        campaign,
        "Session XP apply is locked while session state is active-live."
      );

      if (characterId) {
        this.support.requireGmMembership(
          repos,
          campaignId,
          actorUser.id,
          "Only GM can apply Session XP for another player."
        );
      } else {
        this.support.requireMembership(repos, campaignId, actorUser.id);
      }

      const adapter = this.support.getAdapterForCampaign(campaign, {
        requiredMethod: "applyCharacterSheetUpdate",
        missingMessage: "Ruleset adapter missing."
      });

      let character;
      let displayName;
      if (characterId) {
        character = this.support.requireCharacterById(repos, campaignId, characterId);
        const user = repos.users.findById(character.userId);
        displayName = user?.displayName || "Adventurer";
      } else {
        character = this.support.ensureOwnCharacter({
          data,
          repos,
          campaign,
          actorUser
        });
        displayName = actorUser.displayName;
      }

      this.support.ensureCharacterSectionLocks(character, adapter);
      const normalized = this.support.normalizeCharacterWithAdapter(data, {
        campaign,
        character,
        displayName,
        adapter
      });

      let sessionXp = Number(normalized.sheet?.sections?.bio?.bioSessionXp || 0);
      const rawOverrideXp = options?.xp;
      const hasOverrideXp =
        characterId &&
        rawOverrideXp !== undefined &&
        rawOverrideXp !== null &&
        String(rawOverrideXp).trim() !== "";
      if (hasOverrideXp) {
        sessionXp = Number(rawOverrideXp);
      }
      if (!Number.isInteger(sessionXp) || sessionXp <= 0) {
        throw httpError(400, "Session XP must be greater than 0 to apply.");
      }
      const sessionNumber = Number(
        normalized.sheet?.sections?.bio?.bioGameSession || 0
      );
      const awardDate = new Date().toISOString();

      const awardRecord = repos.xpLedger.upsertSessionAwardRecord({
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

      const event = this.sessionEventService.record(data, {
        campaignId,
        type: "SESSION_XP_APPLIED",
        actorUserId: actorUser.id,
        payload: {
          characterId: character.id,
          userId: character.userId,
          sessionNumber,
          xp: sessionXp,
          ...(characterId ? { appliedByRole: "GM" } : {})
        }
      });

      return { character, awardRecord, event };
    });
  }
}
