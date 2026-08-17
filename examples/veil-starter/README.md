# Veil Starter — Lessons 01 and 02

## Hello Veil

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

# Lesson 02 — One Runtime, Different Capabilities

Lesson 01 proved that Veil could execute a real capability.

Lesson 02 proves something broader:

> **Changing what Veil can do does not require changing how Veil works.**

The same runtime now executes capabilities from two different application domains:

- **Personal** presents `notes.create` as **Save a Note**.
- **Developer** presents `service.health` as **Check Service**.

Both capabilities are registered with the same `OperatorRuntime` and executed through the same `ExecutionPlan` boundary.

```text
Personal                  Developer
notes.create              service.health
     \                       /
      \                     /
       ---- ExecutionPlan ---
                |
                v
         OperatorRuntime
                |
                v
        Job / Events / Result
```

Nothing about the fundamental Veil execution model changed.

Only the capabilities available to the application changed.

---

## Personal Scenario

Select:

**Personal**

The Starter presents:

```text
Save a Note
```

which maps to the Veil capability:

```text
notes.create
```

The capability accepts:

```json
{
  "title": "Meeting Notes",
  "content": "Follow up with the team."
}
```

and returns a deterministic simulated note.

Lesson 02 does not introduce persistence yet.

The purpose is to demonstrate that an application-defined capability can represent useful work while still executing through the same Veil runtime.

---

## Developer Scenario

Select:

**Developer**

The Starter presents:

```text
Check Service
```

which maps to:

```text
service.health
```

The capability accepts:

```json
{
  "serviceName": "payments-api"
}
```

and returns a deterministic simulated health result.

Lesson 02 deliberately does not perform a real network request.

Real external integrations belong to a later lesson.

The execution path remains:

```text
Scenario
    |
    v
ExecutionPlan
    |
    v
OperatorRuntime
    |
    v
service.health
    |
    v
Job / Events / Result
```

---

## Scenario Metadata Belongs to Starter

The **Personal** and **Developer** concepts exist only in the Starter application.

Scenario definitions live under:

```text
client/src/scenarios/
```

They contain presentation metadata that helps the UI describe the demonstrations.

They are **not**:

- Veil capability contracts
- capability registration metadata
- runtime authorization inputs
- governance rules
- part of `@veil-runtime/core`

Veil itself does not know what **Personal** or **Developer** means.

To Veil, these remain ordinary registered capabilities:

```text
demo.greet
notes.create
service.health
```

This separation is important.

The application is free to organize capabilities around its own users, domains, workflows, and experiences without requiring Veil Core to understand those concepts.

---

## Experience and Learn Modes

Lesson 02 introduces two ways of viewing the same execution:

```text
[ Experience ] [ Learn ]
```

The selected mode changes presentation only.

It does **not** change how Veil executes the request.

### Experience Mode

**Experience** mode presents the capability in application terms.

For example:

```text
Personal

Save a Note

Title: Meeting Notes
Content: Follow up with the team.

[ Run with Veil ]
```

or:

```text
Developer

Check Service

Service Name: payments-api

[ Run with Veil ]
```

The result is presented as a simple user-facing output.

The user does not need to understand `ExecutionPlan`, `OperatorRuntime`, or runtime events to use the application.

### Learn Mode

**Learn** mode reveals what happened underneath.

Where available, it shows the real:

- selected capability
- `ExecutionPlan`
- `Job`
- events
- execution result
- rejection details

The UI may format this information for readability, but it does not replace Veil's execution contracts with a separate telemetry model.

Both modes execute exactly the same request:

```text
Experience ─┐
            |
            +----> Same ExecutionPlan
            |             |
Learn ──────┘             v
                    OperatorRuntime
                           |
                           v
                     Capability
                           |
                           v
                 Job / Events / Result
```

Changing the mode changes **presentation only**.

It does not change:

- the server request
- the execution plan
- the selected capability
- runtime execution
- validation behaviour

---

## Try Breaking It

The new capabilities use Veil's real input validation path.

For:

```text
notes.create
```

an invalid required title is rejected.

For:

```text
service.health
```

an invalid required service name is rejected.

Select:

**Try invalid input**

to deliberately submit invalid data.

The failure is not simulated by React.

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
HTTP 422
```

As in Lesson 01, invalid plans are currently rejected before a `Job` exists.

The Starter exposes the real validation error through HTTP `422` rather than inventing a separate Veil failure contract.

---

## Capability Discovery

The Starter discovers registered capabilities through Veil's public runtime API.

The runtime now contains:

```text
demo.greet
notes.create
service.health
```

Capability discovery uses the public `runtime.listCapabilities()` API rather than reaching into Veil's internal capability registry.

This allows the application to inspect what Veil can execute without coupling itself to Veil's internal implementation.

---

## What Lesson 02 Proved

The application now contains capabilities representing very different kinds of work:

```text
Personal
   |
   └── notes.create

Developer
   |
   └── service.health
```

But underneath, nothing fundamental changed:

```text
Scenario
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
Job / Events / Result
```

That is the important lesson:

> **The application changed what Veil can do. Veil itself did not change.**

This is what allows Veil to remain reusable across different domains.

A future application could present capabilities for:

```text
Personal automation
Developer tooling
Customer support
Operations
Infrastructure
AI agents
MCP tools
Enterprise systems
```

without requiring each domain to introduce a new execution architecture.

---

## Explore Lesson 02

The scenario definitions are under:

```text
client/src/scenarios/
```

The application capabilities are defined under:

```text
server/veil/
```

Follow a scenario from the UI through:

```text
Scenario
    |
    v
server/index.ts
    |
    v
ExecutionPlan
    |
    v
server/veil/runtime.ts
    |
    v
OperatorRuntime
    |
    v
Capability
```

Compare the Personal and Developer scenarios.

Although the user experience changes, both ultimately travel through the same Veil execution path.

---

## Lesson 02 Complete

You have now:

- registered multiple capabilities with the same runtime
- used Veil across Personal and Developer scenarios
- kept domain metadata outside Veil Core
- executed both scenarios through real `ExecutionPlan` objects
- used public capability discovery
- viewed execution through Experience and Learn modes
- observed real validation failures
- seen that application presentation does not need to affect runtime architecture

The core model remains:

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
Capability
```

Only what Veil is capable of doing has expanded.

---

## Next — Lesson 03: Compose Capabilities

Lesson 03 moves from individual actions to multi-step execution.

Instead of executing one isolated capability, an `ExecutionPlan` will connect multiple capabilities and allow a later step to use the result of an earlier step.

Conceptually:

```text
Capability A
     |
     | result
     v
Capability B
```

while the overall execution remains:

```text
Intent
   |
   v
ExecutionPlan
   |
   v
OperatorRuntime
   |
   +----> Capability A
   |           |
   |           | result
   |           v
   +----> Capability B
   |
   v
Job / Events / Result
```

The runtime boundary remains the same.

Only the plan becomes more powerful.

---

# Lesson 03 — Compose Capabilities in One Plan

Lesson 01 executed one capability. Lesson 02 showed that different capabilities
can use the same runtime. Lesson 03 proves that one `ExecutionPlan` can contain
multiple capabilities, with a later step consuming an earlier step's result.

Select **Support** and run **Prepare Customer Response**:

```text
customer.lookup
      |
      | result
      v
email.draft
```

The Support scenario accepts a customer ID and an issue. Its single plan has two
ordered steps:

1. `customer.lookup` resolves `CUST-001` to the deterministic Amina customer fixture.
2. `email.draft` receives that result through the public Veil reference:
   `{ $ref: 'steps.customer.result' }`.

The Starter does not orchestrate two JavaScript calls or copy the customer into
the draft input. It creates one `ExecutionPlan` and calls
`OperatorRuntime.executePlan(plan)` once. Veil resolves the first step result
when executing the second step.

In **Experience** mode, the final deterministic draft is shown in application
terms. In **Learn** mode, the real plan exposes the unresolved reference, and
the real Job exposes each step result, events, and final result.

Select **Try invalid input** to send an empty customer ID. Veil rejects the
first step during plan validation before a Job is created, and the server
returns the existing HTTP `422` response.

Lesson 03 deliberately does not send email or add HTTP integrations, databases,
persistence, AI-generated text, policies, approvals, authentication, retries,
or new runtime abstractions.

---

# Lesson 04 — Integrate an External REST Service

Lesson 04 adds a real external integration while preserving the execution
boundary from the earlier lessons.

Select **Developer**, then choose either:

- **Check Service** for the existing deterministic `service.health` capability.
- **Fetch Repository** for the new `github.repo.get` capability.

`github.repo.get` accepts an `owner` and `repo`, builds a normal
`ExecutionPlan`, and Veil executes the capability through the same
`OperatorRuntime.executePlan(plan)` entry point:

```text
Browser
   |
   | POST /api/execute
   v
Starter server
   |
   | ExecutionPlan
   v
OperatorRuntime
   |
   v
github.repo.get
   |
   | GET https://api.github.com/repos/{owner}/{repo}
   v
GitHub REST API
```

The browser calls only the Starter server. The Starter server creates and
executes plans; it does not call GitHub itself. The capability owns the external
request, and its `execute` function is the only place this lesson performs the
GitHub network I/O.

For a successful GitHub response, the capability maps the public REST payload
to the application result:

```json
{
  "name": "veil",
  "fullName": "veil-runtime/veil",
  "description": "A governed execution runtime",
  "stars": 42,
  "openIssues": 3,
  "url": "https://github.com/veil-runtime/veil"
}
```

The values are live GitHub data, so the UI values will vary. A GitHub network
failure, a non-success HTTP response, or an invalid GitHub payload throws from
the capability. Veil records that as the normal failed step and failed Job;
the Starter returns its existing execution failure response.

Lesson 04 uses the platform `fetch` API from the Starter capability. It does
not use or expose a Core HTTP abstraction. Tests replace `fetch` with
deterministic mocks, so automated tests never contact GitHub.

The integration is read-only and unauthenticated for demonstration purposes.
Credential management, authorization, approval workflows, retries, and rate
limit handling remain application and future-runtime concerns rather than
changes to the locked Core contracts.

---

# Lesson 05 — Govern Execution

The lessons progress from execution to governance:

```text
01 Execute
02 Extend
03 Compose
04 Integrate
05 Govern
```

Lesson 05 adds the Operations scenario and its deterministic, simulated
`deploy.trigger` capability. It accepts a service and environment, but it
does not contact deployment infrastructure. The lesson concerns authorization,
not deployments.

`deploy.trigger` is structurally valid for both `staging` and `production`.
Validation answers, "Is this execution structurally valid?" Authorization
answers, "Is this valid execution allowed?" The Starter's
`ExecutionAuthorizer` permits staging and denies production before the
capability starts.

```text
Valid ExecutionPlan
        |
        v
ExecutionAuthorizer
     /       \
 allow       deny
   |          |
   v          X
Capability stopped
```

In Experience mode, trigger `payments-api` for `staging` to see the simulated
deployment result. Select `production` to see the real authorization denial.
In Learn mode, the real `ExecutionPlan`, Job, and events show validation,
authorization, and the `capability.denied` event. The denied Job has no
`capability.started` event for `deploy.trigger`.

---

# Lesson 06 — Add Intelligence

The lessons progress from execution to reasoning:

```text
01 Execute
02 Extend
03 Compose
04 Integrate
05 Govern
06 Reason
```

Lesson 06 proves exactly one idea:

> The planner decides what should happen. Veil still decides how that plan is executed through the runtime.

Select **Planner**, enter:

```text
Check the payments service
```

then select **Plan and Run**. The Starter server sends the goal to its
deterministic planner. The planner proposes a real `ExecutionPlan` for the
already-registered `service.health` capability:

```text
Goal
 |
 v
Planner
 |
 v
ExecutionPlan
 |
 v
Veil
 |
 v
Capability
```

The plan is then submitted unchanged to `OperatorRuntime.executePlan(plan)`.
The planner does not receive the runtime or a capability instance, so it
cannot execute `service.health` directly.

In **Experience** mode, the lesson shows only the goal, action, and the
`payments-api` health result. In **Learn** mode, it shows the original goal,
the deterministic planner label, the real `ExecutionPlan`, and the runtime's
Job, events, and final result:

```text
Goal
 |
 v
Planner
 |
 v
ExecutionPlan
 |
 v
OperatorRuntime
 |
 v
service.health
 |
 v
Result
```

The default planner is deliberately deterministic. It recognizes the
payments-service demonstration goal and proposes:

```json
{
  "version": "1.0",
  "goal": "Check the payments service",
  "steps": [
    {
      "id": "check-payments-service",
      "capability": "service.health",
      "capabilityVersion": "1.0.0",
      "input": {
        "serviceName": "payments-api"
      }
    }
  ]
}
```

This keeps the reasoning/execution boundary fully testable offline without
external model credentials. It is not a chatbot, does not call tools outside
Veil, and does not add model configuration, memory, or persistence.
