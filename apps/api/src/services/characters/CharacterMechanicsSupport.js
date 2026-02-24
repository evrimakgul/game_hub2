import { isGm } from "../../permissions.js";
import { httpError } from "../../http/httpError.js";
import { CampaignRepository } from "../../repositories/CampaignRepository.js";
import { CharacterRepository } from "../../repositories/CharacterRepository.js";
import { MembershipRepository } from "../../repositories/MembershipRepository.js";
import { UserRepository } from "../../repositories/UserRepository.js";
import { XpLedgerRepository } from "../../repositories/XpLedgerRepository.js";
import { XpCorrectionRepository } from "../../repositories/XpCorrectionRepository.js";
import { SectionLockState } from "../../domain/characters/SectionLockState.js";
import { XpBuyRequestRepository } from "../../repositories/XpBuyRequestRepository.js";

export class CharacterMechanicsSupport {
  constructor({
    rulesetRegistry,
    characterRecordFactory,
    campaignSessionStatePolicy,
    characterAccessPolicy,
    createId
  }) {
    this.rulesetRegistry = rulesetRegistry;
    this.characterRecordFactory = characterRecordFactory;
    this.campaignSessionStatePolicy = campaignSessionStatePolicy;
    this.characterAccessPolicy = characterAccessPolicy;
    this.createId = createId;
  }

  createRepositories(data) {
    return {
      campaigns: new CampaignRepository(data),
      characters: new CharacterRepository(data),
      memberships: new MembershipRepository(data),
      users: new UserRepository(data),
      xpLedger: new XpLedgerRepository(data, { createId: this.createId }),
      xpCorrections: new XpCorrectionRepository(data),
      xpBuyRequests: new XpBuyRequestRepository(data)
    };
  }

  requireCampaign(repos, campaignId) {
    const campaign = repos.campaigns.findById(campaignId);
    if (!campaign) {
      throw httpError(404, "Campaign not found.");
    }
    return campaign;
  }

  requireMembership(repos, campaignId, userId) {
    const membership = repos.memberships.findActive(campaignId, userId);
    if (!membership) {
      throw httpError(403, "Campaign access denied.");
    }
    return membership;
  }

  requireGmMembership(repos, campaignId, userId, message = "Only GM can perform this action.") {
    const membership = this.requireMembership(repos, campaignId, userId);
    if (!isGm(membership)) {
      throw httpError(403, message);
    }
    return membership;
  }

  getAdapterForCampaign(campaign, { requiredMethod, missingMessage } = {}) {
    const adapter = this.rulesetRegistry.getAdapter(campaign.rulesetId);
    if (!adapter) {
      throw httpError(500, missingMessage || "Ruleset adapter missing.");
    }
    if (requiredMethod && typeof adapter[requiredMethod] !== "function") {
      throw httpError(500, missingMessage || "Ruleset adapter missing.");
    }
    return adapter;
  }

  ensureOwnCharacter({ data, repos, campaign, actorUser }) {
    let character = repos.characters.findByCampaignAndUser(campaign.id, actorUser.id);
    if (!character) {
      character = this.characterRecordFactory.createDefaultForCampaignMember({
        campaignId: campaign.id,
        userId: actorUser.id,
        displayName: actorUser.displayName,
        rulesetId: campaign.rulesetId,
        xpSessionAwards: data.xpSessionAwards || [],
        xpBuyEntries: data.xpBuyEntries || []
      });
      repos.characters.add(character);
    }
    return character;
  }

  requireCharacterById(repos, campaignId, characterId) {
    const character = repos.characters.findByCampaignAndId(campaignId, characterId);
    if (!character) {
      throw httpError(404, "Character not found.");
    }
    return character;
  }

  ensureCharacterSectionLocks(character, adapter) {
    return SectionLockState.ensureCharacterSectionLocks(character, adapter);
  }

  lockableSectionIds(adapter) {
    return SectionLockState.lockableSectionIds(adapter);
  }

  normalizeCharacterWithAdapter(data, { campaign, character, displayName, adapter }) {
    return adapter.normalizeCharacterSheet(character, {
      displayName,
      xpSessionAwards: data.xpSessionAwards || [],
      xpBuyEntries: data.xpBuyEntries || [],
      xpBuyCorrections: data.xpBuyCorrections || [],
      campaignSessionState: this.campaignSessionStatePolicy.normalize(
        campaign.sessionState
      )
    });
  }

  normalizeCharacterForResponse(data, character, userById = new Map()) {
    const repos = this.createRepositories(data);
    const campaign = repos.campaigns.findById(character?.campaignId);
    if (!campaign) {
      return character;
    }
    let adapter;
    try {
      adapter = this.getAdapterForCampaign(campaign, {
        requiredMethod: "normalizeCharacterSheet",
        missingMessage: "Ruleset adapter missing."
      });
    } catch {
      return character;
    }

    const displayName = userById.get(character.userId)?.displayName || "Adventurer";
    try {
      return this.normalizeCharacterWithAdapter(data, {
        campaign,
        character,
        displayName,
        adapter
      });
    } catch {
      return character;
    }
  }

  assertCanViewCharacter(membership, character) {
    this.characterAccessPolicy.assertCanView(membership, character);
  }
}
