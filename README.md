# Operator Platform

Operator is a capability-driven execution platform for AI and software systems.

It separates **reasoning** from **execution**, allowing planners, language models and applications to safely interact with external systems through reusable capabilities while keeping execution deterministic, observable, auditable and independent of any specific AI provider.

The goal is simple:

> **Allow any planner to decide _what_ should happen, while Operator reliably decides _how_ it happens.**

Or, more simply:

> **Operator treats AI as a planning problem and execution as an engineering problem.**

---

# Vision

Modern language models are exceptional at reasoning.

They should not be responsible for safely interacting with production systems.

Operator provides the execution layer between reasoning and the outside world.

Instead of allowing models to directly manipulate browsers, files, databases, infrastructure or external services, Operator executes structured plans through governed capabilities, applying validation, permissions, memory, logging and runtime services before any action is performed.

The result is a reusable execution platform capable of powering automation, operational intelligence, developer tooling and enterprise integrations without coupling execution to a specific language model or AI provider.

---

# Architecture

```
                         Goal
                          │
                          ▼
                   Planner Layer
                          │
          ┌───────────────┴────────────────┐
          │                                │
     Deterministic                   AI Planners
          │                                │
     Qwen Local                     Llama (Mac)
          │                                │
          └────────── Team Planner ────────┘
                          │
                          ▼
                   Execution Plan
                          │
                          ▼
                  Operator Runtime
                          │
     ┌────────────────────┼─────────────────────┐
     │                    │                     │
     ▼                    ▼                     ▼
  Policy            Job Manager            Event Bus
     │                    │                     │
     │                    ▼                     ▼
     │             Execution Engine      Subscribers
     │                    │                     │
     └────────────────────┼─────────────────────┘
                          ▼
                  Execution Context
                          │
     ┌──────────────┬──────────────┬──────────────┐
     ▼              ▼              ▼              ▼
  Memory         Logging      Runtime        Services
                               Services
                          │
                          ▼
                     Capabilities
                          │
                          ▼
                       Providers
                          │
     ┌──────────────┬──────────────┬──────────────┬──────────────┐
     ▼              ▼              ▼              ▼
  Browser      Filesystem       Shell          HTTP
```

---

# Current Features

## Runtime

- Generic execution engine
- Operator runtime façade
- Capability registry
- Planner registry
- Execution context
- Event bus
- Runtime events
- Structured execution logging
- Job lifecycle management
- Persistent SQLite job store
- Human-reviewed outcomes

---

## Planning

- Deterministic planner
- OpenAI-compatible planners
- Local Qwen planner
- Distributed Llama planner
- Team planner (multi-model planning)
- Planner validation
- Planner memory
- Historical context retrieval

---

## SDK

- Capability SDK
- Declarative capability authoring
- Middleware pipeline
- Lifecycle logging middleware
- Timeout middleware
- Runtime execution options

---

## Memory

- Persistent job history
- Planner context retrieval
- Historical capability recall
- Outcome recording
- Human review workflow

---

## Capabilities

- LinkedIn authentication
- LinkedIn profile reader
- Generic web page reader
- HTTP request execution
- Filesystem reader
- Shell command execution

---

## Providers

- Browser provider
- Browser session manager
- HTTP provider
- Filesystem provider
- Shell provider
- SQLite provider
- OpenAI-compatible AI providers

---

# Design Principles

- Planner agnostic
- Provider agnostic
- Capability driven
- Runtime governed
- Deterministic execution
- Explicit permissions
- Structured observability
- Human review before learning
- Small composable services
- Reusable by design

---

# What Makes Operator Different

Operator does not attempt to replace language models.

Instead, it provides the execution environment around them.

Planners determine **what** should happen.

Operator determines **how** it happens.

Capabilities perform the work.

Providers interact with external systems.

Applications embed Operator without needing to understand planning, execution or infrastructure concerns.

Because these responsibilities remain independent:

- Planners can be replaced without changing capabilities.
- Capabilities can evolve without changing the runtime.
- Providers can change without affecting planners.
- Runtime services can evolve without modifying capabilities.
- Applications remain insulated from implementation details.

This separation allows Operator to remain reusable across domains while ensuring execution stays deterministic, observable and governed.

---

# Roadmap

## Runtime

- Dependency graph execution
- Parallel capability execution
- Live progress reporting
- Cancellation
- Retry policies
- Secrets service
- Metrics
- Audit services
- Resource management

---

## SDK

- Provider SDK
- Capability testing framework
- Middleware library
- Validation helpers
- Retry middleware
- Metrics middleware
- Audit middleware
- Execution decorators

---

## Intelligence

- Capability recommendations
- Historical plan optimisation
- Planner evaluation
- Outcome-aware learning
- Runtime analytics
- Multi-agent planning pipelines

---

## Capabilities

- LinkedIn posting
- GitHub
- Docker
- SSH
- SQL
- Jira
- Confluence
- Kubernetes
- Cloud providers
- Generic REST integrations

---

# Long-Term Direction

Operator is evolving into a reusable execution platform capable of powering:

- AI assistants
- Operational intelligence platforms
- Enterprise automation
- Developer tooling
- Agentic systems
- Workflow orchestration
- Multi-agent collaboration

The runtime remains responsible for execution, governance and observability, while planners remain responsible for reasoning.

---

# Status

Operator has evolved beyond a proof of concept into a reusable execution platform.

The core runtime, planner abstraction, capability system, provider model, event bus, persistent memory, distributed planning and SDK foundation are now in place.

The current focus is strengthening the platform itself—its SDKs, runtime services, provider ecosystem and execution model—so that new capabilities and integrations become progressively simpler to build while preserving deterministic, observable and governed execution.

Every architectural improvement compounds across the platform, allowing Operator to scale in capability without increasing complexity.