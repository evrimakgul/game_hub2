import { httpError } from "../../http/httpError.js";

export class CharacterRecordFactory {
  constructor({ rulesetRegistry, createId }) {
    this.rulesetRegistry = rulesetRegistry;
    this.createId = createId;
  }

  createDefaultForCampaignMember({
    campaignId,
    userId,
    displayName,
    rulesetId,
    xpSessionAwards = [],
    xpBuyEntries = []
  }) {
    const adapter = this.rulesetRegistry.getAdapter(rulesetId);
    if (!adapter || typeof adapter.createDefaultCharacterSheetData !== "function") {
      throw httpError(500, "Ruleset adapter missing.");
    }

    const now = new Date().toISOString();
    return {
      id: this.createId(),
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
      numericBonuses: {},
      createdAt: now,
      updatedAt: now
    };
  }
}
