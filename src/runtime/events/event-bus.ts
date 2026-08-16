import {
  RuntimeEvent,
  RuntimeEventType,
} from './runtime-event.js';

import {
  EventSubscriber,
} from './event-subscriber.js';

export interface EventBus {
  publish(
    event: RuntimeEvent
  ): Promise<void>;

  subscribe(
    type: RuntimeEventType | '*',
    handler: EventSubscriber
  ): () => void;
}