import { httpError } from "../../http/httpError.js";

export class SectionLockService {
  constructor({ transactionRunner, support, sessionEventService }) {
    this.transactionRunner = transactionRunner;
    this.support = support;
    this.sessionEventService = sessionEventService;
  }

  assertXpBuySectionUnlocked(character, kind) {
    const normalizedKind = String(kind || "").toUpperCase();
    if (normalizedKind === "POWER" && character.sectionLocks?.powersSpells?.locked) {
      throw httpError(400, "Powers / Spells is locked by GM.");
    }
    if (
      (normalizedKind === "MERIT" || normalizedKind === "FLAW") &&
      character.sectionLocks?.meritsFlaws?.locked
    ) {
      throw httpError(400, "Merits / Flaws is locked by GM.");
    }
  }

  setSectionLock(campaignId, characterId, actorUser, { sectionId, locked }) {
    return this.transactionRunner.update((data) => {
      const repos = this.support.createRepositories(data);
      const campaign = this.support.requireCampaign(repos, campaignId);
      this.support.requireGmMembership(
        repos,
        campaignId,
        actorUser.id,
        "Only GM can change section locks."
      );

      const adapter = this.support.getAdapterForCampaign(campaign, {
        requiredMethod: "normalizeCharacterSheet",
        missingMessage: "Ruleset adapter missing."
      });
      const lockableSections = this.support.lockableSectionIds(adapter);
      if (!lockableSections.has(sectionId)) {
        throw httpError(400, `Section '${sectionId}' is not lockable.`);
      }

      const character = this.support.requireCharacterById(repos, campaignId, characterId);
      const now = new Date().toISOString();
      const locks = this.support.ensureCharacterSectionLocks(character, adapter);
      locks[sectionId] = {
        locked: Boolean(locked),
        updatedAt: now,
        updatedByUserId: actorUser.id
      };
      character.updatedAt = now;

      const user = repos.users.findById(character.userId);
      const normalized = this.support.normalizeCharacterWithAdapter(data, {
        campaign,
        character,
        displayName: user?.displayName || "Adventurer",
        adapter
      });
      Object.assign(character, normalized);

      const event = this.sessionEventService.record(data, {
        campaignId,
        type: "SECTION_LOCK_CHANGED",
        actorUserId: actorUser.id,
        payload: {
          characterId: character.id,
          sectionId,
          locked: Boolean(locked)
        }
      });

      return { character, sectionLocks: character.sectionLocks, event };
    });
  }
}
