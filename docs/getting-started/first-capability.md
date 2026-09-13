---
title: Your first capability
---
# Your first capability

A capability names one executable operation and assigns a risk.

```ts
import { createCapability, type CapabilityModule } from '@veil-runtime/core';

const echo = createCapability<{ value: string }, string>({
  name: 'example.echo', version: '1.0.0',
  description: 'Return the supplied value', risk: 'read',
  inputSchema: { value: { type: 'string', required: true, description: 'Text to return' } },
  async execute({ input }) { return input.value; },
});

export const exampleModule: CapabilityModule = {
  manifest: { name: 'example', version: '1.0.0', capabilities: [echo.name] },
  capabilities: [echo],
};
```

The callback receives `{ input, context? }`. The optional context contains job and step IDs, logger, and optional caller. Risks are `read`, `write`, and `destructive`; the default authorizer permits reads only. See [capabilities](../concepts/capabilities.html).
