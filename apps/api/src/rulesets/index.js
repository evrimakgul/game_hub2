import { getRulesetAdapter as getLegacyRulesetAdapter } from "../rulesets.js";
import { D10RulesetAdapter } from "./d10/D10RulesetAdapter.js";

const d10Adapter = new D10RulesetAdapter();

export class RulesetRegistry {
  getAdapter(rulesetId) {
    if (rulesetId === "d10-basic") {
      return d10Adapter;
    }
    return getLegacyRulesetAdapter(rulesetId);
  }
}

export function createDefaultRulesetRegistry() {
  return new RulesetRegistry();
}

export function getRulesetAdapter(rulesetId) {
  return getLegacyRulesetAdapter(rulesetId);
}
