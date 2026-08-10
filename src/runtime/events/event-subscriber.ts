import {
  RuntimeEvent,
  RuntimeEventType,
} from './runtime-event.js';

export type EventSubscriber<
  TEvent extends RuntimeEvent = RuntimeEvent
> = (
  event: TEvent
) => Promise<void> | void;

export interface EventSubscription {
  type: RuntimeEventType | '*';
  handler: EventSubscriber;
}