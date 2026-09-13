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

## Resolution sequence

1. Step A completes and its result is recorded on its JobStep.
2. Before Step B executes, Veil walks B's input recursively.
3. Each reference is replaced with the earlier completed step result or requested property.
4. Veil validates B's resolved input schema.
5. Veil authorizes B using that resolved input.
6. Only an allow starts B's capability.

References can be scalar fields, nested object members, array items, or objects inside arrays because resolution recursively maps arrays and object entries.

~~~ts
input: {
  orderId: { $ref: 'steps.create.result.order.id' },
  firstItemId: { $ref: 'steps.create.result.items.0.id' },
  audit: [{ value: { $ref: 'steps.create.result.order.id' } }],
}
~~~

Numeric dot segments such as items.0 work because the resolver uses property lookup on object-like values, including arrays. Bracket syntax such as items[0] is not parsed as an array index.

## Parser edge cases

The normal form should use nonempty dot-separated property names. The current parser nevertheless accepts steps.create.result. and steps.create.result..id: it turns the suffix into an empty path segment, which normally fails resolution unless the result has an empty-string property. This is current implementation behavior, not recommended reference syntax. steps.create.result has an empty path and resolves the full result. A malformed prefix or missing step ID fails parsing.

## Invalid cases

A forward reference fails plan validation: steps.read.result.id cannot be used before the read step is declared. An object with other keys beside $ref is ordinary input, not a reference. At execution, an earlier source that has not completed fails; a missing path throws Result reference path not found: <reference>. If a reference resolves to a number where the declared field is string, that step fails before authorization or capability execution.

## Common mistakes

Do not reference a job result; only earlier step results are addressable. Do not expect expressions, escaping, or bracket notation. Avoid duplicate IDs: current validation does not reject them and lookup finds the first prior matching completed step.

Related: [multi-step guide](../guides/multi-step-execution.html), [authorization](authorization.html), [v1 reference](../reference/execution-plan-v1.html).
