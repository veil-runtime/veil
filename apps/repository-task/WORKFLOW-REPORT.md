# Developer workflow delivery report

Implemented and verified offline on 2026-10-18. Comparison base:
`d7c528c73633242b1ec6b3577a060b5e472d7166`. No paid inference, commits,
deployment, merging, or changes to governance policy were performed.

## Already present

The application already had approved-file copying, list/read/write/exact-patch
capabilities, private workspace revisions, governed one-step V2 plans through
`OperatorRuntime`, authorization, turn/duration/verification limits, fail-closed
finish handling, sandbox acceptance, bounded diagnostic categories, patch
construction, original-input checks, and cleanup. `live.ts` already provided
the reasoning adapter, inference budgets, cost reservations, redaction, and
replay. The trial fixture and simulated transport were reusable.

## Added and changed

- `runner.ts`: explicit canonical path instructions and approved readable/writable
  names in detached model context; remaining verification count and revision
  identity; model-visible repeated-failure evidence and correction guidance;
  unchanged-write/patch and denial guidance; changed-file list. Default
  verification feedback now uses the existing sanitized summary, with unknown
  feedback modes rejected. Diagnostic categories remain host-owned opt-in.
- `workspace.ts`: canonical path guidance in existing capability schemas.
- `workflow-cli.ts`: task/profile/inference-limit entry point using the existing
  adapter, explicit paid opt-in, offline example, and approved-profile replay.
  Writes private `summary.json`, `record.json`, and `changes.patch` artifacts to
  a new directory. Separates simulated accounting from zero actual inference
  cost and states whether the final result is verified.
- `benchmark.ts`: adds the changed-file field to the existing fallback report.
  No historical evidence, benchmark tasks, or experimental apparatus changed.
- `test/repository-task.test.ts`: permission discovery, canonical-path rejection,
  unchanged writes and patches, remaining limits, repeated revisions, correction,
  and default private-case redaction tests.
- `test/developer-workflow.test.ts`: offline CLI artifacts, sandbox-backed
  correction, output preservation, and explicit-mode validation.
- `test/benchmark-diagnostics.test.ts`: updates the assertion to require repeated
  failed revision evidence in model feedback. Existing revision/count assertions
  remain intact.
- `test/sandbox-verification.test.ts`: isolates this test process's temporary
  directory so its full cleanup inventory assertion cannot race with concurrent
  task suites. All sandbox boundary assertions remain intact.
- `README.md`, `WORKFLOW.md`, and this report document the entry point, trust
  boundaries, usage, artifacts, and validation limits.

No core/runtime contract, package export, provider, dependency, permission rule,
or sandbox implementation was changed. Reasoning selects proposals; the existing
runtime still authorizes and executes them. Earlier benchmark records remain
historical evidence; new model context differs, so future runs are not a
prompt-identical replication of those records.

## Offline evidence and commands

- `./node_modules/.bin/tsc --project apps/repository-task/tsconfig.json`: passed.
- `node .tmp/task-build/apps/repository-task/workflow-cli.js --offline-example /tmp/veil-workflow-offline-20261018`:
  passed. Six reasoning turns; two real sandbox verification attempts. Initial
  acceptance failed with permitted `data-consistency` feedback; an exact patch
  corrected `src/labels.ts`; final acceptance passed. Original inputs unchanged,
  final revision equals verified revision, actual inference cost $0.
- Focused sequential run of `developer-workflow`, `repository-task`,
  `live-repository-task`, `benchmark-diagnostics`, and `sandbox-verification`
  compiled test files: all five passed, none skipped. Existing tests also cover
  patch applicability, stale-verification rejection, limits, and authorization.
- `npm run check`: typecheck passed; final test run passed 23/25 test files.
  `external-reasoner.test.js` and `external-model-reasoner.test.js` failed.
  Direct diagnostics show `spawnSync .../node EPERM`; external reasoner children
  also exit 13 with unsettled top-level await and empty traces. An untouched
  archive of the comparison commit reproduces both failing test files. This is
  **not a green full gate**. The initial concurrent sandbox cleanup failure was
  resolved by isolating the test temporary root; it passes in the final full run.
- `npm run verify:package`: TypeScript build passed; verifier failed at
  `tools/verify-package.mjs:24` with `SyntaxError: Unexpected end of JSON input`
  parsing empty captured `npm pack` output. The untouched baseline reproduces
  the exact failure. Package verification is therefore not claimed as passed.
- `npm run quality -- --base d7c528c73633242b1ec6b3577a060b5e472d7166`:
  exit 1, **review required** for the four changed test files. No new governance
  finding after simplifying argument parsing. Core source LOC unchanged
  (6,648); test LOC 4,848 → 4,954 (+106); harness LOC unchanged (1,232);
  dependencies and lockfile unchanged. These totals exclude application/docs
  growth. Test review: two added workflow cases and two added runner cases;
  the diagnostic expectation now checks disclosure of revision metadata only;
  sandbox cleanup retains its full assertion under process-local isolation.
  No comparison base, quality allowance, or verification control was relaxed.
- `git diff --check`: passed.

Local run artifacts: `/tmp/veil-workflow-offline-20261018/`.
Logs: `/tmp/veil-workflow-check-final.log`, `/tmp/veil-workflow-quality-final.log`,
`/tmp/veil-workflow-focused.log`, `/tmp/veil-workflow-package.log`,
`/tmp/veil-workflow-baseline-check.log`, `/tmp/veil-workflow-baseline-package.log`.
These temporary files are not committed repository evidence.

## Before a real application trial

The offline policy is fixture-specific, and no claim of general autonomous
coding performance follows from this run. The verifier still supports only
standalone erasable-TypeScript synchronous functions with JSON inputs/results;
imports, package builds, arbitrary tests, new/deleted files, and dependency
installation remain outside this slice. Passing acceptance is a bounded claim,
not proof of general correctness.

Next practical step: rerun the full functional/package gate in an environment
with working subprocess capture and review the four test changes. Then select
one small standalone function change from a real application, prepare an explicit
approved file/acceptance profile, review the existing adapter's pinned pricing
and limits, and obtain explicit approval for one bounded paid trial. Review the
patch and evidence before applying anything. Broader application verification
needs a separately approved host-owned verifier profile; do not add shell access
or weaken isolation to accommodate it.
