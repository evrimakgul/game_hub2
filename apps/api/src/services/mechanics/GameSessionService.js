import { httpError } from "../../http/httpError.js";

export class GameSessionService {
  constructor({ transactionRunner, support, sessionEventService }) {
    this.transactionRunner = transactionRunner;
    this.support = support;
    this.sessionEventService = sessionEventService;
  }

  advanceSession(campaignId, actorUser) {
    return this.transactionRunner.update((data) => {
      const repos = this.support.createRepositories(data);
      const campaign = this.support.requireCampaign(repos, campaignId);
      this.support.requireGmMembership(
        repos,
        campaignId,
        actorUser.id,
        "Only GM can advance game session."
      );

      const adapter = this.support.getAdapterForCampaign(campaign, {
        requiredMethod: "applyCharacterSheetUpdate",
        missingMessage: "Ruleset adapter missing."
      });

      const campaignCharacters = repos.characters.listByCampaign(campaignId);
      const userById = repos.users.createUserMap();
      const xpSessionAwards = data.xpSessionAwards || [];
      const xpBuyEntries = data.xpBuyEntries || [];
      const xpBuyCorrections = data.xpBuyCorrections || [];
      const normalizedRows = campaignCharacters.map((character) => {
        const displayName = userById.get(character.userId)?.displayName || "Adventurer";
        this.support.ensureCharacterSectionLocks(character, adapter);
        const normalized = this.support.normalizeCharacterWithAdapter(data, {
          campaign,
          character,
          displayName,
          adapter
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

      const event = this.sessionEventService.record(data, {
        campaignId,
        type: "GAME_SESSION_ADVANCED",
        actorUserId: actorUser.id,
        payload: {
          gameSession: nextSession,
          characterCount: normalizedRows.length
        }
      });

      return {
        gameSession: nextSession,
        characterCount: normalizedRows.length,
        event
      };
    });
  }
}
