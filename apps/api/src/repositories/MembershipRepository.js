import { findMembership } from "../permissions.js";

export class MembershipRepository {
  constructor(data) {
    this.data = data;
  }

  findActive(campaignId, userId) {
    return findMembership(this.data, campaignId, userId);
  }
}
