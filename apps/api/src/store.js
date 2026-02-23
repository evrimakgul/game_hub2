import fs from "node:fs";
import path from "node:path";

const DEFAULT_CAMPAIGN_SESSION_STATE = "active-offline";
const CAMPAIGN_SESSION_STATE_ALIASES = Object.freeze({
  active: "active-live",
  "active-live": "active-live",
  idle: "active-offline",
  paused: "active-offline",
  "active-offline": "active-offline",
  ended: "archived",
  archived: "archived"
});

function normalizeCampaignSessionState(value) {
  const raw = String(value || "").trim().toLowerCase();
  return CAMPAIGN_SESSION_STATE_ALIASES[raw] || DEFAULT_CAMPAIGN_SESSION_STATE;
}

function createDefaultData() {
  return {
    meta: {
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    users: [],
    campaigns: [],
    memberships: [],
    invites: [],
    characterSheets: [],
    xpSessionAwards: [],
    xpBuyEntries: [],
    xpBuyCorrections: [],
    sessionEvents: [],
    chatMessages: []
  };
}

export class JsonStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = createDefaultData();
    this.#load();
  }

  read() {
    return structuredClone(this.data);
  }

  update(mutator) {
    const draft = structuredClone(this.data);
    const result = mutator(draft);
    draft.meta.updatedAt = new Date().toISOString();
    this.data = draft;
    this.#save();
    return result;
  }

  #load() {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });

    if (!fs.existsSync(this.filePath)) {
      this.#save();
      return;
    }

    const raw = fs.readFileSync(this.filePath, "utf-8");
    if (!raw.trim()) {
      this.#save();
      return;
    }

    const parsed = JSON.parse(raw);
    const defaults = createDefaultData();
    this.data = {
      ...defaults,
      ...parsed,
      meta: {
        ...defaults.meta,
        ...(parsed.meta || {})
      }
    };

    // Backward-compatible normalization for older store snapshots.
    for (const key of [
      "users",
      "campaigns",
      "memberships",
      "invites",
      "characterSheets",
      "xpSessionAwards",
      "xpBuyEntries",
      "xpBuyCorrections",
      "sessionEvents",
      "chatMessages"
    ]) {
      if (!Array.isArray(this.data[key])) {
        this.data[key] = [];
      }
    }

    for (const campaign of this.data.campaigns) {
      if (!campaign || typeof campaign !== "object") {
        continue;
      }
      campaign.sessionState = normalizeCampaignSessionState(campaign.sessionState);
    }

    for (const event of this.data.sessionEvents) {
      if (!event || event.type !== "SESSION_STATE_CHANGED") {
        continue;
      }
      if (!event.payload || typeof event.payload !== "object") {
        continue;
      }
      event.payload.state = normalizeCampaignSessionState(event.payload.state);
    }
  }

  #save() {
    const tempPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), "utf-8");
    fs.renameSync(tempPath, this.filePath);
  }
}
