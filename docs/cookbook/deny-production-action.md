---
title: Deny production action
---
# Deny production action

Use an authorizer to inspect resolved input and return a deny decision for
production. The capability will not start. This complete JavaScript example
uses a local counter to represent invocation; it never deploys anything or
contacts an external system.

Install the reviewed candidate using the [five-minute guide](../getting-started/five-minutes.html),
save this as `deny-production.mjs` in the same consumer project, and run
`node deny-production.mjs`:

```js
import assert from 'node:assert/strict';
import { createCapability, OperatorRuntime } from '@veil-runtime/core';

let invocations = 0;
const deployment = createCapability({
  name: 'example.deploy', version: '1.0.0', risk: 'write',
  description: 'Demonstrate a deployment request without deploying',
  inputSchema: {
    environment: { type: 'string', required: true, description: 'Target environment' },
  },
  async execute() {
    invocations++;
    return 'Simulated deployment';
  },
});

const runtime = new OperatorRuntime({
  authorizer: {
    async authorize({ capability, input, caller }) {
      if (capability.name === 'example.deploy' && capability.risk === 'write' &&
          typeof input === 'object' && input !== null &&
          'environment' in input && input.environment === 'staging' &&
          caller?.scopes?.includes('deploy:staging')) {
        return { decision: 'allow' };
      }
      return { decision: 'deny', reason: 'Only approved staging requests are allowed' };
    },
  },
});
runtime.use({
  manifest: { name: 'deployment-demo', version: '1.0.0', capabilities: [deployment.name] },
  capabilities: [deployment],
});

const job = await runtime.executePlan({
  version: '1.0',
  steps: [{ id: 'deploy', capability: deployment.name, input: { environment: 'production' } }],
}, { caller: { subject: 'demo-user', scopes: ['deploy:staging'] } });

assert.equal(job.status, 'failed');
assert.equal(invocations, 0);
assert.ok(job.events.some(event => event.type === 'capability.denied'));
assert.ok(!job.events.some(event => event.type === 'capability.started'));
console.log('Production denied; capability invocations:', invocations);
```

The custom authorizer replaces the default, so it explicitly allows only this
capability, staging target and scope. All other requests are denied. Caller
identity and scopes must come from trusted host authentication, not model output
or an untrusted request body. See [protect write actions](../guides/protect-write-actions.html).
