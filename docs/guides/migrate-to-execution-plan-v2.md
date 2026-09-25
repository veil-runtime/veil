---
title: Migrate from ExecutionPlan v1 to v2
---
# Migrate from ExecutionPlan v1 to v2

ExecutionPlan `2.0` is useful when a host needs Veil to own the value presented to
authorization and provide a detached equivalent value at outer capability entry.
It is not a general sandbox or durable-execution upgrade.

## 1. Choose an admission policy

Enable V2 in trusted host construction, not in request data:

```ts
// Governed-only boundary: every admitted plan uses V2 value semantics.
const runtime = new OperatorRuntime({
  planVersions: ['2.0'],
  authorizer,
});
```

For a staged compatibility boundary, use:

```ts
const runtime = new OperatorRuntime({
  planVersions: ['1.0', '2.0'],
  authorizer,
});
```

Omitting the option leaves the runtime V1-only. Mixed admission is deliberate
coexistence, not a universal V2 guarantee: untrusted proposal data can select V1
if the host admits it. Unknown/not-enabled versions reject before Job creation;
there is no fallback. Built-in planners and adapters still emit `1.0`, so migrate
or wrap those application-owned producers before using a V2-only runtime.

## 2. Audit receiving values

V2 accepts primitive values plus bounded, finite acyclic graphs of dense ordinary
arrays and ordinary/null-prototype records with enumerable string data properties.
Audit literal input and every selected earlier-step result for accessors, Proxies,
functions, symbols, cycles, sparse arrays, custom prototypes, rich native objects,
hidden fields and extra array properties. These representations are rejected;
Veil does not coerce, serialize or fall back to V1.

The public [V2 reference](../reference/execution-plan-v2.html#governed-value-domain)
lists the complete domain and resource bounds. Normalize rich provider results in
trusted capability/provider code when your application requires a passive data
contract; that normalization is application behavior, not a Veil effect guarantee.

## 3. Audit identity and mutation assumptions

V1 can preserve selected producer-result identity through authorization and outer
entry, and an authorizer can mutate the shared value. V2 intentionally removes
those channels:

- authorization receives a detached recursively frozen copy;
- capability entry receives a different detached mutable copy;
- neither copy shares governed containers with the source; and
- aliases within the accepted graph remain aliases within each copy.

Update authorizers that mutate input. Reads and policy decisions can remain the
same, but mutation attempts may throw or be ignored depending on JavaScript mode.
An uncaught authorizer error fails the Job. Update capabilities that depend on
object identity, custom prototypes, hidden state or producer-to-consumer mutation.

## 4. Account for failure timing

V2 uses this receiving sequence:

```text
resolution → capture → validation → frozen authorization copy
→ explicit allow → mutable capability copy → running/start → capability entry
```

Unsupported capture and schema failures occur before authorization. Denial,
malformed decisions and authorizer errors occur before start. If construction of
the post-allow capability copy fails, authorization has occurred but the step has
no `startedAt`, no `capability.started`, no capability entry and no capability
effect. The failure uses the existing failed-step/failed-Job lifecycle. A job-wide
`execution.started` event still precedes step processing, and earlier completed
steps are not rolled back.

## 5. Keep shared reference recognition in mind

[ADR-0013](../adr/0013-result-reference-object-shape.html) tightened the shared
V1/V2 classification rule. A wrapper must have exactly one own key, `$ref`, as an
enumerable data property containing a primitive string. Inherited/accessor `$ref`
values and wrappers with hidden or symbol extras are ordinary input rather than
instructions. Ordinary one-field literals remain supported.

This classification tightening applies even if a host stays on V1. It does not
make result-path traversal passive: own getters and Proxy traps on live producer
results can still execute before receiving authorization and, for V2, before
governed capture.

## 6. Preserve unchanged boundaries

V2 does not change plan/step fields, capability registration, capability risk,
caller ownership, explicit allow/deny decisions, sequential execution, result
assignment, Job/event contracts, provider APIs or the package export boundary.
It adds no retries, cancellation, rollback or idempotency enforcement.

Do not treat V2 as provider-operation binding or an external-effect guarantee.
Capability/middleware code can change its entry copy and construct a different
provider request. Installed capability/provider code remains executable trusted
host code, but it does not own authorization authority.

## Persistence and rollout limits

Jobs do not record the ExecutionPlan semantic version, and stored-Job replay is
not a public V2 resume/migration path. Memory and SQLite can present different
materialized values; JSON storage can drop or transform supported in-memory
values. Test the actual active execution/storage path, but do not advertise
cross-store parity or migration of historical Jobs.

A bounded rollout is:

1. add V2-specific input/result fixtures and authorizer tests;
2. run a mixed runtime only where compatibility is required;
3. move a boundary to `planVersions: ['2.0']` once all of its plan producers emit
   `2.0` and all receiving values satisfy the governed domain; and
4. keep V1 endpoints explicitly labeled if they remain available.

There is no automatic saved-plan conversion. Changing a plan's version string is
a semantic migration, not a package-version upgrade.
