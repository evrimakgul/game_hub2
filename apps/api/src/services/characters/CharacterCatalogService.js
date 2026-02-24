export class CharacterCatalogService {
  constructor({ transactionRunner, support }) {
    this.transactionRunner = transactionRunner;
    this.support = support;
  }

  getSchema(campaignId, actorUser) {
    return this.transactionRunner.read((data) => {
      const repos = this.support.createRepositories(data);
      const campaign = this.support.requireCampaign(repos, campaignId);
      this.support.requireMembership(repos, campaignId, actorUser.id);
      const adapter = this.support.getAdapterForCampaign(campaign, {
        requiredMethod: "getSheetSchema",
        missingMessage: "Ruleset adapter missing."
      });
      return {
        rulesetId: campaign.rulesetId,
        schema: adapter.getSheetSchema()
      };
    });
  }

  getPowerCatalog(campaignId, actorUser) {
    return this.transactionRunner.read((data) => {
      const repos = this.support.createRepositories(data);
      const campaign = this.support.requireCampaign(repos, campaignId);
      this.support.requireMembership(repos, campaignId, actorUser.id);
      const adapter = this.support.getAdapterForCampaign(campaign, {
        requiredMethod: "getPowerSystem",
        missingMessage: "Ruleset power system missing."
      });
      return {
        rulesetId: campaign.rulesetId,
        powerSystem: adapter.getPowerSystem()
      };
    });
  }

  getMeritsFlawsCatalog(campaignId, actorUser) {
    return this.transactionRunner.read((data) => {
      const repos = this.support.createRepositories(data);
      const campaign = this.support.requireCampaign(repos, campaignId);
      this.support.requireMembership(repos, campaignId, actorUser.id);
      const adapter = this.support.getAdapterForCampaign(campaign, {
        requiredMethod: "getMeritsFlawsSystem",
        missingMessage: "Ruleset merits/flaws system missing."
      });
      return {
        rulesetId: campaign.rulesetId,
        meritsFlawsSystem: adapter.getMeritsFlawsSystem()
      };
    });
  }
}
