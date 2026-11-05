---
title: Veil ecosystem and architecture
product: ecosystem
description: Independent Veil tools for governed execution and interface composition, with a clear distinction between released software and research.
---
# Veil ecosystem

Veil is a growing set of independent developer tools. **Core** governs execution of application-defined work. **UI** composes interfaces from bounded definitions and host-controlled actions. An application may use either package alone or connect them in its own integration.

| Component | Current status | Use it for |
| --- | --- | --- |
| [Veil Core](getting-started/overview.html) | 0.6.0 published on npm | Plans, capability execution, authorization, jobs and events |
| [Veil UI](ui.html) | 0.4.0 published on npm as a Developer Preview; GitHub marks it prerelease | Framework-neutral interface definitions and optional DOM rendering |
| Veil Emergence | Independent experimental research | Intelligence and coordination experiments |
| Veil Sandbox | Proposed | Potential execution isolation |
| [Veil Playground](playground/) | Static browser playground | Edit JSON definitions and try published UI 0.4.0 |

## Boundaries

~~~text
Developers / applications / AI agents
             |                  |
             |                  +--> Veil UI --> interface description / DOM adapter
             |                                --> host-owned events and actions
             +--> ExecutionPlan --> Veil Core --> authorized capabilities
                                                  --> application providers / systems

Optional application integration: a UI event can ask the host to submit a plan
to Core. Neither package requires the other for its independent features.
~~~

Core's `ExecutionPlan` is the boundary between reasoning and execution. `OperatorRuntime` validates, authorizes and executes registered capabilities, and returns jobs and events. A plan or UI button is a request, not authority. The host supplies trusted identity and policy. [Read the Core lifecycle](architecture/execution-lifecycle.html) and [authorization guide](concepts/authorization.html).

UI 0.4.0's optional Core peer range is `^0.4.0`. For a combined npm install, use Core 0.4.0 with UI 0.4.0. Compatibility of that UI release with Core 0.6.0 has not been qualified. Each package can be tried independently at its latest published version.

UI's interface definition is bounded data. Its controller validates definitions, preserves compatible local state across updates, and emits events to host code. The optional DOM adapter renders built-in components. The host owns authentication, allowed actions, trusted custom component code and any execution. [Read the UI guide](ui.html).

## Start independently

- **Core:** [install the published package](getting-started/installation.html) and [run a complete plan](getting-started/five-minutes.html).
- **UI:** [install the published Developer Preview and run an example](ui.html#install-and-run). The neutral interface engine and DOM adapter do not require Core.

Published Core 0.6.0 adds cooperative cancellation, optional deadlines and bounded admission and execution capacity. Cancellation does not guarantee that external work stops or rolls back. See the [Core release](https://github.com/veil-runtime/veil/releases/tag/v0.6.0). The separate local UI 0.4.0-rc.2 candidate predates published UI 0.4.0; use the published package for onboarding. Future components have no committed release dates or integration contract.
