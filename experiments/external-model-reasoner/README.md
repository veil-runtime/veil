# External Reasoner Experiment II

Implementation of the [approved design](../../docs/architecture/external-model-reasoner-experiment-design.md).
Only fake in-memory capability effects are available. The sole live network
interaction is the explicitly configured model API. No real model is used by tests.
The runner supports `anthropic` and `openai`; both produce the same serialized
model-output contract and use the same scenarios and trusted host.

## Current checkpoint

**PRIMARY_MATRIX_COMPLETE.** The harness, provider-boundary corrections,
pilot-metric separation, pilots, and the frozen 45-trial OpenAI primary matrix
are complete. The primary results are recorded in
`docs/architecture/external-model-reasoner-primary-results.md`. The local
`.tmp` smoke, pilot, and primary artifacts remain ignored and are not release
artifacts.

## OpenAI wire-output correction

The original prompt-only OpenAI baseline is retained as evidence. Smoke-2
returned one valid discovery object and later stopped at its budget checkpoint;
smoke-3 and smoke-4 returned two concatenated identical discovery objects and
ended with `protocol-abort`. All three runs used the same provider/model and
initial context. The repeated malformed wire shape showed that the experiment
was measuring incidental JSON serialization as well as external reasoning.

The OpenAI adapter now enables the Responses API `json_object` structured text
mode. The provider-neutral boundary is exactly one unambiguous public assistant
proposal: one assistant message with one `output_text` part. The documented
`reasoning` item type may coexist and is recorded only as
bounded structure; its
private content is never retained or projected. Unknown, tool, refusal, or
ambiguous public content is rejected; the adapter never concatenates or repairs
parts.
This constrains only the wire grammar while leaving method semantics, capability
names and versions, plan versions, resources, inputs and terminal claims
model-authored and untrusted. The existing decoder still validates the protocol.
Run manifests record `wireOutput.mode` and its protocol schema revision, while
safe response-shape counts explain any structural rejection.

This is a provider transport distinction. Provider-native wire constraints must
be recorded when comparing providers or models; structured OpenAI output and
prompt-only Anthropic output share the same provider-neutral protocol, but raw
malformed-wire rates are not comparable unless the constraint mode is matched.

The first post-instrumentation cardinality smoke returned two output items,
both assistant messages, each with one `output_text` part. The adapter rejected
the response as `invalid-provider-response` without selecting or concatenating
either proposal. The provider request completed, but no host, Veil, capability,
or fake-world boundary was crossed. This establishes that response's raw
structure only; historical smoke-3, smoke-4, and structured-smoke retained no
raw provider structure and are not retroactively attributed to the same shape.

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

- `VEIL_EXPERIMENT_PROVIDER`: `anthropic` (default) or `openai`.
- `ANTHROPIC_API_KEY`: selected when the provider is `anthropic`; passed only to
  the worker process.
- `OPENAI_API_KEY`: selected when the provider is `openai`; passed only to the
  worker process.
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
the selected experiment-local adapter: Anthropic Messages or OpenAI Responses.
No provider SDK or root dependency is added.

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

Structural provider-boundary failures are recorded as
`provider-boundary-failure` with outcome class `AMBIGUOUS_PUBLIC_PROPOSALS` (or
the corresponding structural category). They increment
`providerBoundaryFailures`, not generic `providerErrors`, protocol-invalid
outputs, Veil admission, authorization, or execution metrics. They terminate
the current trial without retry or replacement; the suite may continue to its
next scheduled trial. Generic HTTP, transport, refusal, and other provider
failures remain infrastructure checkpoints.

## Retained evidence

`manifest.json` records HEAD, dirty status, content hashes (including compiled
source), selected provider, provider API identifier, prompts, adapter, scenario
matrix, model/configuration and limits. It never records credentials.
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

The provider accepts only one public assistant text proposal; private reasoning
items may be observed structurally but are rejected from retention/projection,
and tool blocks are rejected. OpenAI requests structured `json_object` wire output
but no tools or extended thinking; Anthropic remains prompt-only. Provider errors
are reduced to safe categories; raw error bodies, headers, provider content and
arbitrary response fields are not persisted. Bounded output-item/content counts,
types, indexes and text lengths are retained for structural diagnosis only.
`decision` and `summary` are short public output, not hidden chain-of-thought.

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
- `model-adapter.mjs`, `providers/anthropic.mjs`, `providers/openai.mjs`: neutral
  contract and isolated provider HTTP adapters. OpenAI uses the Responses API
  with `store:false`, serialized text input, no tools, and the same plain JSON
  proposal protocol; provider output remains untrusted text.
- `protocol.md`, `prompts/reasoner.txt`, `scenarios.json`: fixed model-visible data.
- `trace.mjs`, `evaluate.mjs`: projection, checksums and private evidence metrics.
- `manifest.mjs`, `worker.mjs`, `run.mjs`: frozen source manifest and trial lifecycle.
- `harness.test.mjs`, `../../test/external-model-reasoner.test.ts`: offline tests.

No core, descriptors, authorization, plan semantics, ADR-0011, dependencies or
package version change. Existing fixture passive-value and session-local replay
limitations still apply. Process separation is not an OS sandbox.
