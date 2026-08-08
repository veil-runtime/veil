# ADR-0003: Jobs Are the Unit of Work

**Status:** Accepted

**Date:** 2026-08-08

---

# Context

Operator Runtime initially exposed capabilities directly.

A client could request execution of a capability such as:

```text
web.page.read
```

and receive a result.

This model is sufficient for individual operations, but it does not represent how users or applications naturally describe work.

Users express goals such as:

```text
Read this website and tell me what it contains.
```

or:

```text
Inspect the deployment state and determine whether release is safe.
```

A goal may require:

- planning
- one or more capabilities
- permissions
- approvals
- retries
- execution history
- intermediate results
- final output

Direct capability execution does not provide a suitable abstraction for managing this lifecycle.

A higher-level unit of work is therefore required.

---

# Decision

Every meaningful request submitted to Operator Runtime will be represented as a **Job**.

A Job represents a goal and owns the lifecycle required to accomplish that goal.

Capabilities remain the unit of execution.

Jobs become the unit of work.

Conceptually:

```text
Goal
 ↓
Job
 ↓
Plan
 ↓
Steps
 ↓
Capabilities
 ↓
Result
```

Applications should normally interact with Jobs rather than directly orchestrating capabilities.

---

# Job Responsibilities

A Job is responsible for representing:

- identity
- goal
- lifecycle state
- execution plan
- execution steps
- timestamps
- results
- failures
- event history

A Job does not contain provider-specific implementation details.

---

# Job Lifecycle

The initial Job lifecycle is:

```text
created
   ↓
planning
   ↓
awaiting_approval
   ↓
executing
   ↓
completed
```

Alternative terminal states include:

```text
failed
cancelled
```

Not every Job must pass through every state.

For example, a read-only Job may move directly from planning to execution without requiring approval.

---

# Job Steps

A Job contains one or more execution steps.

Each step represents a planned capability invocation.

Example:

```json
{
  "capability": "web.page.read",
  "input": {
    "url": "https://example.com"
  }
}
```

A Job Step contains its own execution state.

Initial states include:

```text
pending
running
completed
failed
skipped
```

Each step may also contain:

- start timestamp
- completion timestamp
- result
- error
- execution metadata

---

# Events

Meaningful Job lifecycle changes are recorded as events.

Examples include:

```text
job.created
planning.started
planning.completed
approval.requested
approval.granted
execution.started
capability.started
capability.completed
capability.failed
job.completed
job.failed
job.cancelled
```

Events provide a chronological explanation of how the Job progressed.

The event history is part of the Job's operational record.

---

# Why Events Matter

Recording meaningful execution events provides several future capabilities without changing the core Job model.

## Audit

Events show exactly what happened and when.

## Debugging

Failures can be understood by inspecting the sequence of events leading to them.

## Analytics

Events can be aggregated to understand:

- execution duration
- capability usage
- failure rates
- approval frequency
- provider reliability

## Memory

Previous execution histories can later inform planning decisions.

## Learning

The runtime may compare successful and unsuccessful execution paths to improve future plans.

---

# Planner Relationship

The Planner does not execute work.

The Planner produces an execution plan for a Job.

Conceptually:

```text
Job Goal
   ↓
Planner
   ↓
Execution Plan
   ↓
Job Steps
```

The Job Engine then owns execution of those steps.

This preserves the separation established in ADR-0001.

---

# Capability Relationship

Capabilities remain independent from Jobs.

A capability should not need to know:

- which Job invoked it
- why the Job exists
- which other capabilities are executing
- how planning occurred

A capability receives input, performs one reusable operation, and returns a result.

The Job Engine owns orchestration.

---

# Provider Relationship

Jobs must never interact directly with providers.

The execution path remains:

```text
Job
 ↓
Job Step
 ↓
Capability
 ↓
Provider
 ↓
External System
```

This preserves the layering defined in ADR-0002.

---

# API Relationship

Clients may still use low-level capability execution endpoints for:

- debugging
- development
- testing
- administrative tooling

However, normal application workflows should increasingly use the Job API.

The preferred interface becomes:

```text
POST /api/jobs/run
```

with:

```json
{
  "goal": "Read https://example.com and tell me what it contains"
}
```

The client should not be responsible for manually coordinating:

```text
create
plan
execute
```

The Job Engine owns that lifecycle.

---

# Persistence

The initial Job Store is in-memory.

This is intentionally temporary.

The Job abstraction must remain independent from storage implementation.

Future stores may include:

- PostgreSQL
- SQLite
- distributed databases
- event stores

The Job Engine should depend on a Job Store contract rather than a specific database.

---

# Consequences

## Positive

Applications can express goals rather than implementation details.

Planning becomes independent from execution.

Jobs provide a natural home for:

- approvals
- retries
- results
- history
- scheduling
- persistence
- observability
- memory

Complex workflows can evolve from the same abstraction used for simple work.

---

## Negative

The runtime becomes more stateful.

Jobs require lifecycle management.

Persistence becomes necessary as the runtime matures.

Long-running Jobs will eventually require recovery and concurrency handling.

These costs are accepted because they provide a durable abstraction for coordinating work.

---

# Alternatives Considered

## Direct Capability Execution Only

Clients directly select and execute capabilities.

Rejected as the primary model because clients would need to understand runtime internals and manually coordinate multi-step work.

---

## Planner-Owned Execution

Allow the Planner to directly execute capabilities.

Rejected because it breaks the separation between reasoning and execution established in ADR-0001.

---

## Workflow-Specific Objects

Create separate abstractions for research, automation, deployments, browser work, and infrastructure tasks.

Rejected because it would fragment the runtime.

A generic Job abstraction can represent all of these forms of work.

---

# Guiding Principle

> **Capabilities perform operations. Jobs accomplish goals.**

Operator Runtime should treat Jobs as the primary representation of meaningful work.

Capabilities remain reusable building blocks used by Jobs to achieve those goals.