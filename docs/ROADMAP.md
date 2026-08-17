# Operator Runtime Roadmap

## Overview

Operator Runtime is being developed as a generic, capability-driven execution platform.

The roadmap intentionally prioritises runtime foundations before expanding into large numbers of integrations.

The goal is to keep the core small, predictable, and reusable while allowing capabilities and providers to evolve independently.

---

## Version 0.1 — Runtime Foundation

Status: **Implemented**

The first milestone establishes the basic execution model.

### Core

- Capability contract
- Capability Registry
- Generic capability execution endpoint
- Permission model
- Audit logging

### Browser Infrastructure

- Playwright Browser Provider
- Shared browser lifecycle
- Session Manager
- Named authenticated sessions
- Public browser sessions

### Initial Capabilities

- `linkedin.auth.status`
- `linkedin.profile.self`
- `web.page.read`

### Development Infrastructure

- TypeScript
- Fastify API
- Git repository
- Architecture documentation
- Example scripts
- Authentication bootstrap tooling

The purpose of v0.1 is to prove that capabilities can be discovered, governed, executed, and audited through a reusable runtime.

---

## Version 0.2 — Job Runtime

Goal: move from executing individual capabilities to executing user goals.

### Job Model

Introduce a first-class Job entity containing:

- Job ID
- Goal
- Status
- Requested timestamp
- Start timestamp
- Completion timestamp
- Execution steps
- Result
- Failure information

Initial statuses:

```text
pending
planning
awaiting_approval
running
completed
failed
cancelled
```

### Job API

Introduce endpoints such as:

```text
POST /api/jobs
GET  /api/jobs/:id
GET  /api/jobs
```

Example:

```json
{
  "goal": "Read https://example.com"
}
```

### Execution History

A job should retain the capabilities executed during its lifecycle.

This begins separating user intent from individual capability calls.

---

## Version 0.3 — Planner Interface

Goal: allow goals to be converted into execution plans.

The runtime must support multiple planner implementations.

Possible planners include:

- deterministic rules
- local language models
- cloud language models
- application-provided plans

### Initial Planner Contract

Conceptually:

```ts
interface Planner {
  plan(goal: string, capabilities: CapabilityMetadata[]): Promise<ExecutionPlan>;
}
```

The planner receives:

- the user's goal
- available capabilities
- relevant context

It returns a structured execution plan.

The planner must never directly control providers.

---

## Version 0.4 — Local AI Planner

Goal: connect Operator Runtime to a local Ollama model.

Initial target:

- Qwen

The local model should be able to inspect the Capability Registry and choose the appropriate capability.

Example:

```text
User:

"Read https://example.com"

        ↓

Qwen

        ↓

web.page.read

        ↓

Execution Runtime
```

The first AI planner should remain deliberately constrained.

It should select capabilities and provide structured inputs rather than freely controlling browsers or executing arbitrary code.

---

## Version 0.5 — Operator Interface

Goal: remove the need for manual REST and PowerShell interaction.

Introduce a lightweight local interface.

Initial functionality:

- Submit a goal
- View current jobs
- View results
- View capability catalogue
- View approval requests
- View audit history

Example:

```text
Operator

What would you like me to do?

> Read Hacker News and summarize the major discussions.
```

The user should not need to know capability names, endpoint URLs, JSON payloads, or provider details.

---

## Version 0.6 — Persistent Runtime State

Goal: move execution state beyond process memory and console logs.

Introduce persistent storage for:

- Jobs
- Job steps
- Audit records
- approvals
- capability outcomes
- execution metrics

PostgreSQL is a likely initial persistence provider.

This milestone should introduce storage abstractions rather than embedding PostgreSQL-specific logic throughout the runtime.

---

## Version 0.7 — Capability Validation

Goal: make capability execution safer and more predictable.

Capabilities should declare structured input and output schemas.

Potential implementation:

- JSON Schema
- Zod
- equivalent schema abstraction

Example:

```json
{
  "name": "web.page.read",
  "input": {
    "url": {
      "type": "string",
      "format": "uri"
    }
  }
}
```

The runtime validates inputs before execution.

Planner-generated arguments must pass the same validation.

---

## Version 0.8 — Approval Workflow

Goal: formalise human-in-the-loop execution.

Read operations may continue automatically.

Write operations should be able to pause a job and request approval.

Example:

```text
Job
 ↓
Planner
 ↓
jira.comment.create
 ↓
Permission Engine
 ↓
Awaiting Approval
 ↓
Human Approves
 ↓
Execute
```

Approval records should contain:

- Job
- Capability
- Proposed input
- Risk level
- Request timestamp
- Approver
- Approval timestamp

### Contextual Execution Policy

The public `OperatorRuntime` API now accepts an `ExecutionAuthorizer`, providing
a runtime-scoped pre-execution boundary for contextual rules such as allowing
staging deployments while denying production deployments. Denials use the
ordinary job lifecycle and emit `capability.denied`.

Richer policy systems remain future work, including approval orchestration,
RBAC or ABAC, policy persistence and management, and administrative interfaces.
Those systems must extend the governed runtime path rather than create an
alternate execution path.

---

## Version 0.9 — Provider Expansion

Goal: prove that Operator Runtime is not browser-specific.

Candidate providers:

### REST Provider

Generic HTTP operations through governed capabilities.

### Filesystem Provider

Possible capabilities:

```text
filesystem.file.read
filesystem.directory.list
filesystem.file.write
```

### Git Provider

Possible capabilities:

```text
git.repository.status
git.commit.history
git.diff.read
```

### Database Provider

Possible capabilities:

```text
database.query.read
database.schema.inspect
```

Write access should remain highly governed.

---

## Version 0.10 — Capability SDK

Goal: make adding capabilities straightforward.

A capability developer should be able to implement:

```text
Metadata
Input Schema
Output Schema
Risk
Execute
```

without understanding runtime internals.

Future tooling may include:

```bash
operator capability create
```

which scaffolds:

```text
capability.ts
schema.ts
tests/
README.md
```

---

## Version 0.11 — Memory

Goal: allow the runtime to learn from previous execution outcomes.

Memory should initially be operational rather than conversational.

Potential memory types:

- successful execution plans
- failed plans
- provider reliability
- repeated workflows
- known entities
- execution preferences
- capability performance

The runtime may use these observations to improve future planning.

Memory must not allow uncontrolled modification of runtime code.

---

## Version 0.12 — Strategy Evaluation

Goal: introduce controlled improvement.

After job completion, an evaluator may examine:

```text
Was the goal completed?
Which capabilities succeeded?
Which failed?
How long did execution take?
Was human intervention required?
Could fewer steps have achieved the same result?
```

This data can improve future planning decisions.

---

## Version 0.13 — Capability Proposals

Goal: allow the system to identify missing reusable operations.

Example:

The runtime repeatedly performs:

```text
open page
find deployment section
extract deployment state
normalize status
```

It may propose:

```text
Suggested capability:
deployment.status.read
```

The system may generate candidate implementation code and tests.

Production registration remains subject to human review.

---

## Version 1.0 — Stable Operator Runtime

Version 1.0 represents the first stable generic runtime.

Expected characteristics:

- Stable capability contract
- Stable provider contract
- Job Engine
- Planner abstraction
- Local AI planner
- Persistent job state
- Persistent audit trail
- Permission and approval workflows
- Capability input validation
- Browser Provider
- Multiple non-browser providers
- Operator UI
- Capability SDK
- Operational memory

At this stage, applications should be able to integrate with Operator Runtime through a stable API without knowing implementation details.

---

# Future Directions

The following areas are intentionally outside the immediate roadmap but remain compatible with the architecture.

## Scheduling

Recurring jobs such as:

```text
Every morning:
check several systems
collect operational information
produce a daily brief
```

---

## Event-Driven Execution

Jobs triggered by:

- webhooks
- queues
- repository events
- monitoring alerts
- database events

---

## Distributed Workers

Provider execution may eventually occur on different machines.

Example:

```text
Operator Runtime
       │
       ├── Windows Worker
       ├── Linux Worker
       └── macOS Worker
```

Each worker may expose different capabilities.

---

## Multi-Device Execution

A capability may require a specific execution environment.

Examples:

```text
Windows application automation
macOS automation
Linux infrastructure inspection
GPU inference node
```

The scheduler should eventually route work to the correct execution node.

---

## Multi-Agent Planning

Multiple specialist planners may collaborate on complex jobs.

Examples:

```text
Research Planner
Engineering Planner
Security Reviewer
Execution Planner
```

The runtime itself should remain independent from the agent architecture.

---

## Multi-Tenant Operation

Operator Runtime may eventually serve multiple applications, organisations, or users.

This requires strong isolation of:

- sessions
- credentials
- jobs
- capabilities
- policies
- audit records
- memory

Tenant isolation must be designed before Operator Runtime is exposed as a shared service.

---

# Development Principle

The roadmap follows one guiding rule:

> **Expand capability without expanding complexity in the core.**

New integrations should normally appear as providers or capabilities.

New intelligence should normally appear as planners or evaluators.

New state should normally appear through runtime services.

The core execution contract should remain intentionally small and stable.
