import { SessionEventRepository } from "../../repositories/SessionEventRepository.js";

export class SessionEventService {
  constructor({ createId }) {
    this.createId = createId;
  }

  record(data, payload) {
    const repo = new SessionEventRepository(data, { createId: this.createId });
    return repo.add(payload);
  }
}
