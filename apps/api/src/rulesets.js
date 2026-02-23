function randomIntInclusive(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const D10_POWER_SYSTEM_V1 = Object.freeze({
  version: 1,
  nesting: ["tiers", "powers", "spells"],
  tiers: [
    {
      id: "t1",
      label: "T1",
      title: "Tier 1",
      powers: [
        { id: "awareness", label: "Awareness" },
        { id: "body-reinforcement", label: "Body Reinforcement" },
        { id: "crowd-control", label: "Crowd Control" },
        { id: "elementalist", label: "Elementalist" },
        { id: "healing", label: "Healing" },
        { id: "light-support", label: "Light Support" },
        { id: "necromancy", label: "Necromancy" },
        { id: "shadow-control", label: "Shadow Control" }
      ]
    }
  ]
});

const D10_MERITS_FLAWS_SYSTEM_V1 = Object.freeze({
  version: 1,
  categories: ["merits", "flaws"],
  merits: [
    { id: "extra-hp", label: "Extra HP" },
    { id: "extra-mana", label: "Extra Mana" },
    { id: "gifted", label: "Gifted" },
    { id: "rich-bitch", label: "Rich Bitch" },
    { id: "dao-companion", label: "Dao Companion" },
    { id: "extra-language", label: "Extra Language" },
    { id: "dominant-dosha-pitta", label: "Dominant Dosha (Pitta)" },
    { id: "dominant-dosha-vata", label: "Dominant Dosha (Vata)" },
    { id: "dominant-dosha-kapha", label: "Dominant Dosha (Kapha)" },
    { id: "inspired", label: "Inspired" },
    { id: "echoes-of-past", label: "Echoes of Past" }
  ],
  flaws: [
    { id: "permanently-wounded", label: "Permanently Wounded" },
    { id: "magic-blindness", label: "Magic Blindness" },
    { id: "asocial", label: "Asocial" },
    { id: "huge-debt", label: "Huge Debt" },
    { id: "uninspired", label: "Uninspired" },
    { id: "weak-and-meek", label: "Weak and Meek" }
  ]
});

const D10_XP_BUY_SYSTEM_V1 = Object.freeze({
  version: 1,
  caps: {
    stats: 10,
    skills: 10,
    t1Powers: 10
  },
  statProgression: Object.freeze({
    2: 3,
    3: 6,
    4: 9,
    5: 12,
    6: 15,
    7: 18,
    8: 21,
    9: 24,
    10: 27
  }),
  skillProgression: Object.freeze({
    1: 3,
    2: 2,
    3: 4,
    4: 6,
    5: 8,
    6: 10,
    7: 12,
    8: 14,
    9: 16,
    10: 18
  }),
  powerProgressionByTier: Object.freeze({
    t1: Object.freeze({
      1: 10,
      2: 6,
      3: 12,
      4: 18,
      5: 24,
      6: 30,
      7: 36,
      8: 42,
      9: 48,
      10: 54
    })
  }),
  merits: Object.freeze([
    Object.freeze({ id: "extra-hp", label: "Extra HP", xpCostTotalByLevel: [5, 10], maxLevel: 2 }),
    Object.freeze({ id: "extra-mana", label: "Extra Mana", xpCostTotalByLevel: [3, 6, 9, 12], maxLevel: 4 }),
    Object.freeze({ id: "gifted", label: "Gifted", xpCostTotalByLevel: 20, maxLevel: 1 }),
    Object.freeze({ id: "rich-bitch", label: "Rich Bitch", xpCostTotalByLevel: 5, maxLevel: 1 }),
    Object.freeze({ id: "dao-companion", label: "Dao Companion", xpCostTotalByLevel: [5, 10], maxLevel: 2 }),
    Object.freeze({ id: "extra-language", label: "Extra Language", xpCostTotalByLevel: 2, maxLevel: 1 }),
    Object.freeze({ id: "dominant-dosha-pitta", label: "Dominant Dosha (Pitta)", xpCostTotalByLevel: 15, maxLevel: 1 }),
    Object.freeze({ id: "dominant-dosha-vata", label: "Dominant Dosha (Vata)", xpCostTotalByLevel: 15, maxLevel: 1 }),
    Object.freeze({ id: "dominant-dosha-kapha", label: "Dominant Dosha (Kapha)", xpCostTotalByLevel: 15, maxLevel: 1 }),
    Object.freeze({ id: "inspired", label: "Inspired", xpCostTotalByLevel: 5, maxLevel: 1 }),
    Object.freeze({ id: "echoes-of-past", label: "Echoes of Past", xpCostTotalByLevel: 10, maxLevel: 1 })
  ]),
  flaws: Object.freeze([
    Object.freeze({ id: "permanently-wounded", label: "Permanently Wounded", xpCostTotalByLevel: [5, 10], maxLevel: 2 }),
    Object.freeze({ id: "magic-blindness", label: "Magic Blindness", xpCostTotalByLevel: 20, maxLevel: 1 }),
    Object.freeze({ id: "asocial", label: "Asocial", xpCostTotalByLevel: 10, maxLevel: 1 }),
    Object.freeze({ id: "huge-debt", label: "Huge Debt", xpCostTotalByLevel: 5, maxLevel: 1 }),
    Object.freeze({ id: "uninspired", label: "Uninspired", xpCostTotalByLevel: 10, maxLevel: 1 }),
    Object.freeze({ id: "weak-and-meek", label: "Weak and Meek", xpCostTotalByLevel: 15, maxLevel: 1 })
  ]),
  meritMutuallyExclusiveGroups: Object.freeze([
    Object.freeze([
      "dominant-dosha-pitta",
      "dominant-dosha-vata",
      "dominant-dosha-kapha"
    ])
  ])
});

const D10_SHEET_SCHEMA_V2 = Object.freeze({
  id: "d10-basic-sheet-v2",
  version: 2,
  title: "D10 Basic Character Sheet",
  sections: [
    {
      id: "bio",
      title: "Bio / General Info",
      fields: [
        {
          id: "name",
          label: "Name",
          type: "text",
          required: true,
          trim: true,
          minLength: 1,
          maxLength: 80,
          defaultValue: "{displayName}'s Adventurer",
          legacyPath: ["name"]
        },
        {
          id: "bioPlayer",
          label: "Player",
          type: "text",
          trim: true,
          maxLength: 80,
          defaultValue: "{displayName}",
          legacyPath: ["bioPlayer"]
        },
        {
          id: "bioAge",
          label: "Age",
          type: "text",
          trim: true,
          maxLength: 40,
          defaultValue: "",
          legacyPath: ["bioAge"]
        },
        {
          id: "bioDemeanor",
          label: "Demeanor",
          type: "text",
          trim: true,
          maxLength: 80,
          defaultValue: "",
          legacyPath: ["bioDemeanor"]
        },
        {
          id: "bioInspiration",
          label: "Inspiration",
          type: "number",
          min: -10,
          max: 10,
          defaultValue: 0,
          editableBy: "GM",
          legacyPath: ["bioInspiration"]
        },
        {
          id: "bioNegKarma",
          label: "Neg. Karma",
          type: "number",
          min: -24,
          max: 24,
          defaultValue: 0,
          editableBy: "GM",
          legacyPath: ["bioNegKarma"]
        },
        {
          id: "bioPosKarma",
          label: "Pos. Karma",
          type: "number",
          min: -24,
          max: 24,
          defaultValue: 0,
          editableBy: "GM",
          legacyPath: ["bioPosKarma"]
        },
        {
          id: "bioXpEarned",
          label: "XP Earned",
          type: "number",
          min: 0,
          max: 9999999,
          defaultValue: 0,
          computed: true,
          legacyPath: ["bioXpEarned"]
        },
        {
          id: "bioXpUsed",
          label: "XP Used",
          type: "number",
          min: 0,
          max: 9999999,
          defaultValue: 0,
          computed: true,
          legacyPath: ["bioXpUsed"]
        },
        {
          id: "bioSessionXp",
          label: "Session XP",
          type: "number",
          min: 0,
          max: 9999,
          defaultValue: 0,
          editableBy: "GM",
          legacyPath: ["bioSessionXp"]
        },
        {
          id: "bioXpLeftOver",
          label: "XP Left Over",
          type: "number",
          min: -9999999,
          max: 9999999,
          defaultValue: 0,
          computed: true,
          legacyPath: ["bioXpLeftOver"]
        },
        {
          id: "bioCr",
          label: "CR",
          type: "number",
          min: 0,
          max: 9999,
          defaultValue: 0,
          computed: true,
          legacyPath: ["bioCr"]
        },
        {
          id: "bioRank",
          label: "Rank",
          type: "text",
          trim: true,
          maxLength: 2,
          defaultValue: "F",
          computed: true,
          legacyPath: ["bioRank"]
        },
        {
          id: "bioDateTime",
          label: "Date/Time",
          type: "text",
          trim: true,
          maxLength: 80,
          defaultValue: "",
          computed: true,
          legacyPath: ["bioDateTime"]
        },
        {
          id: "bioGameSession",
          label: "Game Session",
          type: "number",
          min: 0,
          max: 9999,
          defaultValue: 0,
          editableBy: "GM",
          legacyPath: ["bioGameSession"]
        },
        {
          id: "bioGameDateTime",
          label: "Game Date/Time",
          type: "text",
          trim: true,
          maxLength: 80,
          defaultValue: "",
          editableBy: "GM",
          legacyPath: ["bioGameDateTime"]
        },
        {
          id: "bioMoney",
          label: "Money",
          type: "number",
          min: -999999999,
          max: 999999999,
          defaultValue: 0,
          editableBy: "GM",
          legacyPath: ["bioMoney"]
        }
      ]
    },
    {
      id: "combat",
      title: "Combat Summary",
      fields: [
        // Placeholder defaults are 0 until calculated formulas are defined.
        {
          id: "combatMana",
          label: "Mana",
          type: "number",
          min: 0,
          max: 9999,
          defaultValue: 0,
          legacyPath: ["combatMana"]
        },
        {
          id: "combatHp",
          label: "HP",
          type: "number",
          min: 0,
          max: 9999,
          defaultValue: 0,
          legacyPath: ["combatHp"]
        },
        {
          id: "combatManaRegenPerHour",
          label: "Mana Regen / per hour",
          type: "number",
          min: 0,
          max: 9999,
          defaultValue: 0,
          legacyPath: ["combatManaRegenPerHour"]
        },
        {
          id: "combatHpRegen",
          label: "HP Regen",
          type: "number",
          min: 0,
          max: 9999,
          defaultValue: 0,
          legacyPath: ["combatHpRegen"]
        },
        {
          id: "combatAcDex",
          label: "AC (Dex)",
          type: "number",
          min: 0,
          max: 9999,
          defaultValue: 0,
          legacyPath: ["combatAcDex"]
        },
        {
          id: "combatDr",
          label: "DR",
          type: "number",
          min: 0,
          max: 9999,
          defaultValue: 0,
          legacyPath: ["combatDr"]
        },
        {
          id: "combatResistances",
          label: "Resistance(s)",
          type: "number",
          min: 0,
          max: 9999,
          defaultValue: 0,
          legacyPath: ["combatResistances"]
        },
        {
          id: "combatSoak",
          label: "Soak",
          type: "number",
          min: 0,
          max: 9999,
          defaultValue: 0,
          legacyPath: ["combatSoak"]
        },
        {
          id: "combatInitiative",
          label: "Initiative",
          type: "number",
          min: 0,
          max: 9999,
          defaultValue: 0,
          legacyPath: ["combatInitiative"]
        },
        {
          id: "combatMeleeAttack",
          label: "Melee Attack",
          type: "number",
          min: 0,
          max: 9999,
          defaultValue: 0,
          legacyPath: ["combatMeleeAttack"]
        },
        {
          id: "combatMeleeDamage",
          label: "Melee Damage",
          type: "number",
          min: 0,
          max: 9999,
          defaultValue: 0,
          legacyPath: ["combatMeleeDamage"]
        },
        {
          id: "combatRangeAttack",
          label: "Range Attack",
          type: "number",
          min: 0,
          max: 9999,
          defaultValue: 0,
          legacyPath: ["combatRangeAttack"]
        },
        {
          id: "combatRangeDamage",
          label: "Range Damage",
          type: "number",
          min: 0,
          max: 9999,
          defaultValue: 0,
          legacyPath: ["combatRangeDamage"]
        },
        {
          id: "combatSpellDamage",
          label: "Spell Damage",
          type: "number",
          min: 0,
          max: 9999,
          defaultValue: 0,
          legacyPath: ["combatSpellDamage"]
        }
      ]
    },
    {
      id: "stats",
      title: "Stats",
      groups: [
        {
          id: "physical",
          label: "Physical",
          fields: [
            {
              id: "strength",
              label: "Strength",
              type: "number",
              min: 0,
              max: 999,
              defaultValue: 1,
              legacyPath: ["stats", "physical", "strength"]
            },
            {
              id: "dexterity",
              label: "Dexterity",
              type: "number",
              min: 0,
              max: 999,
              defaultValue: 1,
              legacyPath: ["stats", "physical", "dexterity"]
            },
            {
              id: "stamina",
              label: "Stamina",
              type: "number",
              min: 0,
              max: 999,
              defaultValue: 1,
              legacyPath: ["stats", "physical", "stamina"]
            }
          ]
        },
        {
          id: "social",
          label: "Social",
          fields: [
            {
              id: "charisma",
              label: "Charisma",
              type: "number",
              min: 0,
              max: 999,
              defaultValue: 1,
              legacyPath: ["stats", "social", "charisma"]
            },
            {
              id: "manipulation",
              label: "Manipulation",
              type: "number",
              min: 0,
              max: 999,
              defaultValue: 1,
              legacyPath: ["stats", "social", "manipulation"]
            },
            {
              id: "appearance",
              label: "Appearance",
              type: "number",
              min: 0,
              max: 999,
              defaultValue: 1,
              legacyPath: ["stats", "social", "appearance"]
            }
          ]
        },
        {
          id: "mental",
          label: "Mental",
          fields: [
            {
              id: "intelligence",
              label: "Intelligence",
              type: "number",
              min: 0,
              max: 999,
              defaultValue: 1,
              legacyPath: ["stats", "mental", "intelligence"]
            },
            {
              id: "perception",
              label: "Perception",
              type: "number",
              min: 0,
              max: 999,
              defaultValue: 1,
              legacyPath: ["stats", "mental", "perception"]
            },
            {
              id: "wits",
              label: "Wits",
              type: "number",
              min: 0,
              max: 999,
              defaultValue: 1,
              legacyPath: ["stats", "mental", "wits"]
            }
          ]
        }
      ]
    },
    {
      id: "skills",
      title: "Skills",
      fields: [
        {
          id: "melee",
          label: "Melee",
          type: "number",
          min: 0,
          max: 999,
          defaultValue: 0,
          legacyPath: ["skills", "melee"]
        },
        {
          id: "ranged",
          label: "Ranged",
          type: "number",
          min: 0,
          max: 999,
          defaultValue: 0,
          legacyPath: ["skills", "ranged"]
        },
        {
          id: "athletics",
          label: "Athletics",
          type: "number",
          min: 0,
          max: 999,
          defaultValue: 0,
          legacyPath: ["skills", "athletics"]
        },
        {
          id: "stealth",
          label: "Stealth",
          type: "number",
          min: 0,
          max: 999,
          defaultValue: 0,
          legacyPath: ["skills", "stealth"]
        },
        {
          id: "alertness",
          label: "Alertness",
          type: "number",
          min: 0,
          max: 999,
          defaultValue: 0,
          legacyPath: ["skills", "alertness"]
        },
        {
          id: "intimidation",
          label: "Intimidation",
          type: "number",
          min: 0,
          max: 999,
          defaultValue: 0,
          legacyPath: ["skills", "intimidation"]
        },
        {
          id: "social",
          label: "Social",
          type: "number",
          min: 0,
          max: 999,
          defaultValue: 0,
          legacyPath: ["skills", "social"]
        },
        {
          id: "medicine",
          label: "Medicine",
          type: "number",
          min: 0,
          max: 999,
          defaultValue: 0,
          legacyPath: ["skills", "medicine"]
        },
        {
          id: "technology",
          label: "Technology",
          type: "number",
          min: 0,
          max: 999,
          defaultValue: 0,
          legacyPath: ["skills", "technology"]
        },
        {
          id: "academics",
          label: "Academics",
          type: "number",
          min: 0,
          max: 999,
          defaultValue: 0,
          legacyPath: ["skills", "academics"]
        },
        {
          id: "mechanics",
          label: "Mechanics",
          type: "number",
          min: 0,
          max: 999,
          defaultValue: 0,
          legacyPath: ["skills", "mechanics"]
        },
        {
          id: "occultism",
          label: "Occultism",
          type: "number",
          min: 0,
          max: 999,
          defaultValue: 0,
          legacyPath: ["skills", "occultism"]
        }
      ]
    },
    {
      id: "powersSpells",
      title: "Powers / Spells",
      selectionSource: {
        type: "ruleset-power-system",
        lockable: true,
        defaultLocked: true,
        unlockControlledBy: "GM",
        playerEditRequiresUnlock: true,
        tierIds: ["t1"],
        // Connection point for character-sheet UI to request ruleset-driven options.
        endpoint: "/api/v1/campaigns/:campaignId/characters/powers/catalog"
      },
      fields: [
        {
          id: "powers",
          label: "Known Powers",
          type: "textarea",
          maxLength: 4000,
          defaultValue: "",
          legacyPath: ["powers"]
        }
      ]
    },
    {
      id: "equipment",
      title: "Equipment",
      fields: [
        {
          id: "equipment",
          label: "Equipped Gear",
          type: "textarea",
          maxLength: 4000,
          defaultValue: "",
          legacyPath: ["equipment"]
        }
      ]
    },
    {
      id: "meritsFlaws",
      title: "Merits / Flaws",
      selectionSource: {
        type: "ruleset-merits-flaws-system",
        lockable: true,
        defaultLocked: true,
        unlockControlledBy: "GM",
        playerEditRequiresUnlock: true,
        categories: ["merits", "flaws"],
        // Connection point for character-sheet UI to request ruleset-driven options.
        endpoint: "/api/v1/campaigns/:campaignId/characters/merits-flaws/catalog"
      },
      fields: [
        {
          id: "meritsFlaws",
          label: "Traits",
          type: "textarea",
          maxLength: 4000,
          defaultValue: "",
          legacyPath: ["meritsFlaws"]
        }
      ]
    },
    {
      id: "connections",
      title: "Connections",
      fields: [
        {
          id: "connections",
          label: "People and Factions",
          type: "textarea",
          maxLength: 4000,
          defaultValue: "",
          legacyPath: ["connections"]
        }
      ]
    },
    {
      id: "inventory",
      title: "Inventory",
      fields: [
        {
          id: "inventory",
          label: "Carried Items",
          type: "textarea",
          maxLength: 4000,
          defaultValue: "",
          legacyPath: ["inventory"]
        }
      ]
    },
    {
      id: "notes",
      title: "Notes",
      fields: [
        {
          id: "notes",
          label: "Session Notes",
          type: "textarea",
          maxLength: 8000,
          defaultValue: "",
          legacyPath: ["notes"]
        }
      ]
    }
  ]
});

function isGroupedSection(section) {
  return Array.isArray(section?.groups);
}

function hasFlatFields(section) {
  return Array.isArray(section?.fields);
}

function forEachSectionField(section, visitor) {
  if (hasFlatFields(section)) {
    for (const field of section.fields) {
      visitor({
        section,
        group: null,
        field
      });
    }
    return;
  }

  if (isGroupedSection(section)) {
    for (const group of section.groups) {
      for (const field of group.fields || []) {
        visitor({
          section,
          group,
          field
        });
      }
    }
  }
}

const D10_SECTION_BY_ID = new Map(
  D10_SHEET_SCHEMA_V2.sections.map((section) => [section.id, section])
);

const D10_FIELD_INDEX = new Map();
const D10_STATS_GROUP_FIELD_IDS = new Map();
const D10_PROGRESSION_FIELDS = new WeakSet();
const D10_STAT_FIELD_IDS = new Set();
const D10_SKILL_FIELD_IDS = new Set();
const D10_COMBAT_FIELD_IDS = new Set();
for (const section of D10_SHEET_SCHEMA_V2.sections) {
  forEachSectionField(section, ({ group, field }) => {
    D10_FIELD_INDEX.set(field.id, {
      sectionId: section.id,
      groupId: group?.id || null,
      field
    });
    if (section.id === "combat") {
      D10_PROGRESSION_FIELDS.add(field);
      D10_COMBAT_FIELD_IDS.add(field.id);
    }
    if (section.id === "stats") {
      D10_PROGRESSION_FIELDS.add(field);
      D10_STAT_FIELD_IDS.add(field.id);
    }
    if (section.id === "skills") {
      D10_PROGRESSION_FIELDS.add(field);
      D10_SKILL_FIELD_IDS.add(field.id);
    }
    if (section.id === "powersSpells" || section.id === "meritsFlaws") {
      D10_PROGRESSION_FIELDS.add(field);
    }
    if (section.id !== "stats" || !group) {
      return;
    }
    if (!D10_STATS_GROUP_FIELD_IDS.has(group.id)) {
      D10_STATS_GROUP_FIELD_IDS.set(group.id, new Set());
    }
    D10_STATS_GROUP_FIELD_IDS.get(group.id).add(field.id);
  });
}

const D10_STAT_FIELD_PATHS = Object.freeze({
  strength: ["physical", "strength"],
  dexterity: ["physical", "dexterity"],
  stamina: ["physical", "stamina"],
  charisma: ["social", "charisma"],
  manipulation: ["social", "manipulation"],
  appearance: ["social", "appearance"],
  intelligence: ["mental", "intelligence"],
  perception: ["mental", "perception"],
  wits: ["mental", "wits"]
});

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(source, key) {
  return Object.prototype.hasOwnProperty.call(source, key);
}

function valueAtPath(source, path) {
  let cursor = source;
  for (const key of path) {
    if (!isPlainObject(cursor) || !hasOwn(cursor, key)) {
      return undefined;
    }
    cursor = cursor[key];
  }
  return cursor;
}

function fieldDefaultValue(field, context = {}) {
  if (
    typeof field.defaultValue === "string" &&
    field.defaultValue.includes("{displayName}")
  ) {
    const rawDisplayName = String(context.displayName || "").trim();
    const displayName = rawDisplayName || "Adventurer";
    return field.defaultValue.replace("{displayName}", displayName);
  }
  if (typeof field.defaultValue === "function") {
    return field.defaultValue(context);
  }
  return field.defaultValue;
}

function normalizeTextValue(raw, field, context = {}) {
  const fallback = fieldDefaultValue(field, context);
  const base = raw === undefined || raw === null ? fallback : raw;
  let value = String(base === undefined || base === null ? "" : base);

  if (field.trim) {
    value = value.trim();
  }

  if (field.required && value.length < 1) {
    throw new Error(`${field.label} is required.`);
  }
  if (
    Number.isInteger(field.minLength) &&
    value.length < field.minLength
  ) {
    throw new Error(
      `${field.label} must be at least ${field.minLength} characters.`
    );
  }
  if (
    Number.isInteger(field.maxLength) &&
    value.length > field.maxLength
  ) {
    throw new Error(
      `${field.label} must be ${field.maxLength} characters or fewer.`
    );
  }

  return value;
}

function normalizeNumberValue(raw, field, context = {}) {
  const fallback = fieldDefaultValue(field, context);
  const base =
    raw === undefined || raw === null || raw === "" ? fallback : raw;
  const numeric = Number(base);

  if (
    !Number.isInteger(numeric) ||
    numeric < field.min ||
    numeric > field.max
  ) {
    throw new Error(
      `${field.label} must be an integer between ${field.min} and ${field.max}.`
    );
  }

  return numeric;
}

function normalizeFieldValue(raw, field, context) {
  if (field.type === "number") {
    return normalizeNumberValue(raw, field, context);
  }
  if (field.type === "text" || field.type === "textarea") {
    return normalizeTextValue(raw, field, context);
  }
  throw new Error(`Unsupported field type '${field.type}'.`);
}

function normalizeActorRole(actorRole) {
  const role = String(actorRole || "PLAYER").trim().toUpperCase();
  return role || "PLAYER";
}

function canEditField(field, actorRole) {
  const role = normalizeActorRole(actorRole);
  if (role === "SYSTEM") {
    return true;
  }
  if (field && D10_PROGRESSION_FIELDS.has(field)) {
    return false;
  }
  if (field?.computed) {
    return false;
  }

  const editableBy = field?.editableBy;
  if (!editableBy) {
    return true;
  }
  if (Array.isArray(editableBy)) {
    return editableBy.map((entry) => String(entry).toUpperCase()).includes(role);
  }
  return String(editableBy).toUpperCase() === role;
}

function assertFieldPatchAllowed(field, actorRole) {
  if (!canEditField(field, actorRole)) {
    throw new Error(`${field.label} cannot be edited by this role.`);
  }
}

const D10_POWER_LABEL_BY_TIER_AND_ID = new Map();
for (const tier of D10_POWER_SYSTEM_V1.tiers || []) {
  D10_POWER_LABEL_BY_TIER_AND_ID.set(
    tier.id,
    new Map((tier.powers || []).map((entry) => [entry.id, entry.label || entry.id]))
  );
}
const D10_MERIT_BY_ID = new Map(
  D10_XP_BUY_SYSTEM_V1.merits.map((entry) => [entry.id, entry])
);
const D10_FLAW_BY_ID = new Map(
  D10_XP_BUY_SYSTEM_V1.flaws.map((entry) => [entry.id, entry])
);
const D10_MERIT_LABEL_BY_ID = new Map(
  D10_MERITS_FLAWS_SYSTEM_V1.merits.map((entry) => [entry.id, entry.label || entry.id])
);
const D10_FLAW_LABEL_BY_ID = new Map(
  D10_MERITS_FLAWS_SYSTEM_V1.flaws.map((entry) => [entry.id, entry.label || entry.id])
);
const D10_DOSHA_TRAIT_IDS = new Set(
  D10_XP_BUY_SYSTEM_V1.meritMutuallyExclusiveGroups.flat()
);

function makeDefaultProgressionState() {
  return {
    stats: {
      physical: {
        strength: 1,
        dexterity: 1,
        stamina: 1
      },
      social: {
        charisma: 1,
        manipulation: 1,
        appearance: 1
      },
      mental: {
        intelligence: 1,
        perception: 1,
        wits: 1
      }
    },
    skills: {
      melee: 0,
      ranged: 0,
      athletics: 0,
      stealth: 0,
      alertness: 0,
      intimidation: 0,
      social: 0,
      medicine: 0,
      technology: 0,
      academics: 0,
      mechanics: 0,
      occultism: 0
    },
    powers: {
      t1: Object.fromEntries(
        (D10_POWER_SYSTEM_V1.tiers.find((entry) => entry.id === "t1")?.powers || []).map(
          (power) => [power.id, 0]
        )
      )
    },
    merits: Object.fromEntries(D10_XP_BUY_SYSTEM_V1.merits.map((entry) => [entry.id, 0])),
    flaws: Object.fromEntries(D10_XP_BUY_SYSTEM_V1.flaws.map((entry) => [entry.id, 0]))
  };
}

function sortedCharacterXpBuyEntries(
  xpBuyEntries,
  { campaignId, characterId, userId } = {}
) {
  if (!Array.isArray(xpBuyEntries)) {
    return [];
  }
  return xpBuyEntries
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
      if (aTime !== bTime) {
        return aTime - bTime;
      }
      return String(a.id || "").localeCompare(String(b.id || ""));
    });
}

function applyXpBuyEntryToProgression(progression, entry) {
  if (!entry || !progression) {
    return;
  }
  const kind = String(entry.kind || "").toUpperCase();
  const fromLevel = Number(entry.fromLevel);
  const toLevel = Number(entry.toLevel);
  if (!Number.isInteger(toLevel) || toLevel < 0) {
    return;
  }
  if (kind === "STAT") {
    const fieldId = entry.target?.fieldId || entry.fieldId;
    const path = D10_STAT_FIELD_PATHS[fieldId];
    if (!path) return;
    progression.stats[path[0]][path[1]] = toLevel;
    return;
  }
  if (kind === "SKILL") {
    const fieldId = entry.target?.fieldId || entry.fieldId;
    if (!D10_SKILL_FIELD_IDS.has(fieldId)) return;
    progression.skills[fieldId] = toLevel;
    return;
  }
  if (kind === "POWER") {
    const tierId = String(entry.tierId || entry.target?.tierId || "");
    const powerId = String(entry.powerId || entry.target?.powerId || "");
    if (!tierId || !powerId) return;
    if (!isPlainObject(progression.powers[tierId])) {
      progression.powers[tierId] = {};
    }
    progression.powers[tierId][powerId] = toLevel;
    return;
  }
  if (kind === "MERIT") {
    const traitId = String(entry.traitId || entry.target?.traitId || "");
    if (!traitId) return;
    progression.merits[traitId] = toLevel;
    return;
  }
  if (kind === "FLAW") {
    const traitId = String(entry.traitId || entry.target?.traitId || "");
    if (!traitId) return;
    progression.flaws[traitId] = toLevel;
    return;
  }
  if (Number.isInteger(fromLevel) && Number.isInteger(toLevel) && fromLevel > toLevel) {
    // Ignore unknown decreasing entry kinds; known kinds handled above.
  }
}

function deriveProgressionFromXpHistory(
  { characterContext = {}, xpBuyEntries = [] } = {}
) {
  const progression = makeDefaultProgressionState();
  const entries = sortedCharacterXpBuyEntries(xpBuyEntries, characterContext);
  for (const entry of entries) {
    applyXpBuyEntryToProgression(progression, entry);
  }
  return progression;
}

function sumCharacterXpBuyTotals(
  xpBuyEntries,
  { campaignId, characterId, userId } = {}
) {
  const rows = sortedCharacterXpBuyEntries(xpBuyEntries, {
    campaignId,
    characterId,
    userId
  });
  let xpUsed = 0;
  let flawXpEarned = 0;
  for (const entry of rows) {
    const used = Number(entry.xpDeltaUsed || 0);
    const earned = Number(entry.xpDeltaEarned || 0);
    if (Number.isInteger(used)) {
      xpUsed += used;
    }
    if (Number.isInteger(earned)) {
      flawXpEarned += earned;
    }
  }
  return { xpUsed, flawXpEarned };
}

function summarizePowersProgression(powers) {
  const chunks = [];
  for (const [tierId, powersById] of Object.entries(powers || {})) {
    const labels = [];
    const labelMap = D10_POWER_LABEL_BY_TIER_AND_ID.get(tierId) || new Map();
    for (const [powerId, level] of Object.entries(powersById || {})) {
      if (!Number.isInteger(level) || level <= 0) {
        continue;
      }
      labels.push(`${labelMap.get(powerId) || powerId} ${level}`);
    }
    if (labels.length > 0) {
      chunks.push(`${String(tierId).toUpperCase()}: ${labels.join(", ")}`);
    }
  }
  return chunks.join(" | ");
}

function summarizeMeritsFlawsProgression(merits = {}, flaws = {}) {
  const meritParts = [];
  const flawParts = [];
  for (const [traitId, level] of Object.entries(merits)) {
    if (!Number.isInteger(level) || level <= 0) continue;
    meritParts.push(`${D10_MERIT_LABEL_BY_ID.get(traitId) || traitId} ${level}`);
  }
  for (const [traitId, level] of Object.entries(flaws)) {
    if (!Number.isInteger(level) || level <= 0) continue;
    flawParts.push(`${D10_FLAW_LABEL_BY_ID.get(traitId) || traitId} ${level}`);
  }
  if (meritParts.length === 0 && flawParts.length === 0) {
    return "";
  }
  if (meritParts.length === 0) {
    return `Flaws: ${flawParts.join(", ")}`;
  }
  if (flawParts.length === 0) {
    return `Merits: ${meritParts.join(", ")}`;
  }
  return `Merits: ${meritParts.join(", ")} | Flaws: ${flawParts.join(", ")}`;
}

function zeroCombatFields(sections) {
  if (!isPlainObject(sections?.combat)) {
    return sections;
  }
  const next = structuredClone(sections);
  for (const fieldId of D10_COMBAT_FIELD_IDS) {
    next.combat[fieldId] = 0;
  }
  return next;
}

function applyDerivedProgressionFields(
  sections,
  { characterContext = {}, xpBuyEntries = [] } = {}
) {
  if (!isPlainObject(sections)) {
    return sections;
  }
  const next = structuredClone(sections);
  const progression = deriveProgressionFromXpHistory({
    characterContext,
    xpBuyEntries
  });
  next.stats = structuredClone(progression.stats);
  next.skills = structuredClone(progression.skills);
  if (!isPlainObject(next.powersSpells)) {
    next.powersSpells = {};
  }
  next.powersSpells.powers = summarizePowersProgression(progression.powers);
  if (!isPlainObject(next.meritsFlaws)) {
    next.meritsFlaws = {};
  }
  next.meritsFlaws.meritsFlaws = summarizeMeritsFlawsProgression(
    progression.merits,
    progression.flaws
  );
  return {
    sections: zeroCombatFields(next),
    progression
  };
}

function incrementalCostForTargetLevels(progressionTable, fromLevel, toLevel) {
  let total = 0;
  for (let level = fromLevel + 1; level <= toLevel; level += 1) {
    const delta = Number(progressionTable[level]);
    if (!Number.isInteger(delta) || delta < 0) {
      throw new Error(`Unsupported progression cost for level ${level}.`);
    }
    total += delta;
  }
  return total;
}

function totalCostAtLevel(costSpec, level) {
  if (Array.isArray(costSpec)) {
    if (level < 0 || level > costSpec.length) {
      return null;
    }
    if (level === 0) {
      return 0;
    }
    const value = Number(costSpec[level - 1]);
    return Number.isInteger(value) ? value : null;
  }
  if (level === 0) {
    return 0;
  }
  if (level === 1) {
    const value = Number(costSpec);
    return Number.isInteger(value) ? value : null;
  }
  return null;
}

function deltaCostFromTotalCostSpec(costSpec, fromLevel, toLevel) {
  const fromTotal = totalCostAtLevel(costSpec, fromLevel);
  const toTotal = totalCostAtLevel(costSpec, toLevel);
  if (!Number.isInteger(fromTotal) || !Number.isInteger(toTotal)) {
    throw new Error("Unsupported merit/flaw level progression.");
  }
  if (toTotal < fromTotal) {
    throw new Error("Target level total cost cannot be lower than current level cost.");
  }
  return toTotal - fromTotal;
}

function normalizedKind(kind) {
  return String(kind || "").trim().toUpperCase();
}

function normalizeXpBuyPayload(payload) {
  if (!isPlainObject(payload)) {
    throw new Error("XP buy payload must be an object.");
  }
  const kind = normalizedKind(payload.kind);
  const toLevel = Number(payload.toLevel);
  if (!Number.isInteger(toLevel)) {
    throw new Error("toLevel must be an integer.");
  }
  const action = { kind, toLevel };
  if (kind === "STAT" || kind === "SKILL") {
    action.fieldId = String(payload.fieldId || "").trim();
  } else if (kind === "POWER") {
    action.tierId = String(payload.tierId || "").trim();
    action.powerId = String(payload.powerId || "").trim();
  } else if (kind === "MERIT" || kind === "FLAW") {
    action.traitId = String(payload.traitId || "").trim();
  } else {
    throw new Error("Unsupported XP buy kind.");
  }
  return action;
}

function validateAndPriceXpBuyAction(
  payload,
  {
    characterContext = {},
    xpSessionAwards = [],
    xpBuyEntries = []
  } = {}
) {
  const action = normalizeXpBuyPayload(payload);
  const progression = deriveProgressionFromXpHistory({
    characterContext,
    xpBuyEntries
  });
  const totals = sumCharacterXpBuyTotals(xpBuyEntries, characterContext);
  const sessionXp = sumCharacterXpAwards(xpSessionAwards, characterContext);
  const xpEarnedBefore = sessionXp + totals.flawXpEarned;
  const xpUsedBefore = totals.xpUsed;
  const xpLeftOverBefore = xpEarnedBefore - xpUsedBefore;

  let fromLevel = 0;
  let xpDeltaUsed = 0;
  let xpDeltaEarned = 0;
  let target = {};

  if (action.kind === "STAT") {
    if (!D10_STAT_FIELD_IDS.has(action.fieldId)) {
      throw new Error(`Unknown stat '${action.fieldId}'.`);
    }
    const path = D10_STAT_FIELD_PATHS[action.fieldId];
    fromLevel = Number(progression.stats?.[path[0]]?.[path[1]] || 1);
    if (!Number.isInteger(fromLevel)) {
      fromLevel = 1;
    }
    if (action.toLevel <= fromLevel) {
      throw new Error("toLevel must be greater than current stat level.");
    }
    if (action.toLevel > D10_XP_BUY_SYSTEM_V1.caps.stats) {
      throw new Error(`Stat level cannot exceed ${D10_XP_BUY_SYSTEM_V1.caps.stats}.`);
    }
    xpDeltaUsed = incrementalCostForTargetLevels(
      D10_XP_BUY_SYSTEM_V1.statProgression,
      fromLevel,
      action.toLevel
    );
    target = { fieldId: action.fieldId };
  } else if (action.kind === "SKILL") {
    if (!D10_SKILL_FIELD_IDS.has(action.fieldId)) {
      throw new Error(`Unknown skill '${action.fieldId}'.`);
    }
    fromLevel = Number(progression.skills?.[action.fieldId] || 0);
    if (action.toLevel <= fromLevel) {
      throw new Error("toLevel must be greater than current skill level.");
    }
    if (action.toLevel > D10_XP_BUY_SYSTEM_V1.caps.skills) {
      throw new Error(`Skill level cannot exceed ${D10_XP_BUY_SYSTEM_V1.caps.skills}.`);
    }
    xpDeltaUsed = incrementalCostForTargetLevels(
      D10_XP_BUY_SYSTEM_V1.skillProgression,
      fromLevel,
      action.toLevel
    );
    target = { fieldId: action.fieldId };
  } else if (action.kind === "POWER") {
    const powerLabelMap = D10_POWER_LABEL_BY_TIER_AND_ID.get(action.tierId);
    if (!powerLabelMap || !powerLabelMap.has(action.powerId)) {
      throw new Error(`Unknown power '${action.powerId}' in tier '${action.tierId}'.`);
    }
    const tierProgression = D10_XP_BUY_SYSTEM_V1.powerProgressionByTier[action.tierId];
    if (!tierProgression) {
      throw new Error(`Unsupported power tier '${action.tierId}'.`);
    }
    fromLevel = Number(progression.powers?.[action.tierId]?.[action.powerId] || 0);
    if (action.toLevel <= fromLevel) {
      throw new Error("toLevel must be greater than current power level.");
    }
    if (action.toLevel > D10_XP_BUY_SYSTEM_V1.caps.t1Powers) {
      throw new Error(
        `Power level cannot exceed ${D10_XP_BUY_SYSTEM_V1.caps.t1Powers}.`
      );
    }
    xpDeltaUsed = incrementalCostForTargetLevels(
      tierProgression,
      fromLevel,
      action.toLevel
    );
    target = { tierId: action.tierId, powerId: action.powerId };
  } else if (action.kind === "MERIT" || action.kind === "FLAW") {
    const catalog =
      action.kind === "MERIT" ? D10_MERIT_BY_ID : D10_FLAW_BY_ID;
    const entry = catalog.get(action.traitId);
    if (!entry) {
      throw new Error(`Unknown ${action.kind.toLowerCase()} '${action.traitId}'.`);
    }
    fromLevel = Number(
      (action.kind === "MERIT"
        ? progression.merits?.[action.traitId]
        : progression.flaws?.[action.traitId]) || 0
    );
    if (action.toLevel <= fromLevel) {
      throw new Error(`toLevel must be greater than current ${action.kind.toLowerCase()} level.`);
    }
    const maxLevel = Number(entry.maxLevel || (Array.isArray(entry.xpCostTotalByLevel) ? entry.xpCostTotalByLevel.length : 1));
    if (action.toLevel > maxLevel) {
      throw new Error(`${entry.label} cannot exceed level ${maxLevel}.`);
    }
    if (D10_DOSHA_TRAIT_IDS.has(action.traitId) && action.kind === "MERIT") {
      for (const otherId of D10_DOSHA_TRAIT_IDS) {
        if (otherId === action.traitId) continue;
        if (Number(progression.merits?.[otherId] || 0) > 0) {
          throw new Error("Only one Dominant Dosha merit can be owned.");
        }
      }
    }
    const delta = deltaCostFromTotalCostSpec(
      entry.xpCostTotalByLevel,
      fromLevel,
      action.toLevel
    );
    if (action.kind === "MERIT") {
      xpDeltaUsed = delta;
    } else {
      xpDeltaEarned = delta;
    }
    target = { traitId: action.traitId };
  }

  if (xpDeltaUsed <= 0 && xpDeltaEarned <= 0) {
    throw new Error("XP buy must change XP totals.");
  }
  if (xpDeltaUsed > 0 && xpLeftOverBefore < xpDeltaUsed) {
    throw new Error("Not enough XP Left Over for this purchase.");
  }

  return {
    action,
    progressionBefore: progression,
    receipt: {
      kind: action.kind,
      target,
      fromLevel,
      toLevel: action.toLevel,
      xpDeltaUsed,
      xpDeltaEarned,
      xpLeftOverBefore,
      xpLeftOverAfter: xpLeftOverBefore + xpDeltaEarned - xpDeltaUsed
    }
  };
}

function defaultSectionLocksFromSchema(schema) {
  const locks = {};
  for (const section of schema?.sections || []) {
    if (!section?.selectionSource?.lockable) {
      continue;
    }
    locks[section.id] = {
      locked: Boolean(section.selectionSource.defaultLocked),
      updatedAt: null,
      updatedByUserId: null
    };
  }
  return locks;
}

function normalizeSectionLocksForSchema(sectionLocks, schema) {
  const defaults = defaultSectionLocksFromSchema(schema);
  const raw = isPlainObject(sectionLocks) ? sectionLocks : {};
  for (const [sectionId, defaultEntry] of Object.entries(defaults)) {
    const candidate = isPlainObject(raw[sectionId]) ? raw[sectionId] : {};
    defaults[sectionId] = {
      locked:
        candidate.locked === undefined
          ? defaultEntry.locked
          : Boolean(candidate.locked),
      updatedAt: candidate.updatedAt || null,
      updatedByUserId: candidate.updatedByUserId || null
    };
  }
  return defaults;
}

function hasPendingCorrectionForCharacter(
  xpBuyCorrections,
  { campaignId, characterId, userId } = {}
) {
  if (!Array.isArray(xpBuyCorrections)) {
    return false;
  }
  return xpBuyCorrections.some((entry) => {
    if (!entry) return false;
    if (campaignId && entry.campaignId !== campaignId) return false;
    if (characterId && entry.characterId !== characterId) return false;
    if (userId && entry.playerUserId !== userId && entry.userId !== userId) return false;
    return String(entry.status || "").toUpperCase() === "PENDING";
  });
}

function rankFromXpUsed(xpUsed) {
  if (xpUsed < 30) return "F";
  if (xpUsed < 90) return "E";
  if (xpUsed < 170) return "D";
  if (xpUsed < 270) return "C";
  if (xpUsed < 390) return "B";
  if (xpUsed < 530) return "A";
  return "S";
}

function sumCharacterXpAwards(xpSessionAwards, { campaignId, userId }) {
  if (!Array.isArray(xpSessionAwards) || !campaignId || !userId) {
    return 0;
  }
  let total = 0;
  for (const row of xpSessionAwards) {
    if (!row || row.campaignId !== campaignId || !Array.isArray(row.awards)) {
      continue;
    }
    for (const award of row.awards) {
      if (!award || award.userId !== userId) {
        continue;
      }
      const amount = Number(award.xp);
      if (Number.isInteger(amount)) {
        total += amount;
      }
    }
  }
  return total;
}

function applyDerivedBioFields(
  sections,
  { characterContext = {}, xpSessionAwards = [], xpBuyEntries = [] } = {}
) {
  if (!isPlainObject(sections?.bio)) {
    return sections;
  }
  const next = structuredClone(sections);
  const bio = next.bio;

  if (!bio.bioDateTime) {
    bio.bioDateTime = new Date().toISOString();
  }

  const sessionXpEarned = sumCharacterXpAwards(xpSessionAwards, characterContext);
  const { xpUsed, flawXpEarned } = sumCharacterXpBuyTotals(
    xpBuyEntries,
    characterContext
  );
  const xpEarned = sessionXpEarned + flawXpEarned;
  const xpLeftOver = xpEarned - xpUsed;
  const cr = Math.floor(Math.max(0, xpUsed) / 33);

  bio.bioXpEarned = xpEarned;
  bio.bioXpUsed = xpUsed;
  bio.bioXpLeftOver = xpLeftOver;
  bio.bioCr = cr;
  bio.bioRank = rankFromXpUsed(Math.max(0, xpUsed));

  return next;
}

function buildD10Sections({
  sheetSections = {},
  legacySource = {},
  displayName = ""
} = {}) {
  const normalized = {};

  for (const section of D10_SHEET_SCHEMA_V2.sections) {
    const rawSection = isPlainObject(sheetSections[section.id])
      ? sheetSections[section.id]
      : {};
    const nextSection = {};

    if (hasFlatFields(section)) {
      for (const field of section.fields) {
        let rawValue;
        if (hasOwn(rawSection, field.id)) {
          rawValue = rawSection[field.id];
        } else if (Array.isArray(field.legacyPath) && field.legacyPath.length > 0) {
          rawValue = valueAtPath(legacySource, field.legacyPath);
        } else {
          rawValue = undefined;
        }

        nextSection[field.id] = normalizeFieldValue(rawValue, field, {
          displayName
        });
      }
      normalized[section.id] = nextSection;
      continue;
    }

    if (isGroupedSection(section)) {
      for (const group of section.groups) {
        const rawGroup = isPlainObject(rawSection[group.id]) ? rawSection[group.id] : {};
        const nextGroup = {};

        for (const field of group.fields || []) {
          let rawValue;
          if (hasOwn(rawGroup, field.id)) {
            rawValue = rawGroup[field.id];
          } else if (Array.isArray(field.legacyPath) && field.legacyPath.length > 0) {
            rawValue = valueAtPath(legacySource, field.legacyPath);
          } else {
            rawValue = undefined;
          }

          nextGroup[field.id] = normalizeFieldValue(rawValue, field, {
            displayName
          });
        }

        nextSection[group.id] = nextGroup;
      }
      normalized[section.id] = nextSection;
      continue;
    }

    throw new Error(`Section '${section.id}' must define fields or groups.`);
  }

  return normalized;
}

function createD10SheetData(sections) {
  return {
    templateVersion: "v2",
    sheetSchemaId: D10_SHEET_SCHEMA_V2.id,
    sheetSchemaVersion: D10_SHEET_SCHEMA_V2.version,
    sheet: {
      schemaId: D10_SHEET_SCHEMA_V2.id,
      schemaVersion: D10_SHEET_SCHEMA_V2.version,
      sections
    },
    name: sections.bio.name,
    notes: sections.notes.notes,
    stats: structuredClone(sections.stats)
  };
}

function ensurePatchSection(patch, sectionId) {
  if (!isPlainObject(patch[sectionId])) {
    patch[sectionId] = {};
  }
  return patch[sectionId];
}

function mergePatchValue(sourceValue, patchValue) {
  if (isPlainObject(sourceValue) && isPlainObject(patchValue)) {
    const next = structuredClone(sourceValue);
    for (const [key, value] of Object.entries(patchValue)) {
      next[key] = mergePatchValue(next[key], value);
    }
    return next;
  }
  if (isPlainObject(patchValue)) {
    return structuredClone(patchValue);
  }
  return patchValue;
}

function applyPatchSections(sourceSections, patchSections) {
  const next = structuredClone(sourceSections);
  for (const [sectionId, sectionPatch] of Object.entries(patchSections)) {
    next[sectionId] = mergePatchValue(next[sectionId], sectionPatch);
  }
  return next;
}

function collectSectionPatchFromObject(rawSections, patch, options = {}) {
  if (rawSections === undefined) {
    return;
  }
  if (!isPlainObject(rawSections)) {
    throw new Error("Sheet sections must be an object.");
  }

  for (const [sectionId, rawSectionPatch] of Object.entries(rawSections)) {
    const section = D10_SECTION_BY_ID.get(sectionId);
    if (!section) {
      throw new Error(`Unknown sheet section '${sectionId}'.`);
    }
    if (!isPlainObject(rawSectionPatch)) {
      throw new Error(`Sheet section '${sectionId}' must be an object.`);
    }

    const target = ensurePatchSection(patch, sectionId);
    if (hasFlatFields(section)) {
      for (const [fieldId, value] of Object.entries(rawSectionPatch)) {
        const field = section.fields.find((entry) => entry.id === fieldId);
        if (!field) {
          throw new Error(
            `Unknown field '${fieldId}' in section '${sectionId}'.`
          );
        }
        assertFieldPatchAllowed(field, options.actorRole);
        target[fieldId] = value;
      }
      continue;
    }

    if (isGroupedSection(section)) {
      for (const [groupId, rawGroupPatch] of Object.entries(rawSectionPatch)) {
        const group = (section.groups || []).find((entry) => entry.id === groupId);
        if (!group) {
          throw new Error(
            `Unknown group '${groupId}' in section '${sectionId}'.`
          );
        }
        if (!isPlainObject(rawGroupPatch)) {
          throw new Error(
            `Group '${groupId}' in section '${sectionId}' must be an object.`
          );
        }
        if (!isPlainObject(target[groupId])) {
          target[groupId] = {};
        }
        for (const [fieldId, value] of Object.entries(rawGroupPatch)) {
          const field = (group.fields || []).find((entry) => entry.id === fieldId);
          if (!field) {
            throw new Error(
              `Unknown field '${fieldId}' in group '${groupId}' of section '${sectionId}'.`
            );
          }
          assertFieldPatchAllowed(field, options.actorRole);
          target[groupId][fieldId] = value;
        }
      }
      continue;
    }

    throw new Error(`Section '${sectionId}' must define fields or groups.`);
  }
}

function collectSheetPatch(payload, options = {}) {
  if (payload === undefined) {
    return {};
  }
  if (!isPlainObject(payload)) {
    throw new Error("Character update payload must be an object.");
  }

  const patch = {};

  collectSectionPatchFromObject(payload.sections, patch, options);
  if (payload.sheet !== undefined) {
    if (!isPlainObject(payload.sheet)) {
      throw new Error("sheet must be an object.");
    }
    collectSectionPatchFromObject(payload.sheet.sections, patch, options);
  }

  if (hasOwn(payload, "name")) {
    assertFieldPatchAllowed(D10_FIELD_INDEX.get("name")?.field, options.actorRole);
    ensurePatchSection(patch, "bio").name = payload.name;
  }
  if (hasOwn(payload, "notes")) {
    assertFieldPatchAllowed(D10_FIELD_INDEX.get("notes")?.field, options.actorRole);
    ensurePatchSection(patch, "notes").notes = payload.notes;
  }
  if (hasOwn(payload, "stats")) {
    if (!isPlainObject(payload.stats)) {
      throw new Error("stats must be an object.");
    }
    const statsPatch = ensurePatchSection(patch, "stats");
    for (const [groupId, rawGroupPatch] of Object.entries(payload.stats)) {
      const statFieldIds = D10_STATS_GROUP_FIELD_IDS.get(groupId);
      if (!statFieldIds) {
        throw new Error(`Unknown stat group '${groupId}'.`);
      }
      if (!isPlainObject(rawGroupPatch)) {
        throw new Error(`Stat group '${groupId}' must be an object.`);
      }
      if (!isPlainObject(statsPatch[groupId])) {
        statsPatch[groupId] = {};
      }
      for (const [statKey, value] of Object.entries(rawGroupPatch)) {
        if (!statFieldIds.has(statKey)) {
          throw new Error(`Unknown stat '${statKey}' in group '${groupId}'.`);
        }
        const descriptor = D10_FIELD_INDEX.get(statKey);
        assertFieldPatchAllowed(descriptor?.field, options.actorRole);
        statsPatch[groupId][statKey] = value;
      }
    }
  }

  for (const [fieldId, descriptor] of D10_FIELD_INDEX.entries()) {
    if (fieldId === "name" || fieldId === "notes") {
      continue;
    }
    if (descriptor.sectionId === "stats") {
      continue;
    }
    if (!hasOwn(payload, fieldId)) {
      continue;
    }
    assertFieldPatchAllowed(descriptor.field, options.actorRole);
    ensurePatchSection(patch, descriptor.sectionId)[fieldId] = payload[fieldId];
  }

  return patch;
}

class D10RulesetAdapter {
  constructor() {
    this.id = "d10-basic";
    this.name = "D10 Basic Success System";
  }

  getSheetSchema() {
    return structuredClone(D10_SHEET_SCHEMA_V2);
  }

  getPowerSystem() {
    return structuredClone(D10_POWER_SYSTEM_V1);
  }

  getMeritsFlawsSystem() {
    return structuredClone(D10_MERITS_FLAWS_SYSTEM_V1);
  }

  getXpBuySystem() {
    return structuredClone(D10_XP_BUY_SYSTEM_V1);
  }

  getDefaultSectionLocks() {
    return defaultSectionLocksFromSchema(D10_SHEET_SCHEMA_V2);
  }

  deriveProgressionFromXpHistory(character, { xpBuyEntries } = {}) {
    return deriveProgressionFromXpHistory({
      characterContext: {
        campaignId: character?.campaignId,
        characterId: character?.id,
        userId: character?.userId
      },
      xpBuyEntries
    });
  }

  validateAndPriceXpBuyAction(character, payload, options = {}) {
    return validateAndPriceXpBuyAction(payload, {
      characterContext: {
        campaignId: character?.campaignId,
        characterId: character?.id,
        userId: character?.userId
      },
      xpSessionAwards: options.xpSessionAwards,
      xpBuyEntries: options.xpBuyEntries
    });
  }

  createDefaultCharacterSheetData({
    displayName,
    characterContext,
    xpSessionAwards,
    xpBuyEntries
  } = {}) {
    const sections = buildD10Sections({
      displayName
    });
    const derivedProgression = applyDerivedProgressionFields(sections, {
      characterContext,
      xpBuyEntries
    });
    return createD10SheetData(
      applyDerivedBioFields(derivedProgression.sections, {
        characterContext,
        xpSessionAwards,
        xpBuyEntries
      })
    );
  }

  normalizeCharacterSheet(
    character,
    {
      displayName,
      xpSessionAwards,
      xpBuyEntries,
      xpBuyCorrections,
      campaignSessionState
    } = {}
  ) {
    if (!isPlainObject(character)) {
      throw new Error("Character sheet must be an object.");
    }

    const sections = buildD10Sections({
      sheetSections: character.sheet?.sections,
      legacySource: character,
      displayName
    });
    const derivedProgression = applyDerivedProgressionFields(sections, {
      xpBuyEntries,
      characterContext: {
        campaignId: character.campaignId,
        characterId: character.id,
        userId: character.userId
      }
    });
    const derivedSections = applyDerivedBioFields(derivedProgression.sections, {
      xpSessionAwards,
      xpBuyEntries,
      characterContext: {
        campaignId: character.campaignId,
        characterId: character.id,
        userId: character.userId
      }
    });
    const sectionLocks = normalizeSectionLocksForSchema(
      character.sectionLocks,
      D10_SHEET_SCHEMA_V2
    );
    const normalizedCampaignSessionState =
      ({
        active: "active-live",
        "active-live": "active-live",
        idle: "active-offline",
        paused: "active-offline",
        "active-offline": "active-offline",
        ended: "archived",
        archived: "archived"
      }[String(campaignSessionState || "").trim().toLowerCase()]) ||
      "active-offline";
    const lockedBySessionState =
      normalizedCampaignSessionState === "active-live";
    const frozenByPendingCorrection = hasPendingCorrectionForCharacter(
      xpBuyCorrections,
      {
        campaignId: character.campaignId,
        characterId: character.id,
        userId: character.userId
      }
    );

    return {
      ...character,
      ...createD10SheetData(derivedSections)
      ,
      sectionLocks,
      progression: structuredClone(derivedProgression.progression),
      xpBuyStatus: {
        lockedBySessionState,
        frozenByPendingCorrection,
        canBuy: !lockedBySessionState && !frozenByPendingCorrection
      }
    };
  }

  applyCharacterSheetUpdate(
    character,
    payload,
    { displayName, actorRole, xpSessionAwards, xpBuyEntries, xpBuyCorrections, campaignSessionState } = {}
  ) {
    const normalized = this.normalizeCharacterSheet(character, {
      displayName,
      xpSessionAwards,
      xpBuyEntries,
      xpBuyCorrections,
      campaignSessionState
    });
    const patch = collectSheetPatch(payload, { actorRole });
    const mergedSections = applyPatchSections(normalized.sheet.sections, patch);
    const validatedSections = buildD10Sections({
      sheetSections: mergedSections,
      displayName
    });
    const derivedProgression = applyDerivedProgressionFields(validatedSections, {
      xpBuyEntries,
      characterContext: {
        campaignId: character.campaignId,
        characterId: character.id,
        userId: character.userId
      }
    });
    const derivedSections = applyDerivedBioFields(derivedProgression.sections, {
      xpSessionAwards,
      xpBuyEntries,
      characterContext: {
        campaignId: character.campaignId,
        characterId: character.id,
        userId: character.userId
      }
    });

    return {
      ...normalized,
      ...createD10SheetData(derivedSections)
    };
  }

  rollCheck({ pool, difficulty }) {
    const dicePool = Number(pool);
    const target = Number(difficulty);

    if (!Number.isInteger(dicePool) || dicePool < 1 || dicePool > 20) {
      throw new Error("Pool must be an integer between 1 and 20.");
    }

    if (!Number.isInteger(target) || target < 2 || target > 10) {
      throw new Error("Difficulty must be an integer between 2 and 10.");
    }

    const rolls = Array.from({ length: dicePool }, () =>
      randomIntInclusive(1, 10)
    );
    const successes = rolls.filter((value) => value >= target).length;

    return {
      rulesetId: this.id,
      pool: dicePool,
      difficulty: target,
      rolls,
      successes,
      isSuccess: successes > 0
    };
  }
}

const adapters = new Map([["d10-basic", new D10RulesetAdapter()]]);

export function getRulesetAdapter(rulesetId) {
  return adapters.get(rulesetId);
}
