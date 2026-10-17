# Veil Experiment 005 — Phase 3 v1.2 findings 001

**Evidence:** `.tmp/veil-005-phase3-v1.2-replacement-001/`  
**Frozen source:** `529cf503998285a3a95a3a5b1bf49f026356afad`  
**Full analysis:** [post-run analysis 001](./veil-experiment-005-phase3-v1.2-analysis-001.md)

## Verified evidence

- All 24 trial JSON records, 24 JSONL ledgers, 25 checkpoints, manifest, and
  summary have matching SHA-256 sidecars (75/75).
- All 42 frozen source hashes match; HEAD equals the manifest's source commit.
- Summary evaluations, call counts, stop reasons, and event-derived outcome
  counts agree with their underlying trial records.
- Governance was contained in all trials. There were zero protocol-validation
  events, one authorization denial, and three `UNKNOWN_CAPABILITY` admission
  rejections; no denied/rejected operation entered a capability.
- The 362 provider response usage records sum to 701,806 reported tokens, equal
  to the summary's settled usage. Recorded reservations total 3,471,525 tokens.

## Main findings

| Measure | Control | Treatment |
|---|---:|---:|
| Shared objective completed | 4/12 | 1/12 |
| Trials with exact raw-value transfer | 7/12 | 4/12 |
| Exact raw-value transfer events | 14 | 6 |
| Successful extractions | 12/12 | 5/12 |
| Successful alternative refinements | 5/12 | 4/12 |
| Successful releases | 4/12 | 1/12 |
| Messages attempted | 31 | 76 |
| Message envelopes delivered | 50 | 76 |
| Model calls | 171 | 191 |
| Premature retirement | 7/12 | 0/12 |
| Call-limit stop | 5/12 | 7/12 |
| Quiescent stop | 7/12 | 5/12 |

Treatment generated substantially more communication, while producing fewer
exact transfers, extractions, releases, and shared-objective completions. All
five successful trials required an exact raw-value message and an alternative
refinement after the primary capability failed. The successful path appeared
in four control trials and one treatment trial. None met the evaluator's
three-contributor collective-completion or emergence criteria.

Treatment's first action was `discover` in 9 trials and `send` in 3; none began
with execution. Control also began each trial with `discover`, which was needed
to learn the actor's own descriptor. The three treatment first-action sends
requested the raw value; one was p1 asking p0 to extract even though p1's own
observation listed `extract` as available. Six treatment trials made no
extraction proposal, one extraction proposal was rejected as
`UNKNOWN_CAPABILITY`, and five extracted successfully. Four treatment actions
rediscovered a descriptor already present in that participant's observation.
Treatment also made 60 wait actions and submitted 22 proposals,
compared with control's 35 waits and 57 submissions. Seven treatment trials
reached the 18-call limit; four produced some effect, but none released the
objective.

The hypothesis that static peer-capability visibility improves coordination
is **not supported as a positive general claim by this run**. The communication
volume rose, but useful information transfer and downstream task success fell.
The exact paired completion comparison is exploratory (4 control-only versus
1 treatment-only success; two-sided McNemar p=0.375). The extraction and
premature-retirement comparisons are also exploratory and should not be
interpreted causally. Broader effects remain unresolved.

## Recommended next hypothesis

Test the **directory-to-action gap**: static peer capability visibility may
increase requests and waiting without increasing execution. Keep spontaneous
participant choices available, avoid assigning roles or adding a coordinator,
and isolate directory visibility as the manipulated factor. The full analysis
lists two other distinct candidate hypotheses: clearer value-transfer language
and a larger action budget.

## Evidence references and limits

See the run `manifest.json`, `summary.json`, and all `phase3-*.json` and
`phase3-*.jsonl` files with their sidecars in the evidence directory. The full
analysis gives successful-trial event sequences, every paired difference,
descriptive intervals, failure mechanisms, and methodological limitations.
This is a 12-pair exploratory study using one model configuration, one task,
and no provider seed. It provides no causal certainty or access to hidden model
reasoning.

**PHASE 3 v1.2 ANALYSIS COMPLETE — AWAITING RESEARCH DECISION**
