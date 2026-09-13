---
title: Planner API
---
# Planner API

Planner is a root-exported type with this asynchronous contract:

~~~ts
interface Planner {
  plan(goal: string, context?: PlannerContext): Promise<ExecutionPlan>;
}
~~~

Planner registration, routing, strategy, and provider implementation APIs are internal in v0.1.3. Consumer applications can produce an ExecutionPlan directly and submit it to OperatorRuntime without importing planner internals.
