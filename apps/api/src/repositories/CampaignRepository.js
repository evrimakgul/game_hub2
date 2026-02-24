export class CampaignRepository {
  constructor(data) {
    this.data = data;
  }

  findById(campaignId) {
    return this.data.campaigns.find((entry) => entry.id === campaignId);
  }
}
