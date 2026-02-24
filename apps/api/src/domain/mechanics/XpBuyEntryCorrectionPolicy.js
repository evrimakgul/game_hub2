import { httpError } from "../../http/httpError.js";

export class XpBuyEntryCorrectionPolicy {
  applyPatch(entry, patch = {}) {
    if (!entry || !patch || typeof patch !== "object" || Array.isArray(patch)) {
      throw httpError(400, "Correction patch must be an object.");
    }

    const immutableKeys = new Set([
      "id",
      "campaignId",
      "characterId",
      "userId",
      "kind",
      "target",
      "fieldId",
      "tierId",
      "powerId",
      "traitId",
      "actorUserId",
      "actorRole",
      "createdAt"
    ]);
    for (const key of Object.keys(patch)) {
      if (immutableKeys.has(key)) {
        throw httpError(400, `Field '${key}' cannot be corrected.`);
      }
    }

    const next = {
      ...structuredClone(entry),
      ...patch
    };

    for (const key of [
      "fromLevel",
      "toLevel",
      "xpDeltaUsed",
      "xpDeltaEarned",
      "sessionNumber"
    ]) {
      if (next[key] !== undefined && next[key] !== null) {
        const numeric = Number(next[key]);
        if (!Number.isInteger(numeric) || numeric < 0) {
          throw httpError(400, `${key} must be a non-negative integer.`);
        }
        next[key] = numeric;
      }
    }

    if (!Number.isInteger(next.toLevel)) {
      throw httpError(400, "Corrected entry must include integer toLevel.");
    }
    if (!Number.isInteger(next.fromLevel)) {
      throw httpError(400, "Corrected entry must include integer fromLevel.");
    }
    const used = Number(next.xpDeltaUsed || 0);
    const earned = Number(next.xpDeltaEarned || 0);
    if (
      !Number.isInteger(used) ||
      !Number.isInteger(earned) ||
      used < 0 ||
      earned < 0
    ) {
      throw httpError(
        400,
        "xpDeltaUsed and xpDeltaEarned must be non-negative integers."
      );
    }
    if ((used > 0 && earned > 0) || (used === 0 && earned === 0)) {
      throw httpError(
        400,
        "Exactly one of xpDeltaUsed or xpDeltaEarned must be positive."
      );
    }
    return next;
  }
}
