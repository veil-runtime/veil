---
layout: default
title: Veil
---

# Veil

Veil is a capability-driven execution platform for AI and software systems.

It separates **reasoning** from **execution**, allowing planners, language models, agents, humans and applications to safely interact with external systems through reusable capabilities while keeping execution governed, observable, auditable and independent of any specific AI provider.

The goal is simple:

> **Allow any planner to decide _what_ should happen, while Veil reliably decides _how_ it happens.**

Or, more simply:

> **Veil treats AI as a planning problem and execution as an engineering problem.**

---

# Vision

Modern language models are exceptional at reasoning.

They should not be responsible for safely interacting with production systems.

Veil provides the governed execution layer between reasoning and the outside world.

Instead of allowing planners to directly manipulate browsers, files, databases, infrastructure or external services, Veil executes structured plans through governed capabilities, applying validation, permissions, policies, memory, logging and runtime services before any action is performed.

The result is a reusable execution platform capable of powering automation, operational intelligence, developer tooling and enterprise integrations without coupling execution to any specific reasoning system or AI provider.

---

# Architectural Principles

Veil owns **the contract between reasoning and execution**.

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
OperatorRuntime
══════════════════════
Capability Registry
Capability Modules
Providers
    │
Execution
```

This separation allows new planners, routing strategies, capability modules and providers to be introduced without changing Veil Core.

---

# Architecture

```text
                         Goal
                          │
                          ▼
                    Planner Router
                          │
                   selects strategy
                          │
                          ▼
                   Planner Strategy
                          │
             ┌────────────┼────────────┐
             │            │            │
             ▼            ▼            ▼
      Planner Registry Runtime State Eligibility
             │
             └────────────┬────────────┘
                          │
                          ▼
                  Planner Provider(s)
                          │
                          ▼
                    ExecutionPlan

══════════════════════════════════════════════
                     VEIL
══════════════════════════════════════════════

                          │
                          ▼
                  OperatorRuntime
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
       Policy        Job Manager      Event Bus
                                             │
                                             ▼
                                     Execution Engine
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
           ┌──────────────┬──────────────┬──────────────┬──────────────┐
           ▼              ▼              ▼              ▼
        Browser      Filesystem        Shell          HTTP
```

---

# Current Features

## Runtime

- Generic execution engine
- OperatorRuntime façade
- Planner router registry
- Planner registry
- Strategy registry
- Capability registry
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

- Planner router
- Planner registry
- Planner strategies
- Deterministic planner
- OpenAI-compatible planner support
- Example local and distributed planner configurations
- Planner health monitoring
- Planner runtime state
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
- Explicit permissions
- Structured observability
- Human review before learning
- Small composable services
- Extension through composition
- Reusable by design

---

# What Makes Veil Different

Veil does not attempt to replace language models.

Instead, it provides the governed execution environment around them.

Reasoning remains completely replaceable.

Execution remains governed and deterministic at the capability boundary.

Applications can embed Veil without coupling themselves to specific planners, capability implementations or infrastructure providers.

Because these responsibilities remain independent:

- Routers choose strategies.
- Strategies orchestrate planners.
- Planners produce execution plans.
- OperatorRuntime governs execution.
- Capabilities perform the work.
- Providers interact with external systems.
- Runtime services remain independent of planners and capabilities.

This separation allows Veil to remain reusable across domains while ensuring execution remains governed, observable and consistent.

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

Veil is evolving into a reusable execution platform capable of powering:

- AI assistants
- Operational intelligence platforms
- Enterprise automation
- Developer tooling
- Agentic systems
- Workflow orchestration
- Multi-agent collaboration

Reasoning remains modular through planners, strategies and routing.

Execution remains governed and deterministic at the capability boundary.

Veil defines the contract between them.

---

# Status

Veil has evolved beyond a proof of concept into a reusable execution platform.

The execution runtime, capability system, reasoning architecture, planner routing, planner strategies, provider model, event bus, persistent memory, module architecture and SDK foundation are now in place.

The current focus is strengthening the platform itself—its SDKs, runtime services, provider ecosystem, reasoning architecture and execution model—so that new planners, strategies, capabilities and integrations become progressively simpler to build while preserving governed, observable and reliable execution.

Every architectural improvement compounds across the platform, allowing Veil to grow in capability while keeping complexity contained behind stable contracts.

The guiding principles remain simple:

> **Veil owns the contract between reasoning and execution.**

> **Planners reason. Strategies orchestrate. OperatorRuntime governs execution. Veil owns the contract between them.**

> **Architecture evolves only when existing contracts can no longer express a real-world use case. Otherwise, Veil grows through extensions rather than changes to its core.**

---
---

# Getting Started

## Requirements

- Node.js 24+
- npm
- Git

Optional:

- Docker Model Runner or another OpenAI-compatible endpoint
- Playwright (for browser capabilities)

---

## Installation

Clone the repository:

```bash
git clone git@github.com:veil-runtime/veil.git
cd veil
```

Install dependencies:

```bash
npm install
```

---

## Running Veil

Start the runtime:

```bash
JOB_STORE=sqlite npm run dev
```

The runtime will start on:

```
http://127.0.0.1:3333
```

Verify it's running:

```bash
curl http://127.0.0.1:3333/health
```

Expected response:

```json
{
  "status": "ok",
  "service": "operator-runtime"
}
```

---

## Running Your First Job

Submit a goal:

```bash
curl -X POST http://127.0.0.1:3333/api/jobs/run \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Read README.md"
  }'
```

Veil will:

1. Route the request through a `PlannerRouter`.
2. Select a `PlannerStrategy`.
3. Generate an `ExecutionPlan`.
4. Execute the plan through `OperatorRuntime`.
5. Return the completed job.
