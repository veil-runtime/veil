# External Reasoner Experiment II

Implementation of the [approved design](../../docs/architecture/external-model-reasoner-experiment-design.md).
Only fake in-memory capability effects are available. The sole live network
interaction is the explicitly configured model API. No real model is used by tests.

## Current checkpoint

**READY_FOR_LIVE_RUN.** The harness and all offline controls are implemented and
verified. No real-model call or live trial has occurred. Credentials, model
selection and run budget were absent at the last presence-only check, so no
model result is claimed. Configure all three before running the smoke workflow;
the runner writes `NOT RUN` and performs zero provider calls when any is missing.

## Offline verification

From the repository root:

```sh
npx tsc --project tsconfig.test.json
node --test experiments/external-model-reasoner/harness.test.mjs
npm run check
npm run quality -- --base bb3f34e4f938096acec897159f0f56283c11697a
```

Subprocess tests may need execution outside the filesystem sandbox, as in
Experiment I. Tests contain scripted public outputs and mocked fetch responses;
they verify plumbing and containment, not model reasoning. The original checked
trace must remain byte-for-byte equivalent in both capability namespaces.

## Real-model runs

Configure the environment in your shell or secret manager, never a committed file:

- `ANTHROPIC_API_KEY`: model transport key, passed only to the worker process.
- `VEIL_EXPERIMENT_MODEL`: explicit available model/revision; no fallback.
- `VEIL_EXPERIMENT_MAX_TOKENS`: positive integer suite ceiling. Calls reserve a
  conservative input bound (UTF-8 bytes + 1,024 framing tokens) plus 2,048 output
  tokens before invoking the adapter. Reservations are not refunded; actual
  usage is recorded separately. This bound deliberately favors stopping early.
- `VEIL_EXPERIMENT_TEMPERATURE`: `0` when supported, otherwise `omit` (default).
  Unsupported options end the trial; they are never silently retried or changed.
- `VEIL_EXPERIMENT_INPUT_RATE` and `VEIL_EXPERIMENT_OUTPUT_RATE`: published USD
  per-million-token rates for the chosen model, recorded in the manifest.

Do not copy credentials into CLI arguments, prompts, results, or issue reports.
Missing key/model/budget writes a `NOT RUN` summary and makes zero model calls.
Model availability is established only by an actual request; no credential scan
or provider preflight is performed. The API endpoint/version are fixed inside
`providers/anthropic.mjs`. No provider SDK or root dependency is added.

```sh
node experiments/external-model-reasoner/run.mjs --mode smoke --out .tmp/model-smoke
node experiments/external-model-reasoner/run.mjs --mode pilot --out .tmp/model-pilots
node experiments/external-model-reasoner/run.mjs --mode primary --pilot-dir .tmp/model-pilots --out .tmp/model-primary
```

Each output directory must be new. Smoke is one discovery trial; pilots are
separate discovery and UNKNOWN trials. Primary is exactly 45 trials: five per
scenario, three default and two renamed namespaces. A primary run requires the
two pilots to finish under the same source/build hash, model and sampling setting.
Pilot semantic failures remain evidence; infrastructure/security failures block
progression. Freeze the source and prompts after pilots. Do not reduce the matrix
or count smoke/pilot results as primary observations.

A run stops at a recorded checkpoint on exhausted budget, provider/host failure,
worker interruption, or security violation. There is no automatic provider retry,
trial replacement, plan retry or hidden model fallback. All completed trial
records and partial JSONL ledgers remain on disk. A later attempt uses a new
output directory; report both runs rather than overwriting an inconvenient result.

## Retained evidence

`manifest.json` records HEAD, dirty status, content hashes (including compiled
source), prompts, adapter, scenario matrix, model/configuration and limits.
`trial-N.jsonl` preserves ordered observations, public responses, host projections,
admission evidence, authorization, capability entries/effects, and visible
feedback. `trial-N.json` is the completed trial record with evaluation and world
oracle; `summary.json` aggregates strata and coverage. Checksums accompany the
manifest and completed records. JSONL remains useful if a worker dies before
returning a completed record. `realModelCalls` counts model-call attempts, including
provider failures; it does not assert that the provider accepted/billed each one.

The JSONL and completed record are **trusted research evidence**, not model
context. Only the exact recorded observation is submitted to the provider.
Discovery's counts and the UNKNOWN private success/effect oracle are withheld.
Never feed an entire trial record back into the model. Request data remains
untrusted even if it looks like a caller, approval, policy, risk, or diagnostic.

The provider accepts only public text blocks; private reasoning/tool blocks are
rejected without retention. It does not request extended thinking, tools, or a
strict output schema. Provider errors are reduced to safe categories; raw error
bodies, headers and arbitrary response fields are not persisted. `decision` and
`summary` are short public output, not hidden chain-of-thought.

Automatic evaluation distinguishes actual effects, public confirmation, model
claims, uncertainty, and containment. Replacement-label meaning, paraphrased
answers and hostile-data intent remain explicitly marked for human review.
Coverage gaps are not passes. Deterministic regression probes cannot substitute
for model-generated attempts. Any contemplated stress/repair supplement must
remain separately labeled and bounded as described in the approved design.

## Files and boundaries

- `../external-reasoner/fixture-host.mjs`: extracted original domain/policy and
  host protocol, with opt-in detailed instrumentation. A fresh process is required.
- `host.mjs`, `host-client.mjs`: credential-free host child and serialized IPC.
- `driver.mjs`: exact output forwarding, passive decoding, observations and limits.
- `model-adapter.mjs`, `providers/anthropic.mjs`: neutral contract and isolated HTTP.
- `protocol.md`, `prompts/reasoner.txt`, `scenarios.json`: fixed model-visible data.
- `trace.mjs`, `evaluate.mjs`: projection, checksums and private evidence metrics.
- `manifest.mjs`, `worker.mjs`, `run.mjs`: frozen source manifest and trial lifecycle.
- `harness.test.mjs`, `../../test/external-model-reasoner.test.ts`: offline tests.

No core, descriptors, authorization, plan semantics, ADR-0011, dependencies or
package version change. Existing fixture passive-value and session-local replay
limitations still apply. Process separation is not an OS sandbox.
