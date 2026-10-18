# Phase 2: model-generated coordination

This directory adds unscripted model decision transport while leaving the
Phase 1 harness and all retained evidence unchanged. Read
[research-addendum.md](research-addendum.md) and [protocol.md](protocol.md)
before interpreting a trial. The trusted host worker has no model credentials.
It owns the private world and invokes only Veil `ExecutionPlan` V2. The parent
model driver retains separate public histories for `p0`, `p1`, and `p2` within
each episode. Only a bounded participant-authored memory persists between
episodes; complete histories stay in the evidence.

Conditions are A fixed workflow, B one central model reasoner, C independent
participants with messages, and D independent participants without messages.
The open-choice layout gives all participants all capabilities for H3; the
restricted layout tests cooperation and failure recovery. The offline mocked
responses in tests are scripted plumbing checks, not emergence evidence.

From the repository root:

```sh
npx tsc --project tsconfig.test.json
node --test --test-isolation=none experiments/emergent-coordination/phase2/offline.test.mjs
node experiments/emergent-coordination/phase2/run.mjs --dry-run --out .tmp/veil-005-dry-run-NEW
```

The dry run performs zero model calls. The paid pilot command and explicit
token ceiling are in [pilot-readiness.md](pilot-readiness.md). The runner has no
primary mode and never retries a submitted plan or an ambiguous provider call.
The verified offline outcomes are recorded in [offline-results.md](offline-results.md).
Pilot 004's validation failures and the v1-to-v2 instruction boundary are
recorded in [pilot-004-diagnostic.md](pilot-004-diagnostic.md).
The separately labeled two-condition integration command and evidence layout
are in [smoke-readiness.md](smoke-readiness.md).
The budget-settled, separately labeled distributed follow-up is described in
[extended-smoke-readiness.md](extended-smoke-readiness.md).
