# ADR-0001: Runtime Philosophy

**Status:** Accepted

**Date:** 2026-08-08

---

# Context

Modern AI systems are increasingly capable of reasoning about goals.

They can determine what information is required, which actions should occur, and in what sequence.

However, allowing an AI model to directly interact with browsers, databases, operating systems, APIs, or infrastructure creates several challenges.

- execution becomes difficult to govern
- auditing becomes inconsistent
- provider logic becomes duplicated
- authentication becomes fragmented
- safety becomes dependent on prompt engineering
- changing providers requires rewriting reasoning logic

A different architectural model is required.

---

# Decision

Operator Runtime separates **reasoning** from **execution**.

Reasoning engines determine **what should happen**.

Operator Runtime determines **how those actions are executed**.

The runtime exposes reusable capabilities.

Capabilities use providers.

Providers interact with external systems.

The runtime governs every execution regardless of which planner initiated it.

---

# Execution Model

```text
Goal

↓

Planner

↓

Execution Plan

↓

Capability Registry

↓

Permission Engine

↓

Execution Runtime

↓

Providers

↓

External Systems
```

The planner never communicates directly with providers.

Providers never communicate directly with planners.

Operator Runtime remains the execution boundary between them.

---

# Consequences

This decision provides several benefits.

## Planner independence

The runtime is not coupled to a particular AI model.

Possible planners include:

- deterministic planners
- local language models
- cloud language models
- application planners
- human-generated plans

The execution model remains unchanged.

---

## Provider independence

Capabilities remain independent from infrastructure implementations.

Changing browser libraries, database clients, REST clients, or SSH implementations should not affect planners.

---

## Governance

Every execution passes through:

- permissions
- auditing
- session management
- execution lifecycle

This provides predictable operational behaviour.

---

## Reuse

Applications interact with Operator Runtime rather than individual providers.

The same runtime may be reused by:

- desktop software
- web applications
- AI assistants
- enterprise systems
- automation platforms

---

## Extensibility

Future providers may be added without changing the runtime philosophy.

Examples include:

- Browser
- REST
- Database
- Filesystem
- Docker
- SSH
- AI
- Queue
- Cloud

The runtime should remain stable while capabilities continue to expand.

---

# Alternatives Considered

## Direct AI execution

Allow the planner to directly execute browser or provider operations.

Rejected because:

- poor governance
- difficult auditing
- duplicated provider logic
- inconsistent authentication
- increased safety risk

---

## Application-specific integrations

Allow each application to build its own browser and provider integrations.

Rejected because:

- duplicated implementations
- inconsistent behaviour
- reduced reuse
- difficult maintenance

---

# Guiding Principle

> **AI may reason. Applications may request. Operator Runtime executes.**

Execution should remain governed, observable, reusable, and independent from whichever intelligence requested it.

---

# Future Considerations

Future architectural decisions should be evaluated against this principle.

If a proposal weakens the separation between reasoning and execution, it should be reconsidered before implementation.