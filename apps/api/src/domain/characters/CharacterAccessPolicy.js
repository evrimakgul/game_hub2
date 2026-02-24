import { canViewCharacter } from "../../permissions.js";
import { httpError } from "../../http/httpError.js";

export class CharacterAccessPolicy {
  canView(membership, character) {
    return canViewCharacter(membership, character);
  }

  assertCanView(membership, character) {
    if (!this.canView(membership, character)) {
      throw httpError(403, "Character access denied.");
    }
  }
}
