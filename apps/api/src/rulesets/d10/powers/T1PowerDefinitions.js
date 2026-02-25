import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const T1_POWER_SOURCE_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../../../references/powers/T1_Supernatural_Powers4.txt"
);

const LINKED_STAT_ALIASES = Object.freeze({
  per: "per",
  perception: "per",
  stam: "stam",
  sta: "stam",
  stamina: "stam",
  cha: "cha",
  charisma: "cha",
  int: "int",
  intelligence: "int",
  app: "app",
  appearance: "app",
  man: "man",
  manipulation: "man"
});

const T1_POWER_SEED = Object.freeze([
  Object.freeze({
    tierId: "t1",
    id: "awareness",
    label: "Awareness",
    headingLabel: "Awareness",
    abbr: null,
    linkedStatId: "per",
    automationScope: "helper_only",
    effectTemplateSummaries: Object.freeze([
      Object.freeze({
        id: "awareness-alertness-helper",
        label: "Alertness helper bonus",
        category: "helper_formula"
      })
    ])
  }),
  Object.freeze({
    tierId: "t1",
    id: "body-reinforcement",
    label: "Body Reinforcement",
    headingLabel: "Body Reinforcement",
    abbr: "BR",
    linkedStatId: "stam",
    automationScope: "sheet_modifier_supported",
    effectTemplateSummaries: Object.freeze([
      Object.freeze({
        id: "body-reinforcement-physical-buff",
        label: "Physical stat buff",
        category: "self_buff"
      }),
      Object.freeze({
        id: "body-reinforcement-dr-bonus",
        label: "Physical protection (DR) bonus",
        category: "self_buff"
      })
    ])
  }),
  Object.freeze({
    tierId: "t1",
    id: "crowd-control",
    label: "Crowd Control",
    headingLabel: "Crowd Control",
    abbr: "CC",
    linkedStatId: "cha",
    automationScope: "sheet_modifier_supported",
    effectTemplateSummaries: Object.freeze([
      Object.freeze({
        id: "crowd-control-cantrip-social-bonus",
        label: "Cantrip social/intimidation bonus",
        category: "passive_bonus"
      })
    ])
  }),
  Object.freeze({
    tierId: "t1",
    id: "elementalist",
    label: "Elementalist",
    headingLabel: "Elementalist",
    abbr: null,
    linkedStatId: "int",
    automationScope: "helper_only",
    effectTemplateSummaries: Object.freeze([
      Object.freeze({
        id: "elementalist-eb-damage-helper",
        label: "Elemental Bolt damage helper",
        category: "helper_formula"
      })
    ])
  }),
  Object.freeze({
    tierId: "t1",
    id: "healing",
    label: "Healing",
    headingLabel: "Healing",
    abbr: null,
    linkedStatId: "int",
    automationScope: "helper_only",
    effectTemplateSummaries: Object.freeze([
      Object.freeze({
        id: "healing-heal-helper",
        label: "Healing amount helper",
        category: "helper_formula"
      })
    ])
  }),
  Object.freeze({
    tierId: "t1",
    id: "light-support",
    label: "Light Support",
    headingLabel: "Light Support",
    abbr: "LS",
    linkedStatId: "app",
    automationScope: "sheet_modifier_supported",
    effectTemplateSummaries: Object.freeze([
      Object.freeze({
        id: "light-support-combat-bonuses",
        label: "Group hit/DR/Soak bonuses",
        category: "ally_buff"
      }),
      Object.freeze({
        id: "light-support-cantrip-mana",
        label: "Cantrip mana bonus",
        category: "passive_bonus"
      })
    ])
  }),
  Object.freeze({
    tierId: "t1",
    id: "necromancy",
    label: "Necromancy",
    headingLabel: "Necromancy",
    abbr: null,
    linkedStatId: "app",
    automationScope: "sheet_modifier_supported",
    effectTemplateSummaries: Object.freeze([
      Object.freeze({
        id: "necromancy-cantrip-melee-bonus",
        label: "Cantrip melee bonus",
        category: "passive_bonus"
      }),
      Object.freeze({
        id: "necromancy-necrotic-touch-helper",
        label: "Necrotic touch helper",
        category: "helper_formula"
      })
    ])
  }),
  Object.freeze({
    tierId: "t1",
    id: "shadow-control",
    label: "Shadow Control",
    headingLabel: "Shadow Control",
    abbr: "SC",
    linkedStatId: "man",
    automationScope: "sheet_modifier_supported",
    effectTemplateSummaries: Object.freeze([
      Object.freeze({
        id: "shadow-control-cloak-bonuses",
        label: "Cloak AC / stealth / intimidation bonuses",
        category: "self_buff"
      })
    ])
  })
]);

const POWER_HEADER_RE =
  /^(?<label>.+?)(?:\s+\((?<abbr>[A-Za-z]{2,})\))?:\s+\((?<linkedStat>[A-Za-z]+)\)\s*$/;
const LEVEL_LINE_RE = /^(?<level>[1-5])\.\s+(?<text>.+)$/;

function safeReadPowerSourceText() {
  try {
    return fs.readFileSync(T1_POWER_SOURCE_FILE, "utf8");
  } catch {
    return "";
  }
}

function normalizeWhitespace(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLinkedStatId(raw) {
  const key = normalizeWhitespace(raw).toLowerCase();
  return LINKED_STAT_ALIASES[key] || key;
}

function finalizeBuffer(text) {
  return normalizeWhitespace(text);
}

function parseT1PowerSections(rawText) {
  const lines = String(rawText || "").split(/\r?\n/);
  const sections = [];
  let current = null;
  let activeBucket = null;

  const flushActive = () => {
    if (!current || !activeBucket) return;
    const value = finalizeBuffer(activeBucket.text);
    if (!value) {
      activeBucket = null;
      return;
    }
    if (activeBucket.type === "level") {
      current.levelMap.set(activeBucket.level, value);
    } else if (activeBucket.type === "cantrip") {
      current.cantrip.push(value);
    } else if (activeBucket.type === "note") {
      current.notes.push(value);
    }
    activeBucket = null;
  };

  const flushSection = () => {
    flushActive();
    if (!current) return;
    current.levels = Array.from({ length: 5 }, (_, index) =>
      current.levelMap.get(index + 1) || ""
    );
    delete current.levelMap;
    sections.push(current);
    current = null;
  };

  for (const rawLine of lines) {
    const trimmed = String(rawLine || "").trim();
    if (!trimmed) {
      flushActive();
      continue;
    }

    const headerMatch = trimmed.match(POWER_HEADER_RE);
    if (headerMatch) {
      flushSection();
      current = {
        headingLabel: normalizeWhitespace(headerMatch.groups?.label),
        headingAbbr: normalizeWhitespace(headerMatch.groups?.abbr || ""),
        linkedStatId: normalizeLinkedStatId(headerMatch.groups?.linkedStat || ""),
        levels: [],
        levelMap: new Map(),
        cantrip: [],
        notes: [],
        rawLines: [trimmed]
      };
      continue;
    }

    if (!current) {
      continue;
    }
    current.rawLines.push(trimmed);

    const levelMatch = trimmed.match(LEVEL_LINE_RE);
    if (levelMatch) {
      flushActive();
      activeBucket = {
        type: "level",
        level: Number(levelMatch.groups?.level || 0),
        text: String(levelMatch.groups?.text || "")
      };
      continue;
    }

    if (trimmed.startsWith("* Cantrip:")) {
      flushActive();
      activeBucket = {
        type: "cantrip",
        text: trimmed.replace(/^\*\s*Cantrip:\s*/i, "")
      };
      continue;
    }

    if (trimmed.startsWith("Note:")) {
      flushActive();
      activeBucket = {
        type: "note",
        text: trimmed.replace(/^Note:\s*/i, "")
      };
      continue;
    }

    if (activeBucket) {
      activeBucket.text += ` ${trimmed}`;
      continue;
    }
  }

  flushSection();
  return sections;
}

function buildDefinitionsFromSeed() {
  const parsedByHeading = new Map(
    parseT1PowerSections(safeReadPowerSourceText()).map((entry) => [
      String(entry.headingLabel || "").toLowerCase(),
      entry
    ])
  );

  return T1_POWER_SEED.map((seed) => {
    const parsed = parsedByHeading.get(String(seed.headingLabel).toLowerCase()) || null;
    const linkedStatId = parsed?.linkedStatId || seed.linkedStatId;
    const abbr = parsed?.headingAbbr || seed.abbr || null;
    const levels = Array.isArray(parsed?.levels) ? parsed.levels.slice(0, 5) : ["", "", "", "", ""];
    while (levels.length < 5) {
      levels.push("");
    }
    const cantrip = Array.isArray(parsed?.cantrip) ? parsed.cantrip.slice() : [];
    const notes = Array.isArray(parsed?.notes) ? parsed.notes.slice() : [];
    const rawText = Array.isArray(parsed?.rawLines) ? parsed.rawLines.join("\n") : "";
    return Object.freeze({
      schemaVersion: 2,
      sourceTextPath: "references/powers/T1_Supernatural_Powers4.txt",
      tierId: seed.tierId,
      id: seed.id,
      label: seed.label,
      abbr,
      linkedStatId,
      levels: Object.freeze(levels.map((entry) => String(entry || ""))),
      cantrip: Object.freeze(cantrip.map((entry) => String(entry || ""))),
      notes: Object.freeze(notes.map((entry) => String(entry || ""))),
      rawText,
      automationScope: seed.automationScope,
      effectTemplateSummaries: Object.freeze(
        (seed.effectTemplateSummaries || []).map((entry) => Object.freeze({ ...entry }))
      )
    });
  });
}

export const D10_T1_POWER_DEFINITIONS_V2 = Object.freeze(buildDefinitionsFromSeed());
export const D10_T1_POWER_DEFINITIONS_BY_ID = new Map(
  D10_T1_POWER_DEFINITIONS_V2.map((entry) => [entry.id, entry])
);

export function getD10T1PowerDefinitions() {
  return D10_T1_POWER_DEFINITIONS_V2.map((entry) => structuredClone(entry));
}

