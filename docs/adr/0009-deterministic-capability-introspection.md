# ADR-0009: Deterministic Capability Introspection

**Status:** Accepted — explicit maintainer decision; included in v0.2.0

**Date:** 2026-09-17

## Context

The architecture locked at `v0.1.0-arch-lock` separates reasoning from governed
execution. The existing public `OperatorRuntime.listCapabilities()` exposes
registered metadata but aliases capability input schemas. Consumers need a
stable public projection and exact lookup without execution implementation access.

## Decision

Veil v0.2.0 formalizes deterministic capability introspection while preserving the separation between execution-surface description, external reasoning, and runtime authorization.

This is NOT semantic capability discovery.

The maintainer explicitly authorizes this incremental extension of the locked
`OperatorRuntime` public contract: export `CapabilityDescriptor` with name,
version, description, risk and inputSchema; preserve mutable, registration-ordered
`listCapabilities()` results; add `describeCapability(name, version?)` returning
a descriptor or undefined. Names are case-sensitive and versions match exactly;
undefined means omitted, while an empty string is an explicitly supplied version.

Both methods share an internal explicit projection. Every returned descriptor,
schema record and field record is fresh and detached, not frozen. Missing schemas
remain `{}`. The existing limited Veil field contract and validation semantics
are unchanged. No implementation objects or unrelated properties are projected.

Introspection is not authorization. Registered metadata implies neither permission
nor health, provider readiness or guaranteed execution. Introspection invokes no
authorizer, capability, provider or execution lifecycle. Risk, registration,
module metadata and provider presence do not establish permission.

## Consequences

Relevance selection and external reasoning/tool conversion remain outside Veil;
execution still enters through a version-pinned `ExecutionPlan` and normal
`OperatorRuntime` governance. No semantic search, filtering, tags, groups,
bundles, ranking, LLM calls, embeddings, output schemas or provider inspection
are introduced.

Inventory remains process-global and reflects later registration on subsequent
calls. Prior snapshots stay unchanged. Duplicate names remain rejected, including
different versions; no replacement, unregister, subscription, cache invalidation
or multi-version registration is added. MCP inbound inventory remains captured
at adapter construction, and MCP invocation retains its existing execution path.

This decision does not redesign registry ownership or other locked contracts.
At acceptance, the package version remained unchanged and this work targeted
v0.1.4 on `develop`, without release artifacts. The maintainer subsequently
assigned introspection and the hardening work to v0.2.0; this release preparation
does not change the architectural decision.

## Governance review

The fixed preimplementation develop base is
`157600e376da9a30255e7c04f3ee4b1486a27115`. The governance harness hashes the
whole enclosing top-level class and its position. The new runtime method/type
annotation and descriptor import change two anchors despite unchanged execution
methods. Exact comparison confirms `executePlan` and `run` are byte-for-byte
unchanged from that base, with no new execution reference.

Only the two corresponding candidate baseline hashes were reconciled:

| Existing site | Base anchor | Candidate anchor |
| --- | --- | --- |
| Runtime delegation to JobManager | `bee745368f9432230e79e8e483392a15aa743bdf853564657fbd8b05bccfdec1` | `6bfbeefd5ca8028fffeeee37c2785a3650cbdf19d1201c33926dd40d679304c6` |
| Planner strategy execution | `f1589007acc4a53492d593561b9d9b3aac451bf4d5e22dd3e01748bc3d065cc6` | `2d0d6f2fdfeca15da7dc35e76568603be9da04167c1ecced1ebe407c9f293e7a` |

Classifications, reasons, the other 14 entries and verification controls are
unchanged. Fixed-base quality still requires review of the two replacement
anchors and reports the old anchors retired: candidate entries cannot authorize
themselves. Maintainer adoption through the trusted branch remains required.
The changed root export, added tests, consumer checks and candidate baseline are
also verification-control review items; no allowances or checks were weakened.
