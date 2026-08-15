import {
  RuntimeEvent,
  RuntimeEventType,
} from './runtime-event.js';

import {
  EventSubscriber,
} from './event-subscriber.js';

import {
  EventBus,
} from './event-bus.js';

export class MemoryEventBus
  implements EventBus
{
  private readonly subscribers =
    new Map<
      RuntimeEventType | '*',
      Set<EventSubscriber>
    >();

  subscribe(
    type: RuntimeEventType | '*',
    handler: EventSubscriber
  ): () => void {
    const handlers =
      this.subscribers.get(type) ??
      new Set<EventSubscriber>();

    handlers.add(handler);

    this.subscribers.set(
      type,
      handlers
    );

    return () => {
      handlers.delete(handler);

      if (handlers.size === 0) {
        this.subscribers.delete(type);
      }
    };
  }

  async publish(
    event: RuntimeEvent
  ): Promise<void> {
    const specific =
      this.subscribers.get(event.type) ??
      new Set<EventSubscriber>();

    const wildcard =
      this.subscribers.get('*') ??
      new Set<EventSubscriber>();

    const handlers = [
      ...specific,
      ...wildcard,
    ];

    await Promise.all(
      handlers.map(
        (handler) =>
          Promise.resolve(handler(event))
      )
    );
  }
}

export const runtimeEventBus =
  new MemoryEventBus();