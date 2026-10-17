# Veil Experiment 005 — Phase 4 v1 candidate

This directory contains a separately versioned implementation candidate for
the reviewed 96-trial mechanism-discrimination study. It is not frozen for
live execution. It makes no model calls unless invoked with the explicit
`--live-phase4` flag and valid frozen environment configuration.

The four conditions and 24 seed-block orders are in `run.mjs`. The exact P18
neutral notes are in `neutral-bank.json`; its SHA-256 is in the adjacent
sidecar. `preregistration.md` records implementation details and known
clarifications. The local `js-tiktoken` dependency is pinned only for exact
offline `o200k_base` accounting. It does not alter root dependencies.

The live runner refuses to start without a clean source tree, verified source
and bank hashes, the frozen model and aggregate/trial ceilings, and a new
exclusive output directory. It writes a manifest, per-trial event ledger and
checksum, trial record and checksum, checkpoint and checksum, and final
summary and checksum. A fatal governance, protocol, provider, accounting, or
integrity error stops subsequent trials and preserves partial evidence.

Offline tests (after `npm run build`) can be run with:

```sh
node --test experiments/emergent-coordination/phase4/v1/offline.test.mjs
```

The freeze-manifest generation command is offline:

```sh
node experiments/emergent-coordination/phase4/v1/run.mjs --write-freeze-manifest
```

The proposed live command, which has not been run, is:

```sh
VEIL_005_MODEL=gpt-4.1-mini \
VEIL_005_MAX_TOKENS=50000000 \
VEIL_005_PER_TRIAL_TOKENS=700000 \
node experiments/emergent-coordination/phase4/v1/run.mjs \
  --live-phase4 --out .tmp/veil-005-phase4-v1-run-001
```
