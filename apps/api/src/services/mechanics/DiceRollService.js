import { httpError } from "../../http/httpError.js";

function parseIntegerInRange(value, { field, min, max }) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < min || numeric > max) {
    throw httpError(400, `${field} must be an integer between ${min} and ${max}.`);
  }
  return numeric;
}

export class DiceRollService {
  constructor({ transactionRunner, support, sessionEventService }) {
    this.transactionRunner = transactionRunner;
    this.support = support;
    this.sessionEventService = sessionEventService;
  }

  roll(campaignId, actorUser, { pool, difficulty, label } = {}) {
    const parsedPool = parseIntegerInRange(pool, {
      field: "Pool",
      min: 1,
      max: 20
    });
    const parsedDifficulty = parseIntegerInRange(
      difficulty === undefined ? 6 : difficulty,
      {
        field: "Difficulty",
        min: 2,
        max: 10
      }
    );
    const parsedLabel = String(label || "").trim();

    return this.transactionRunner.update((data) => {
      const repos = this.support.createRepositories(data);
      const campaign = this.support.requireCampaign(repos, campaignId);
      this.support.requireMembership(repos, campaignId, actorUser.id);

      const adapter = this.support.getAdapterForCampaign(campaign, {
        missingMessage: "Ruleset adapter missing."
      });
      if (typeof adapter.rollCheck !== "function") {
        throw httpError(500, "Ruleset adapter missing.");
      }

      const roll = adapter.rollCheck({
        pool: parsedPool,
        difficulty: parsedDifficulty
      });
      const event = this.sessionEventService.record(data, {
        campaignId,
        type: "DICE_ROLLED",
        actorUserId: actorUser.id,
        payload: {
          label: parsedLabel,
          ...roll
        }
      });
      return { result: roll, event };
    });
  }
}
