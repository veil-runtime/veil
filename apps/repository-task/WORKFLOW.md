# One bounded developer task

Run from the repository root with Node 24, installed development dependencies,
and the existing [Linux sandbox prerequisites](../../docs/developer/verification-sandbox.md).

```sh
./node_modules/.bin/tsc --project apps/repository-task/tsconfig.json
node .tmp/task-build/apps/repository-task/workflow-cli.js --offline-example /tmp/veil-example-result
```

Choose a **new** output directory. This offline example discovers and reads an
approved TypeScript file, observes a real sandbox acceptance failure, patches
it, verifies the new revision, and finishes. Its deterministic, fixture-specific
policy reacts to feedback; it is not a general language model. No network or
paid inference is used. Simulated token accounting is labeled separately from
actual inference cost ($0).

The directory contains:

- `summary.json`: outcome/reason, explicit `actuallyVerified`, files changed,
  revision identities, verification evidence, usage and cost estimate.
- `changes.patch`: reviewable unified diff, suitable for separately reviewed
  `git apply` against the original inputs.
- `record.json`: full trusted-host evidence and reasoning exchanges. This private
  artifact includes the approved profile and acceptance cases; do not send it
  back to a model or publish it as a public transcript.

Exit status is zero only for a verified final result. The original repository
is unchanged. A patch from an exhausted, failed, blocked, or uncertain run is
still reviewable, but is not claimed as verified. Passing means only that the
host-owned acceptance cases passed on the exact final approved-tree revision.

## An explicitly approved repository task

Prepare a host-reviewed profile using the [existing profile format](README.md).
The profile specifies the absolute repository, exact readable/writable existing
files, private acceptance cases, sandbox limits, `maxTurns`, `maxVerifications`,
`reasonerTimeoutMs`, and `maxDurationMs`. Include requirements in the task or in
approved readable files; private cases are not a substitute for a specification.

Verification feedback defaults to sanitized summaries. For bounded diagnostic
feedback, explicitly set `acceptanceFeedback: "diagnostic"` and one
`diagnosticCategories` entry per acceptance case. Entries are `null` or one of
`input-validation`, `boundary-handling`, `state-invariant`, `data-consistency`,
`error-recovery`. The existing verifier discloses only permitted categories,
never case arguments, expected values, assertion errors, or oracle code.

The CLI accepts the task and profile directly and uses the existing adapter to
choose actions without manual turn orchestration. Paid mode requires explicit
approval outside this workflow and the explicit `--live-paid` flag. It has **not**
been run as part of this delivery.

```sh
node .tmp/task-build/apps/repository-task/workflow-cli.js \
  --profile /absolute/approved-profile.json \
  --task 'Describe the bounded software change and its public requirements' \
  --output /tmp/new-task-result \
  --live-paid --inference /absolute/inference.json
```

`inference.json` uses the existing adapter's model and limits:

```json
{
  "model": "gpt-4.1-mini-2025-04-14",
  "limits": {
    "inputTokens": 30000, "outputTokens": 12000, "outputPerCall": 1500,
    "costUSD": 0.04, "observationBytes": 32768,
    "responseBytes": 32768, "transcriptBytes": 4194304
  }
}
```

This is the existing trial configuration, not a statement of current provider
pricing. Before authorizing a real run, review the adapter's pinned model/pricing
table and cost budget. Credentials come only from `OPENAI_API_KEY`. Unknown
pricing, unreliable usage, missing duration, and exhausted limits fail closed.
The report distinguishes estimated consumption from worst-case reservations;
when usage is unreliable, the estimate is incomplete and is not a billing receipt.

To replay an existing record offline on a separately approved matching workspace:

```sh
node .tmp/task-build/apps/repository-task/workflow-cli.js \
  --profile /absolute/approved-profile.json \
  --task 'The exact objective in the recorded run' \
  --output /tmp/replay-result --replay /absolute/record.json
```

Replay does not trust the recorded profile as authority, makes no inference
requests, and reruns sandbox verification. It is action replay, not independent
reasoning. Replay input is capped at 4 MiB.

## Current boundary

The function verifier supports standalone erasable-TypeScript synchronous
exports with JSON inputs/results. A host-owned `tsxAcceptance` profile also
supports a single-file JSX ID relationship correction through sandboxed parsing
and narrow AST comparison; see [the prepared Mizan trial](MIZAN-TRIAL.md).
TSX source checks do not execute or build the application. Imports, package builds, arbitrary project
tests, new/deleted files, dependency installation, and unrestricted shell are
outside this profile. No deployment, merge, commit, policy editing, or sandbox
weakening is performed. Use one process per task, and keep original inputs
quiescent while it runs.
