# Phase 2 offline evidence — 2026-10-14

These are infrastructure checks using scripted mock responses. They are not
observations of model-generated coordination or emergence. No paid model API
was invoked and no primary trial was run.

| Check | Result |
| --- | --- |
| Phase 2 mocked offline tests | 6 passed, 0 failed |
| Phase 1 harness regression tests | 5 passed, 0 failed |
| Phase 1 `initial-40-v5` source hashes | All six listed source files unchanged |
| Seven-trial pilot dry run | `NOT RUN`; 0 model calls, 0 completed trials |
| `npm run check` outside the sandbox | Passed: 310 tests, 0 failed; package archive verified (106 files) |
| `npm run quality -- --base 5f5bbf6` | Passed; no unapproved execution references or unsupported accesses |

The sandboxed `npm run check` attempt failed two existing subprocess-based
suites (`external-model-reasoner` and `external-reasoner`); typechecking and the
other 17 test files passed. The same command passed outside the sandbox. The
first quality run identified two dynamic-indexing sites in new Phase 2 code;
both were rewritten as explicit bounded lookups, and the rerun passed. Against
the requested base, quality reported zero change in its source, test, and
harness LOC categories, no dependency/lockfile changes, and no verification
control changes. The new experiment directory is outside those LOC categories;
the governance scan did include its files.

The mocked tests establish that the participant transport keeps separate local
contexts, submitted V2 plans cross Veil admission and authorization, forged
authority is ignored, V1 proposals are rejected, a persistent provider failure
can be followed by a visible alternative action, no-message and central
controls execute, budget/provider boundaries stop trials, and an UNKNOWN
receipt stays unconfirmed without automatic retry. Scripted mock outputs make
these plumbing checks deterministic; their task completions are not scientific
support for H1, H2, or H3.

Dry-run evidence is at `.tmp/veil-005-phase2-dry-run-verified/` and records a
120,000-token maximum reservation setting. The live pilot readiness commands
and expected outputs are in [pilot-readiness.md](pilot-readiness.md). Live
model behavior, model usage, statistical comparisons, and role persistence
remain unobserved.
