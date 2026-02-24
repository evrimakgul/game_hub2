export class XpBuyRequestRepository {
  constructor(data) {
    this.data = data;
  }

  ensureStore() {
    if (!Array.isArray(this.data.xpBuyRequests)) {
      this.data.xpBuyRequests = [];
    }
    return this.data.xpBuyRequests;
  }

  add(request) {
    this.ensureStore().push(request);
    return request;
  }

  findById({ campaignId, requestId }) {
    return (this.data.xpBuyRequests || []).find(
      (entry) => entry && entry.id === requestId && entry.campaignId === campaignId
    );
  }

  listByCampaign({ campaignId, status, characterId, playerUserId } = {}) {
    return (this.data.xpBuyRequests || [])
      .filter((entry) => {
        if (!entry || entry.campaignId !== campaignId) return false;
        if (status && String(entry.status || "").toUpperCase() !== String(status).toUpperCase()) {
          return false;
        }
        if (characterId && entry.characterId !== characterId) return false;
        if (playerUserId && entry.playerUserId !== playerUserId) return false;
        return true;
      })
      .slice()
      .sort((a, b) => {
        const aTime = Date.parse(a.createdAt || 0) || 0;
        const bTime = Date.parse(b.createdAt || 0) || 0;
        return bTime - aTime;
      });
  }
}
