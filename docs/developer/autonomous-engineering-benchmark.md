# Veil Phase 4: autonomous engineering reliability benchmark

Checkpoint: clean `feat/live-autonomous-repository-tasks`,
`8dbd44a1369a4e56303f625bcae2cc0c15f5a990`. Implementation branch:
`feat/autonomous-engineering-benchmark`. No paid inference, deployment, commits,
publishing, historical evidence edits, frozen-experiment edits, dependency changes,
or runtime self-modification were performed.

## Design and task specifications

The benchmark calls the existing live adapter and repository-task runner. Every
model action still passes through ExecutionPlan 2.0, OperatorRuntime's private
identity/authorizer, scoped workspace capabilities, and the existing Linux sandbox.
There is no model shell or new permission. Tasks execute sequentially, each with a
fresh source directory and a separate runner copy. The original source is checked
before disposal. No dependency installation or external network is needed offline.

Each task approves exactly `src/task.ts` for reading/writing. The host oracle and
simulated solutions are outside that tree. Objectives describe behavior and export
contracts; they contain neither expected patches nor acceptance assertions. The
host controls fixed cases; the model cannot select or modify cases. Benchmark
verification returns status and generic pass/fail text, suppressing assertion
values and candidate stdout/stderr. Host evidence retains cases for audit. This is
an agent visibility boundary, not a claim that published benchmark cases are secret.

| ID | Difficulty | Desired behavior | Fixed acceptance coverage |
|---|---|---|---|
| `bounded-integer` | small | Parse a complete signed decimal integer within inclusive safe-integer bounds; invalid input returns null. | 10 cases: whitespace/sign, trailing junk, empty, exponent, fraction, lower/upper boundaries, outside range, reversed bounds, unsafe/noninteger bounds. |
| `group-totals` | small | Sum finite input amounts by exact string key in first occurrence order, retaining zero/negative totals and leaving inputs unchanged. | 3 cases: duplicate keys/cancellation/order, empty input, prototype-like keys and negative totals; argument preservation checked. |
| `interval-union` | small-intermediate | Normalize finite intervals by discarding reversed/empty pairs and merging overlap/touching; compute union length across interacting exports. | 6 cases: 3 per export covering unsorted/touching/contained/disjoint/negative/empty/reversed ranges; argument preservation checked. |
| `reservation-ledger` | small-intermediate | Reserve/release capacity without overbooking; reject duplicate ids and invalid quantities, allow reuse after release, retain active reservation order. | 4 cases: overbooking, duplicate/release/reuse, missing release/negative/fractional quantities/prototype-like id, zero capacity. |
| `record-recovery` | small | Process independent JSON lines, retain finite numeric values including zero, report bad-line indexes, continue after errors. | 3 cases: malformed line between good records, null/array/string/missing/nonfinite values followed by valid data, empty input. |

All five original seeds fail real acceptance. Tests separately show the deterministic
reference corrections pass. This validates fixture discrimination, not live model
reliability. The corpus is versioned in `benchmark-tasks.ts`; evidence fingerprints
include task spec, actual seed, objective, condition, and profile with its temporary
path normalized. Fingerprints do not attest to the whole runtime binary. Retain
this implementation and checkpoint with evidence when reproducing a study.

## Controlled recovery condition

`bounded-integer`, condition `recovery`, starts with an otherwise plausible parser
that rejects the inclusive upper endpoint. The behavior objective is unchanged;
an additional instruction asks the reasoner to verify the seed before editing.
The initial failure is real, not an injected fake verifier response. The host never
writes a correction in live mode, forces an action, or tells the model the defect.
The reasoner must select its own edit using the objective, source, and generic
verification feedback.

`recoveryConditionFollowed` records whether the first authorized write/patch/verify
action was a failed verification. A disobedient run is retained and labeled, not
silently discarded or retried. `recoveryCompliance` reports both compliance count
and recovered successes among compliant runs. Recovery requires a failed verifier,
a later authorized successful edit with a different revision, then passing
verification and final verified completion. A failed check alone is not recovery.

First-pass success means the first *checked* implementation passed and no check
failed; it does not prove that the first proposed edit was correct. Failed finish,
exhausted budgets, invalid protocol, unavailable infrastructure, unreliable
accounting, and revision/source integrity failures have distinct outcomes. A
verified result outside the first-pass/recovery definitions is `verified-other`.
The recovery condition is a separate within-task experiment, not a sixth
independent task. `record-recovery` tests application error handling; it is not
itself the controlled reasoner-recovery condition.

Offline corrections are scripted in `benchmark-simulated.ts`, dynamically loaded
only in dry mode. Their recovery demonstrates orchestration, never model-selected
recovery. Live recovery has not been measured.

## CLI and limits

Build with the installed toolchain:

```sh
npx tsc -p apps/repository-task/tsconfig.json
node .tmp/task-build/apps/repository-task/benchmark-cli.js --dry-run /tmp/veil-phase4-evidence gpt-4.1-mini-2025-04-14 all standard continue-model-failures
node .tmp/task-build/apps/repository-task/benchmark-cli.js --dry-run /tmp/veil-phase4-evidence gpt-4.1-mini-2025-04-14 bounded-integer recovery stop-on-failure
```

Replace `all` with comma-separated distinct task IDs for a subset. Model,
condition, and continuation policy are explicit positional arguments. Invalid
arguments, unknown models, duplicate/unknown tasks, and unsupported recovery
selections fail closed. No default live mode, provider fallback, or paid retry.

Proposed paid commands, **not executed and requiring explicit approval**:

```sh
# Supply OPENAI_API_KEY securely through the environment beforehand.
node .tmp/task-build/apps/repository-task/benchmark-cli.js --live-paid /tmp/veil-phase4-live gpt-4.1-mini-2025-04-14 all standard continue-model-failures
# Separate optional recovery experiment; not included in the five-task ceiling:
node .tmp/task-build/apps/repository-task/benchmark-cli.js --live-paid /tmp/veil-phase4-live gpt-4.1-mini-2025-04-14 bounded-integer recovery stop-on-failure
```

Only the existing adapter model allowlist is supported. Availability and current
billing prices have not been checked in this phase. Reconfirm them before approval;
no alternate model will be selected automatically.

| Limit | Per task | Session default |
|---|---:|---:|
| Tasks | 1 | 5 |
| Reasoning request attempts | 12 | 60 |
| Verification attempts | 3 | 15 |
| Accounted input tokens | 30,000 | 150,000 |
| Accounted output tokens | 12,000 | 60,000 |
| Maximum output per generation | 1,500 | Same |
| Conservative inference reservations | $0.04 | $0.20 |
| Task admission/action deadline | 120 seconds | 660 seconds |

The existing 20-second model deadline, 32 KiB observation/response caps, 4 MiB
transcript cap, 8 KiB workspace cap, and 2-second sandbox wall/CPU limits remain.
A session admits a task only if its *full* task budget fits all remaining limits.
This conservative admission can leave unused budget. The duration limit governs
admission/actions; final evidence and cleanup can overrun it. There is no
OS-enforced session deadline. Host stalls remain an inherited limitation.

`continue-model-failures` continues after failed completion or ordinary budget
exhaustion. `stop-on-failure` stops on any nonverified result. Both always stop on
protocol, infrastructure, accounting, or integrity failure. Not-run tasks remain in
the selected denominator and are listed explicitly. Fixture-setup failures are
reported separately in `hostFailures`; no model attempt occurred. CLI exit status
is zero only when all selected tasks verified.

At the existing host table ($0.40/M input, $1.60/M output), the first five-task live
benchmark reserves **at most $0.20** of estimated inference cost. Fully accounted
token ceilings imply at most **$0.156** (150,000 input + 60,000 output). Reservations
are retained after ambiguous calls, with no further inference. Optional recovery
adds at most $0.04, for a combined reservation ceiling of $0.24. These are estimates
under the current code's table, not external billing guarantees. Dry-run actual
inference cost is zero; its usage and cost fields are synthetic accounting data.

## Evidence and metrics schema (version 1)

Each invocation creates an exclusive `benchmark-*` directory. JSON files are opened
with `wx`, mode 0600; no earlier record is overwritten. `manifest.json` precedes
execution. Each completed task writes `<task-id>.json` before another task starts;
`report.json` is the final session aggregate. Do not automatically publish these
files: they contain source, model requests, actions and host cases.

| Record | Fields |
|---|---|
| Manifest | schemaVersion, mode, model, selected tasks, condition, policy, sessionLimits, taskInferenceLimits |
| Task envelope | schemaVersion, taskId, condition, specificationSHA256, metrics, record |
| Existing LiveRecord | mode, requestedModel, limits, pricing, exchanges, usage, report |
| Exchanges | actual request, counted input, bounded raw provider response, normalized action, reserved USD, protocol/transport error |
| Task report | host classification/reason, original/verified/final revision digests, originalUnchanged, final unified patch, ordered authorization and verification feedback, approved profile/cases |
| Metrics | model, verified, outcome, hostClassification, reason, firstPassSuccess, recoveredSuccess, recoveryConditionFollowed, modelTurns, completedModelTurns, verificationAttempts, rejectedActions, tokens, estimatedInferenceCostUSD, reservedUSD, revisionIntegrity, originalSourcePreserved, durationMs |
| Session report | selected/notRun, stopReason, hostFailures, recoveryCompliance, results/evidence links, totals, exact denominators, timing, policy/limits, limitations |

`modelTurns` counts adapter request attempts (including count-only attempts);
`completedModelTurns` counts captured provider responses. Tokens report accepted
provider usage, and `reliable:false` prevents claiming complete accounting.
Reservations, not returned cost, govern monetary admission. Rejected actions count
runner authorization/schema denials and captured malformed/unsupported protocol
actions. Verification attempts count authorized invocations, including unsuccessful
checks. Revision integrity compares final and accepted revisions; it is false for
unverified work, not automatically an integrity incident. Model finish is only a
claim. Task duration includes source cleanup, excludes fixture setup and persistence;
session duration covers those operations through final report assembly.

Outcome enum: `first-pass-success`, `recovered-success`, `verified-other`,
`failure-without-recovery`, `budget-exhaustion`, `protocol-failure`,
`infrastructure-failure`, `accounting-failure`, `integrity-failure`.
Unknown host exceptions stop the session, mark accounting unreliable, and retain a
full task cost reservation. Raw private exception text is not copied into evidence.
Filesystem persistence failure terminates the CLI: a final report may be missing.
The manifest and prior exclusive task records remain; this is not a crash-durable
journal. In-flight evidence can be lost on host crash or an unexpected host exception.

Replay uses the existing `replay(record, freshApprovedProfile)` helper with a fresh
`benchmarkFixture(getTask(id), condition)`. The task envelope's `.record` is the
LiveRecord input. Recorded permissions never grant replay authority. Replay performs
no inference and is explicitly not independent reproduction; the tests cover it.

## Verification and readiness

- New benchmark tests: **10/10**, including all five failing seeds, all five passing
  corrections, actual recovery/replay, hidden-oracle feedback, argument mutation,
  stale acceptance, denial, error classifications, exclusive output, every session
  admission dimension, continuation policies, and unexpected host failure.
- Existing live adapter: **15/15**. Repository task: **8/8**. Sandbox security: **10/10**.
- Root and application typechecks, test compilation, production build: pass.
- Standard CLI dry run: **5/5** verified, **5/5** first-pass, **0/5** recovered.
- Separate recovery CLI dry run: **1/1** recovered, **1/1** compliant, **0/1** first-pass.
- `npm run check`: **21/23 workers pass**; unchanged external-model-reasoner and
  external-reasoner workers fail. This gate stops before package verification.
- Separate `npm run verify:package`: build passes; existing
  `SyntaxError: Unexpected end of JSON input` at `tools/verify-package.mjs:24`
  persists. Downstream package-consumer checks remain unproven.
- `npm run quality -- --base 8dbd44a`: no dependencies/lockfile changes, no core
  growth, +136 test LOC, no unapproved execution references. Exit 1: new benchmark tests require
  review. Tests add controls; existing assertions and sandbox permissions are not
  weakened. Application LOC is outside the tool's core-growth bucket.

The baseline environmental child-stdio/IPC failures are documented separately in
[repository-task-runner.md](repository-task-runner.md#baseline-failure-investigation).
The whole repository is **not green**. No paid run was used to obtain these results.

Validation commands executed:

```sh
npx tsc -p apps/repository-task/tsconfig.json
npx tsc -p tsconfig.test.json
node .tmp/test-build/test/benchmark.test.js
node .tmp/test-build/test/live-repository-task.test.js
node .tmp/test-build/test/repository-task.test.js
node .tmp/test-build/test/sandbox-verification.test.js
npm run check
npm run verify:package
npm run quality -- --base 8dbd44a
git diff --check
```

Latest local offline session reports (outside Git):
`/tmp/veil-phase4-evidence/benchmark-c4uMpG/report.json` (standard) and
`/tmp/veil-phase4-evidence/benchmark-ZDNYpT/report.json` (recovery).
Validation logs are `/tmp/veil-benchmark-direct.log` and
`/tmp/veil-phase4-{check,quality,package,live-tests,repository-tests,sandbox-tests}.log`.
These local temporary paths are not durable archival storage.

Five purposively selected small tasks, a single model snapshot, finite acceptance
cases, and one run per condition do not support statistically conclusive reliability
claims. Cases are not independent Bernoulli samples from general software work.
No confidence interval, emergence, or self-improvement claim is warranted. Larger
repositories, imports, dependency management, multi-file changes, repeated trials,
model comparisons, order randomization, and long-term recovery remain unmeasured.
Generic verification feedback makes this a deliberately sparse-feedback benchmark.
Reference solutions and cases in the source tree could contaminate future training;
version changes must not be pooled without disclosure.

## Exact changed files

- `apps/repository-task/acceptance.ts`: opt-in summary feedback and immutable-argument assertions.
- `apps/repository-task/runner.ts`: forwards the host's optional feedback mode.
- `apps/repository-task/benchmark-tasks.ts`: five task specs, fixed cases, disposable fixtures, recovery seed.
- `apps/repository-task/benchmark.ts`: sequential session limits, classification, evidence and metrics.
- `apps/repository-task/benchmark-simulated.ts`: explicitly synthetic offline reference actions.
- `apps/repository-task/benchmark-cli.ts`: explicit dry/paid CLI and policy selection.
- `test/benchmark.test.ts`: deterministic integration and limit tests.
- `docs/developer/autonomous-engineering-benchmark.md`: specifications, commands, schema, results and limitations.

Ready for review and a separately approved live benchmark, subject to model/price
availability and the documented baseline gate failures. Stop before live execution.

## Phase 4A: governed diagnostic feedback (offline implementation)

New runs select a host-owned `feedbackCondition`: `sparse` (default) or
`diagnostic`. The original task seeds, objectives, acceptance inputs and expected
values, model allowlist, budgets, sandbox, authorization and verification limits
are unchanged. Historical version-1 evidence is untouched. The existing
`standard`/`recovery` task condition remains a separate choice. Run the same task
selection and task condition in each arm; do not pool either arm with historical
results without labeling the feedback condition.

After compiling the application, these are **offline simulated** commands for
the two arms. They make no paid model calls:

```sh
npx tsc -p apps/repository-task/tsconfig.json
node .tmp/task-build/apps/repository-task/benchmark-cli.js --dry-run /tmp/veil-phase4a-sparse gpt-4.1-mini-2025-04-14 bounded-integer standard stop-on-failure sparse
node .tmp/task-build/apps/repository-task/benchmark-cli.js --dry-run /tmp/veil-phase4a-diagnostic gpt-4.1-mini-2025-04-14 bounded-integer standard stop-on-failure diagnostic
```

The final argument is optional and defaults to `sparse`. A future live comparison
requires separate approval and otherwise uses the same arguments with
`--live-paid`; no live comparison was run for Phase 4A.

Diagnostic labels are fixed in the host-only `benchmark-diagnostics.ts` mapping:

| Task | Failed-case categories |
|---|---|
| `bounded-integer` | Input form cases: `input-validation`; range and safe-bound cases: `boundary-handling` |
| `group-totals` | `data-consistency` |
| `interval-union` | `boundary-handling` |
| `reservation-ledger` | `state-invariant` |
| `record-recovery` | `error-recovery` |

The evaluator collects labels only from cases that fail during function execution
or comparison. It emits sorted, unique allowlisted labels after a private marker.
The host discards raw sandbox stdout/stderr and returns a fixed phrase plus labels.
An unlabeled failure, parse failure or unavailable classification returns generic
failure. The diagnostic text contains no case index, input, expected output,
assertion, source excerpt or stack trace. The host report still retains the
approved cases for audit; the reasoner context does not contain the profile.

New manifest, task envelope and session report records have `schemaVersion: 2`
and `feedbackCondition`. Task evidence also records the host-owned diagnostic
mapping inside its profile when selected. The task `specificationSHA256` excludes
feedback metadata so the same task seed and acceptance specification produce the
same hash in both arms. A verification feedback entry may add
`repeatedFailedRevision` with the full SHA-256 revision when the same revision was
previously checked and failed. This is retained in host evidence, while the
reasoner receives the original feedback shape to avoid a second model-visible
intervention; the request still executes and consumes an ordinary verification
attempt. Acceptance remains tied to the host-computed current revision.

The category is a coarse clue, not a proof of the defect or a guarantee that all
failures are classified. The mapping must be reviewed when cases change. A
candidate that fails several cases may receive several labels, which can reveal
more about the finite oracle than sparse feedback. Comparisons must therefore
attribute any change in model behavior to the feedback arm, not to a broader
security or correctness claim. No capability instruction or budget was changed.
