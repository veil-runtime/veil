import { test } from 'node:test';
import { execFileSync } from 'node:child_process';

test('external model experiment offline harness and provider contract', { timeout: 90000 }, () => {
  execFileSync(process.execPath, ['--test', 'experiments/external-model-reasoner/harness.test.mjs'], {
    encoding: 'utf8', env: {}, timeout: 85000, maxBuffer: 4 * 1024 * 1024,
  });
});
