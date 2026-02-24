import { httpError } from "../../http/httpError.js";

export class XpBuyRequestService {
  constructor({
    transactionRunner,
    support,
    sessionEventService,
    campaignSessionStatePolicy,
    createId
  }) {
    this.transactionRunner = transactionRunner;
    this.support = support;
    this.sessionEventService = sessionEventService;
    this.campaignSessionStatePolicy = campaignSessionStatePolicy;
    this.createId = createId;
  }

  createRequestForSelf(campaignId, actorUser, body = {}) {
    return this.transactionRunner.update((data) => {
      const repos = this.support.createRepositories(data);
      const campaign = this.support.requireCampaign(repos, campaignId);
      this.campaignSessionStatePolicy.assertActiveOffline(
        campaign,
        "XP buy requests are only available while session state is active-offline."
      );
      const membership = this.support.requireMembership(repos, campaignId, actorUser.id);
      const adapter = this.support.getAdapterForCampaign(campaign, {
        missingMessage: "Ruleset XP buy support missing."
      });
      if (typeof adapter.validateAndPriceXpBuyAction !== "function") {
        throw httpError(500, "Ruleset XP buy support missing.");
      }

      const character = this.support.ensureOwnCharacter({
        data,
        repos,
        campaign,
        actorUser
      });
      this.support.ensureCharacterSectionLocks(character, adapter);
      if (repos.xpCorrections.hasPendingForCharacter({ campaignId, characterId: character.id })) {
        throw httpError(
          400,
          "XP buy requests are frozen while a GM correction is awaiting player confirmation."
        );
      }

      const rawActions = Array.isArray(body.actions) ? body.actions : [];
      if (rawActions.length < 1) {
        throw httpError(400, "actions must include at least one XP buy change.");
      }
      if (rawActions.length > 50) {
        throw httpError(400, "actions cannot exceed 50 entries.");
      }

      repos.xpBuyRequests.ensureStore();
      repos.xpLedger.ensureXpBuyEntriesStore();
      const simulatedEntries = structuredClone(data.xpBuyEntries || []);
      const previewReceipts = [];
      const sessionNumber = Number(
        this.support.normalizeCharacterWithAdapter(data, {
          campaign,
          character,
          displayName: actorUser.displayName,
          adapter
        }).sheet?.sections?.bio?.bioGameSession || 0
      );

      for (const rawAction of rawActions) {
        let priced;
        try {
          priced = adapter.validateAndPriceXpBuyAction(character, rawAction, {
            xpSessionAwards: data.xpSessionAwards || [],
            xpBuyEntries: simulatedEntries
          });
        } catch (error) {
          throw httpError(400, error?.message || "Invalid XP buy request action.");
        }

        const kind = String(priced.receipt.kind || "").toUpperCase();
        const tempEntry = {
          id: `preview-${this.createId()}`,
          campaignId,
          characterId: character.id,
          userId: character.userId,
          kind,
          target: structuredClone(priced.receipt.target),
          fromLevel: priced.receipt.fromLevel,
          toLevel: priced.receipt.toLevel,
          xpDeltaUsed: priced.receipt.xpDeltaUsed,
          xpDeltaEarned: priced.receipt.xpDeltaEarned,
          actorUserId: actorUser.id,
          actorRole: String(membership.role || "PLAYER").toUpperCase(),
          createdAt: new Date().toISOString(),
          sessionNumber: Number.isInteger(sessionNumber) ? sessionNumber : 0
        };
        if (tempEntry.target?.fieldId) tempEntry.fieldId = tempEntry.target.fieldId;
        if (tempEntry.target?.tierId) tempEntry.tierId = tempEntry.target.tierId;
        if (tempEntry.target?.powerId) tempEntry.powerId = tempEntry.target.powerId;
        if (tempEntry.target?.traitId) tempEntry.traitId = tempEntry.target.traitId;
        simulatedEntries.push(tempEntry);

        previewReceipts.push({
          ...priced.receipt
        });
      }

      const now = new Date().toISOString();
      const request = {
        id: this.createId(),
        campaignId,
        characterId: character.id,
        playerUserId: actorUser.id,
        status: "PENDING",
        note: String(body.note || "").trim(),
        createdAt: now,
        updatedAt: now,
        actions: rawActions.map((entry) => structuredClone(entry)),
        previewReceipts
      };
      repos.xpBuyRequests.add(request);

      const event = this.sessionEventService.record(data, {
        campaignId,
        type: "XP_BUY_REQUEST_CREATED",
        actorUserId: actorUser.id,
        payload: {
          requestId: request.id,
          characterId: character.id,
          actionCount: request.actions.length
        }
      });

      return { request, event };
    });
  }

  listRequests(campaignId, actorUser, query = {}) {
    return this.transactionRunner.read((data) => {
      const repos = this.support.createRepositories(data);
      const membership = this.support.requireMembership(repos, campaignId, actorUser.id);
      const status = String(query.status || "PENDING").trim() || undefined;
      const characterId = String(query.characterId || "").trim() || undefined;
      const playerUserId =
        membership.role === "GM"
          ? String(query.playerUserId || "").trim() || undefined
          : actorUser.id;

      return {
        requests: repos.xpBuyRequests.listByCampaign({
          campaignId,
          status,
          characterId,
          playerUserId
        })
      };
    });
  }

  approveRequest(campaignId, requestId, actorUser, body = {}) {
    return this.transactionRunner.update((data) => {
      const repos = this.support.createRepositories(data);
      const campaign = this.support.requireCampaign(repos, campaignId);
      this.campaignSessionStatePolicy.assertActiveOffline(
        campaign,
        "XP buy approval is only available while session state is active-offline."
      );
      this.support.requireGmMembership(
        repos,
        campaignId,
        actorUser.id,
        "Only GM can approve XP buy requests."
      );

      const request = repos.xpBuyRequests.findById({ campaignId, requestId });
      if (!request) {
        throw httpError(404, "XP buy request not found.");
      }
      if (String(request.status || "").toUpperCase() !== "PENDING") {
        throw httpError(400, "XP buy request is not pending.");
      }

      const character = this.support.requireCharacterById(repos, campaignId, request.characterId);
      if (repos.xpCorrections.hasPendingForCharacter({ campaignId, characterId: character.id })) {
        throw httpError(
          400,
          "Cannot approve XP buy request while a GM correction awaits player confirmation."
        );
      }

      const adapter = this.support.getAdapterForCampaign(campaign, {
        missingMessage: "Ruleset XP buy support missing."
      });
      if (
        typeof adapter.validateAndPriceXpBuyAction !== "function" ||
        typeof adapter.normalizeCharacterSheet !== "function"
      ) {
        throw httpError(500, "Ruleset XP buy support missing.");
      }

      const owner = repos.users.findById(character.userId);
      const displayName = owner?.displayName || "Adventurer";
      repos.xpLedger.ensureXpBuyEntriesStore();
      const appliedEntries = [];
      const appliedReceipts = [];

      for (const rawAction of request.actions || []) {
        let priced;
        try {
          priced = adapter.validateAndPriceXpBuyAction(character, rawAction, {
            xpSessionAwards: data.xpSessionAwards || [],
            xpBuyEntries: data.xpBuyEntries || []
          });
        } catch (error) {
          throw httpError(
            400,
            error?.message || "XP buy request can no longer be approved."
          );
        }

        const normalizedBefore = this.support.normalizeCharacterWithAdapter(data, {
          campaign,
          character,
          displayName,
          adapter
        });
        const sessionNumber = Number(
          normalizedBefore.sheet?.sections?.bio?.bioGameSession || 0
        );
        const now = new Date().toISOString();
        const kind = String(priced.receipt.kind || "").toUpperCase();
        const entry = {
          id: this.createId(),
          campaignId,
          characterId: character.id,
          userId: character.userId,
          kind,
          target: structuredClone(priced.receipt.target),
          fromLevel: priced.receipt.fromLevel,
          toLevel: priced.receipt.toLevel,
          xpDeltaUsed: priced.receipt.xpDeltaUsed,
          xpDeltaEarned: priced.receipt.xpDeltaEarned,
          actorUserId: actorUser.id,
          actorRole: "GM",
          createdAt: now,
          sessionNumber: Number.isInteger(sessionNumber) ? sessionNumber : 0,
          sourceRequestId: request.id
        };
        if (entry.target?.fieldId) entry.fieldId = entry.target.fieldId;
        if (entry.target?.tierId) entry.tierId = entry.target.tierId;
        if (entry.target?.powerId) entry.powerId = entry.target.powerId;
        if (entry.target?.traitId) entry.traitId = entry.target.traitId;
        repos.xpLedger.addXpBuyEntry(entry);
        appliedEntries.push(entry);
        appliedReceipts.push({
          ...priced.receipt,
          entryId: entry.id
        });

        const normalizedAfter = this.support.normalizeCharacterWithAdapter(data, {
          campaign,
          character,
          displayName,
          adapter
        });
        Object.assign(character, normalizedAfter);
        character.updatedAt = now;
      }

      const now = new Date().toISOString();
      request.status = "APPROVED";
      request.updatedAt = now;
      request.approvedAt = now;
      request.approvedByUserId = actorUser.id;
      request.gmNote = String(body.note || "").trim();
      request.appliedEntryIds = appliedEntries.map((entry) => entry.id);
      request.appliedReceipts = appliedReceipts;

      const event = this.sessionEventService.record(data, {
        campaignId,
        type: "XP_BUY_REQUEST_APPROVED",
        actorUserId: actorUser.id,
        payload: {
          requestId: request.id,
          characterId: character.id,
          actionCount: appliedEntries.length
        }
      });

      return { request, character, event };
    });
  }

  denyRequest(campaignId, requestId, actorUser, body = {}) {
    return this.transactionRunner.update((data) => {
      const repos = this.support.createRepositories(data);
      this.support.requireCampaign(repos, campaignId);
      this.support.requireGmMembership(
        repos,
        campaignId,
        actorUser.id,
        "Only GM can deny XP buy requests."
      );

      const request = repos.xpBuyRequests.findById({ campaignId, requestId });
      if (!request) {
        throw httpError(404, "XP buy request not found.");
      }
      if (String(request.status || "").toUpperCase() !== "PENDING") {
        throw httpError(400, "XP buy request is not pending.");
      }
      const now = new Date().toISOString();
      request.status = "DENIED";
      request.updatedAt = now;
      request.deniedAt = now;
      request.deniedByUserId = actorUser.id;
      request.gmNote = String(body.note || "").trim();

      const event = this.sessionEventService.record(data, {
        campaignId,
        type: "XP_BUY_REQUEST_DENIED",
        actorUserId: actorUser.id,
        payload: {
          requestId: request.id,
          characterId: request.characterId
        }
      });

      return { request, event };
    });
  }
}
