---
title: Upcoming v0.1.4 (unreleased)
description: The scope and limits of Veil’s upcoming execution hardening and deterministic capability introspection.
---
# Upcoming v0.1.4

**Unreleased. v0.1.3 remains the latest published package.** The hardening below
is merged into `develop`; deterministic capability introspection is present in
the local implementation and still awaits its PR and merge. Neither is available
through the published v0.1.3 install. This page describes current source behavior,
not a release announcement.

## Reasoning proposes; Veil governs execution

Software, humans, and planners produce a declarative `ExecutionPlan`.
`OperatorRuntime` validates the plan, resolves registered capabilities and earlier
results, validates resolved inputs, authorizes each step, and records execution
outcomes. Capabilities define work; providers interact with infrastructure.
No particular model or reasoning system is required.

## Governed-execution hardening

- **Observer failures:** internal event-subscriber throws and rejections do not
  change execution outcomes or stop delivery to other subscribers. Publication
  still awaits subscribers; there is no observer timeout or mutation isolation.
- **Explicit authorization:** execution requires a valid own `decision: 'allow'`
  on a non-null, non-array object. Malformed decisions and authorizer failures fail
  closed. The default policy still allows reads and denies writes/destructive work.
- **Result references:** each result-path segment must be an own property.
  Inherited properties are rejected; own getters and proxy traps can still run.
- **Step identity:** duplicate step IDs reject admission before a job is created.
  Equality is exact within a plan; separate plans may reuse IDs.
- **Structural ownership:** `executePlan` captures a runtime-owned structural
  envelope before admission. Validation and job materialization use that same
  structure, including step order, identity, capability bindings and input root
  bindings. Later caller structural edits cannot redirect that submission.

These boundaries do **not** make inputs deeply immutable. Nested input and
reference contents remain shared. Authorization and invocation share resolved
input, with no revalidation between them; deep value stability from authorization
to capability invocation is **not guaranteed**. Structural capture does not cover
stored-job replay. See [trust boundaries](../architecture/trust-boundaries.html).

## Deterministic capability introspection

`runtime.listCapabilities()` returns inventory in registration order.
`runtime.describeCapability(name, version?)` performs exact, case-sensitive lookup;
a supplied version must match exactly. An unknown name or version mismatch returns
`undefined`. This is registered-name lookup, not semantic discovery.

The public `CapabilityDescriptor` contains `name`, `version`, `description`, `risk`
and `inputSchema`. Returned descriptors, schema records and field records are
fresh, detached and mutable, not frozen. The schema describes Veil’s limited
field contract, not full JSON Schema. Inventory is process-global, not private
to a runtime or filtered for a caller. Duplicate names remain rejected even
when versions differ.

Three questions stay separate:

1. **Introspection:** What execution capabilities are registered?
2. **External application or reasoning:** Which capability is relevant?
3. **Authorization:** May this caller execute it with this input?

Introspection invokes no authorizer, capability or provider. Registration implies
neither permission nor provider readiness. Veil adds no semantic search, ranking,
embeddings or LLM-driven capability selection. Execution still passes through a
normal `ExecutionPlan` and runtime governance.

See the [OperatorRuntime reference](../reference/operator-runtime.html#deterministic-capability-introspection-unreleased-v014)
for the unreleased API example and [capability API](../reference/capability-api.html)
for the descriptor contract. These examples require the local v0.1.4 implementation;
do not use them with the published v0.1.3 package.

## What remains application-owned

Relevance selection, human approval UI, provider credentials, and external side
effects remain application responsibilities. Governed execution is not a sandbox
or a promise of deterministic external results. Plans remain sequential; this
work adds no DAGs, parallel execution, retries, cancellation, rollback or
idempotency enforcement.
