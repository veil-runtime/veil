# Operator Platform

Operator is a capability-driven execution platform for AI and software systems.

It separates **reasoning** from **execution**, allowing planners, language models and applications to safely interact with external systems through reusable capabilities while keeping execution deterministic, observable, auditable and independent of any specific AI provider.

The goal is simple:

> Allow any planner to decide **what** should happen, while Operator reliably decides **how** it happens.

---

# Vision

Modern language models are exceptional at reasoning.

They should not be responsible for safely interacting with production systems.

Operator provides the execution layer between reasoning and the outside world.

Instead of allowing models to directly manipulate browsers, files, databases or infrastructure, Operator executes structured plans through governed capabilities, applying validation, permissions, logging, memory and runtime services before any action is performed.

The result is a reusable execution platform that can power automation, operational intelligence, developer tooling and enterprise integrations without coupling execution to a specific AI model.

---

# Architecture

```
                    Goal
                     │
                     ▼
               Planner Runtime
                     │
        ┌────────────┴────────────┐
        │                         │
   Qwen Local               Llama (Mac)
        │                         │
        └──────── Team Planner ───┘
                     │
                     ▼
              Execution Plan
                     │
                     ▼
            Operator Runtime
                     │
     ┌───────────────┼────────────────┐
     │               │                │
 Validation      Permissions      Memory
     │               │                │
     └───────────────┼────────────────┘
                     │
                     ▼
           Execution Context
                     │
     ┌───────────────┼────────────────┐
     │               │                │
 Logger        Job History      Runtime Services
                     │
                     ▼
              Capabilities
                     │
                     ▼
               Providers
                     │
     ┌───────────────┼────────────────┐
     │               │                │
 Browser      Filesystem        Shell
```

---

# Current Features

## Runtime

- Generic execution engine
- Capability registry
- Planner registry
- Execution context
- Structured execution logging
- Job lifecycle management
- Event timeline
- Human-reviewed outcomes
- SQLite-backed persistence
- Runtime façade (`OperatorRuntime`)

## Planning

- Deterministic planner
- OpenAI-compatible planners
- Local Qwen planner
- Distributed Llama planner
- Team planner (multi-model planning)
- Plan validation
- Planner memory

## Memory

- Persistent job history
- Planner context retrieval
- Historical capability recall
- Outcome recording
- Human review workflow

## Capabilities

- LinkedIn authentication
- LinkedIn profile reader
- Generic web page reader
- Filesystem reader
- Shell command execution

## Providers

- Browser provider
- Browser session manager
- Local AI providers
- SQLite storage

---

# Design Principles

- Planner agnostic
- Provider agnostic
- Capability driven
- Runtime governed
- Deterministic execution
- Human review before learning
- Small composable services
- Explicit permissions
- Structured observability
- Reusable by design

---

# What Makes Operator Different

Operator does not attempt to replace language models.

Instead, it provides the execution environment around them.

Planners can be swapped without changing capabilities.

Capabilities can be added without changing the runtime.

Providers can change without affecting planners.

Applications can embed Operator without knowing how planning or execution works internally.

This separation allows the platform to remain reusable across domains while keeping execution safe and observable.

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

## Intelligence

- Capability recommendations
- Historical plan optimisation
- Planner evaluation
- Outcome-aware learning
- Runtime analytics
- Multi-agent planning pipelines

## Capabilities

- LinkedIn posting
- GitHub
- Docker
- SSH
- SQL
- Jira
- Confluence
- REST APIs
- Kubernetes
- Cloud providers

---

# Status

Operator is under active development.

The execution runtime, capability system, planner abstraction, distributed planning, structured logging and persistent memory are now in place.

The current focus is evolving Operator from a capable execution runtime into a complete execution platform capable of powering a wide range of AI-assisted and traditional software systems.