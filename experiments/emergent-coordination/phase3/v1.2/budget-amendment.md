# Phase 3 v1.2 exposure ceilings

v1.2 inherits the frozen v1.1 exposure limits and reservation method without
change:

- 18 model calls per trial; 432 maximum across 24 trials.
- 450,000 charged-reservation tokens per trial.
- 10,800,000 charged-reservation tokens aggregate.
- 24,000 input-bound tokens, 512 output allowance, and 1,024 framing tokens
  per reservation under the existing serialized-byte reservation method.
- No retries; failed, missing, or uncertain usage retains the full reservation.

At the maximum input bound, one reservation is at most 24,512 tokens and 18
reservations total 441,216 tokens, leaving 8,784 tokens under the per-trial
ceiling. Aggregate exposure is 24 times that ceiling. These are token
exposure ceilings, not monetary caps. The v1.1 derivation remains in its
[`budget-amendment.md`](../v1.1/budget-amendment.md).
