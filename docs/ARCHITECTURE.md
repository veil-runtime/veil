# Operator Runtime Architecture

## 1. Vision

Operator Runtime is a capability-driven execution engine that enables humans and AI systems to accomplish goals through governed, reusable capabilities.

It separates reasoning from execution.

Applications and planners decide **what** should happen.

Operator Runtime determines **how** those actions are executed safely, consistently, and audibly.

The runtime is provider-agnostic. Browsers are only the first provider. Future providers may include REST APIs, databases, SSH, Docker, filesystems, local AI models, cloud AI services, and other execution environments.

The goal is not to build a collection of automation scripts.

The goal is to create a reusable execution runtime through which software and AI systems can interact with external systems using a consistent capability model.

---

## 2. Core Principles

### 2.1 Separate reasoning from execution

Reasoning and execution are different responsibilities.

A planner may determine that a website needs to be read, a database queried, or an external system updated.

The runtime is responsible for carrying out those actions.

This allows reasoning engines to change without changing execution infrastructure.

A local model, cloud model, deterministic rules engine, application, or human can all use the same runtime.

---

### 2.2 Capabilities are the unit of execution

External functionality is exposed as capabilities.

Examples:

- `web.page.read`
- `linkedin.profile.self`
- `github.pull_requests.read`
- `database.query`
- `filesystem.read`
- `docker.container.inspect`

Capabilities describe **what can be done**, not how the underlying technology works.

Every capability follows a common contract.

---

### 2.3 Providers encapsulate technology

Capabilities should not directly manage infrastructure such as Playwright, SSH clients, database connections, or Docker clients.

Providers encapsulate those technologies.

Examples:

```text
Browser Provider
REST Provider
Database Provider
SSH Provider
Docker Provider
Filesystem Provider
AI Provider
```

Capabilities consume providers.

The runtime manages providers.

---

### 2.4 Authentication belongs to sessions

Capabilities should not manage credentials or authentication details.

The Session Manager provides named execution contexts such as:

```text
public
linkedin
github
jira
```

A capability requests the session it needs without knowing how authentication is stored or established.

---

### 2.5 Every action is governed

Execution should always pass through a permission boundary.

Current risk classes are:

```text
read
write
destructive
```

Read capabilities may execute automatically.

Write and destructive capabilities can require explicit approval.

Future versions may introduce more sophisticated policy evaluation.

---

### 2.6 Every execution is observable

Capability execution must be auditable.

The runtime should record information such as:

- capability
- requester
- risk
- approval state
- start time
- duration
- success or failure
- provider
- relevant execution metadata

Observability is a core runtime responsibility rather than an optional feature.

---

### 2.7 The core should remain small

The runtime should not contain provider-specific business logic.

LinkedIn logic belongs in LinkedIn capabilities.

GitHub logic belongs in GitHub capabilities.

Database behaviour belongs in database providers and capabilities.

New functionality should normally be introduced by adding capabilities or providers rather than modifying the runtime core.

---

## 3. High-Level Architecture

```text
                       Client / Application
                               │
                               ▼
                         Operator API
                               │
                               ▼
                           Job Engine
                               │
                               ▼
                            Planner
                               │
                               ▼
                     Capability Registry
                               │
                               ▼
                      Permission Engine
                               │
                               ▼
                       Execution Runtime
                               │
                ┌──────────────┴──────────────┐
                │                             │
         Session Manager                Audit Engine
                │
                ▼
                         Provider Layer
                ┌────────┼────────┬──────────┐
                │        │        │          │
             Browser    REST   Database     SSH
                │
                ▼
          External Systems
```

---

## 4. Capability Registry

The Capability Registry maintains the catalogue of executable operations available to the runtime.

Responsibilities include:

- registering capabilities
- discovering capabilities
- retrieving capability metadata
- resolving capabilities by name
- exposing available capabilities to applications and planners

Example:

```json
{
  "name": "web.page.read",
  "description": "Read the visible content of a public web page",
  "risk": "read"
}
```

The registry should eventually allow planners to discover available actions dynamically.

---

## 5. Capability Contract

A capability represents one reusable operation.

The current conceptual contract is:

```ts
interface Capability<TInput, TResult> {
  name: string;
  description: string;
  risk: 'read' | 'write' | 'destructive';

  execute(
    input: TInput,
    context?: CapabilityContext
  ): Promise<TResult>;
}
```

Capabilities should be:

- focused
- reusable
- predictable
- independently testable
- provider-aware but provider-implementation agnostic

A capability should ideally perform one meaningful operation.

---

## 6. Provider Model

Providers expose infrastructure services to capabilities.

The first implemented provider is the Browser Provider.

Its responsibility is to manage Playwright and browser lifecycle rather than forcing each capability to create and destroy browsers independently.

Future providers may include:

```text
Browser Provider
REST Provider
Database Provider
Filesystem Provider
SSH Provider
Docker Provider
AI Provider
Queue Provider
```

Providers should expose narrow interfaces instead of leaking implementation details throughout the runtime.

---

## 7. Session Management

The Session Manager abstracts authenticated execution contexts.

Current named sessions include:

```text
public
linkedin
```

Capabilities request a session by name:

```text
createSession("linkedin")
```

rather than knowing details such as:

```text
playwright/.auth/linkedin.json
```

This provides a natural path toward:

- multiple services
- multiple identities
- credential rotation
- tenant isolation
- session expiry
- authentication refresh

---

## 8. Permission Model

Every capability declares a risk level.

### Read

The capability retrieves information without intentionally changing external state.

Examples:

```text
web.page.read
linkedin.profile.self
```

These may normally execute automatically.

### Write

The capability changes external state.

Examples might include:

```text
jira.comment.create
github.issue.create
```

These should normally require explicit approval.

### Destructive

The capability performs an action that can remove, overwrite, stop, or otherwise significantly alter resources.

Examples might include:

```text
filesystem.delete
database.drop
docker.container.remove
```

These require stronger safeguards and approval.

The permission engine should remain independent from capability implementation.

---

## 9. Audit Model

Every capability execution should produce an audit record.

Current audit information includes:

```text
timestamp
capability
risk
approved
success
duration
error
```

Future versions should extend this with:

```text
jobId
actorId
tenantId
provider
session
input summary
output summary
approval identity
correlation ID
```

Audit data should eventually be persisted rather than only emitted to application logs.

---

## 10. Job Model

A capability is an operation.

A **job** represents a goal.

For example:

```text
"Read Hacker News and summarize the major discussions."
```

may become:

```text
Job
 ↓
Planner
 ↓
web.page.read
 ↓
AI summarization capability
 ↓
Result
```

A job may therefore involve one or many capabilities.

The Job Engine will eventually manage:

- job identity
- status
- planning
- execution steps
- permissions
- retries
- results
- failures
- history

---

## 11. Planner

The Planner converts goals into capability execution plans.

The Planner must not directly control providers.

Instead, it discovers capabilities through the registry and produces plans using registered operations.

Possible planner implementations include:

- deterministic planners
- local LLM planners
- cloud LLM planners
- application-supplied plans

This means Operator Runtime must not depend on any particular AI model.

AI is a consumer of the runtime, not the runtime itself.

---

## 12. Memory and Learning

The runtime may eventually maintain execution memory.

Memory can contain:

- previous jobs
- successful execution plans
- failed strategies
- provider reliability information
- learned preferences
- known entities
- cached observations

Learning must remain governed.

The system should not freely rewrite its runtime implementation.

Instead it may:

- rank successful strategies
- prefer reliable capabilities
- identify recurring workflows
- propose new capabilities
- generate candidate implementations
- evaluate execution outcomes

Any modification to production capability code should remain subject to testing and review.

---

## 13. Plugin and Extension Model

Long-term extensibility should allow capabilities and providers to be installed without changing runtime internals.

A plugin may contribute:

```text
Capabilities
Providers
Authentication adapters
Schemas
Planner hints
UI metadata
```

The runtime should discover these components through explicit contracts.

The core should not need to know whether a capability belongs to LinkedIn, GitHub, Jira, Docker, or a future system.

---

## 14. Current Implementation

The current runtime contains:

### Core

- Capability Registry
- Permission Engine
- Generic execution endpoint
- Audit logging

### Providers

- Browser Provider
- Session Manager

### Browser capabilities

- `linkedin.auth.status`
- `linkedin.profile.self`
- `web.page.read`

### API

- Health endpoint
- Capability discovery endpoint
- Generic capability execution endpoint

These components form the first working foundation of Operator Runtime.

---

## 15. Near-Term Architecture

The next major runtime layers are expected to be:

```text
Job Engine
Planner Interface
Operator API
Persistent Audit Store
Capability Input Validation
Provider Lifecycle Management
Operator UI
```

Once those foundations exist, additional providers and capabilities can be introduced without changing the execution model.

---

## 16. Long-Term Direction

Operator Runtime should eventually be capable of supporting workflows such as:

```text
User Goal

"Check the deployment state,
read the related issue,
inspect the server,
and tell me whether release is safe."

        ↓

Planner

        ↓

jira.issue.read
        +
ssh.server.inspect
        +
database.health.read
        +
deployment.status.read

        ↓

Permission Engine

        ↓

Providers

        ↓

Execution

        ↓

Audit + Memory

        ↓

Result
```

The same runtime should be usable by:

- standalone applications
- AI assistants
- automation platforms
- development tooling
- operational systems
- local personal assistants
- enterprise software

The browser is only the first execution environment.

The architecture should remain capable of supporting many others without changing the fundamental model.

---

## 17. Guiding Principle

The guiding principle of Operator Runtime is:

> **AI may reason. Applications may request. Operator Runtime executes.**

Execution should remain governed, observable, reusable, and independent from whichever intelligence requested it.