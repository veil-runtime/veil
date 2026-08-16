# Veil Agent Instructions

Veil is a governed execution runtime. Treat the architecture tagged
`v0.1.0-arch-lock` as locked.

## Architectural laws

- Planners reason.
- Strategies orchestrate.
- `PlannerRouter` selects strategies.
- `ExecutionPlan` is the boundary between reasoning and execution.
- `OperatorRuntime` governs execution.
- Capabilities define work.
- Providers interact with external systems.

Do not redesign or bypass `ExecutionPlan`, `OperatorRuntime`, `Capability`, or
the public job/result/event contracts. Do not expose internal registries,
stores, provider implementations, or validators from the package root.

## Working rules

1. Read the relevant contracts and tests before editing.
2. State the files and smallest intended change before implementation.
3. Keep each task within its assigned ownership boundary.
4. Prefer extending an existing contract over adding a new abstraction.
5. Do not mix formatting, line-ending, or file-mode cleanup into feature work.
6. Run `npm run check` before handing work back.
7. Report changed files, commands run, exact failures, and remaining work.

Any change to a locked contract requires an explicit architecture decision by
the maintainer; agents must stop and request that decision.
