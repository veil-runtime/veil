---
title: Events and observability
---
# Events and observability

Jobs retain events including `job.created`, `execution.started`, `capability.started`, `capability.completed`, `capability.failed`, `capability.denied`, `job.completed`, `job.failed`, and `job.reviewed` (for internal review flow).

The runtime also publishes corresponding runtime events through its internal event bus. Event-bus subscription and log sinks are not root public APIs in v0.1.3. Capabilities receive an execution logger; `createCapability` adds lifecycle logging by default and can apply a timeout middleware.

## Subscriber failures (unreleased v0.1.4)

The internal event bus contains synchronous subscriber throws and asynchronous
rejections, continues delivery to other subscribers, and preserves execution
outcomes. It still awaits subscribers: this does not add timeouts or isolate
mutations to shared values. Event-bus subscription remains internal.
