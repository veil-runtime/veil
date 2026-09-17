# ADR-0007: Plan-local Step Identity

**Status:** Accepted (explicit maintainer architecture decision)

**Date:** 2026-09-17

## Context

The architecture locked at `v0.1.0-arch-lock` makes `ExecutionPlan` the boundary
between reasoning and execution. Previously, a plan could reuse step IDs,
creating ambiguous identity across result references, events, authorization
context, and capability execution.

## Decision

Within a single `ExecutionPlan`, every step ID MUST be unique. A step ID is the
plan-local identity of exactly one execution step. IDs may be reused across
separate plans. Identity is exact-string equality, without trimming, case
folding, Unicode normalization, new grammar, or special-name restrictions.
Exact duplicates of empty, whitespace-only, Unicode, dotted, or unusual names
such as `__proto__` and `constructor` are also invalid.

Enforce this in the existing semantic `validatePlan` path, using its existing
`seenStepIds` set without changing reference-validation semantics or insertion
timing. Add one existing-structure validation error for each occurrence after
the first, with message `Duplicate step ID: <id>`. Preserve aggregated validation
errors, including unknown capabilities. Do not add a JobManager uniqueness guard.

Plan rejection precedes job creation, persistence, runtime lifecycle events,
authorization, and capability invocation.

## Consequences and compatibility

This is a public semantic hardening change that intentionally narrows previously
accepted inputs. Plans containing duplicate IDs must assign distinct IDs and
update any affected references before submission. This is not behaviorally
compatibility-neutral. Valid unique-ID plans retain their existing behavior.

This decision does not address historical persisted jobs, the legacy stored-job
execution route, replay/idempotency, empty-ID reference grammar, `.result`
delimiter ambiguity, result mutation/identity, dependency graphs, or normalization.
