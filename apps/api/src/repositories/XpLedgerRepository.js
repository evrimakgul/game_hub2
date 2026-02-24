export class XpLedgerRepository {
  constructor(data, { createId }) {
    this.data = data;
    this.createId = createId;
  }

  ensureSessionAwardsStore() {
    if (!Array.isArray(this.data.xpSessionAwards)) {
      this.data.xpSessionAwards = [];
    }
    return this.data.xpSessionAwards;
  }

  ensureXpBuyEntriesStore() {
    if (!Array.isArray(this.data.xpBuyEntries)) {
      this.data.xpBuyEntries = [];
    }
    return this.data.xpBuyEntries;
  }

  upsertSessionAwardRecord({ campaignId, sessionNumber, awardDate, award }) {
    const rows = this.ensureSessionAwardsStore();
    let record = rows.find(
      (entry) =>
        entry.campaignId === campaignId &&
        Number(entry.sessionNumber) === Number(sessionNumber)
    );

    if (!record) {
      record = {
        id: this.createId(),
        campaignId,
        sessionNumber: Number(sessionNumber),
        date: awardDate,
        awards: [],
        createdAt: awardDate,
        updatedAt: awardDate
      };
      rows.push(record);
    }

    const existingAward = Array.isArray(record.awards)
      ? record.awards.find((entry) => entry.userId === award.userId)
      : null;
    if (!Array.isArray(record.awards)) {
      record.awards = [];
    }
    if (existingAward) {
      existingAward.xp = Number(existingAward.xp || 0) + Number(award.xp || 0);
      existingAward.player = award.player || existingAward.player;
      existingAward.characterId = award.characterId || existingAward.characterId;
      existingAward.updatedAt = awardDate;
    } else {
      record.awards.push({
        userId: award.userId,
        player: award.player,
        characterId: award.characterId,
        xp: Number(award.xp || 0),
        createdAt: awardDate,
        updatedAt: awardDate
      });
    }
    record.date = awardDate;
    record.updatedAt = awardDate;
    return record;
  }

  listSessionAwards(campaignId) {
    return (this.data.xpSessionAwards || [])
      .filter((entry) => entry.campaignId === campaignId)
      .sort((a, b) => Number(a.sessionNumber || 0) - Number(b.sessionNumber || 0));
  }

  listCharacterXpBuyEntries({ campaignId, characterId, userId }) {
    return (this.data.xpBuyEntries || [])
      .filter((entry) => {
        if (!entry || entry.campaignId !== campaignId) return false;
        if (characterId && entry.characterId !== characterId) return false;
        if (userId && entry.userId !== userId) return false;
        return true;
      })
      .slice()
      .sort((a, b) => {
        const aTime = Date.parse(a.createdAt || 0) || 0;
        const bTime = Date.parse(b.createdAt || 0) || 0;
        if (aTime !== bTime) return aTime - bTime;
        return String(a.id || "").localeCompare(String(b.id || ""));
      });
  }

  findXpBuyEntryById({ campaignId, characterId, entryId }) {
    this.ensureXpBuyEntriesStore();
    return this.data.xpBuyEntries.find(
      (entry) =>
        entry &&
        entry.id === entryId &&
        entry.campaignId === campaignId &&
        (!characterId || entry.characterId === characterId)
    );
  }

  addXpBuyEntry(entry) {
    this.ensureXpBuyEntriesStore().push(entry);
    return entry;
  }
}
