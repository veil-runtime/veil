---
title: Runtime events
---
# Runtime events

RuntimeEvent is a root-exported type. Event-bus subscription is internal in v0.1.3; jobs retain event history.

Subscriber delivery is best-effort observation, independent of governed execution
correctness. Each subscriber receives a delivery attempt even if another throws
synchronously or returns a rejected promise. These failures are contained at the
in-memory event-bus delivery boundary and do not reject publication or change job
results, status, or retained lifecycle event history.

Specific subscribers are invoked before wildcard subscribers. Publication awaits
all delivery attempts, which may complete in any order. V1 provides no retries,
timeouts, durable delivery, or subscriber failure reporting.
