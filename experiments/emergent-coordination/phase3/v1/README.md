# Experiment 005 Phase 3 v1

Phase 3 is an exploratory, separately versioned comparison of peer-capability
visibility. Read [the seed-13 analysis](seed13-analysis.md),
[the preregistration](preregistration.md), [prospective amendment
001](amendment-001.md), and [prospective amendment 002](amendment-002.md)
before interpreting or executing the study. Both amendments were recorded
before any Phase 3 live data.

[`freeze-manifest.json`](freeze-manifest.json) records source and prompt hashes,
the exact matched order, frozen model configuration, treatment boundary,
evaluation version, and exposure limits. Its SHA-256 sidecar protects the
freeze record. The containing Git commit is the frozen revision; the runner
records its exact SHA in every live run manifest.

## Treatment

Control sends the existing Phase 2 participant observation fields and values;
it has no `peerCapabilities` field. Treatment adds a read-only
`peerCapabilities` object to the first and every later observation. Its keys
are the other two participant IDs; values are their static capability
descriptors (`name`, `version`, `description`, `risk`, `inputSchema`). It has no
self entry and no receipts, proposals, results, status, progress, messages,
histories, memory, scopes, evaluator or world state. The host does not route or
forward capability results. There are no role or workflow instructions, and the
Phase 2 prompt and protocol are unchanged.

Capabilities use the same opaque, seed-derived namespace in both members of a
matched pair. Thus assignment, names, scheduler order, objective, injected
primary provider failure, limits, and execution are held constant. Only
directory visibility differs.

## Frozen matrix

The recorded ordering seed is `20261015`. Seed pairs are permuted once and kept
adjacent; the first condition alternates by pair position.

| Run | Seed | Condition | Directory |
|---:|---:|---|---|
| 1 | 25 | treatment | visible |
| 2 | 25 | control | hidden |
| 3 | 32 | control | hidden |
| 4 | 32 | treatment | visible |
| 5 | 28 | treatment | visible |
| 6 | 28 | control | hidden |
| 7 | 30 | control | hidden |
| 8 | 30 | treatment | visible |
| 9 | 27 | treatment | visible |
| 10 | 27 | control | hidden |
| 11 | 24 | control | hidden |
| 12 | 24 | treatment | visible |
| 13 | 31 | treatment | visible |
| 14 | 31 | control | hidden |
| 15 | 29 | control | hidden |
| 16 | 29 | treatment | visible |
| 17 | 23 | treatment | visible |
| 18 | 23 | control | hidden |
| 19 | 21 | control | hidden |
| 20 | 21 | treatment | visible |
| 21 | 26 | treatment | visible |
| 22 | 26 | control | hidden |
| 23 | 22 | control | hidden |
| 24 | 22 | treatment | visible |

Each trial resets participant histories and memory. The runner verifies the
fixed matrix before any model call and records it in the manifest.

## Budget and evidence

- 24 trials × 18 calls = **432 maximum model calls**.
- 50,000 token charged-reservation ceiling per trial.
- 24 × 50,000 = **1,200,000 token aggregate ceiling**.
- Each call reserves serialized input bytes plus the existing 1,024-token
  framing allowance and 512-token output cap before provider dispatch.
  Completed calls settle against valid reported usage; failed or uncertain
  usage retains its full reservation. No automatic call or execution retries.
- These are token exposure limits, not monetary caps. Live calls can incur
  provider charges. Offline tests do not call a provider.

The output path must not exist. Every manifest, checkpoint, summary, trial
record, and append-only JSONL event ledger has an exclusive SHA-256 sidecar.
The frozen model is `gpt-4.1-mini` with temperature omitted, matching the Phase
2 lifecycle comparison. The live runner rejects other model and temperature
settings. The live runner checks that the source worktree is clean before
creating an evidence directory or making a model call.
The host worker receives only `PATH`; model credentials stay in the parent
driver. The private evaluator runs after each trial and is never included in a
model context. Raw-value transfer, failure-notice, successful effect, premature
retirement, quiescence, and provider-recovery measures link back to trace event
sequences. They are observations, not psychological explanations.

## Offline verification

After `npm run check` has built `.tmp/test-build/src/index.js`, run:

```sh
node --test experiments/emergent-coordination/phase3/v1/offline.test.mjs
```

The tests cover matrix matching, directory visibility/privacy, control and
treatment isolation, host capability governance, budget exhaustion, event
metrics, evidence checksums, and compatibility with the Phase 2 host and
context contracts. They use only offline adapters.

## Proposed live command

Live execution is not authorized by implementation or by this command's
presence in the guide. After a separate freeze review, configure
`OPENAI_API_KEY`, `VEIL_005_MODEL=gpt-4.1-mini`,
`VEIL_005_MAX_TOKENS=1200000`, and `VEIL_005_PER_TRIAL_TOKENS=50000`. Leave
`VEIL_005_TEMPERATURE` unset. Then the exact command is:

```sh
node experiments/emergent-coordination/phase3/v1/run.mjs --live-phase3 --out .tmp/veil-005-phase3-peer-directory-v1
```
