export class CharacterController {
  constructor({ characterSheetService, realtimeHub }) {
    this.characterSheetService = characterSheetService;
    this.realtimeHub = realtimeHub;
  }

  async listCharacters(req, res) {
    const result = this.characterSheetService.listCharacters(
      req.params.campaignId,
      req.user
    );
    res.json(result);
  }

  async getCharacter(req, res) {
    const result = this.characterSheetService.getCharacter(
      req.params.campaignId,
      req.params.characterId,
      req.user
    );
    res.json(result);
  }

  async updateOwnCharacter(req, res) {
    const result = this.characterSheetService.updateOwnCharacter(
      req.params.campaignId,
      req.user,
      req.body || {}
    );
    this.realtimeHub.publishSessionEvent(result.event);
    res.json({ character: result.character });
  }

  async deleteCharacter(req, res) {
    const result = this.characterSheetService.deleteCharacter(
      req.params.campaignId,
      req.params.characterId,
      req.user
    );
    this.realtimeHub.publishSessionEvent(result.event);
    res.json({
      deletedCharacterId: result.deletedCharacterId,
      deletedUserId: result.deletedUserId
    });
  }
}
