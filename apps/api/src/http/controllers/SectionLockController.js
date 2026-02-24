export class SectionLockController {
  constructor({ sectionLockService, realtimeHub }) {
    this.sectionLockService = sectionLockService;
    this.realtimeHub = realtimeHub;
  }

  async setSectionLock(req, res) {
    const sectionId = String(req.body?.sectionId || "").trim();
    const locked = Boolean(req.body?.locked);

    const result = this.sectionLockService.setSectionLock(
      req.params.campaignId,
      req.params.characterId,
      req.user,
      { sectionId, locked }
    );
    this.realtimeHub.publishSessionEvent(result.event);
    res.json({
      character: result.character,
      sectionLocks: result.sectionLocks
    });
  }
}
