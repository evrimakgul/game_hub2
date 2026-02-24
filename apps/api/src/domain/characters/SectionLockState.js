export class SectionLockState {
  static ensureCharacterSectionLocks(character, adapter) {
    if (!character || !adapter || typeof adapter.getDefaultSectionLocks !== "function") {
      return {};
    }
    const defaults = adapter.getDefaultSectionLocks();
    const raw =
      character.sectionLocks && typeof character.sectionLocks === "object"
        ? character.sectionLocks
        : {};
    const next = {};
    for (const [sectionId, defaultEntry] of Object.entries(defaults)) {
      const current =
        raw[sectionId] && typeof raw[sectionId] === "object" ? raw[sectionId] : {};
      next[sectionId] = {
        locked:
          current.locked === undefined
            ? Boolean(defaultEntry.locked)
            : Boolean(current.locked),
        updatedAt: current.updatedAt || defaultEntry.updatedAt || null,
        updatedByUserId: current.updatedByUserId || defaultEntry.updatedByUserId || null
      };
    }
    character.sectionLocks = next;
    return character.sectionLocks;
  }

  static lockableSectionIds(adapter) {
    const schema =
      adapter && typeof adapter.getSheetSchema === "function"
        ? adapter.getSheetSchema()
        : null;
    return new Set(
      (schema?.sections || [])
        .filter((section) => section?.selectionSource?.lockable)
        .map((section) => section.id)
    );
  }
}
