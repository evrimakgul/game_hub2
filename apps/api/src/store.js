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
    sessionEvents: []
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

    this.data = JSON.parse(raw);
  }

  #save() {
    const tempPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), "utf-8");
    fs.renameSync(tempPath, this.filePath);
  }
}
