---
title: Architecture rules
---
# Architecture rules

The repository locks its architecture. Planners reason; strategies orchestrate; PlannerRouter selects strategies; ExecutionPlan is the boundary; OperatorRuntime governs execution; capabilities define work; providers interact externally. Locked contract changes need a maintainer architecture decision.

The first machine-enforced invariant is **VEIL-GOV-001: No new unapproved
capability execution reference or direct JobManager execution entrance may be
introduced.** The experimental quality harness checks the whole relevant
candidate tree, using individual allowances from the explicit comparison base.
Capability work should enter through `OperatorRuntime.run` or `executePlan`.

Existing direct HTTP execution in `linkedin.routes.ts` and `jobs.routes.ts`
is recorded as legacy debt, not repaired by this rule. The generic capability
HTTP endpoint now submits a plan through OperatorRuntime.
Approved runtime/SDK machinery, non-capability strategy execution and test/fixture
execution are classified individually. Ordinary computed data access is not a
governance finding; unresolved dynamic invocation/executable extraction is. Candidate
baseline edits cannot grant themselves permission. See
[the quality harness](quality-harness.html) for adoption, coverage and limits.
