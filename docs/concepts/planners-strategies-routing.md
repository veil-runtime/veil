---
title: Planners, strategies, and routing
---
# Planners, strategies, and routing

Veil includes planning support while keeping planning replaceable. A Planner turns goal plus optional PlannerContext into ExecutionPlan. Planner providers implement concrete reasoning. PlannerStrategy orchestrates one or more providers. PlannerRouter selects the strategy.

run(goal, options) gets the registered default router and calls select with goal and optional requested strategy/planner. It then retrieves the selected strategy, obtains historical context, calls strategy.execute, and sends the resulting plan into executePlan. Direct plans skip this path but not governance.

The DefaultPlannerRouter selects explicit strategy first; otherwise a requested planner selects configured planner strategy; otherwise its default strategy. DirectStrategy favors requested eligible planner, then its configured planner. FallbackStrategy tries configured planners sequentially. Tests verify requested/default precedence, ineligible planner rejection, and fallback after provider failure.

The repository includes deterministic and OpenAI-compatible planner support, planner definitions, runtime state, eligibility, and registries. Those registration/implementation APIs are internal, so consumers should not imply that a particular model is required or import them. Planning cannot execute infrastructure operations itself; execution still runs through OperatorRuntime.

Related: [reasoning and execution](reasoning-and-execution.html), [lifecycle](../architecture/execution-lifecycle.html), [planner API](../reference/planner-api.html).
