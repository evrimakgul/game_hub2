import { D10_T1_POWER_DEFINITIONS_BY_ID } from "./T1PowerDefinitions.js";

const LINKED_STAT_FIELD_BY_ID = Object.freeze({
  per: "perception",
  stam: "stamina",
  cha: "charisma",
  int: "intelligence",
  app: "appearance",
  man: "manipulation"
});

const LINKED_STAT_GROUP_BY_FIELD = Object.freeze({
  perception: "mental",
  stamina: "physical",
  charisma: "social",
  intelligence: "mental",
  appearance: "social",
  manipulation: "social"
});

function integerOrZero(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) ? numeric : 0;
}

function statCurrentValue(sections, linkedStatId) {
  const fieldId = LINKED_STAT_FIELD_BY_ID[String(linkedStatId || "")];
  if (!fieldId) return 0;
  const groupId = LINKED_STAT_GROUP_BY_FIELD[fieldId];
  return integerOrZero(sections?.stats?.[groupId]?.[fieldId]);
}

function line(text) {
  return String(text || "").trim();
}

function helperForPower(powerId, { linkedStatValue, currentLevel } = {}) {
  const lvl = integerOrZero(currentLevel);
  const stat = integerOrZero(linkedStatValue);
  if (lvl <= 0) {
    return {
      summary: "",
      summaryLines: []
    };
  }

  if (powerId === "awareness") {
    const lines = [line(`Alertness helper bonus: +${lvl} (equal to Awareness level).`)];
    if (lvl >= 3) {
      lines.push(line("Cantrip helper: +1 inspiration / session (non-stacking)."));
    }
    return { summary: lines.join(" "), summaryLines: lines };
  }

  if (powerId === "body-reinforcement") {
    const statBuff = lvl >= 5 ? 3 : lvl >= 3 ? 2 : 1;
    const drBonus = lvl >= 5 ? 2 : lvl >= 4 ? 1 : 0;
    const lines = [
      line(`Body Reinforcement buff magnitude: +${statBuff} to one physical stat (STR/DEX/STA).`)
    ];
    if (drBonus > 0) {
      lines.push(line(`Physical protection helper: +${drBonus} DR while effect is active.`));
    }
    return { summary: lines.join(" "), summaryLines: lines };
  }

  if (powerId === "crowd-control") {
    const lines = [line("Control resolution remains descriptive/manual in this batch.")];
    if (lvl >= 2) {
      lines.push(line("Cantrip helper: +1 social and +1 intimidation dice pool bonus."));
    }
    if (lvl >= 5) {
      lines.push(line("Cantrip helper (level 5): +1 mechanics and +1 technology dice pool bonus."));
    }
    return { summary: lines.join(" "), summaryLines: lines };
  }

  if (powerId === "elementalist") {
    const ebDamage = stat + lvl;
    const cantripDamage =
      lvl >= 2 ? stat + (lvl >= 4 ? 1 : 0) : null;
    const lines = [line(`Elemental Bolt helper damage: ${ebDamage} (linked INT ${stat} + level ${lvl}).`)];
    if (cantripDamage !== null) {
      lines.push(line(`Cantrip helper damage: ${cantripDamage}.`));
    }
    return { summary: lines.join(" "), summaryLines: lines };
  }

  if (powerId === "healing") {
    const healingAmount = stat + lvl;
    const lines = [line(`Healing helper amount: ${healingAmount} (linked INT ${stat} + level ${lvl}).`)];
    if (lvl >= 3) {
      const cantripHeal = lvl >= 5 ? 4 : lvl >= 4 ? 3 : 2;
      lines.push(line(`Cantrip helper healing: ${cantripHeal} HP.`));
    }
    return { summary: lines.join(" "), summaryLines: lines };
  }

  if (powerId === "light-support") {
    const hitBonus = lvl >= 5 ? 4 : lvl >= 3 ? 3 : 2;
    const drBonus = lvl >= 4 ? 2 : lvl >= 2 ? 1 : 0;
    const soakBonus = lvl >= 5 ? 2 : lvl >= 3 ? 1 : 0;
    const manaBonus = lvl >= 5 ? 3 : lvl >= 3 ? 2 : 1;
    const lines = [
      line(`Light Support aura helper: +${hitBonus} hit bonus.`),
      line(`Light Support aura helper: +${drBonus} DR, +${soakBonus} Soak.`),
      line(`Cantrip helper: +${manaBonus} mana bonus.`)
    ];
    return { summary: lines.join(" "), summaryLines: lines };
  }

  if (powerId === "necromancy") {
    const lines = [line("Summon lifecycle and combat automation remain descriptive/manual in this batch.")];
    if (lvl >= 2) {
      const meleeBonus = 1 + Math.floor(Math.max(0, lvl - 2) / 2);
      lines.push(line(`Cantrip helper melee bonus: +${meleeBonus}.`));
    }
    if (lvl >= 3) {
      const touchDamage = lvl >= 5 ? stat + 2 * lvl : stat + lvl;
      lines.push(line(`Necrotic touch helper damage: ${touchDamage} before soak/resistance adjustments.`));
    }
    return { summary: lines.join(" "), summaryLines: lines };
  }

  if (powerId === "shadow-control") {
    const acBonus = lvl >= 5 ? 3 : lvl >= 3 ? 2 : 1;
    const lines = [
      line(`Cloak of Shadow helper: +${acBonus} AC while active.`),
      line(`Cloak of Shadow helper: intimidation and stealth bonuses equal to SC level (${lvl}).`)
    ];
    if (lvl >= 4) {
      lines.push(line("Level 4 helper: AC bonus can be shared with allies in range (manual effect application)."));
    }
    return { summary: lines.join(" "), summaryLines: lines };
  }

  return {
    summary: "",
    summaryLines: []
  };
}

export function buildD10PowerHelpers({ sections, numericTriples } = {}) {
  const helpers = {};
  const powersByTier = numericTriples?.powers || {};
  for (const [tierId, powers] of Object.entries(powersByTier)) {
    for (const [powerId, triple] of Object.entries(powers || {})) {
      const definition = D10_T1_POWER_DEFINITIONS_BY_ID.get(powerId);
      const linkedStatId = definition?.linkedStatId || null;
      const linkedStatFieldId = LINKED_STAT_FIELD_BY_ID[String(linkedStatId || "")] || null;
      const linkedStatValue = statCurrentValue(sections, linkedStatId);
      const currentLevel = integerOrZero(triple?.current);
      const baseLevel = integerOrZero(triple?.base);
      const bonusLevel = integerOrZero(triple?.bonus);
      const helper = helperForPower(powerId, {
        linkedStatValue,
        currentLevel
      });
      helpers[powerId] = {
        tierId,
        powerId,
        linkedStatId,
        linkedStatFieldId,
        linkedStatValue,
        baseLevel,
        bonusLevel,
        currentLevel,
        summary: helper.summary,
        summaryLines: helper.summaryLines
      };
    }
  }
  return helpers;
}

