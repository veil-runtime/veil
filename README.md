# Operator Runtime

Operator Runtime is a capability-driven execution runtime that separates planning from execution.

Its purpose is to provide a safe, observable and reusable way for language models and software systems to interact with external systems through capabilities, while keeping execution deterministic, auditable and independent of any specific AI provider.

## Vision

Separate reasoning from execution.

- Planners decide **what** should happen.
- The runtime decides **how** it happens.
- Capabilities perform the work.
- Providers integrate with external systems.

This allows different planners (local models, cloud models or deterministic planners) to drive the same execution engine without changing the capabilities themselves.

## Architecture

```
Goal
   │
   ▼
Planner
   │
   ▼
Execution Plan
   │
   ▼
Execution Runtime
   │
   ▼
Execution Context
   │
   ├── Logger
   ├── Memory
   ├── Job History
   └── Runtime Services
   │
   ▼
Capabilities
   │
   ▼
Providers
```

## Current Features

### Runtime

- Capability Registry
- Generic Execution Engine
- Execution Context
- Structured Execution Logging
- Job Lifecycle Management
- Event Timeline
- Human-reviewed Outcomes

### Planning

- Deterministic Planner
- OpenAI-compatible Planner
- Local Qwen Planner (Docker Model Runner)

### Memory

- Persistent Job Store (SQLite)
- Job History API
- Memory-assisted Planning
- Planner Context Retrieval

### Capabilities

- Generic Web Page Reader
- LinkedIn Authentication
- LinkedIn Profile Reader

### Providers

- Browser Provider
- Session Manager
- Local AI Provider
- SQLite Storage

## Principles

- Planner agnostic
- Provider agnostic
- Capability driven
- Human review before learning
- Structured observability
- Small composable services
- Deterministic execution

## Roadmap

### Runtime

- Execution Log Pipeline
- Progress Reporting
- Cancellation
- Secrets Service
- Metrics
- Audit Services

### Capabilities

- LinkedIn Posting
- GitHub
- Docker
- SSH
- SQL
- Jira
- Confluence
- REST APIs

### Intelligence

- Capability recommendations
- Historical plan optimisation
- Outcome-aware memory
- Planner evaluation
- Runtime analytics

## Status

Active development.

The runtime foundation is complete and the current focus is expanding runtime services and the capability ecosystem.