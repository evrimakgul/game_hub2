export class XpCorrectionRepository {
  constructor(data) {
    this.data = data;
  }

  ensureStore() {
    if (!Array.isArray(this.data.xpBuyCorrections)) {
      this.data.xpBuyCorrections = [];
    }
    return this.data.xpBuyCorrections;
  }

  listByCharacter({ campaignId, characterId }) {
    return (this.data.xpBuyCorrections || [])
      .filter(
        (entry) =>
          entry &&
          entry.campaignId === campaignId &&
          entry.characterId === characterId
      )
      .slice()
      .sort((a, b) => {
        const aTime = Date.parse(a.createdAt || 0) || 0;
        const bTime = Date.parse(b.createdAt || 0) || 0;
        return bTime - aTime;
      });
  }

  hasPendingForCharacter({ campaignId, characterId }) {
    return (this.data.xpBuyCorrections || []).some(
      (entry) =>
        entry &&
        entry.campaignId === campaignId &&
        entry.characterId === characterId &&
        String(entry.status || "").toUpperCase() === "PENDING"
    );
  }

  findById({ campaignId, correctionId }) {
    return (this.data.xpBuyCorrections || []).find(
      (entry) => entry && entry.id === correctionId && entry.campaignId === campaignId
    );
  }

  add(correction) {
    this.ensureStore().push(correction);
    return correction;
  }
}
