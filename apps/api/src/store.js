import fs from "node:fs";
import path from "node:path";

function createDefaultData() {
  return {
    meta: {
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    users: [],
    campaigns: [],
    memberships: [],
    invites: [],
    characterSheets: [],
    sessionEvents: [],
    chatMessages: []
  };
}

export class JsonStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = createDefaultData();
    this.#load();
  }

  read() {
    return structuredClone(this.data);
  }

  update(mutator) {
    const draft = structuredClone(this.data);
    const result = mutator(draft);
    draft.meta.updatedAt = new Date().toISOString();
    this.data = draft;
    this.#save();
    return result;
  }

  #load() {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });

    if (!fs.existsSync(this.filePath)) {
      this.#save();
      return;
    }

    const raw = fs.readFileSync(this.filePath, "utf-8");
    if (!raw.trim()) {
      this.#save();
      return;
    }

    const parsed = JSON.parse(raw);
    const defaults = createDefaultData();
    this.data = {
      ...defaults,
      ...parsed,
      meta: {
        ...defaults.meta,
        ...(parsed.meta || {})
      }
    };

    // Backward-compatible normalization for older store snapshots.
    for (const key of [
      "users",
      "campaigns",
      "memberships",
      "invites",
      "characterSheets",
      "sessionEvents",
      "chatMessages"
    ]) {
      if (!Array.isArray(this.data[key])) {
        this.data[key] = [];
      }
    }
  }

  #save() {
    const tempPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), "utf-8");
    fs.renameSync(tempPath, this.filePath);
  }
}
