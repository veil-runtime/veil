---
title: Unreleased reasoning-boundary changes
---
# Unreleased reasoning-boundary changes

This document records observable changes on `research/reasoning-boundary` for a
future release decision. It does not select a release number, announce
publication, change package metadata, or imply that the branch has been merged.

## ExecutionPlan and admission

- ExecutionPlan `2.0` adds the optional ADR-0011 governed receiving-value
  semantics. It is available only when a trusted host includes `2.0` in
  `OperatorRuntimeOptions.planVersions`; omission remains V1-only.
- V2 captures the resolved receiving value, validates the capture, presents a
  detached recursively frozen authorization copy, requires explicit allow,
  constructs a detached mutable capability copy, and only then transitions the
  step to running/`capability.started` and enters the capability.
- V1 and V2 can coexist when explicitly enabled. There is no automatic upgrade,
  downgrade, negotiation or stored-Job migration.
- Plan versions are admitted before Job creation. Structured admission diagnostics
  expose fixed issue codes through the root-exported `isPlanAdmissionError`
  predicate while preserving legacy Error messages.

## Compatibility notes

- ADR-0013 tightens result-reference classification for both V1 and V2. A wrapper
  must contain exactly one own key, `$ref`, as an enumerable data property holding
  a primitive string. Previously over-recognized inherited/accessor `$ref` shapes
  and wrappers with hidden/symbol extras now remain ordinary input. Supported
  ordinary one-field wrappers are unchanged.
- V2 rejects resolved representations outside its governed domain instead of
  invoking authorization or falling back to V1. It also removes shared object
  identity between supported producer/source values, authorization and outer
  capability entry.
- Stored-job execution through `POST /api/jobs/:id/execute` is retired with `410`.
  The LinkedIn status route and generic capability endpoint now enter through
  `OperatorRuntime`, with caller identity and authorization supplied by trusted
  host configuration rather than request fields.
- `http.request` uses conservative destructive risk for its combined method
  surface. Shell execution uses destructive risk and exact reviewed command/argv
  tuples; prefix-like or ambiguous encodings are rejected.

## Trust-boundary clarification

Installed capabilities, middleware and providers are executable in-process host
code, not hostile-plugin isolation subjects. Their trusted placement does not make
them authorization authorities: the configured host authorizer still controls
each governed capability invocation. Live result getters and Proxy traps can run
during pre-capture result-path traversal. V2 governs the value returned by that
traversal, not the traversal behavior itself.

The changes do not establish passive/getter-safe/Proxy-safe traversal, committed
result immutability, persistence parity, provider-operation or external-effect
equivalence, rollback, retries, exactly-once execution, hostile-process isolation
or a security proof.

## Research evidence

Experiment I and the frozen 45-trial Experiment II record remain research
evidence. Offline regressions exercise their harnesses. No live provider/model
run is required for release verification, and the experiments do not establish
universal model reliability or ADR-0011 ownership guarantees.

## Package state

The branch adds no runtime dependency, package export path or package-version
change. The package root remains the only supported import path; governed-value
helpers, registries, stores, providers and validators remain internal.
