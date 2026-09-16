import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';

import { MemoryEventBus } from '../src/runtime/events/memory-event-bus.js';
import { RuntimeEvent } from '../src/runtime/events/runtime-event.js';

const event: RuntimeEvent = {
  id: 'event-1',
  type: 'job.completed',
  timestamp: new Date(0).toISOString(),
};

for (const mode of ['throw', 'reject', 'reject-then-throw'] as const) {
  test(`subscriber failure is isolated: ${mode}`, async () => {
    const bus = new MemoryEventBus();
    const deliveries: string[] = [];
    // Register wildcard first to verify specific-before-wildcard invocation.
    bus.subscribe('*', () => { deliveries.push('wildcard'); });
    if (mode !== 'throw') {
      bus.subscribe(event.type, () => {
        deliveries.push('reject');
        return Promise.reject(new Error('observer rejected'));
      });
    }
    if (mode !== 'reject') {
      bus.subscribe(event.type, () => {
        deliveries.push('throw');
        throw new Error('observer threw');
      });
    }
    bus.subscribe(event.type, () => { deliveries.push('later specific'); });

    await assert.doesNotReject(bus.publish(event));
    // Let unhandled rejections surface; node:test fails the test if any occur.
    await setImmediate();
    assert.deepEqual(deliveries, [
      ...(mode !== 'throw' ? ['reject'] : []),
      ...(mode !== 'reject' ? ['throw'] : []),
      'later specific',
      'wildcard',
    ]);
  });
}

test('successful delivery awaits subscribers and preserves subscription cleanup', async () => {
  const bus = new MemoryEventBus();
  const deliveries: RuntimeEvent[] = [];
  let completed = false;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  const unsubscribe = bus.subscribe(event.type, async (received) => {
    deliveries.push(received);
    await pending;
    completed = true;
  });
  const unsubscribeWildcard = bus.subscribe('*', (received) => {
    deliveries.push(received);
  });
  bus.subscribe('job.failed', () => { assert.fail('unrelated subscriber'); });
  const publication = bus.publish(event);
  assert.deepEqual(deliveries, [event, event]);
  assert.equal(completed, false);
  release();
  await publication;
  assert.equal(completed, true);

  unsubscribe();
  unsubscribe();
  await bus.publish(event);
  assert.equal(deliveries.length, 3);
  unsubscribeWildcard();
  await bus.publish(event);
  assert.equal(deliveries.length, 3);
  const cleanup = bus.subscribe(event.type, (received) => { deliveries.push(received); });
  await bus.publish(event);
  assert.equal(deliveries.length, 4);
  cleanup();
});
