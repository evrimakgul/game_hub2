import { httpError } from "../../http/httpError.js";

export class CharacterSheetService {
  constructor({ transactionRunner, support, sessionEventService }) {
    this.transactionRunner = transactionRunner;
    this.support = support;
    this.sessionEventService = sessionEventService;
  }

  listCharacters(campaignId, actorUser) {
    return this.transactionRunner.read((data) => {
      const repos = this.support.createRepositories(data);
      const membership = this.support.requireMembership(repos, campaignId, actorUser.id);
      const allCharacters = repos.characters.listByCampaign(campaignId);
      const visibleCharacters =
        membership.role === "GM"
          ? allCharacters
          : allCharacters.filter((entry) => entry.userId === actorUser.id);
      const userById = repos.users.createUserMap();
      return {
        characters: visibleCharacters.map((entry) =>
          this.support.normalizeCharacterForResponse(data, entry, userById)
        )
      };
    });
  }

  getCharacter(campaignId, characterId, actorUser) {
    return this.transactionRunner.read((data) => {
      const repos = this.support.createRepositories(data);
      const membership = this.support.requireMembership(repos, campaignId, actorUser.id);
      const character = this.support.requireCharacterById(repos, campaignId, characterId);
      this.support.assertCanViewCharacter(membership, character);
      const userById = repos.users.createUserMap();
      return {
        character: this.support.normalizeCharacterForResponse(data, character, userById)
      };
    });
  }

  updateOwnCharacter(campaignId, actorUser, payload = {}) {
    return this.transactionRunner.update((data) => {
      const repos = this.support.createRepositories(data);
      const campaign = this.support.requireCampaign(repos, campaignId);
      const membership = this.support.requireMembership(repos, campaignId, actorUser.id);
      const adapter = this.support.getAdapterForCampaign(campaign, {
        requiredMethod: "applyCharacterSheetUpdate",
        missingMessage: "Ruleset adapter missing."
      });

      const character = this.support.ensureOwnCharacter({
        data,
        repos,
        campaign,
        actorUser
      });
      this.support.ensureCharacterSectionLocks(character, adapter);

      let nextCharacter;
      try {
        nextCharacter = adapter.applyCharacterSheetUpdate(character, payload, {
          displayName: actorUser.displayName,
          actorRole: membership.role,
          xpSessionAwards: data.xpSessionAwards || [],
          xpBuyEntries: data.xpBuyEntries || [],
          xpBuyCorrections: data.xpBuyCorrections || [],
          campaignSessionState: campaign.sessionState
        });
      } catch (error) {
        throw httpError(400, error?.message || "Invalid character sheet update.");
      }
      Object.assign(character, nextCharacter);
      character.updatedAt = new Date().toISOString();

      const event = this.sessionEventService.record(data, {
        campaignId,
        type: "CHARACTER_UPDATED",
        actorUserId: actorUser.id,
        payload: { characterId: character.id }
      });

      return { character, event };
    });
  }

  deleteCharacter(campaignId, characterId, actorUser) {
    return this.transactionRunner.update((data) => {
      const repos = this.support.createRepositories(data);
      this.support.requireCampaign(repos, campaignId);
      this.support.requireGmMembership(
        repos,
        campaignId,
        actorUser.id,
        "Only GM can delete characters."
      );
      const character = this.support.requireCharacterById(repos, campaignId, characterId);

      data.characterSheets = (data.characterSheets || []).filter(
        (entry) => !(entry && entry.campaignId === campaignId && entry.id === characterId)
      );
      data.xpBuyEntries = (data.xpBuyEntries || []).filter(
        (entry) => !(entry && entry.campaignId === campaignId && entry.characterId === characterId)
      );
      data.xpBuyCorrections = (data.xpBuyCorrections || []).filter(
        (entry) => !(entry && entry.campaignId === campaignId && entry.characterId === characterId)
      );
      data.xpBuyRequests = (data.xpBuyRequests || []).filter(
        (entry) => !(entry && entry.campaignId === campaignId && entry.characterId === characterId)
      );
      data.xpSessionAwards = (data.xpSessionAwards || []).map((record) => {
        if (!record || record.campaignId !== campaignId || !Array.isArray(record.awards)) {
          return record;
        }
        return {
          ...record,
          awards: record.awards.filter((award) => award?.characterId !== characterId)
        };
      });

      const event = this.sessionEventService.record(data, {
        campaignId,
        type: "CHARACTER_DELETED",
        actorUserId: actorUser.id,
        payload: {
          characterId,
          userId: character.userId
        }
      });

      return {
        deletedCharacterId: characterId,
        deletedUserId: character.userId,
        event
      };
    });
  }
}
