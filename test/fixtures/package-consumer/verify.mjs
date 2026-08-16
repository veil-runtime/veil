import assert from 'node:assert/strict';
import * as publicApi from '@veil-runtime/core';
import { validateConsumer } from './dist/index.js';

assert.equal(typeof publicApi.OperatorRuntime, 'function');
assert.equal(typeof publicApi.createCapability, 'function');
await validateConsumer();

for (const privateImport of [
  '@veil-runtime/core/dist/index.js',
  '@veil-runtime/core/src/index.js',
  '@veil-runtime/core/runtime/operator-runtime',
]) {
  await assert.rejects(
    import(privateImport),
    (error) => error?.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED',
  );
}
