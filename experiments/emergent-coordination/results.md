# Initial offline evidence — scripted baseline

The current checkpoint is [initial-40-v5](evidence/initial-40-v5/summary.json):
40 deterministic trials, five seeds per cell. All participant policies were
identical instances of a programmed workflow and recovery rule.

| Condition | Normal confirmed | Primary failure confirmed | Other observation |
| --- | ---: | ---: | --- |
| A fixed central | 5/5 | 0/5 | Stops after failed primary provider. |
| B adaptive central | 5/5 | 5/5 | Central script selects alternative capability. |
| C scripted distributed | 5/5 | 5/5 | Failure message precedes alternative proposal in all five failure trials. |
| C without messages | 0/5 | — | No release effect in five trials. |
| C with lost release receipt | — | — | Five private release effects, zero confirmed completions, five `UNKNOWN` receipts. |

All 40 trials had zero evaluator-detected governance violations. The focused
offline tests additionally exercised denied cross-participant capability use,
forged caller/scopes, and V1 submission to a V2-only host. They observed no
effect for the denied proposal and no authorization or entry for V1 rejection.
These are observed cases, not a general security proof.

The first run exposed a scheduler quiescence error: seeds 1 and 5 of C with
primary failure stopped after repeated idle turns from two participants,
before the third could release. The rule now requires an idle turn from each
participant. The next pilot run exposed that its capability namespace encoded
the fault label; the namespace is now opaque. The third run preceded the
current evaluator's stronger message provenance check. The fourth still used
public names that suggested a preferred provider and fallback. All four pilot
directories are retained in `evidence/` and excluded from the current result.

The private evaluator separates task effect, public confirmation, failure
recovery, message provenance, governance, and functional action counts.
The present capability distribution and scripted policy prescribe functional
behavior. Therefore these results establish **infrastructure correctness only**;
they provide no evidence that H1, H2, or H3 emerge from independent reasoning.
The next research step is to freeze an unscripted participant policy and an
open-choice H3 control before any primary trials. In-process policies are not
process-isolated, and five seeds are too few for statistical conclusions.
