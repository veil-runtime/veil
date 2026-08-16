# Contributing to Veil

Thank you for your interest in contributing to Veil.

Veil is a governed execution platform that separates reasoning from execution
through stable, extensible contracts.

## Workflow

1. Create a focused branch from the current development branch.
2. Keep each change small and aligned with the repository's architecture.
3. Open a pull request using the repository template and describe the behavior,
   public API impact, and validation performed.
4. Address review feedback before merge. Maintainers control merging and
   releases.

Before requesting review, run:

```bash
npm run check
```

## Architecture and public API

The architecture at `v0.1.0-arch-lock` is locked. Preserve the boundary between
reasoning and governed execution: planners reason, strategies orchestrate,
`PlannerRouter` selects strategies, `ExecutionPlan` is the boundary, and
`OperatorRuntime` governs execution.

Do not redesign `ExecutionPlan`, `OperatorRuntime`, capabilities, planner
contracts, or public job/result/event contracts without an explicit maintainer
architecture decision. Keep internal registries, stores, provider
implementations, and validators out of the package root. Public API changes
need a clear compatibility assessment and maintainer approval.

## Contribution licensing

Unless you explicitly state otherwise, contributions intentionally submitted
for inclusion in Veil are submitted under the Apache License, Version 2.0,
consistent with the repository `LICENSE`. This follows Apache-2.0 section 5;
Veil does not currently require a CLA or DCO. Whether either is needed is a
future governance decision.
