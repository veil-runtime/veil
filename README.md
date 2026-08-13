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

The result is a reusable execution platform capable of powering automation, operational intelligence, developer tooling and enterprise integrations without coupling execution to any specific language model or AI provider.

---

# Architectural Principles

Operator owns **the contract between reasoning and execution**.

It does not prescribe how reasoning is performed or how capabilities are implemented.

Instead, it defines stable interfaces that allow both sides to evolve independently.

```text
Reasoning
    │
Planner Providers
Planner Strategies
Planner Routing
    │
ExecutionPlan
══════════════════════
Operator Runtime
══════════════════════
Capability Registry
Capability Modules
Providers
    │
Execution
```

This separation allows new planners, routing strategies, capability modules and providers to be introduced without changing Operator Core.

---

# Architecture

```text
                          Goal
                           │
                           ▼
                    Planner Router
                           │
                           ▼
                   Planner Strategy
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
 Planner Registry    Runtime State      Eligibility
        │
        ▼
   Planner Providers
        │
        ▼
    ExecutionPlan
══════════════════════════════════════════════
                 OPERATOR CORE
══════════════════════════════════════════════
        │
        ▼
    Operator Runtime
        │
 ┌──────┼───────────────┬──────────────┐
 ▼      ▼               ▼              ▼
Policy Job Manager   Event Bus   Execution Engine
        │               │
        ▼               ▼
     Execution Context
        │
 ┌──────┼──────────┬────────────┐
 ▼      ▼          ▼            ▼
Memory Logging Runtime Services SDK
        │
        ▼
 Capability Registry
        │
        ▼
 Capability Modules
        │
        ▼
 Providers
        │
 ┌──────┼──────────┬──────────┬──────────┐
 ▼      ▼          ▼          ▼
Browser Filesystem Shell      HTTP
```

---

# Current Features

## Runtime

- Generic execution engine
- Operator runtime façade
- Capability registry
- Planner registry
- Strategy registry
- ExecutionPlan contract
- Execution context
- Event bus
- Runtime events
- Structured execution logging
- Job lifecycle management
- Persistent SQLite job store
- Human-reviewed outcomes

---

## Planning

- Planner registry
- Planner strategies
- Deterministic planner
- OpenAI-compatible planners
- Local Qwen planner
- Distributed Llama planner
- Planner health monitoring
- Planner eligibility
- Historical context retrieval
- ExecutionPlan v1

---

## SDK

- Capability SDK
- Declarative capability authoring
- Middleware pipeline
- Lifecycle middleware
- Timeout middleware
- Runtime execution options
- Capability module support

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
- Strategy agnostic
- Provider agnostic
- Capability driven
- Runtime governed
- Deterministic execution
- Explicit permissions
- Structured observability
- Human review before learning
- Small composable services
- Extension by composition
- Reusable by design

---

# What Makes Operator Different

Operator does not attempt to replace language models.

Instead, it provides the governed execution environment around them.

Reasoning remains completely replaceable.

Execution remains completely governed.

Applications embed Operator without needing to understand planning, execution or infrastructure concerns.

Because these responsibilities remain independent:

- Routers choose strategies.
- Strategies orchestrate planners.
- Planners produce execution plans.
- Operator governs execution.
- Capabilities perform the work.
- Providers interact with external systems.
- Runtime services remain independent of planners and capabilities.

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

- Planner routing policies
- Planner evaluation
- Cost-aware routing
- Latency-aware routing
- Capability recommendations
- Historical plan optimisation
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

The runtime remains responsible for execution, governance and observability, while reasoning remains modular through planners, strategies and routing.

---

# Status

Operator has evolved beyond a proof of concept into a reusable execution platform.

The execution runtime, capability system, planner abstraction, planner strategies, routing foundation, provider model, event bus, persistent memory, module architecture and SDK foundation are now in place.

The current focus is strengthening the platform itself—its SDKs, runtime services, provider ecosystem, reasoning architecture and execution model—so that new planners, strategies, capabilities and integrations become progressively simpler to build while preserving deterministic, observable and governed execution.

Every architectural improvement compounds across the platform, allowing Operator to scale in capability without increasing complexity.

The guiding principle remains simple:

> **Operator owns the contract between reasoning and execution.**