# Experiment 005 Phase 3 v1.1 — budget-amended replacement study

Status: **Frozen replacement design; live execution is not authorized.**

This replacement preserves the v1 question, hypotheses, treatment/control,
matched seeds and ordering, model, prompts, evaluation criteria, failure
injection, and governance boundaries. It changes only the per-trial and
aggregate exposure ceilings and the study/evidence version identifiers.

The amendment was designed after observing the incomplete seed-25 treatment in
`.tmp/veil-005-phase3-v1-budget-limited-archive`. The replacement is therefore
not independent of that observation. The archived trace is excluded from
replacement matched outcomes and trial counts.

The interrupted study and its checksum-verified archive are preserved locally
under ignored `.tmp/` storage. That archive is temporary local preservation,
not committed research evidence; it remains outside the staged and committed
files. The v1.1 design, amendment, runner, tests, and freeze manifest are the
committed research record. A live run must write new evidence to its own
exclusive output directory.

## Budget

- Maximum 18 model calls per trial; maximum 432 across 24 trials.
- Per-trial charged-reservation ceiling: **450,000 tokens**.
- Aggregate charged-reservation ceiling: **10,800,000 tokens**.
- The unchanged reservation formula is serialized UTF-8 input bytes plus
  1,024 framing tokens plus a 512-token output allowance, reserved before
  provider dispatch. Valid usage settles to reported input plus output;
  missing, failed, or uncertain usage retains the full reservation.
- The existing 24,000-token context bound limits one reservation to 24,512
  tokens, so 18 fully held reservations require at most 441,216 tokens. The
  450,000 ceiling leaves 8,784 tokens of margin. The aggregate ceiling is 24
  times the trial ceiling; it is a token exposure ceiling, not a monetary cap.

The derivation and observed-versus-extrapolated evidence are in
[`budget-amendment.md`](./budget-amendment.md). The complete v1 protocol is
preserved in [`preregistration.md`](./preregistration.md), followed by the v1.1
prospective amendment.

## Verification and execution

Offline verification uses `node --test` on this directory's `offline.test.mjs`
and the frozen v1 `offline.test.mjs`. The v1.1 test exercises the new runner
without a provider. Historical compatibility remains covered by the v1 test.

The live runner uses the v1 model driver, host worker, host, and evaluator
without changes. It requires the same frozen model and omitted temperature,
rejects any per-trial or aggregate ceiling other than this amendment, requires a
clean source worktree, and requires a new exclusive output directory.

After separate live authorization and with a clean committed source tree, the
replacement command is:

```sh
VEIL_005_MODEL=gpt-4.1-mini \
VEIL_005_MAX_TOKENS=10800000 \
VEIL_005_PER_TRIAL_TOKENS=450000 \
node experiments/emergent-coordination/phase3/v1.1/run.mjs \
  --live-phase3 --out .tmp/veil-005-phase3-v1.1-replacement-001
```

Do not execute this command as part of research-design review. It makes paid
provider calls.
