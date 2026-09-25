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

The LinkedIn and generic capability HTTP endpoints submit plans through
OperatorRuntime. Stored-job execution is retired with 410. Recognized execution
references and direct capability/provider imports in `src/api/routes/` are
prohibited even if a trusted baseline once allowed them; candidate route
allowances are rejected. This is a syntax boundary, not a call-graph proof.
Approved runtime/SDK machinery, non-capability strategy execution and test/fixture
execution are classified individually. Ordinary computed data access is not a
governance finding; unresolved dynamic invocation/executable extraction is. Candidate
baseline edits cannot grant themselves permission. See
[the quality harness](quality-harness.html) for adoption, coverage and limits.
