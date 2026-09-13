---
title: Result references
---
# Result references

## Exact form

A result reference is an object with exactly one property, $ref, whose string uses this grammar:

~~~text
steps.<stepId>.result
steps.<stepId>.result.<property>...
~~~

For example, { $ref: 'steps.create.result.id' } uses create's result id. The parser requires the steps. prefix, a nonempty step ID before .result, and either no suffix or a dot-separated suffix.

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
  audit: [{ value: { $ref: 'steps.create.result.order.id' } }],
}
~~~

## Invalid cases

A forward reference fails plan validation: steps.read.result.id cannot be used before the read step is declared. An object with other keys beside $ref is ordinary input, not a reference. Bad prefix/shape fails validation. At execution, an earlier source that has not completed fails; a missing path fails with+�u���\Result reference path not founf��y��y�. If a reference resolves to a number where the declared field is string, that step fails before authorization or capability execution.

## Common mistakes

Do not reference a job result; only earlier step results are addressable. Do not expect bracket notation, array indexes, escaping, or expressions: path segments are dot-split property names and the resolver only walks object-like values. Avoid duplicate IDs: current validation does not reject them and lookup finds the first prior matching completed step.

Related: [multi-step guide](../guides/multi-step-execution.html), [authorization](authorization.html), [v1 reference](../reference/execution-plan-v1.html).
