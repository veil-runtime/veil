---
title: Events and observability
---
# Events and observability

Jobs retain events including `job.created`, `execution.started`, `capability.started`, `capability.completed`, `capability.failed`, `capability.denied`, `job.completed`, `job.failed`, and `job.reviewed` (for internal review flow).

The runtime also publishes corresponding runtime events through its internal event bus. Event-bus subscription and log sinks are not root public APIs in v0.1.3. Capabilities receive an execution logger; `createCapability` adds lifecycle logging by default and can apply a timeout middleware.
