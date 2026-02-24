export class XpCorrectionController {
  constructor({ xpCorrectionService, realtimeHub }) {
    this.xpCorrectionService = xpCorrectionService;
    this.realtimeHub = realtimeHub;
  }

  async listCorrections(req, res) {
    const result = this.xpCorrectionService.listCorrections(
      req.params.campaignId,
      req.params.characterId,
      req.user
    );
    res.json(result);
  }

  async createCorrection(req, res) {
    const result = this.xpCorrectionService.createCorrection(
      req.params.campaignId,
      req.params.characterId,
      req.user,
      req.body || {}
    );
    this.realtimeHub.publishSessionEvent(result.event);
    res.status(201).json({ correction: result.correction });
  }

  async confirmCorrection(req, res) {
    const result = this.xpCorrectionService.confirmCorrection(
      req.params.campaignId,
      req.params.correctionId,
      req.user,
      req.body || {}
    );
    this.realtimeHub.publishSessionEvent(result.event);
    res.json({ correction: result.correction });
  }

  async denyCorrection(req, res) {
    const result = this.xpCorrectionService.denyCorrection(
      req.params.campaignId,
      req.params.correctionId,
      req.user,
      req.body || {}
    );
    this.realtimeHub.publishSessionEvent(result.event);
    res.json({ correction: result.correction });
  }
}
