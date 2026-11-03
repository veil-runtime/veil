import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPublicSession } from '../src/providers/browser/browser-session.js';
import { sessionManager } from '../src/providers/browser/session-manager.js';

for (const cleanupFails of [false, true]) {
  test(`failed page creation preserves its error when cleanup ${cleanupFails ? 'rejects' : 'succeeds'}`, async () => {
    const original = sessionManager.create;
    const pageError = new Error('page creation failed');
    const cleanupError = new Error('context cleanup failed');
    let closes = 0;
    sessionManager.create = async () => ({
      async newPage() { throw pageError; },
      async close() {
        closes += 1;
        if (cleanupFails) throw cleanupError;
      },
    }) as unknown as Awaited<ReturnType<typeof sessionManager.create>>;
    try {
      await assert.rejects(createPublicSession(), (error: unknown) => {
        assert.strictEqual(error, pageError);
        return true;
      });
      assert.equal(closes, 1);
    } finally {
      sessionManager.create = original;
    }
  });
}
