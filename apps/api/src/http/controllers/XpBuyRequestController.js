export class XpBuyRequestController {
  constructor({ xpBuyRequestService, realtimeHub }) {
    this.xpBuyRequestService = xpBuyRequestService;
    this.realtimeHub = realtimeHub;
  }

  async createRequestForSelf(req, res) {
    const result = this.xpBuyRequestService.createRequestForSelf(
      req.params.campaignId,
      req.user,
      req.body || {}
    );
    this.realtimeHub.publishSessionEvent(result.event);
    res.status(201).json({ request: result.request });
  }

  async listRequests(req, res) {
    const result = this.xpBuyRequestService.listRequests(
      req.params.campaignId,
      req.user,
      req.query || {}
    );
    res.json(result);
  }

  async approveRequest(req, res) {
    const result = this.xpBuyRequestService.approveRequest(
      req.params.campaignId,
      req.params.requestId,
      req.user,
      req.body || {}
    );
    this.realtimeHub.publishSessionEvent(result.event);
    res.json({ request: result.request, character: result.character });
  }

  async denyRequest(req, res) {
    const result = this.xpBuyRequestService.denyRequest(
      req.params.campaignId,
      req.params.requestId,
      req.user,
      req.body || {}
    );
    this.realtimeHub.publishSessionEvent(result.event);
    res.json({ request: result.request });
  }
}
