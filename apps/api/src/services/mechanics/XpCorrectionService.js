import { httpError } from "../../http/httpError.js";

export class XpCorrectionService {
  constructor({
    transactionRunner,
    support,
    sessionEventService,
    xpBuyEntryCorrectionPolicy,
    createId
  }) {
    this.transactionRunner = transactionRunner;
    this.support = support;
    this.sessionEventService = sessionEventService;
    this.xpBuyEntryCorrectionPolicy = xpBuyEntryCorrectionPolicy;
    this.createId = createId;
  }

  listCorrections(campaignId, characterId, actorUser) {
    return this.transactionRunner.read((data) => {
      const repos = this.support.createRepositories(data);
      const membership = this.support.requireMembership(repos, campaignId, actorUser.id);
      const character = this.support.requireCharacterById(repos, campaignId, characterId);
      this.support.assertCanViewCharacter(membership, character);
      return {
        corrections: repos.xpCorrections.listByCharacter({ campaignId, characterId })
      };
    });
  }

  createCorrection(campaignId, characterId, actorUser, body = {}) {
    return this.transactionRunner.update((data) => {
      const repos = this.support.createRepositories(data);
      this.support.requireCampaign(repos, campaignId);
      this.support.requireGmMembership(
        repos,
        campaignId,
        actorUser.id,
        "Only GM can create XP corrections."
      );
      const character = this.support.requireCharacterById(repos, campaignId, characterId);
      if (repos.xpCorrections.hasPendingForCharacter({ campaignId, characterId })) {
        throw httpError(400, "A pending XP correction already exists for this character.");
      }
      const targetEntryId = String(body.targetEntryId || "").trim();
      if (!targetEntryId) {
        throw httpError(400, "targetEntryId is required.");
      }

      repos.xpLedger.ensureXpBuyEntriesStore();
      repos.xpCorrections.ensureStore();
      const targetEntry = repos.xpLedger.findXpBuyEntryById({
        campaignId,
        characterId,
        entryId: targetEntryId
      });
      if (!targetEntry) {
        throw httpError(404, "XP buy entry not found.");
      }

      const beforeState = structuredClone(targetEntry);
      const afterState = this.xpBuyEntryCorrectionPolicy.applyPatch(
        targetEntry,
        body.patch || {}
      );
      Object.assign(targetEntry, afterState, {
        correctedAt: new Date().toISOString(),
        correctedByUserId: actorUser.id
      });

      const now = new Date().toISOString();
      const correction = {
        id: this.createId(),
        campaignId,
        characterId,
        targetEntryId,
        beforeState,
        afterState: structuredClone(targetEntry),
        gmUserId: actorUser.id,
        playerUserId: character.userId,
        userId: character.userId,
        sessionNumber: Number.isInteger(Number(targetEntry.sessionNumber))
          ? Number(targetEntry.sessionNumber)
          : 0,
        createdAt: now,
        status: "PENDING",
        appliedImmediately: true,
        note: String(body.note || "").trim(),
        playerConfirmation: {
          status: "PENDING",
          userId: null,
          at: null,
          note: ""
        }
      };
      repos.xpCorrections.add(correction);
      character.updatedAt = now;

      const event = this.sessionEventService.record(data, {
        campaignId,
        type: "XP_CORRECTION_CREATED",
        actorUserId: actorUser.id,
        payload: {
          characterId,
          correctionId: correction.id,
          targetEntryId
        }
      });

      return { correction, event };
    });
  }

  confirmCorrection(campaignId, correctionId, actorUser, body = {}) {
    return this.transactionRunner.update((data) => {
      const repos = this.support.createRepositories(data);
      this.support.requireCampaign(repos, campaignId);
      this.support.requireMembership(repos, campaignId, actorUser.id);
      const correction = repos.xpCorrections.findById({ campaignId, correctionId });
      if (!correction) {
        throw httpError(404, "XP correction not found.");
      }
      if (correction.playerUserId !== actorUser.id) {
        throw httpError(403, "Only the affected player can confirm this correction.");
      }
      if (String(correction.status || "").toUpperCase() !== "PENDING") {
        throw httpError(400, "XP correction is not pending.");
      }

      const now = new Date().toISOString();
      correction.status = "CONFIRMED";
      correction.playerConfirmation = {
        status: "CONFIRMED",
        userId: actorUser.id,
        at: now,
        note: String(body.note || "").trim()
      };
      correction.confirmedAt = now;

      const event = this.sessionEventService.record(data, {
        campaignId,
        type: "XP_CORRECTION_CONFIRMED",
        actorUserId: actorUser.id,
        payload: {
          characterId: correction.characterId,
          correctionId: correction.id,
          targetEntryId: correction.targetEntryId
        }
      });
      return { correction, event };
    });
  }

  denyCorrection(campaignId, correctionId, actorUser, body = {}) {
    return this.transactionRunner.update((data) => {
      const repos = this.support.createRepositories(data);
      this.support.requireCampaign(repos, campaignId);
      this.support.requireMembership(repos, campaignId, actorUser.id);
      const correction = repos.xpCorrections.findById({ campaignId, correctionId });
      if (!correction) {
        throw httpError(404, "XP correction not found.");
      }
      if (correction.playerUserId !== actorUser.id) {
        throw httpError(403, "Only the affected player can deny this correction.");
      }
      if (String(correction.status || "").toUpperCase() !== "PENDING") {
        throw httpError(400, "XP correction is not pending.");
      }

      const targetEntry = repos.xpLedger.findXpBuyEntryById({
        campaignId: correction.campaignId,
        characterId: correction.characterId,
        entryId: correction.targetEntryId
      });
      if (!targetEntry) {
        throw httpError(404, "Corrected XP entry no longer exists.");
      }
      Object.assign(targetEntry, structuredClone(correction.beforeState), {
        revertedAt: new Date().toISOString(),
        revertedByUserId: actorUser.id
      });

      const now = new Date().toISOString();
      correction.status = "DENIED_REVERTED";
      correction.revertedAt = now;
      correction.playerConfirmation = {
        status: "DENIED",
        userId: actorUser.id,
        at: now,
        note: String(body.note || "").trim()
      };

      const event = this.sessionEventService.record(data, {
        campaignId,
        type: "XP_CORRECTION_DENIED_REVERTED",
        actorUserId: actorUser.id,
        payload: {
          characterId: correction.characterId,
          correctionId: correction.id,
          targetEntryId: correction.targetEntryId
        }
      });

      return { correction, event };
    });
  }
}
