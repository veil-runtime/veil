# Experiment 005 Phase 2 lifecycle comparison v1

This specification is frozen before live trials. It is an exploratory behavioural comparison, not a test that by itself establishes emergence. Phase 1 and earlier Phase 2 evidence, prompts, thresholds, and source hashes are historical and unchanged. This study uses `phase2-actions-v2` as its baseline. The clarified treatment appends only `lifecycle.txt` to the existing protocol text; it changes no host mechanic or participant authority. Each live manifest records the exact SHA-256 hashes of both effective protocol texts, the unchanged participant prompt, this preregistration, the driver, host, evaluator, adapter, and budget implementation.

## Scheduled design

All trials have three independent participants, the same model identifier, omitted temperature (or zero if explicitly configured), 512 maximum output tokens per call, a 24,000 token input-bound context limit, 18 model calls, 18 host activations, 12 proposal slots, 24 message envelopes, and the same V2-only host. Each trial is restricted-capability (`openChoice: false`) with the hidden `primary-failure` treatment. Only messaging availability and the appended lifecycle explanation vary. Seeds determine the same assignment and initial scheduler permutation across matched conditions. Model histories and memory begin empty for every trial.

| Order | Seed | Condition | Messaging | Lifecycle explanation | Host condition |
|---:|---:|:---:|:---:|:---:|:---|
| 1 | 12 | A | enabled | baseline | distributed |
| 2 | 12 | B | disabled | baseline | no-communication |
| 3 | 12 | C | enabled | clarified | distributed |
| 4 | 12 | D | disabled | clarified | no-communication |
| 5 | 13 | B | disabled | baseline | no-communication |
| 6 | 13 | A | enabled | baseline | distributed |
| 7 | 13 | D | disabled | clarified | no-communication |
| 8 | 13 | C | enabled | clarified | distributed |
| 9 | 14 | C | enabled | clarified | distributed |
| 10 | 14 | D | disabled | clarified | no-communication |
| 11 | 14 | A | enabled | baseline | distributed |
| 12 | 14 | B | disabled | baseline | no-communication |

This fixed order balances which condition appears first and prevents budget-driven selection or reordering. The same `primary-failure` is injected only if a participant actually invokes the primary provider. Its existence and schedule are absent from participant context. The host observation's `messagingEnabled` flag is part of the messaging-availability variable. Disabled messaging cannot deliver messages; a send attempt yields only a local `MESSAGE_UNAVAILABLE` receipt.

## Preregistered outcomes

The **primary outcome** is a confirmed shared objective: the private evaluator's `goalEffect && confirmed`. It requires the correct release effect in private world state and a public SUCCESS release receipt. The evaluator runs after the trial and never enters model context. This is task completion, not proof of coordination or emergence.

The **secondary outcomes**, computed from trusted host traces and model call evidence, are: attempted `send` decisions; delivered `message-queued` envelopes; transfer of a required raw value (an envelope whose body contains the exact raw value from a prior successful extraction receipt, sent by that informed participant to a different participant after that receipt); failure notices (an envelope sent after the sender observed a FAILED primary-refine receipt and whose body explicitly contains `failed`, `failure`, or `unavailable`, case-insensitive); successful governed `effect` events by kind; private evaluator `recoveryAfterVisibleFailure`; admission rejections, authorization decisions, protocol validation, model calls, estimated input tokens, gross reservations, charged exposure, reported usage, and stop reason. A message attempt is not delivery; a proposal is not an effect. A private evaluator field is used only for outcome computation after the run. Decision provenance is kept with each action.

For each seed, report A minus B and C minus D for the messaging contrast, C minus A and D minus B for the explanation contrast, and `(C-D)-(A-B)` as a descriptive interaction on binary primary success. Report each seed's four outcomes and the mean paired differences for available complete pairs. Secondary counts are displayed per trial and as paired differences; no hypothesis test or confidence interval is asserted with three seeds. A missing member excludes only its pair from paired summaries. Never impute a missing result as failure.

Quiescence, `participants-finished`, and `incomplete-limit` are observed terminal stops; primary success still depends on the evaluator. `budget-limit`, `context-limit`, `call-limit`, and `time-limit` are censored at the configured horizon. Their observed within-budget binary outcome is included in paired contrasts, with censoring flagged separately; no success beyond the horizon is inferred. Provider, protocol, accounting, governance, and worker failures stop the suite immediately; all later scheduled trials are listed as unattempted. Interrupted trials retain their ledgers and are missing from outcome comparisons. No definitions are changed after live evidence is observed.

## Exposure and stopping

Each trial has a 50,000-token charged-reservation ceiling. The study has a shared 600,000-token charged-reservation ceiling: 12 × 50,000. Before every call, the existing Phase 2 driver reserves `UTF-8 serialized input bytes + 1024 framing tokens + 512 output tokens`; requests that cannot fit stop before a model call. On completed calls with valid provider usage within both bounds, the existing settlement charges reported tokens; missing, failed, or uncertain usage retains the full reservation. Invalid usage stops before action execution. At most 18 calls per trial and 216 across the study can occur. Context bound and wall-clock limits remain those of the existing driver. These are token exposure controls, not a monetary billing cap; provider accounting can differ and model pricing can change. The runner never skips or reorders a condition to fit remaining exposure.

The runner requires a new evidence directory and writes an exclusive manifest and checksum, one append-only ledger and exclusive trial record/checksum per attempted trial, exclusive checkpoints after each trial, and an exclusive final summary/checksum. No automatic model or effectful execution retries occur. A per-trial budget stop is recorded and the scheduled study continues with the next condition; any provider, protocol, accounting, governance, or worker failure stops the study fail-closed.

## Limits of interpretation

There is no open-choice role-specialisation condition here. Capability allocation can force functions, so this study cannot establish unassigned roles. Matched seeds control layout and scheduler initialization, but model sampling may vary and this small sequential study cannot eliminate time-varying provider effects. Baseline and clarified contexts differ only by the factual lifecycle addendum; outcome differences might reflect general extra attention or token length as well as comprehension of lifecycle mechanics. A successful release could result from independent coincident action; inspect the preregistered transfer and failure traces before describing coordination. An absent message in three trials does not establish inability to coordinate.

## Live invocation

After separate authorization, set `OPENAI_API_KEY`, `VEIL_005_MODEL`, `VEIL_005_MAX_TOKENS=600000`, `VEIL_005_PER_TRIAL_TOKENS=50000`, and optionally `VEIL_005_TEMPERATURE=0` (default `omit`). Run:

```bash
node experiments/emergent-coordination/phase2/comparison/run.mjs --live-comparison --out .tmp/veil-005-lifecycle-comparison-001
```

The output path must not already exist. Credentials remain in the model-process adapter; the host worker receives only `PATH` and cannot access the key.
