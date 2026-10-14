# Experiment 005 offline harness

Read [research-spec.md](research-spec.md) and [protocol.md](protocol.md) before
interpreting any result. The harness runs three separate scripted policy
instances against a V2-only Veil host. The policy encodes coordination; its
success is an infrastructure check, not evidence of emergence.

From the repository root, with Node 24 and installed dependencies:

```sh
npx tsc --project tsconfig.test.json
node --test --test-isolation=none experiments/emergent-coordination/harness.test.mjs
VEIL_EXPERIMENT_GIT_DIRTY=true node experiments/emergent-coordination/run.mjs --out experiments/emergent-coordination/evidence/NEW_RUN
```

`--test-isolation=none` is required because the runtime's SQLite log sink uses
a relative path and this experiment moves each sequential trial into a
temporary working directory. The runner refuses an existing output directory.
Set `VEIL_EXPERIMENT_GIT_DIRTY` to the result of your separate `git status`
check (`true` or `false`); source SHA-256 hashes and HEAD are recorded in the
manifest. A missing value is recorded as `not-recorded`.

The output directory contains a manifest, one JSONL ledger and one complete
JSON record per trial, and an aggregate summary. A governance violation stops
the matrix after retaining that trial. There is no network access or model
provider call. See [results.md](results.md) for the first offline run.
