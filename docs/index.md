---
layout: default
title: Veil — Governed Execution for AI
description: Veil provides the execution layer between intent and action.
---

# Veil

## Governed execution for AI and software systems.

AI is becoming remarkably good at deciding **what should happen**.

Actually doing it safely and reliably is a different problem.

Reading files. Calling APIs. Using browsers. Running commands. Accessing infrastructure. Applying permissions. Recording what happened. Tracking failures.

Every system that moves from reasoning to action eventually has to solve these problems.

**Veil solves the execution problem once.**

Veil provides the **execution layer between intent and action** — turning structured plans into governed operations through reusable capabilities.

```text
Reasoning / Intent
        │
        │  What should happen?
        ▼
   ExecutionPlan
        │
══════════════════════════════
             VEIL
    validate · govern · execute
══════════════════════════════
        │
        ▼
   Capabilities
        │
        ├── Files
        ├── APIs
        ├── Browsers
        ├── Databases
        ├── Commands
        ├── Infrastructure
        └── Your own capabilities
```

The system requesting the work decides **what it wants to happen**.

Veil determines how that plan can be executed using the capabilities and rules you have configured, performs the work through those capabilities, and records what happened.

**The reasoning system can change.**

**The infrastructure can change.**

**The capabilities can grow.**

**The execution model stays the same.**

> **Veil treats reasoning as a planning problem and execution as an engineering problem.**

---

# What Does Veil Actually Do?

Veil gives AI, applications, automations and humans a common execution layer for interacting with real software systems.

Depending on the capabilities you register, a system using Veil could:

- read, create or modify files
- call internal or external APIs
- query or update databases
- navigate and interact with websites
- run approved commands
- inspect repositories
- interact with development tools
- trigger business workflows
- work with infrastructure
- connect to internal systems
- perform any other operation you expose as a capability

These operations are exposed to Veil as **capabilities**.

A capability is an operation that has explicitly been made available for execution.

```text
                    VEIL
                      │
              What can I use?
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
      Files          APIs        Browser
        │             │             │
        ▼             ▼             ▼
     Storage       Services      Websites

                      +

              Your Capabilities
```

You decide which capabilities exist and how they may be used.

Veil provides the common execution machinery around them: validation, policy enforcement, lifecycle management, execution, events, logging, history and observability.

---

# Why Does That Make Things Easier?

Without a shared execution layer, every new AI application, agent or automation tends to rebuild the same plumbing.

Imagine building an AI assistant that needs to investigate a problem in a software project.

You may need to connect it to:

```text
Repository files
       ↓
External APIs
       ↓
Application services
       ↓
Database
       ↓
Approved commands
       ↓
Execution history
```

The application now needs more than intelligence.

It needs integrations.

It needs permissions.

It needs validation.

It needs execution lifecycle management.

It needs logging.

It needs a way to know what operations exist and how to invoke them.

And when you build the next application, much of that work appears again.

Veil moves that machinery into a reusable execution layer.

```text
                         VEIL
                           │
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
           Files          APIs        Database
             │             │             │
             └─────────────┼─────────────┘
                           │
                      reusable by
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
     AI Assistant      Automation      Application
```

The assistant doesn't need its own filesystem execution layer.

An automation doesn't need another implementation of the same API capability.

Changing the model doesn't require rebuilding the execution machinery.

**Expose the capability once. Reuse the execution layer.**

---

# The Core Idea

Veil is not tied to AI.

It is **execution infrastructure that AI can use**.

Work can originate from different places:

```text
                 WHO WANTS WORK DONE?

        AI          Human        Application
         \            |              /
          \           |             /
           \      Automation       /
            \         |           /
             \        |          /
                  Intent
                    │
                    ▼
              ExecutionPlan
                    │
         ═════════════════════
                   VEIL
         validate · govern · execute
         ═════════════════════
                    │
                    ▼
                Capabilities
                    │
       ┌────────────┼────────────┐
       ▼            ▼            ▼
     Files         APIs       Browser
       │            │            │
       ├────────────┼────────────┤
       ▼            ▼            ▼
   Databases     Commands   Infrastructure
                    │
                    ▼
               Your Systems
```

An AI planner can produce an `ExecutionPlan`.

An application can construct one directly.

A deterministic automation can produce one.

A human-controlled interface can submit one.

Veil's execution model does not need to change depending on who requested the work.

---

# A Practical Example

Imagine you expose capabilities that allow Veil to inspect application logs, check service health, read configuration and query a database.

Now imagine an AI system is asked:

> Why is this application failing?

The reasoning system might produce a plan:

```text
1. Read the application logs
2. Check the service health endpoint
3. Inspect the relevant configuration
4. Query the database
5. Perform an approved recovery action if permitted
6. Verify the result
```

Veil does not need to be the intelligence that came up with that plan.

Its responsibility begins when the plan needs to become real operations.

```text
AI / Human / Application
          │
          │ proposes
          ▼
    ExecutionPlan
          │
          ▼
        VEIL
          │
          ├── validate the request
          ├── apply configured rules
          ├── resolve capabilities
          ├── execute operations
          ├── track outcomes and failures
          └── record what happened
          │
          ▼
   Real-world systems
```

The reasoning system can focus on **what should happen**.

Veil provides the engineering machinery for turning that plan into controlled, observable execution.

---

# Build Once. Reuse Everywhere.

This separation becomes more useful as systems grow.

Today you might have:

```text
Local Model
     │
     ▼
    Veil
     │
     ▼
Filesystem
```

Tomorrow:

```text
Hosted Model
     │
     ▼
    Veil
     │
     ▼
Filesystem
```

Later:

```text
Application ──┐
AI Agent ─────┤
Automation ───┤
Human ────────┼──→ Veil ──→ Native Capabilities
Local Model ──┤          ├──→ MCP Ecosystem
Hosted AI ────┘          └──→ Your Systems
```

The systems proposing work can change.

The systems performing work can change.

The execution boundary does not have to be rebuilt every time.

Veil does not require every integration to be Veil-native.

Where an existing interoperability layer already provides access to a system, Veil can use that ecosystem while preserving the same execution model.

Where tighter domain semantics or control are required, native Veil capabilities can be used instead.

Both meet at the same governed execution boundary.

**Veil is not trying to own every model, agent framework, integration or protocol. It provides the execution boundary between them.**

---

# Works With Existing Ecosystems

Veil is designed to complement existing interoperability standards rather than replace them.

Native capabilities can provide deep, controlled access to your own systems, while external tool ecosystems can extend Veil's reach.

Veil currently supports **Model Context Protocol (MCP)** interoperability in both directions:

- MCP clients can discover and invoke Veil capabilities
- Veil can execute tools exposed by external MCP servers

Both paths still use Veil's existing execution model.

```text
MCP Client
    │
    ▼
   Veil
    │
    ▼
Native Capability
```

And in the other direction:

```text
ExecutionPlan
    │
    ▼
   Veil
    │
    ▼
MCP-backed Capability
    │
    ▼
External MCP Server
```

MCP does not introduce a second execution path inside Veil.

It is an interoperability boundary around the existing runtime.

> **MCP connects tools. Veil governs execution across them.**

The current MCP implementation is deliberately narrow and validates local stdio-based interoperability. More advanced gateway, authentication, multi-server and enterprise capabilities are future work.

---

# How Veil Works

At its simplest, Veil follows one execution path:

```text
Intent
  │
  ▼
Planning
  │
  ▼
ExecutionPlan
  │
  ▼
VEIL
  │
  ▼
Capability
  │
  ▼
External System
```

## Intent

Something wants work done.

That could be an AI model, application, automation, human-controlled interface or another system.

## Planning

A planner can translate a goal into an `ExecutionPlan`.

Planning is deliberately separate from execution.

## ExecutionPlan

The plan describes the work to be performed.

It forms the boundary between reasoning and execution.

## Veil

`OperatorRuntime` governs execution of the plan through the runtime.

## Capabilities

Capabilities define the operations available for execution.

Examples already represented in Veil include operations for:

```text
filesystem.file.read
http.request
shell execution
browser operations
```

Additional capabilities can be introduced without changing Veil Core.

Capabilities may execute against native integrations or delegate to interoperability layers such as MCP.

---

# Bring Your Own Everything

Veil is deliberately designed not to own the entire stack.

```text
Bring your own models.
Bring your own infrastructure.
Build your own capabilities.
Use existing tool ecosystems.
Choose your own planning strategies.
```

Models are participants in the architecture, not the architecture itself.

A local model can produce a plan.

A hosted model can produce a plan.

Multiple models can participate in planning.

An application can construct a plan directly.

A deterministic process can operate without AI at all.

They ultimately meet at the same boundary:

```text
Whatever produced the intent
            │
            ▼
      ExecutionPlan
            │
            ▼
           VEIL
            │
            ▼
   Governed Execution
```

---

# What Can You Build With Veil?

Veil is infrastructure rather than a single-purpose AI application.

That means the same execution model can support very different systems.

## AI Assistants

Give assistants controlled access to files, APIs, applications and other systems without embedding all execution logic directly into the reasoning layer.

## Developer Tools

Build systems that can inspect repositories, read files, call development services and perform registered development operations.

## Automation

Allow applications, humans or AI to propose work while Veil provides a consistent execution environment underneath.

## Operational Intelligence

Build systems that investigate conditions, construct plans and perform controlled operational actions through known capabilities.

## Enterprise Integrations

Expose internal systems through explicit capabilities while keeping execution concerns separate from whichever AI system or application consumes them.

Existing MCP servers can also be brought behind the same execution boundary instead of requiring every integration to be rebuilt specifically for Veil.

## Agentic Systems

Change models, planners and orchestration strategies while keeping execution behind the same governed boundary.

Veil can complement existing agent frameworks rather than requiring them to be replaced.

## Your Own Systems

Capabilities are extensible.

Veil does not need native knowledge of every application or infrastructure platform you use.

If an operation can be represented through a capability, it can participate in the same execution model.

---

# Built Around Extensions

Veil's core vocabulary is intentionally small.

```text
Planner
   │
   └── reasons

Strategy
   │
   └── orchestrates

ExecutionPlan
   │
   └── describes work

OperatorRuntime
   │
   └── governs execution

Capability
   │
   └── defines an operation

Integration
   │
   └── connects external systems and protocols
```

The goal is not to continually make Veil Core larger.

New functionality should normally arrive through extensions.

MCP is one example of this principle.

It was added as an interoperability layer around the existing execution model rather than introducing a separate MCP-specific runtime.

> **Architecture evolves only when existing contracts can no longer express a real-world use case. Otherwise, Veil grows through extensions rather than changes to its core.**

---

# What Exists Today?

Veil has moved beyond its initial proof of concept.

The current foundation includes:

### Runtime

- generic execution engine
- `OperatorRuntime` façade
- capability registry
- execution context
- event bus and runtime events
- structured execution logging
- job lifecycle management
- persistent SQLite job store
- human-reviewed outcomes

### Reasoning

- `PlannerRouter`
- planner router registry
- planner registry
- strategy registry
- planner strategies
- deterministic planning
- OpenAI-compatible planner support
- local and distributed planner configurations
- planner health monitoring
- planner runtime state
- planner eligibility
- historical context retrieval
- `ExecutionPlan` v1

### Capabilities and SDK

- capability SDK
- declarative capability authoring
- capability modules
- middleware pipeline
- lifecycle and timeout middleware
- runtime execution options
- filesystem capability
- HTTP capability
- shell capability
- browser-based capabilities
- MCP interoperability

### Interoperability

- expose Veil capabilities to MCP clients
- execute external MCP tools as Veil capabilities
- inbound and outbound MCP stdio support
- MCP execution through the existing Veil runtime and job lifecycle

### Runtime Memory

- persistent job history
- planner context retrieval
- historical capability recall
- outcome recording
- human review workflow

---

# Where Veil Is Going

Veil is currently completing its **Architecture Lock** phase.

A major external-standard test has now been completed:

**MCP interoperability was implemented in both directions without requiring an alternative execution path or MCP-specific changes to Veil's core execution contracts.**

That is important because MCP is not only a new integration.

It is evidence that Veil's existing boundaries can absorb an external interoperability standard without redefining the runtime around it.

The remaining Architecture Lock work is focused on removing historical duplication and tightening the public execution contracts.

```text
MCP Architecture Validation
              │
              ▼
Architecture Cleanup
              │
              ▼
Architecture Lock
              │
              ▼
SDK Ergonomics
              │
              ▼
Documentation + Examples
              │
              ▼
Clean-machine Verification
              │
              ▼
v0.1.0
              │
              ▼
Real-world Usage
              │
              ▼
Ecosystem
```

The immediate goal is not to make Veil capable of everything.

It is to make its existing contracts usable by somebody other than its creator.

The release criterion is deliberately simple:

> **Veil reaches `v0.1.0` when somebody else can confidently extend it without understanding Veil Core.**

After that, real usage should determine how the ecosystem evolves.

Potential directions include:

- reusable capability packages
- richer integration tooling
- module discovery
- additional planner strategies
- cancellation and retry semantics
- stronger audit services
- secrets management
- dependency-aware execution
- parallel execution
- runtime analytics
- richer MCP integration
- community extensions

These are directions rather than promises.

---

# Open Source

Veil is being prepared for its first usable public release.

The goal is to provide an open foundation for building systems that can reason and act without coupling intelligence directly to execution infrastructure.

Veil is not intended to replace models, agent frameworks, MCP, workflow systems or the infrastructure you already use.

It provides a common execution boundary between them.

The architecture is currently being locked, the extension contracts are being hardened, and the developer experience is being prepared for `v0.1.0`.

---

# The Idea in One Line

## Build the execution layer once. Use it from AI, applications, humans and automation.

> **Planners reason. Strategies orchestrate. OperatorRuntime governs execution. Veil owns the contract between them.**
