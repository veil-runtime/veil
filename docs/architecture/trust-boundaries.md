---
title: Trust boundaries
---
# Trust boundaries

## The boundary

Veil distinguishes intent from authority. Reasoning produces requested work. An ExecutionPlan represents structured requested work. OperatorRuntime decides whether registered capability work may start for each resolved step.

~~~text
planner/application intent
        -> requested plan
        -> plan validation
        -> resolved input
        -> authorization decision
        -> capability execution
        -> provider interaction
~~~

## What is not authority

Planner output is not permission: a planner returns a plan, and planning failure never gives it access to providers. Capability registration is not permission: registration only makes a capability resolvable in the process. The default authorizer still denies write and destructive risk.

## Two validation points

At plan admission, Veil validates known capability, requested version, declared field requirements/types, and reference ordering. A reference object is allowed at this point because its value is not available yet. Immediately before a step, Veil resolves references from completed earlier steps and validates the actual input again. This prevents a reference that resolves to a wrong type from reaching either authorization or the capability.

## Authorization sees the real request

ExecutionAuthorizer receives capability identity/risk, job ID, step ID, immutable caller, and fully resolved input. This lets a policy decide on properties such as target environment or generated identifier instead of trusting plan text. A denied action records capability.denied and never emits capability.started. Tests also show an authorizer exception fails the job before capability execution.

## Provider boundary

A provider is downstream code used by a capability to talk to a remote system. Veil's runtime governance occurs before the capability starts; it does not prove that provider credentials are correct, that an external API will honor a request, or that provider code is safe. Capability authors and applications remain responsible for provider-specific security and secrets.

## Limits

Caller freezing is shallow: caller, scopes, and metadata are frozen copies, but nested metadata values are not deep-frozen. The current input schema is a small field validator, not general JSON Schema. See [authorization](../concepts/authorization.html) and [result references](../concepts/result-references.html).
