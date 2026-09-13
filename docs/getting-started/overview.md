---
title: Overview
---
# Overview

## What it is

Veil is a governed, capability-driven execution runtime. An application, deterministic code, a human, or an AI-backed planner can decide what should happen; Veil executes an `ExecutionPlan` through registered capabilities.

## Where it fits

```text
Reasoning / application -> ExecutionPlan -> OperatorRuntime
  -> validate -> resolve references -> validate resolved input -> authorize
  -> capability -> provider / external system -> job, events, history
```

Planners produce plans; they do not get direct provider access. A capability names an operation. A provider is the implementation that touches an external system.

## Next steps

[Install](installation.html), then create a [capability](first-capability.html), [plan](first-plan.html), and [runtime](first-runtime.html). Read [trust boundaries](../architecture/trust-boundaries.html) before enabling write operations.
