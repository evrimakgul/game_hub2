import { httpError } from "../../http/httpError.js";

const DEFAULT_CAMPAIGN_SESSION_STATE = "active-offline";
const LIVE_CAMPAIGN_SESSION_STATE = "active-live";
const CAMPAIGN_SESSION_STATE_ALIASES = Object.freeze({
  active: "active-live",
  "active-live": "active-live",
  idle: "active-offline",
  paused: "active-offline",
  "active-offline": "active-offline",
  ended: "archived",
  archived: "archived"
});

export class CampaignSessionStatePolicy {
  parse(value) {
    const raw = String(value || "").trim().toLowerCase();
    return CAMPAIGN_SESSION_STATE_ALIASES[raw] || null;
  }

  normalize(value) {
    return this.parse(value) || DEFAULT_CAMPAIGN_SESSION_STATE;
  }

  isActiveLive(value) {
    return this.normalize(value) === LIVE_CAMPAIGN_SESSION_STATE;
  }

  assertNotActiveLive(campaign, message) {
    if (this.isActiveLive(campaign?.sessionState)) {
      throw httpError(
        400,
        message || "Action is locked while session state is active-live."
      );
    }
  }

  assertActiveOffline(campaign, message) {
    if (this.normalize(campaign?.sessionState) !== "active-offline") {
      throw httpError(
        400,
        message || "Action is only available while session state is active-offline."
      );
    }
  }
}
