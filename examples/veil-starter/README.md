# Veil Starter — Lesson 01: Hello Veil

Welcome to the first hands-on Veil lesson.

In this lesson, you will run the smallest useful Veil application and follow an execution from the browser all the way through the Veil runtime.

By the end, you will have:

1. Started a real Veil runtime.
2. Registered a capability.
3. Created an `ExecutionPlan`.
4. Executed the plan.
5. Inspected the returned job, events, and result.
6. Seen how Veil rejects invalid execution.

---

## What You Are Building

Lesson 01 uses a single capability:

```text
demo.greet
```

It accepts a name and returns a greeting.

The application deliberately keeps the example small so you can see the complete Veil execution path without AI, MCP, databases, authentication, or other infrastructure getting in the way.

---

## Architecture

Veil does not run in the browser.

```text
Browser UI
    |
    v
Application Server
    |
    v
Veil OperatorRuntime
    |
    v
demo.greet
    |
    v
Execution Result
```

Veil runs on the trusted side of the application.

The browser is only the interface used to propose execution and inspect what happened.

This separation is intentional. Capabilities may eventually access APIs, files, databases, infrastructure, credentials, or other trusted resources that should not execute directly in an untrusted browser environment.

---

## Prerequisites

You need:

- Node.js
- npm
- a local clone of the Veil repository

This lesson runs directly from the Veil repository so the Starter can consume the current Veil package through its public package entrypoint.

---

## Install

From the **Veil repository root**, install the repository dependencies and build Veil:

```bash
npm install
npm run build
```

The Starter consumes Veil through the public:

```text
@veil-runtime/core
```

package entrypoint.

It does not import directly from Veil's `src/`, `dist/`, or other internal modules.

Next, install the Starter server dependencies:

```bash
cd examples/veil-starter
npm install
```

Then install the browser client dependencies:

```bash
cd client
npm install
```

---

## Run

The Starter has two parts:

```text
React / Vite UI
        |
        | HTTP
        v
Local Node Server
        |
        v
@veil-runtime/core
```

Both need to be running.

### 1. Start the Veil Application Server

From:

```text
examples/veil-starter
```

run:

```bash
npm run dev:server
```

This starts the trusted-side application server that hosts the Veil runtime.

### 2. Start the Browser UI

Open another terminal and run:

```bash
cd examples/veil-starter/client
npm run dev
```

Vite will print the local development URL.

Normally:

```text
http://127.0.0.1:5173
```

Open that URL in your browser.

---

## Try Your First Execution

Enter a name and select:

**Run with Veil**

Follow the three panels from left to right.

### Capabilities

The **Capabilities** panel shows:

```text
demo.greet
```

A capability represents something that Veil is able to execute.

For Lesson 01, the runtime has only one application capability.

---

### Execution Plan

The **Execution Plan** panel shows the real deterministic `ExecutionPlan` used for the execution.

The plan describes what should happen.

Conceptually:

```text
User Input
    |
    v
ExecutionPlan
    |
    v
OperatorRuntime
```

The plan is the boundary between deciding what should happen and executing it.

---

### Execution

The **Execution** panel sends the request to the local application server.

The server executes the plan through Veil's `OperatorRuntime`.

The browser then displays the real execution response, including the resulting job, events, and result.

The complete Lesson 01 flow is:

```text
User Input
    |
    v
ExecutionPlan
    |
    v
OperatorRuntime
    |
    v
demo.greet
    |
    v
Job / Events / Result
```

If you enter:

```text
Mustapha
```

the capability should return a greeting similar to:

```text
Hello, Mustapha!
```

That result came from a real capability executed through Veil.

---

## Where Veil Is Integrated

The Veil-specific code is intentionally kept small so you can inspect the complete integration.

### `server/veil/capabilities.ts`

Defines the:

```text
demo.greet
```

capability.

This is the actual application behavior Veil is allowed to execute.

### `server/veil/runtime.ts`

Contains the Veil runtime integration, including the registration and execution logic used by Lesson 01.

It uses the public `@veil-runtime/core` package entrypoint.

### `server/index.ts`

Provides the small HTTP boundary used by the browser.

Lesson 01 exposes only what the demonstration needs.

The browser communicates with the application server through:

```text
GET /api/capabilities
POST /api/execute
```

The React client does **not** import `@veil-runtime/core`.

Veil and its Node runtime dependencies remain entirely on the trusted side of the application.

---

## Why Veil Runs on the Server

`OperatorRuntime` is currently a Node runtime.

More importantly, governed capabilities will often need access to things such as:

```text
APIs
files
databases
internal services
credentials
infrastructure
MCP servers
```

Those capabilities should normally execute within a trusted application environment rather than directly inside an untrusted browser.

The Starter therefore demonstrates the application boundary explicitly:

```text
Browser
   |
   | proposes execution
   v
Application Server
   |
   | submits ExecutionPlan
   v
Veil
   |
   | governs execution
   v
Capability
```

The UI proposes and observes.

Veil executes on the trusted side.

---

## Try Breaking It

Successful execution is only half of the lesson.

Select:

**Try invalid input**

The application attempts to execute a real plan containing an empty `name`.

Veil rejects the plan during validation and the browser displays the rejection.

The failure is **not simulated by the UI**.

It travels through the real application and Veil execution path.

Conceptually:

```text
Invalid Input
     |
     v
ExecutionPlan
     |
     v
Veil Validation
     |
     X
Rejected
```

### Current Validation Behaviour

At the moment, an invalid plan is rejected by `executePlan()` before a `Job` exists.

The Starter therefore returns the real error message to the browser as an HTTP `422` response.

It deliberately does not invent a new Veil result or validation contract just for the demonstration.

This behaviour may be revisited as Veil's public API evolves.

---

## Explore the Code

A useful way to understand Lesson 01 is to follow the execution yourself.

Start here:

```text
client/src/
```

Find where the browser sends the execution request.

Then follow it to:

```text
server/index.ts
```

From there, follow the Veil integration into:

```text
server/veil/
```

Look for:

```text
ExecutionPlan
OperatorRuntime
demo.greet
```

You should be able to trace the complete execution without needing to understand the rest of the Veil repository.

That is intentional.

---

## Verify the Example

The normal learning path only requires running the application.

If you are developing or contributing to Veil, you can also verify the Starter independently.

From:

```text
examples/veil-starter
```

run:

```bash
npm run check
```

This verifies the Starter server TypeScript.

Verify the browser production build:

```bash
cd client
npm run build
```

The client should type-check and produce a successful Vite production build.

You can also verify the complete Veil repository.

From the repository root:

```bash
npm run check
```

This runs Veil's configured type checks, tests, and package verification.

---

## What You Learned

You have now seen Veil's basic execution model working end to end.

```text
Something proposes what should happen
              |
              v
        ExecutionPlan
              |
              v
      OperatorRuntime
              |
              v
         Capability
              |
              v
     Observable Result
```

There are several important ideas hidden inside this small example.

### Capabilities define what can be done

Veil does not need to know every application or integration in advance.

Applications provide capabilities representing the actions available to the runtime.

### Plans describe what should happen

An `ExecutionPlan` describes the requested execution.

It separates the decision about what should happen from the mechanism that performs it.

### Veil executes the plan

`OperatorRuntime` receives the plan and executes it through the capabilities available to the runtime.

### Execution is observable

The caller receives the resulting execution state rather than treating the action as an invisible side effect.

### The UI is not Veil

The React application is only one possible interface.

The same execution boundary can eventually be used by:

```text
applications
APIs
automation
humans
AI planners
agents
MCP clients
other systems
```

They can propose what should happen.

Veil provides the governed execution layer between that intent and the underlying capability.

---

## Lesson 01 Complete

You have now:

- run Veil inside a real application
- registered a capability
- inspected an `ExecutionPlan`
- executed the plan
- inspected the resulting job and events
- observed a real validation rejection
- seen where Veil belongs in a client/server application

The application is deliberately small.

From here, we can start giving Veil more useful things to do.

---

## Next — Lesson 02: Build Your Own Capability

Lesson 02 moves beyond the capability provided by the Starter.

You will create another capability yourself, register it with Veil, and execute it through the same runtime and UI.

The architecture will stay the same:

```text
Intent
   |
   v
ExecutionPlan
   |
   v
Veil
   |
   v
Your Capability
```

Only what Veil is capable of doing will change.

