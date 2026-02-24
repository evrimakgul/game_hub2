export class MechanicsController {
  constructor({
    xpBuyService,
    xpSessionService,
    gameSessionService,
    diceRollService,
    realtimeHub
  }) {
    this.xpBuyService = xpBuyService;
    this.xpSessionService = xpSessionService;
    this.gameSessionService = gameSessionService;
    this.diceRollService = diceRollService;
    this.realtimeHub = realtimeHub;
  }

  async createXpBuyForSelf(req, res) {
    const result = this.xpBuyService.createBuyForSelf(
      req.params.campaignId,
      req.user,
      req.body || {}
    );
    this.realtimeHub.publishSessionEvent(result.event);
    res.status(201).json({
      character: result.character,
      receipt: result.receipt
    });
  }

  async claimOwnSessionXp(req, res) {
    const result = this.xpSessionService.claimOwnSessionXp(
      req.params.campaignId,
      req.user
    );
    this.realtimeHub.publishSessionEvent(result.event);
    res.json({
      character: result.character,
      awardRecord: result.awardRecord
    });
  }

  async claimSessionXpForCharacter(req, res) {
    const result = this.xpSessionService.claimForCharacter(
      req.params.campaignId,
      req.params.characterId,
      req.user,
      {
        xp: req.body?.xp
      }
    );
    this.realtimeHub.publishSessionEvent(result.event);
    res.json({
      character: result.character,
      awardRecord: result.awardRecord
    });
  }

  async listSessionAwards(req, res) {
    const result = this.xpSessionService.listSessionAwards(
      req.params.campaignId,
      req.user
    );
    res.json(result);
  }

  async advanceGameSession(req, res) {
    const result = this.gameSessionService.advanceSession(
      req.params.campaignId,
      req.user
    );
    this.realtimeHub.publishSessionEvent(result.event);
    res.json({
      gameSession: result.gameSession,
      characterCount: result.characterCount
    });
  }

  async rollDice(req, res) {
    const result = this.diceRollService.roll(req.params.campaignId, req.user, {
      pool: req.body?.pool,
      difficulty: req.body?.difficulty,
      label: req.body?.label
    });
    this.realtimeHub.publishSessionEvent(result.event);
    res.status(201).json({ result: result.result });
  }
}
