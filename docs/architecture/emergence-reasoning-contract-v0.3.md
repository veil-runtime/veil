# Emergence v0.3 reasoning contract repair

The first live trial stopped after one model call and zero Veil jobs because
`{"kind":"delegate","worker":"repair","input":{}}` did not contain the
kernel's required delegation fields. This repair does not rerun or reinterpret
that result.

`src/emergence/proposal.ts` now defines a strict Zod union used for kernel
validation, the inferred TypeScript proposal type, and the JSON Schema sent to
the chat reasoner. The prompt includes examples for execute, delegate, and
finish. Required delegation fields are `kind`, `peer`, `task`, `evidence`, and
`reason`; empty evidence is allowed, but names, tasks, and reasons must contain
non-whitespace text. Unknown fields are rejected.

The model receives registered capabilities intersected with each worker's
grants, including descriptions, risk, versions, and Veil input field schemas.
Worker capability names use the same filtered discovery result. Peer
responsibilities describe their role. Discovery does not grant authority or
promise that the optional host policy will authorize a particular input.

Malformed JSON, invalid proposal shapes, and invalid capability inputs produce
structured `reasoning.rejected` evidence in history and host failure memory.
The same active work item can make a fresh decision using the remaining budgets.
Every attempt consumes a decision and model call; reported usage is charged
before validation, including malformed model output. Prompt reservation includes
the contract and system instruction. No budget is increased or reset, and a
response arriving after the elapsed limit cannot execute. Provider/transport
errors and missing usage remain terminal because their accounting is uncertain.

Scope violations are terminal authorization rejections. Veil authorization
denials are recorded separately on execution failure and terminate the run,
including after an exact human approval. Proposal recovery never replays an
execution. Writes still pause at the original approval gate; plans, caller
scopes, exact-input checks, runtime policy, and restart uncertainty handling
remain in place.

The offline regression reproduces the exact bad delegation through a mocked
chat transport, checks contract/discovery/error delivery, corrects the peer and
fields, and completes a governed read and independent verification. Additional
checks cover strict fields, invalid JSON accounting, decision/call/token/cost
limits, and an approved write denied by Veil without execution or retry.

## Historical evidence

`docs/evidence/emergence-v0.3-first-trial/` contains byte-for-byte copies of
`/tmp/veil-trial-live-slug-wFd64y/journal/85b25b97-511f-4a84-b62f-a70d4d19fa71.json`
and its adjacent `report.md`. Treat these as immutable historical artifacts:
do not resume, rewrite, or replace them with corrected results. SHA256SUMS and
a hard-coded journal digest regression protect their identity. The source
files were left untouched. This is integrity checking in version control,
not a filesystem WORM guarantee.

Goals, seeds, acceptance criteria, deterministic baseline source, and Experiment
005 frozen artifacts were not changed. The baseline was not rerun; its historical
results remain historical. Future runs can consume more decisions when their
proposals fail validation because recovery now uses the existing decision loop.
No paid model calls, push, deployment, publication, or release were performed.

## Verification and remaining limits

- `npx tsc --project tsconfig.test.json` and focused
  `node --test --test-isolation=none .tmp/test-build/test/emergence-*.test.js`:
  38 tests passed.
- `npm run check`: typecheck passed; regression passed 30/32 test files.
  `external-model-reasoner.test.js` and `external-reasoner.test.js` fail with
  child-process `EPERM` / unsettled top-level await. Running these two with
  `--test-isolation=none` exposed the same errors. These environment failures
  were already documented in the v0.3 trial preparation report.
- `npm run verify:package`: build passed; `tools/verify-package.mjs:24` fails
  with `SyntaxError: Unexpected end of JSON input` from empty nested npm output.
  A writable `/tmp` npm cache does not fix that nested-process failure.
  Direct `npm_config_cache=/tmp/veil-emergence-npm-cache npm pack --json --dry-run`
  passes; this does not substitute for full package consumer verification.
- `npm run quality -- --base 3b6c3d240572c249e55f375147bb11976790582f`:
  source +46 net lines, tests +165, harness unchanged, no dependency changes.
  Review-required test edits add assertions; the existing adapter assertion now
  parses unknown output with the shared validator. No assertion was removed.
  Five governance findings remain: two existing dynamic imports in demo.ts and
  three existing kernel helper calls. Comparison with the base confirms these
  sites predate this repair. No allowances or verification controls were changed.
- `git diff --check` and evidence SHA256SUMS pass.

A fully green regression/package gate still needs an environment supporting the
nested child-process checks. Mocked recovery proves the contract and governance
path, not real-model repair success. Cost reservation remains an estimate and
billing depends on reported usage and configured rates; a provider failure with
no usage metadata cannot establish an exact external invoice ceiling.
