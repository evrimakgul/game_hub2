export class CharacterRepository {
  constructor(data) {
    this.data = data;
    if (!Array.isArray(this.data.characterSheets)) {
      this.data.characterSheets = [];
    }
  }

  listByCampaign(campaignId) {
    return this.data.characterSheets.filter((entry) => entry.campaignId === campaignId);
  }

  findByCampaignAndId(campaignId, characterId) {
    return this.data.characterSheets.find(
      (entry) => entry.campaignId === campaignId && entry.id === characterId
    );
  }

  findByCampaignAndUser(campaignId, userId) {
    return this.data.characterSheets.find(
      (entry) => entry.campaignId === campaignId && entry.userId === userId
    );
  }

  add(character) {
    this.data.characterSheets.push(character);
    return character;
  }
}
