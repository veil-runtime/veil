---
title: Authorization
---
# Authorization

## Contract

ExecutionAuthorizer is a runtime-scoped object with async authorize(context). It returns either { decision: 'allow' } or { decision: 'deny', reason? }. Its context contains jobId, stepId, capability name/version/risk, fully resolved input, and optional caller.

## Default policy

The default implementation uses capability risk. It allows read and denies write and destructive capabilities with a reason requiring explicit approval. It does not interpret caller scopes, manifest permissions, metadata, or idempotency keys.

## Custom authorizer

~~~ts
const runtime = new OperatorRuntime({
  authorizer: {
    async authorize({ capability, input, caller }) {
      if (capability.risk === 'read') return { decision: 'allow' };
      if (capability.name === 'deploy.trigger' &&
          typeof input === 'object' && input !== null &&
          'environment' in input && input.environment === 'production') {
        return { decision: 'deny', reason: 'Production is not allowed.' };
      }
      return caller?.scopes?.includes('deploy:write')
        ? { decision: 'allow' }
        : { decision: 'deny', reason: 'Missing deploy scope.' };
    },
  },
});
~~~

The input in this policy is not a reference object: Veil resolves references and validates fields first. Caller is the runtime's immutable shallow snapshot.

## Lifecycle and failures

Allow leads to capability.started and execution. Deny marks the step failed, emits capability.denied and then job.failed, and never emits capability.started or capability.failed for that denial. If authorize throws, the job fails without start or denial events; execution does not proceed. Tests prove runtime authorizers remain isolated even though capabilities are globally registered.

## When to use it

Provide an authorizer for any runtime that needs writes, tenant/caller policy, environment restrictions, or operation-specific approval. Do not use capability risk alone as a complete policy language; it is a coarse classification.

Related: [trust boundaries](../architecture/trust-boundaries.html), [protect write actions](../guides/protect-write-actions.html), [authorization API](../reference/authorization-api.html).
