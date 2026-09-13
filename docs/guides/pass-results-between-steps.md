---
title: Pass results between steps
---
# Pass results between steps

Use an earlier step result with `$ref`:

```ts
{ id: 'create', capability: 'entity.create', input: { name: 'Ada' } },
{ id: 'use', capability: 'entity.use', input: {
  entityId: { $ref: 'steps.create.result.id' },
} }
```

The source must precede the consumer. The runtime fails if the source did not complete, the path is absent, or the resolved value violates the consumer's declared field type. See [result references](../concepts/result-references.html).
