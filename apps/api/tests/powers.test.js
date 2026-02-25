import { describe, expect, it } from "vitest";
import { getRulesetAdapter } from "../src/rulesets.js";

function makeCharacterFromDefault(adapter) {
  const characterContext = {
    campaignId: "camp-1",
    characterId: "char-1",
    userId: "user-1"
  };
  const sheetData = adapter.createDefaultCharacterSheetData({
    displayName: "Tester",
    characterContext,
    xpSessionAwards: [],
    xpBuyEntries: []
  });
  return {
    id: characterContext.characterId,
    campaignId: characterContext.campaignId,
    userId: characterContext.userId,
    rulesetId: "d10-basic",
    name: "Tester",
    ...sheetData,
    numericBonuses: {
      powers: {}
    }
  };
}

describe("D10 powers metadata and normalization", () => {
  it("returns T1 powers catalog metadata with additive fields", () => {
    const adapter = getRulesetAdapter("d10-basic");
    const powerSystem = adapter.getPowerSystem();

    expect(powerSystem?.tiers?.[0]?.powers?.length).toBe(8);

    const awareness = powerSystem.tiers[0].powers.find((entry) => entry.id === "awareness");
    const shadowControl = powerSystem.tiers[0].powers.find(
      (entry) => entry.id === "shadow-control"
    );

    expect(awareness).toMatchObject({
      id: "awareness",
      label: "Awareness",
      linkedStatId: "per"
    });
    expect(Array.isArray(awareness.levels)).toBe(true);
    expect(awareness.levels).toHaveLength(5);
    expect(Array.isArray(awareness.notes)).toBe(true);

    expect(shadowControl).toMatchObject({
      id: "shadow-control",
      label: "Shadow Control",
      abbr: "SC",
      linkedStatId: "man"
    });
  });

  it("aggregates power numeric bonuses into power triplets and helpers", () => {
    const adapter = getRulesetAdapter("d10-basic");
    const character = makeCharacterFromDefault(adapter);
    character.numericBonuses = {
      powers: {
        t1: {
          "shadow-control": -1,
          elementalist: 1
        }
      }
    };

    const xpBuyEntries = [
      {
        id: "xp-1",
        campaignId: "camp-1",
        characterId: "char-1",
        userId: "user-1",
        kind: "POWER",
        tierId: "t1",
        powerId: "shadow-control",
        fromLevel: 0,
        toLevel: 2,
        xpDeltaUsed: 16,
        xpDeltaEarned: 0,
        createdAt: "2026-02-25T00:00:00.000Z"
      },
      {
        id: "xp-2",
        campaignId: "camp-1",
        characterId: "char-1",
        userId: "user-1",
        kind: "POWER",
        tierId: "t1",
        powerId: "elementalist",
        fromLevel: 0,
        toLevel: 3,
        xpDeltaUsed: 28,
        xpDeltaEarned: 0,
        createdAt: "2026-02-25T00:01:00.000Z"
      }
    ];

    const normalized = adapter.normalizeCharacterSheet(character, {
      displayName: "Tester",
      xpSessionAwards: [],
      xpBuyEntries,
      xpBuyCorrections: [],
      campaignSessionState: "active-offline"
    });

    expect(normalized.numericTriples?.powers?.t1?.["shadow-control"]).toEqual({
      base: 2,
      bonus: -1,
      current: 1
    });
    expect(normalized.numericTriples?.powers?.t1?.elementalist).toEqual({
      base: 3,
      bonus: 1,
      current: 4
    });

    expect(normalized.numericBreakdowns?.powers?.t1?.["shadow-control"]?.channels?.legacy).toBe(-1);
    expect(normalized.numericBreakdowns?.powers?.t1?.elementalist?.channels?.legacy).toBe(1);

    expect(normalized.powerHelpers?.["shadow-control"]?.summary).toContain("Cloak of Shadow");
    expect(normalized.powerHelpers?.elementalist?.summary).toContain("Elemental Bolt helper damage");
  });
});

