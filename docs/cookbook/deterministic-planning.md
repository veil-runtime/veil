---
title: Deterministic planning
---
# Deterministic planning

Veil does not require an LLM. Create a plan in application code and submit it to
`runtime.executePlan()`; the same validation, authorization and execution path
applies.

The [five-minute Core guide](../getting-started/five-minutes.html) contains the
complete, verified deterministic echo example, including installation and expected
output. It uses only the public package root and performs no external operation.

For several ordered operations, see [multi-step execution](../guides/multi-step-execution.html)
and [result references](../concepts/result-references.html). Core does not generate
an autonomous loop from a deterministic plan.
