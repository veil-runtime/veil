# ADR-0002: Runtime Layering

**Status:** Accepted

**Date:** 2026-08-08

---

# Context

Operator Runtime began as a small browser automation project.

The initial source structure was intentionally simple:

```text
src/
├── browser/
├── core/
├── providers/
├── routes/
└── skills/
```

As the project evolves into a generic execution runtime, these folders are becoming too broad.

The term `core` does not clearly describe responsibility.

The term `skills` implies application behaviour rather than reusable runtime capabilities.

The API layer is currently represented as `routes`, even though HTTP transport is only one interface into the runtime.

The project now requires stronger boundaries so that future features such as Jobs, Planners, Memory, multiple Providers, and additional execution interfaces can grow without mixing responsibilities.

---

# Decision

Operator Runtime will use explicit architectural layers.

The target source structure is:

```text
src/
├── runtime/
│   ├── jobs/
│   ├── execution/
│   ├── planner/
│   ├── permissions/
│   ├── audit/
│   └── registry/
│
├── providers/
│   ├── browser/
│   ├── rest/
│   ├── database/
│   ├── filesystem/
│   ├── ssh/
│   └── docker/
│
├── capabilities/
│   ├── linkedin/
│   ├── web/
│   └── future/
│
├── api/
│   ├── routes/
│   ├── schemas/
│   └── server/
│
└── shared/
```

These layers define responsibility rather than technology.

---

# Runtime Layer

The `runtime/` layer contains the execution model itself.

It should know nothing about LinkedIn, GitHub, Jira, Playwright, PostgreSQL, or any other external system.

Its responsibilities include:

- jobs
- planning abstractions
- execution orchestration
- capability registration
- permission evaluation
- audit coordination
- runtime lifecycle

Examples:

```text
runtime/jobs/
runtime/execution/
runtime/planner/
runtime/permissions/
runtime/audit/
runtime/registry/
```

The runtime is the stable center of the project.

---

# Provider Layer

The `providers/` layer encapsulates infrastructure and external technology clients.

Examples include:

```text
providers/browser/
providers/rest/
providers/database/
providers/filesystem/
providers/ssh/
providers/docker/
```

Providers expose infrastructure services to capabilities.

A provider may manage:

- connections
- sessions
- lifecycle
- authentication adapters
- retries
- low-level technology behaviour

Providers should not contain application-specific workflow logic.

For example:

The Browser Provider may know how to create an authenticated browser context.

It should not know how to read a LinkedIn profile.

---

# Capability Layer

The `capabilities/` layer contains reusable operations that achieve meaningful actions.

Examples:

```text
capabilities/linkedin/profile-self.ts
capabilities/linkedin/auth-status.ts
capabilities/web/page-read.ts
```

Capabilities may depend on providers.

Capabilities must not manage provider lifecycle directly when that lifecycle belongs to a provider or runtime service.

A capability should expose:

- name
- description
- risk
- input contract
- output contract
- execution logic

Capabilities describe what the runtime can do.

Providers describe how external technology is accessed.

---

# API Layer

The `api/` layer exposes Operator Runtime to external clients.

Initial transport is HTTP using Fastify.

Possible future interfaces include:

- REST
- WebSocket
- CLI
- local desktop interface
- SDK
- message queues

The runtime must not depend on HTTP.

The API depends on the runtime.

Example structure:

```text
api/
├── routes/
├── schemas/
└── server/
```

HTTP-specific concepts such as request objects, status codes, headers, and route registration remain inside this layer.

---

# Shared Layer

The `shared/` layer contains narrowly reusable technical utilities that do not belong to a single architectural layer.

Examples may include:

- common types
- identifiers
- error types
- configuration helpers
- time utilities

`shared/` must not become a replacement for `core`.

If a component has a clear architectural owner, it belongs with that owner instead.

---

# Dependency Direction

Dependencies should flow inward toward the runtime abstractions.

Conceptually:

```text
API
 ↓
Runtime
 ↓
Capabilities
 ↓
Providers
```

However, direct circular dependencies between layers must be avoided.

The practical dependency rules are:

- API may depend on Runtime.
- Runtime may depend on capability contracts, but not provider implementations.
- Capabilities may depend on provider interfaces.
- Providers must not depend on specific capabilities.
- Runtime must not contain provider-specific business logic.
- Providers must not contain planner logic.
- Capabilities must not depend on HTTP routes.

---

# Example

A LinkedIn profile request should conceptually flow as:

```text
HTTP Request
     ↓
API Layer
     ↓
Execution Runtime
     ↓
Capability Registry
     ↓
linkedin.profile.self
     ↓
Browser Provider
     ↓
Session Manager
     ↓
Playwright
     ↓
LinkedIn
```

Each layer has one responsibility.

---

# Why `core/` Is Being Removed

The term `core` becomes ambiguous as projects grow.

Files placed in `core/` often accumulate unrelated responsibilities because they are all considered "important."

Operator Runtime will instead use explicit runtime concepts.

For example:

```text
core/registry.ts
```

becomes:

```text
runtime/registry/
```

and:

```text
core/permissions.ts
```

becomes:

```text
runtime/permissions/
```

The folder name should communicate why the code exists.

---

# Why `skills/` Becomes `capabilities/`

The runtime already uses the word `Capability` as its execution abstraction.

Using both `skills` and `capabilities` for the same concept creates unnecessary terminology.

The project will therefore standardise on:

> **Capability**

A capability represents an operation available to the runtime.

Examples:

```text
web.page.read
linkedin.profile.self
database.query.read
git.repository.status
```

---

# Migration Strategy

The structural change should be incremental and behaviour-preserving.

The migration will occur in small commits.

Suggested order:

1. Create the new layer directories.
2. Move capability files from `skills/` to `capabilities/`.
3. Move registry, permissions, and audit into `runtime/`.
4. Move HTTP routes into `api/routes/`.
5. Move server bootstrap into `api/server/`.
6. Move browser-specific session logic under `providers/browser/`.
7. Update imports.
8. Run type checking after each migration step.
9. Run existing capability tests after the refactor.
10. Remove obsolete directories only when empty.

No functional changes should be introduced during the structural migration.

---

# Consequences

## Positive

The structure becomes easier to understand.

Future contributors can determine where code belongs based on responsibility.

Provider-specific logic remains isolated.

The runtime can evolve independently from integrations.

Job and Planner features gain a natural home.

The project becomes easier to package as a reusable runtime.

---

## Negative

The project gains more directories.

Some files may initially appear to require deeper import paths.

The initial refactor will require changing imports across the codebase.

These costs are accepted in exchange for clearer long-term boundaries.

---

# Alternatives Considered

## Keep the existing structure

Rejected because the existing structure was designed for the initial prototype and does not clearly express the emerging runtime architecture.

---

## Organize exclusively by feature

For example:

```text
linkedin/
web/
jobs/
browser/
```

Rejected because infrastructure, runtime concerns, and domain capabilities would become mixed together.

---

## Build a highly granular package architecture immediately

For example, separate npm packages for runtime, providers, SDK, and capabilities.

Rejected for now because the project is still small.

The layered source structure provides the required boundaries without introducing premature package-management complexity.

A multi-package architecture may be reconsidered later.

---

# Guiding Rule

When deciding where code belongs, ask:

> **Is this runtime behaviour, provider infrastructure, an executable capability, or an external interface?**

The answer determines the layer.

If the answer is unclear, the design should be reconsidered before adding the code.