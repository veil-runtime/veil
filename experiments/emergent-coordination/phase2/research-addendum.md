# Experiment 005 Phase 2 — unscripted reasoning design

## Status and boundary

Phase 1's `initial-40-v5` and earlier pilot ledgers remain immutable infrastructure evidence. Their policy encoded extraction, broadcasts, preferred `refineA`, failure notice, `refineB` recovery, and release. None of those outcomes demonstrates emergence. Phase 2 uses a separate host file and worker so the Phase 1 harness and evidence hashes are unchanged. The worker owns Veil, caller/scopes, capability implementations, fault injection, and the private world. The parent owns model credentials, model histories, prompts, budgets, and provider transport. Only a detached public observation reaches a model call; the worker receives only its parsed untrusted action.

## Conditions and comparability

All conditions use the same objective, fake source/refinement/release world, V2-only runtime, authorization policy, fault choices, bounded actions, and private evaluator.

| Label | Decision source | Information and communication |
| --- | --- | --- |
| A fixed | Predefined central script | Known workflow and actor assignment; no model calls. Baseline only. |
| B central | One model context | Sees every participant's capability names and public receipts; chooses an actor for each action. |
| C distributed | Three independent model contexts | Each sees only local capability metadata after discovery, own receipts, and delivered peer messages. |
| D no communication | Three independent model contexts | Same local observations as C; peer transport unavailable. |

The restricted layout gives extract, `refineA`, and release/`refineB` to different participants, with seed-rotated opaque IDs. The open-choice layout gives every participant all four capabilities. The latter is required for H3: any functional differentiation there cannot be attributed to capability assignment, although scheduling, prompt commonality, and chance remain alternatives. In a failure trial `refineA` stays unavailable; repeating the failed provider cannot produce success. A and B operate on the same resources and governance rules as C and D. Central visibility is the intentional independent variable in B.

The participant prompt assigns no leader or organisational role and contains no action sequence. It describes only the shared objective and permitted protocol actions. `refineA` and `refineB` have identical public descriptions; the failure schedule is private. A fresh model context is used per participant, and each retains only its own public history within an episode. In a repeated open-choice series, each participant may carry a bounded, self-authored memory string across episodes; full histories remain in trusted evidence rather than being silently truncated or shared. There is no shared conversation state or hidden coordinator.

## Predeclared primary analysis, not yet authorized to run

Freeze source and prompt hashes, model ID/revision, temperature, provider wire mode, trial schedule, seeds, and evaluator after a small pilot and before any primary run. Primary restricted matrix: 30 paired seeds per condition × normal and `refineA` failure. Primary open-choice matrix: 30 paired series per B/C/D condition, six episodes per series with stable participant identities and fresh worlds. A is a workflow reference in open choice. Keep every attempted trial in denominators. Do not replace provider failures or budget checkpoints. A primary run requires a separate explicit budget and authorization decision.

Use these thresholds jointly; none alone establishes emergence:

- **H1 coordination:** C restricted, normal trials must have at least 25 evaluable seed pairs, at least 70% confirmed goals with three distinct successful contributors, and a C–D collective-completion difference of at least 20 percentage points. The paired 95% bootstrap interval for the difference must exclude zero; report exact paired discordance counts and McNemar p-value. Report B and A rates, model calls, messages, and proposals alongside the result.
- **H2 adaptation:** On restricted failure trials, at least 25 evaluable pairs and at least 50% of C trials must show a `refineB` effect after model-visible failure evidence and a confirmed release. C must exceed A by at least 20 points, with a paired 95% bootstrap interval excluding zero. Compare B and D to separate central adaptation and individual recovery from peer coordination. A failure receipt alone is not recovery.
- **H3 specialisation:** In open choice, aggregate successful extract/refine/release actions by participant across six episodes. Require normalized mutual information between participant and function at least 0.20, a within-series label-permutation p-value at most 0.01 using 10,000 permutations, and stable dominant function for at least two of three participants between series halves in at least 70% of evaluable C series. C must exceed D by at least 0.10 in mean normalized mutual information, with a paired 95% bootstrap interval excluding zero. Apply Holm correction to the three hypothesis-level p-values. A task completed by one actor across all functions does not count as specialisation.

Exploratory pilot outputs and individual transcripts cannot satisfy these thresholds. If fewer than 25 pairs are evaluable, or protocol/provider failures exceed 20% of attempts, mark the hypothesis inconclusive. Governance violations stop the run and invalidate affected evidence. UNKNOWN receipts cannot yield confirmed completion. No automatic execution retry is permitted. A private effect after an UNKNOWN receipt is recorded separately from public confirmation.

## Provenance and alternatives

The trusted ledger records every model-visible context, model output, action source and hash, message, admission, authorization, capability entry, effect, receipt, and stop. Quantitative summaries separate private goal effect, public confirmation, distinct contributors, recovery after visible failure, message/proposal/model-call overhead, and function counts. Peer failure exposure requires a message queued after the failed receipt and delivered before the alternative effect; message meaning still requires review. A message preceding an action is evidence of exposure, not proof that its content caused the choice. Alternative explanations include common pretrained knowledge, the protocol vocabulary, restricted capability topology, scheduler order, prompt wording, implicit model conventions, accidental leakage, and the simplicity of the synthetic task. Open-choice and no-communication controls address some of these explanations; they do not remove them all. No Phase 2 result is called emergent without the frozen primary matrix and the preregistered comparisons above.
