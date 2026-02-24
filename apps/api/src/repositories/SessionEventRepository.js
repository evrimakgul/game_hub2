export class SessionEventRepository {
  constructor(data, { createId }) {
    this.data = data;
    this.createId = createId;
    if (!Array.isArray(this.data.sessionEvents)) {
      this.data.sessionEvents = [];
    }
  }

  add({ campaignId, type, actorUserId, payload = {} }) {
    const event = {
      id: this.createId(),
      campaignId,
      type,
      actorUserId,
      payload,
      createdAt: new Date().toISOString()
    };
    this.data.sessionEvents.push(event);
    return event;
  }
}
