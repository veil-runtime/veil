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

The input in this policy is not a reference object: Veil resolves references and
validates fields first. Under V1 it is the legacy resolved input. Under V2 it is
a detached recursively frozen copy of the captured, validated receiving value.
Caller is the runtime's immutable shallow snapshot in either version.

## Lifecycle and failures

Allow leads to capability.started and execution. Deny marks the step failed, emits capability.denied and then job.failed, and never emits capability.started or capability.failed for that denial. If authorize throws, the job fails without start or denial events; execution does not proceed. Tests prove runtime authorizers remain isolated even though capabilities are globally registered.

## When to use it

Provide an authorizer for any runtime that needs writes, tenant/caller policy, environment restrictions, or operation-specific approval. Do not use capability risk alone as a complete policy language; it is a coarse classification.

Related: [trust boundaries](../architecture/trust-boundaries.html), [protect write actions](../guides/protect-write-actions.html), [authorization API](../reference/authorization-api.html).

## Decision hardening (v0.2.0)

Execution requires a non-null, non-array object with an own `decision` property,
read once, equal to `allow`. A valid `deny` prevents execution; malformed decisions
and authorizer failures fail closed. A denial reason, if supplied, must be a string.

Under V1, decision hardening does not establish deep value stability:
authorization and invocation share the legacy resolved input, which policy can
mutate. Under V2, ADR-0011 separately guarantees a stable frozen authorization
view and a detached equivalent value at outer capability entry. It does not bind
later middleware/provider operations or effects. See [ExecutionPlan
V2](../reference/execution-plan-v2.html) and [trust
boundaries](../architecture/trust-boundaries.html).
