---
title: ExecutionPlan v2
---
# ExecutionPlan v2

ExecutionPlan `2.0` is the opt-in governed-value version of the existing linear
plan protocol. It uses the same public `ExecutionPlan` and `ExecutionStep`
TypeScript types as `1.0`; the version string selects receiving-value semantics.

## Activation and admission

V2 is implemented but is not the default. A trusted host must enable it when it
constructs the runtime:

```ts
const runtime = new OperatorRuntime({
  planVersions: ['2.0'],
  authorizer,
});
```

Omitting `planVersions` is equivalent to `['1.0']`. A host can deliberately
support both versions with `planVersions: ['1.0', '2.0']`; each submitted plan's
version selects its semantics. The option must be a nonempty array containing
only unique implemented versions. Unknown versions, duplicates and an empty list
are rejected as host configuration errors.

A submitted version that is not implemented or not enabled for that runtime is
rejected with `UNSUPPORTED_PLAN_VERSION` before structural capture, Job creation,
authorization or capability invocation. There is no coercion, negotiation,
automatic upgrade or downgrade. Built-in planners and adapters continue to
produce V1 plans. A boundary claiming V2 ownership for every admitted plan should
therefore enable only `2.0`, rather than let proposal data select V1.

## Type shape

```ts
interface ExecutionPlan {
  readonly version: string;
  readonly id?: string;
  readonly goal?: string;
  readonly steps: readonly ExecutionStep[];
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly idempotencyKey?: string;
}
```

V2 does not add plan fields, authority-bearing metadata, provider handles or a
public governed-value type. Step order, capability lookup, capability-version
matching, schema checks, unique step IDs, result-reference grammar and Job/event
contracts otherwise remain the same as V1.

## Receiving-value lifecycle

For every V2 step, Veil uses this order:

```text
result-reference resolution
→ governed capture into private S
→ receiving-input validation of S
→ detached recursively frozen authorization copy A
→ validated explicit authorization allow
→ detached mutable capability-entry copy C
→ step running / capability.started
→ outer capability entry with C
```

Capture happens after existing resolution and before receiving-step validation.
The authorization and capability values are independently derived from the
private captured value. The capability-entry copy is constructed only after an
explicit allow and before the running/start transition.

For a successful invocation, Veil guarantees that:

- authorization receives a recursively frozen, detached view whose root binding
  cannot be replaced by the authorizer;
- the authorization view remains stable throughout the awaited policy call;
- the value at outer capability entry is a separate mutable copy structurally
  equivalent to the value initially presented to authorization;
- neither copy shares governed containers with the submitted/resolved source or
  with the other copy; and
- a capture, validation, authorization-decision or capability-copy failure
  prevents `capability.started` and capability entry for that step.

Caller identity and scopes remain trusted-host inputs. Plan input, metadata or
model output cannot supply or replace them. A plan remains requested work, not
authorization.

## Governed-value domain

V2 accepts `undefined`, `null`, booleans, strings, all JavaScript numbers
(including `NaN`, infinities and signed zero), and bigint. It accepts finite,
acyclic graphs of dense ordinary arrays and ordinary/null-prototype records with
enumerable string-keyed data properties. Repeated acyclic aliases are supported
and preserved within each detached representation.

V2 rejects accessors, Proxies, functions, symbols and symbol keys, cycles, sparse
arrays, hidden record properties, extra array properties, custom/cross-realm
prototypes, and richer native values such as Date, Map, Set, RegExp, promises,
buffers and typed arrays. It does not invoke getters, iterators, coercion hooks,
`toJSON` or custom serializers while capturing an admitted representation.

Capture is bounded to 128 container levels, 10,000 distinct containers, 100,000
data edges and 1,048,576 UTF-16 code units across keys and string leaves. Values
outside the domain or limits fail through the existing failed-step/failed-Job
path with `Value is not a supported governed representation`.

These rules govern the representation that resolution returned. They do not
attest hidden/private state or the complete semantics of an object that happens
to expose an otherwise admissible record representation.

## Result references

V1 and V2 share [ADR-0013's exact reference-wrapper
recognition](../concepts/result-references.html): a non-array object whose complete
own-key set is exactly `$ref`, where `$ref` is an enumerable own data property
containing a primitive string. Prototype identity and writable/configurable flags
do not affect recognition.

Reference-path selection still happens before V2 capture. Own getters and Proxy
traps in a live in-process producer result may execute, mutate state, throw or
reenter host code during traversal. V2 governs the value returned by that
selection; it does not make `$ref` traversal passive, getter-safe or Proxy-safe.

## Compatibility and limits

V1 remains available for legacy identity and mutation behavior. Under V1,
authorization and capability entry use the legacy resolved value and may share
objects with producer results. Under V2, supported receiving values are detached,
policy input is frozen, and unsupported representations fail before policy.
This is why V2 requires an explicit semantic version and host opt-in.

V2 does not guarantee hostile plugin/process isolation, committed-result
immutability, persistence/reload parity, provider-operation equivalence,
external-effect equivalence, rollback, retry safety, exactly-once execution or a
security proof. Capability and middleware code can mutate or replace its value
after outer entry and can construct a different provider request. Earlier steps
may already have effects when a later receiving step fails.

Jobs do not persist the plan semantic version. Stored-Job execution/replay is not
a supported V2 resume mechanism, and JSON-backed storage can transform values.
V2's guarantee concerns a successful receiving invocation in the current active
execution, after any prior storage materialization.

## Example

```ts
const runtime = new OperatorRuntime({
  planVersions: ['2.0'],
  authorizer: {
    async authorize({ input, caller }) {
      // input is the detached frozen V2 authorization view.
      return caller?.scopes?.includes('orders:read')
        ? { decision: 'allow' }
        : { decision: 'deny', reason: 'Missing orders:read scope' };
    },
  },
});

const job = await runtime.executePlan({
  version: '2.0',
  steps: [{
    id: 'read',
    capability: 'orders.read',
    input: { id: 'order-42' },
  }],
}, { caller: trustedHostCaller });
```

See [migrating from V1 to V2](../guides/migrate-to-execution-plan-v2.html),
[authorization](../concepts/authorization.html), [execution
lifecycle](../architecture/execution-lifecycle.html), and
[ADR-0011](../adr/0011-governed-value-ownership.html).
