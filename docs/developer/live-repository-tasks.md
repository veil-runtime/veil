# Live autonomous repository tasks — Phase 3

Starting state confirmed: clean `feat/secure-verification-sandbox`, HEAD
`062411c`. Work is on `feat/live-autonomous-repository-tasks`; no commits,
pushes, merges, dependency installs, deployments, or paid inference performed.

## Integration and ownership

`apps/repository-task/live.ts` adapts 004G's small native-fetch Responses API
transport to the existing `Reasoner` protocol. The existing OpenAI-compatible
planner was inspected but cannot be used directly: it reads the global registry,
returns a different plan protocol, and does not expose usage or cancellation.
No framework, SDK, public export, locked contract, or sandbox implementation changes.

One sequential count/generation pair produces one strict JSON action. The model
receives the objective, scoped capability schemas, bounded execution feedback,
and remaining turns. The runner still constructs ExecutionPlan 2.0 and calls
OperatorRuntime with its private identity and authorizer. Only the approved
workspace capabilities and fixed host acceptance capability are available.
Unauthorized actions return feedback and can be corrected. Failed acceptance
can be corrected within turn/verification limits. Malformed protocol, transport,
and accounting errors terminate; there are no automatic paid retries.

## Models, credentials, and pricing

The initially reviewed model is explicitly selected as
`gpt-4.1-mini-2025-04-14`; other model IDs fail closed before network access.
`OPENAI_API_KEY` supplies credentials. The endpoint is fixed to OpenAI HTTPS,
redirects are rejected, and keys never enter the request body or evidence.
There are no implicit API calls in imports, tests, builds, or the dry run.

Official documentation reviewed 2026-10-17:

- [Model and pricing](https://developers.openai.com/api/docs/models/gpt-4.1-mini):
  $0.40 input / $1.60 output per million tokens, standard tier. This snapshot is
  marked deprecated; account availability has NOT been checked. Unavailability
  stops the trial; no automatic model substitution is permitted.
- [Input counting](https://developers.openai.com/api/docs/guides/token-counting):
  `/v1/responses/input_tokens` counts the actual input before generation.

No cache discount is assumed. No tools, priority tier, images, or background
responses are requested. Pricing is an explicit host-owned table; review it
before a paid trial. The $0.04 ceiling is an **estimated inference** budget under
these published rates, not a guarantee about external billing or price changes.
Each generation reserves counted input plus maximum output cost before sending;
reservations are never refunded, including after timeouts. Unknown pricing,
missing counts, usage mismatch, missing usage, or model mismatch stop inference.
An interrupted call retains its reservation and marks usage unreliable. The
provider may finish a request after client cancellation; the reservation covers
its configured maximum output. No further calls follow an ambiguous failure.

## Trial limits

| Host limit | Value |
|---|---:|
| Model turns | 12 |
| Cumulative input tokens | 30,000 |
| Cumulative output tokens | 12,000 |
| Output per generation | 1,500 |
| Verification attempts | 3 |
| Task action deadline | 120 seconds |
| Model count + generation deadline | 20 seconds |
| Estimated inference reservations | $0.04 |
| Model context bytes | 32 KiB |
| Response bytes | 32 KiB |
| Transcript budget | 4 MiB |
| Approved workspace bytes | 8 KiB |
| Sandbox verification wall / CPU | 2 seconds / 2 seconds |
| Sandbox output | 8 KiB |

The token ceilings imply at most $0.0312 of accounted inference at these rates;
conservative per-call reservations can stop earlier. Transcript admission reserves
space for responses, action duplication, and worst-case runner feedback/patches.
Oversized observations stop instead of silently removing verification evidence.
Response bodies are read incrementally with a byte cap. Task deadlines stop new
actions and bound model waits; verification is admitted only with enough remaining
wall budget. Final evidence collection and cleanup run after stopping and can
extend elapsed time. These JavaScript deadlines do not forcibly preempt a stalled
host filesystem or event loop; an OS-supervised end-to-end wall deadline remains
a limitation. The sandbox retains its independent process-killing wall limit.

## Evidence and replay

The JSON record includes mode, objective, approved profile, model request bodies,
raw bounded provider responses (including reported model ID), proposed accepted
protocol actions, rejected protocol errors, authorization outcomes, capability
results, initial/final/verified content digests, final unified patch, limits,
usage, conservative cost reservations, and terminal classification. Records are
written exclusively with mode 0600; existing records are not overwritten.

Model finish is a claim. Capability completion is an execution status. Acceptance
success is a trusted oracle result. Task verification additionally requires a
matching final revision and unchanged original approved inputs. Editing invalidates
prior verification. Synthetic dry runs are labeled `simulated`. Replay re-executes
actions through the same authorizer and real sandbox under a fresh host-approved
profile; it is explicitly NOT independent reproduction and performs no inference.
Recorded permissions never become replay authority.

Known credential values are redacted from outbound observations and all evidence.
Transport errors discard provider bodies/headers. Approved source files must still
be reviewed for unrelated secrets; arbitrary secret discovery is not claimed.
Redaction can alter a patch containing a credential. Evidence is assembled in
memory and persisted at normal termination; host crashes are not crash-durable.

## Commands

From the repository root (Node 24 and the existing Linux sandbox prerequisites):

```sh
npx tsc -p apps/repository-task/tsconfig.json
node .tmp/task-build/apps/repository-task/live-cli.js --dry-run /tmp/veil-dry.json
node .tmp/task-build/apps/repository-task/live-cli.js --replay /tmp/veil-replay.json /tmp/veil-dry.json
```

The trial creates a disposable source tree with a genuine `uniqueLabels` defect.
The model must discover `src/labels.ts`, trim labels, remove empties, and deduplicate
case-insensitively while preserving first spelling/order. Three fixed host cases
include empty input and prototype-like strings. No imports, installs, shell,
deployment, or commits are available. The dry run first observes failed acceptance,
then corrects the implementation and passes actual sandbox acceptance.

**Proposed paid command — deliberately not executed:**

```sh
# OPENAI_API_KEY must already be supplied securely in the environment.
node .tmp/task-build/apps/repository-task/live-cli.js --live-paid /tmp/veil-live.json gpt-4.1-mini-2025-04-14
```

## Validation

- Adapter tests: 10/10 deterministic cases, including discovery/success/recovery,
  malformed and unauthorized actions, stale verification, timeout, turn/token/
  cost/byte exhaustion, missing usage/count/model identity, redaction, replay,
  and original preservation.
- Existing repository-task tests: 8/8.
- Existing sandbox security tests: 10/10, unchanged.
- Root typecheck, application typecheck, test compilation, production build: pass.
- Dry run and replay: `verified`; no model calls.
- `npm run check`: 20/22 workers pass. The unchanged
  `external-model-reasoner.test.ts` and `external-reasoner.test.ts` fail.
- `npm run verify:package`: build passes; existing empty captured npm output
  still causes `SyntaxError: Unexpected end of JSON input` at
  `tools/verify-package.mjs:24`. Downstream package-consumer checks remain unproven.
- `npm run quality -- --base 062411c`: no dependency/lock changes or unapproved
  execution references; exit 1 because the new test file requires review.
  Review: tests add assertions and isolate their temporary directory; no existing
  assertions or security restrictions were weakened. Quality's LOC totals exclude
  `apps/`; they are not the full implementation size.

An initial shared-temp cleanup failure was investigated and fixed by giving the
new test worker its own TMPDIR. The unchanged security suite passes again in the
full gate. Existing external-reasoner and package issues remain documented in
[repository-task-runner.md](repository-task-runner.md#baseline-failure-investigation).
The entire repository is **not green**.

## Exact changed files and next step

- `apps/repository-task/runner.ts`: optional host task deadline and verification admission.
- `apps/repository-task/live.ts`: bounded adapter, transport, accounting, redaction, replay.
- `apps/repository-task/trial.ts`: disposable TypeScript task, host oracle, simulated transport.
- `apps/repository-task/live-cli.ts`: separate explicit dry/live/replay entry points.
- `test/live-repository-task.test.ts`: deterministic integration and limit tests.
- `docs/developer/live-repository-tasks.md`: this implementation/readiness record.

Next improvement: an OS-supervised task deadline with an append-only evidence
journal, so host stalls/crashes preserve partial evidence and enforce total elapsed
time independently of the JavaScript event loop. Review an active model snapshot
and its accounting contract before expanding the supported-model table.
