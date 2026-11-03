import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPublicSession } from '../src/providers/browser/browser-session.js';
import { sessionManager } from '../src/providers/browser/session-manager.js';

test('failed page creation closes its newly created browser context', async () => {
  const original = sessionManager.create;
  let closes = 0;
  sessionManager.create = async () => ({
    async newPage() { throw new Error('page creation failed'); },
    async close() { closes += 1; },
  }) as unknown as Awaited<ReturnType<typeof sessionManager.create>>;
  try {
    await assert.rejects(createPublicSession(), /page creation failed/);
    assert.equal(closes, 1);
  } finally {
    sessionManager.create = original;
  }
});
