function randomIntInclusive(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

class D10RulesetAdapter {
  constructor() {
    this.id = "d10-basic";
    this.name = "D10 Basic Success System";
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
