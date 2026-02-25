import { D10_T1_POWER_DEFINITIONS_BY_ID } from "./T1PowerDefinitions.js";

function enrichTierPower(tierId, power) {
  const next = { ...power };
  if (tierId !== "t1") {
    return next;
  }
  const metadata = D10_T1_POWER_DEFINITIONS_BY_ID.get(String(power?.id || ""));
  if (!metadata) {
    return next;
  }
  next.abbr = metadata.abbr || null;
  next.linkedStatId = metadata.linkedStatId || null;
  next.levels = (metadata.levels || []).slice();
  next.cantrip = (metadata.cantrip || []).slice();
  next.notes = (metadata.notes || []).slice();
  next.automationScope = metadata.automationScope || "descriptive_only";
  next.effectTemplateSummaries = (metadata.effectTemplateSummaries || []).map((entry) => ({
    ...entry
  }));
  return next;
}

export function buildD10PowerCatalogWithMetadata(basePowerSystem) {
  const next = structuredClone(basePowerSystem || {});
  if (!Array.isArray(next?.tiers)) {
    return next;
  }
  next.tiers = next.tiers.map((tier) => {
    const tierId = String(tier?.id || "");
    return {
      ...tier,
      powers: Array.isArray(tier?.powers)
        ? tier.powers.map((power) => enrichTierPower(tierId, power))
        : []
    };
  });
  return next;
}

