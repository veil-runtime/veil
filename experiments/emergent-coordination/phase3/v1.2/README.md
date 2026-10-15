# Experiment 005 Phase 3 v1.2 — recipient clarification replacement

Status: **prospective design prepared; freeze and live execution await review.**

v1.2 is a separately versioned replacement for the incomplete v1.1 study. It
keeps the research question, hypotheses, treatment and control, seeds, order,
model settings, task, private state, capabilities, injected failure, evaluator,
call limit, exposure ceilings, governance boundaries, and immediate
protocol-abort behaviour. Its only intended model-visible change is one shared
recipient-rule sentence in the effective action protocol. The rule is shown to
all participants in both conditions. The host's recipient validation is reused
unchanged.

The v1.1 run stopped after six completed trials and three complete matched
pairs. Seven trial records were attempted, including the protocol-aborted seed
30 control. The checkpoint, ledgers, summaries, manifests, and checksums remain
in `.tmp/veil-005-phase3-v1.1-replacement-001/`; their verified inventory and
digests are recorded in [`preserved-evidence.json`](./preserved-evidence.json).
All v1.1 outcomes are excluded from v1.2 trial counts and analyses. The new
run must use its own exclusive evidence directory.

The exact protocol addition and the effective-context comparison are recorded
in [`action-protocol.md`](./action-protocol.md) and
[`context-comparison.md`](./context-comparison.md). The prospective study
amendment is in [`preregistration.md`](./preregistration.md). The versioned
freeze manifest hashes this design and its runner.

## Offline verification

Run the new v1.2 suite and the preserved Phase 2 and Phase 3 offline suites:

```sh
node --test experiments/emergent-coordination/phase3/v1.2/offline.test.mjs \
  experiments/emergent-coordination/phase3/v1/offline.test.mjs \
  experiments/emergent-coordination/phase3/v1.1/offline.test.mjs \
  experiments/emergent-coordination/phase2/offline.test.mjs \
  experiments/emergent-coordination/phase2/smoke.test.mjs \
  experiments/emergent-coordination/phase2/extended-smoke.test.mjs \
  experiments/emergent-coordination/phase2/comparison/offline.test.mjs
```

## Proposed live command

This command is shown for review only. Do not run it without separate live
authorization; it makes paid provider calls.

```sh
VEIL_005_MODEL=gpt-4.1-mini \
VEIL_005_MAX_TOKENS=10800000 \
VEIL_005_PER_TRIAL_TOKENS=450000 \
node experiments/emergent-coordination/phase3/v1.2/run.mjs \
  --live-phase3 --out .tmp/veil-005-phase3-v1.2-replacement-001
```

The output directory must not already exist, and the live runner requires a
clean source worktree. Token ceilings limit charged token exposure, not money.
