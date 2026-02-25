export class ModifierSourceController {
  constructor({ modifierSourceService, realtimeHub }) {
    this.modifierSourceService = modifierSourceService;
    this.realtimeHub = realtimeHub;
  }

  async listModifierSources(req, res) {
    const result = this.modifierSourceService.listModifierSources(
      req.params.campaignId,
      req.params.characterId,
      req.user
    );
    res.json(result);
  }

  async createModifierSource(req, res) {
    const result = this.modifierSourceService.createModifierSource(
      req.params.campaignId,
      req.params.characterId,
      req.user,
      req.body || {}
    );
    this.realtimeHub.publishSessionEvent(result.event);
    res.status(201).json({
      modifierSource: result.modifierSource,
      modifierSources: result.modifierSources,
      character: result.character
    });
  }

  async updateModifierSource(req, res) {
    const result = this.modifierSourceService.updateModifierSource(
      req.params.campaignId,
      req.params.characterId,
      req.params.sourceId,
      req.user,
      req.body || {}
    );
    this.realtimeHub.publishSessionEvent(result.event);
    res.json({
      modifierSource: result.modifierSource,
      modifierSources: result.modifierSources,
      character: result.character
    });
  }

  async deleteModifierSource(req, res) {
    const result = this.modifierSourceService.deleteModifierSource(
      req.params.campaignId,
      req.params.characterId,
      req.params.sourceId,
      req.user
    );
    this.realtimeHub.publishSessionEvent(result.event);
    res.json({
      deletedSourceId: result.deletedSourceId,
      modifierSources: result.modifierSources,
      character: result.character
    });
  }

  async toggleModifierSource(req, res) {
    const result = this.modifierSourceService.toggleModifierSource(
      req.params.campaignId,
      req.params.characterId,
      req.params.sourceId,
      req.user
    );
    this.realtimeHub.publishSessionEvent(result.event);
    res.json({
      modifierSource: result.modifierSource,
      modifierSources: result.modifierSources,
      character: result.character
    });
  }
}

