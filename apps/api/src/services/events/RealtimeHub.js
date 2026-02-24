function writeSseEvent(res, type, payload) {
  res.write(`event: ${type}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export class RealtimeHub {
  constructor({ sanitizeChatMessage, canReadChatMessage } = {}) {
    this.subscribers = new Set();
    this.sanitizeChatMessage = sanitizeChatMessage;
    this.canReadChatMessage = canReadChatMessage;
  }

  subscribe(subscriber) {
    this.subscribers.add(subscriber);
    return () => this.unsubscribe(subscriber);
  }

  unsubscribe(subscriber) {
    this.subscribers.delete(subscriber);
  }

  publishSessionEvent(event) {
    if (!event) {
      return;
    }
    for (const subscriber of this.subscribers) {
      if (subscriber.campaignId !== event.campaignId) {
        continue;
      }
      try {
        writeSseEvent(subscriber.res, "session_event", event);
      } catch {
        this.unsubscribe(subscriber);
      }
    }
  }

  publishChatMessage(message, userById) {
    if (!message || !this.sanitizeChatMessage || !this.canReadChatMessage) {
      return;
    }
    const payload = this.sanitizeChatMessage(message, userById);
    for (const subscriber of this.subscribers) {
      if (subscriber.campaignId !== message.campaignId) {
        continue;
      }
      if (!this.canReadChatMessage(message, subscriber.userId)) {
        continue;
      }
      try {
        writeSseEvent(subscriber.res, "chat_message", payload);
      } catch {
        this.unsubscribe(subscriber);
      }
    }
  }
}
