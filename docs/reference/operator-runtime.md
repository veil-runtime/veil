---
title: OperatorRuntime
---
# OperatorRuntime

## Construction

new OperatorRuntime(options?) accepts optional { authorizer?: ExecutionAuthorizer }. Without one, defaultExecutionAuthorizer allows read capability risk and denies write/destructive. operatorRuntime is a module-level default instance.

## Public methods

use(module) checks that every supplied module capability name appears in module.manifest.capabilities, then globally registers each capability. executePlan(plan, { caller? }) validates and runs a direct plan. run(goal, { planner?, strategy?, caller? }) performs internal routing/strategy planning then executes its plan. getJob(id), listJobs(filter?), listCapabilities(), and listPlanners() are read APIs over internal global services.

## Caller

ExecutePlanOptions and RunJobOptions allow caller with subject, tenant, scopes, and metadata. OperatorRuntime makes a frozen shallow copy; its scopes array and metadata object are copied/frozen too. That snapshot is supplied to authorizer and execution context.

## Failure model

executePlan throws for empty or invalid plans before creating a job. Once a valid job starts, execution failures are represented by a Job with status/outcome failed. run may reject earlier for planning/routing failures. use throws if a supplied capability is omitted from its manifest.

## Important scope detail

Authorizers are runtime instance state, so two runtimes sharing a capability can make different decisions. The capability registry and job services are not runtime-instance isolated in this release. Do not assume use creates a private runtime sandbox.

Related: [execution lifecycle](../architecture/execution-lifecycle.html), [authorization](../concepts/authorization.html), [jobs](../concepts/jobs-and-outcomes.html).
