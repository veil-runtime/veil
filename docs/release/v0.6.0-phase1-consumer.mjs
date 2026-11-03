import assert from 'node:assert/strict';
import { readdirSync, readlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { OperatorRuntime } from '@veil-runtime/core';
const database = resolve('data/operator.db');
const descriptors = () => readdirSync('/proc/self/fd').filter(fd => {
  try { return readlinkSync(`/proc/self/fd/${fd}`) === database; }
  catch { return false; }
}).length;
const before = descriptors();
let maximum = 0;
const runtime = new OperatorRuntime({ planVersions: ['1.0', '2.0'] });
const cycle = {}; cycle.self = cycle;
let fail = false;
runtime.use({ manifest: { name: 'independent', version: '1', capabilities: ['independent.log'] },
  capabilities: [{ name: 'independent.log', version: '1', risk: 'read', description: 'Independent reliability probe',
    async execute(input, context) {
      context.logger.info('cyclic metadata', cycle);
      maximum = Math.max(maximum, descriptors());
      if (fail) throw new Error('independent primary error');
      return input;
    } }],
});
for (let index = 0; index < 30; index += 1) {
  const version = index % 2 ? '2.0' : '1.0';
  const result = await runtime.executePlan({ version, steps: [
    { id: 'a', capability: 'independent.log', input: { value: index } },
    { id: 'b', capability: 'independent.log', input: { value: index } },
  ] });
  assert.equal(result.status, 'completed');
  assert.deepEqual(result.result, [{ value: index }, { value: index }]);
  assert.equal(descriptors(), before);
}
fail = true;
const failed = await runtime.executePlan({ version: '2.0', steps: [{ id: 'failure', capability: 'independent.log' }] });
assert.equal(failed.error, 'independent primary error');
await new Promise(resolve => setImmediate(resolve));
const after = descriptors();
assert.equal(after, before);
assert.equal(maximum, before + 1);
console.log(JSON.stringify({ success: true, successfulJobs: 30, successfulSteps: 60, failedJobs: 1,
  semanticVersions: ['1.0','2.0'], descriptorsBefore: before, maximumDescriptors: maximum, descriptorsAfter: after }));
