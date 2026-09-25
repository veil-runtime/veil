---
title: Result references
---
# Result references

## Exact form

A result reference is an object with exactly one property, $ref. The normal supported form is:

~~~text
steps.<stepId>.result
steps.<stepId>.result.<property>...
~~~

For example, { $ref: 'steps.create.result.id' } uses create's result id. The parser requires the steps. prefix and a nonempty step ID before the first .result.

At the JavaScript boundary, “exactly one property” means the complete own-key set,
including nonenumerable strings and symbols, is exactly `$ref`. `$ref` must be an
enumerable own data property containing a primitive string. Writable and
configurable flags do not matter, and neither does prototype identity; ordinary,
null-prototype and class-created objects may qualify. Inherited or accessor-backed
`$ref`, any additional own key, arrays and non-string values do not qualify. Proxy
objects are not specially rejected, so their reflection traps may run or throw.
This wrapper rule applies to ExecutionPlan 1.0 and 2.0.

## Resolution sequence

1. Step A completes and its result is recorded on its JobStep.
2. Before Step B executes, Veil walks B's input recursively.
3. Each reference is replaced with the earlier completed step result or requested property.
4. For ExecutionPlan 2.0, Veil applies [ADR-0011](../adr/0011-governed-value-ownership.html) governed capture to the complete resolved receiving value.
5. Veil validates B's receiving input (the captured representation under ExecutionPlan 2.0).
6. Veil authorizes B using that resolved input or its governed authorization view.
7. Only an allow starts B's capability.

References can be scalar fields, nested object members, array items, or objects inside arrays because resolution recursively maps arrays and object entries.

~~~ts
input: {
  orderId: { $ref: 'steps.create.result.order.id' },
  firstItemId: { $ref: 'steps.create.result.items.0.id' },
  audit: [{ value: { $ref: 'steps.create.result.order.id' } }],
}
~~~

Numeric dot segments such as items.0 work because the resolver uses property lookup on object-like values, including arrays. Bracket syntax such as items[0] is not parsed as an array index.

## Own-property traversal (v0.2.0)

Every result-path segment must be an own property of the current object.
Inherited properties are rejected; own special names are valid data. Getters
and Proxy traps may run. Under ExecutionPlan 1.0, referenced objects retain
identity and mutability; resolution does not isolate values or stabilize them
between authorization and invocation. Under ExecutionPlan 2.0, traversal is still
active, but the value returned by resolution then enters ADR-0011 governed capture
before receiving-step validation and authorization.

This ordering matters for live in-process results. A capability/provider-produced
getter or Proxy can mutate host or producer state, affect later selections, throw,
or reenter a runtime before the receiving value is captured or authorized. That is
trusted host-code behavior, not the receiving capability invocation and not an
authorization grant. Traversal supplies no caller/scopes or execution handle, and a
reentrant submission must pass its own admission and authorization. A traversal
error prevents receiving-step authorization and entry, but does not roll back prior
host behavior.

[ADR-0013](../adr/0013-result-reference-object-shape.html) defines only whether an input object is a result-reference wrapper. It does
not make referenced-result traversal passive, getter-safe, Proxy-safe or side-effect
free. ADR-0011 begins when the already-resolved receiving value is captured; it does
not retroactively govern selection behavior. Model-authored or serialized JSON does
not itself contain executable JavaScript behavior; an in-process capability,
provider or host integration must introduce the active value.

Persistence is not an isolation boundary. Memory Jobs retain live graphs, and
SQLite does not reload a newly produced result between active steps. Later JSON
serialization/reload can invoke behavior and produce a lossy ordinary-data
representation; that does not establish committed-result immutability or stable
cross-store semantics. See [trust boundaries](../architecture/trust-boundaries.html)
and the [pre-capture investigation](../architecture/pre-capture-result-reference-boundary.html).

## Parser edge cases

The normal form should use nonempty dot-separated property names. The current parser nevertheless accepts steps.create.result. and steps.create.result..id: it turns the suffix into an empty path segment, which normally fails resolution unless the result has an empty-string property. This is current implementation behavior, not recommended reference syntax. steps.create.result has an empty path and resolves the full result. A malformed prefix or missing step ID fails parsing.

## Invalid cases

A forward reference fails plan validation: steps.read.result.id cannot be used before the read step is declared. An object with other keys beside $ref is ordinary input, not a reference. At execution, an earlier source that has not completed fails; a missing path throws Result reference path not found: <reference>. If a reference resolves to a number where the declared field is string, that step fails before authorization or capability execution.

## Common mistakes

Do not reference a job result; only earlier step results are addressable. Do not expect expressions, escaping, or bracket notation. In **v0.2.0**, step IDs MUST be unique within each plan using exact-string equality; every repeated occurrence is a validation error and rejects the plan before job creation. IDs may be reused across different plans. Case and whitespace differences remain distinct; no trimming, case folding, or Unicode normalization is performed.

Related: [multi-step guide](../guides/multi-step-execution.html), [authorization](authorization.html), [v1 reference](../reference/execution-plan-v1.html).
