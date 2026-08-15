import { RuntimeEvent } from './runtime-event.js';

export function consoleEventSubscriber(
  event: RuntimeEvent
): void {
  console.debug(
    JSON.stringify({
      type: 'runtime_event',
      event,
    })
  );
}