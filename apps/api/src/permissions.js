export function findMembership(data, campaignId, userId) {
  return data.memberships.find(
    (entry) =>
      entry.campaignId === campaignId &&
      entry.userId === userId &&
      entry.status === "ACTIVE"
  );
}

export function isGm(membership) {
  return Boolean(membership && membership.role === "GM");
}

export function canViewCharacter(membership, character) {
  if (!membership || !character) {
    return false;
  }

  return membership.role === "GM" || membership.userId === character.userId;
}
