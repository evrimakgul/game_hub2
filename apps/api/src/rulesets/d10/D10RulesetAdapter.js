import { getRulesetAdapter as getLegacyRulesetAdapter } from "../../rulesets.js";

export class D10RulesetAdapter {
  constructor({ legacyAdapter } = {}) {
    this.legacyAdapter = legacyAdapter || getLegacyRulesetAdapter("d10-basic");
    this.id = this.legacyAdapter?.id || "d10-basic";
    this.name = this.legacyAdapter?.name || "D10 Basic Success System";
  }

  getSheetSchema() {
    return this.legacyAdapter.getSheetSchema();
  }

  getPowerSystem() {
    return this.legacyAdapter.getPowerSystem();
  }

  getMeritsFlawsSystem() {
    return this.legacyAdapter.getMeritsFlawsSystem();
  }

  getXpBuySystem() {
    return this.legacyAdapter.getXpBuySystem();
  }

  getDefaultSectionLocks() {
    return this.legacyAdapter.getDefaultSectionLocks();
  }

  createDefaultCharacterSheetData(context) {
    return this.legacyAdapter.createDefaultCharacterSheetData(context);
  }

  normalizeCharacterSheet(character, context) {
    return this.legacyAdapter.normalizeCharacterSheet(character, context);
  }

  applyCharacterSheetUpdate(character, payload, context) {
    return this.legacyAdapter.applyCharacterSheetUpdate(character, payload, context);
  }

  validateAndPriceXpBuyAction(character, payload, context) {
    return this.legacyAdapter.validateAndPriceXpBuyAction(character, payload, context);
  }

  rollCheck(input) {
    return this.legacyAdapter.rollCheck(input);
  }
}
