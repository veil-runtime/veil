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

## Governed HTTP capability execution

`POST /api/capabilities/:name/execute` accepts `{ "input": ... }`, constructs a
version-`1.0` single-step ExecutionPlan, and executes it through OperatorRuntime.
A successful response remains `{ capability, risk, result }`; an unknown
capability retains its `404` response. Invalid declared input returns `400`
before authorization or capability execution. The adapter recognizes the
runtime's existing plan-validation error prefix; no new error contract is added.

The legacy `approved` request field is ignored. In particular, `approved: true`
no longer permits write or destructive execution. Reads are permitted by the
default runtime authorizer; writes and destructive actions are denied. Hosts can
supply an OperatorRuntime with an ExecutionAuthorizer through the internal route
registration options (`app.register(executionRoutes, { prefix: '/api', runtime })`).
This is server configuration, not request-supplied policy or an approval workflow.

Admitted plans receive normal job, step and event recording, retrievable through
the runtime's existing job APIs. Authorization denial returns `403`; authorizer
exceptions and capability failures return `500`. These responses contain
`{ capability, risk, error }` from the failed job. A denial is identified by its
`capability.denied` event; it never starts the capability. Authorizer exceptions
also never start it, and follow the runtime's existing failure events. The old
route-specific audit calls are replaced by runtime job/event recording.

Clients relying on `requiresApproval`/`reason` in the old denial response must
migrate to the new error response and host-owned authorization. This migration
covers only the generic capability endpoint; the LinkedIn status and existing-job
execution routes remain tracked legacy bypasses. See the
[governance inventory](../contributing/quality-harness.html).
