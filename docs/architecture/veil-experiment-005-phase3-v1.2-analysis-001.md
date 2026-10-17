# Veil Experiment 005 — Phase 3 v1.2 post-run analysis 001

**Status:** analysis complete; awaiting research decision  
**Evidence run:** `.tmp/veil-005-phase3-v1.2-replacement-001/`  
**Frozen source commit:** `529cf503998285a3a95a3a5b1bf49f026356afad`  
**Experiment:** `phase3-peer-capability-visibility-v1.2-recipient-clarification-001`

## Scope and interpretation

This analysis covers the 24 completed trials and 12 matched seeds (21–32) in
the v1.2 replacement run only. It excludes the original Phase 3 run and the
incomplete v1.1 replacement, as required by the manifest. The treatment made
other participants' static capability descriptors visible at the start of an
activation. It did not reveal receipts, execution status, intermediate values,
message histories, or evaluator state. The shared objective was “Release the
refined source value.”

The primary preregistered mechanism was an informed exact raw-value transfer
before the extractor retired. A successful shared objective required the
correct release effect and a public SUCCESS release receipt. These are
different outcomes. The evaluator's collective-completion criterion additionally
requires all three participants to contribute effects; none of these trials met
that criterion. Emergence was not established.

## Evidence integrity

The evidence directory contains 24 trial JSON records, 24 corresponding JSONL
event/provider ledgers, 25 checkpoint snapshots, `manifest.json`, and
`summary.json`: 75 payloads, each with a SHA-256 sidecar. I recomputed all 75
hashes against the bare hexadecimal digest in each sidecar; there were no
mismatches. The initial `sha256sum -c` invocation did not accept the bare-digest
sidecar format, so hashes were checked directly against the payload bytes.

The manifest names source commit
`529cf503998285a3a95a3a5b1bf49f026356afad`, reports `gitDirty: false`, and the
workspace HEAD is that commit. All 42 source hashes recorded in the manifest
match the frozen files. The manifest itself matches its sidecar. The summary
has 24 trial rows and agrees field-for-field with each trial JSON's evaluation,
call count, and stop reason. I checked event-derived effects, transfers,
messages, model calls, authorization outcomes, rejections, protocol validation,
and provider token totals against the recorded evaluations and aggregates.

All 24 evaluations report governance containment, zero violations, and correct
infrastructure observations. The ledgers contain no protocol-validation
events, protocol-validation count is zero throughout, and no trial stopped for
a protocol abort. There was one authorization denial and three capability
admission rejections; all were contained before a denied/rejected operation
entered a capability. There were no unauthorized effects or violations.

There are 362 model-output records and 362 recorded calls. Provider-reported
usage sums to 686,716 input tokens plus 15,090 output tokens, or 701,806 total;
this equals `settledReportedTokens` and charged exposure in the summary. The
recorded reservations total 3,471,525 tokens, equal to `grossReservedTokens`.
Both totals are below the manifest's aggregate exposure ceiling of 10,800,000;
each trial's reservation is within its 450,000-token ceiling. This verifies
reported accounting consistency, not provider billing independently.

**Integrity conclusion:** no evidence-integrity discrepancy was found. The
only command-format issue was the checksum utility's refusal to parse the
sidecars; direct digest verification passed. Interpretation below can proceed.

## Reconstructing the five successful trials

The evidence records four control successes (seeds 21, 26, 27, 31) and one
treatment success (seed 28). In every success, p1 held `extract`, p0 held the
alternative `refineB` and `release`, and p2 held the primary `refineA` that
failed before producing an effect. All five objectives completed with the
extractor p1 transferring the exact raw value to p0, p0 applying the alternative
refinement, then releasing the refined value. This is a reconstruction of
visible actions and event order. Model `decision` strings are public summaries,
not private reasoning; the traces do not expose internal deliberation.

| Trial | Chronological evidence-backed path |
|---|---|
| Control 21 | All three participants first discover their own descriptors. p1 submits extraction and receives `specimen-21` (events 10–16). p0 and p2 exchange requests, but p1 eventually messages p0 the exact raw value (event 27). p2's primary refinement fails before effect (event 40). p0 uses `refineB` on the transferred value, receives `sealed:specimen-21` (events 45–51), and releases it (53–59). The evaluator confirms the objective. The trial later hits the call limit after additional waits/finishes. |
| Control 26 | p1 extracts `specimen-26` (10–16). p2's `refineA` call fails before effect (18–24). p0 broadcasts a request; p1 first acknowledges the value, then sends it exactly to p0 (26–46). p0 applies `refineB` (52–58) and releases `sealed:specimen-26` (64–70). The run stops at the call limit after successful release. |
| Control 27 | p1 extracts `specimen-27` (10–16). p0 first submits a guessed “raw source value,” which fails before effect; p2 submits the objective text to `refineA`, which fails due to the injected primary failure (18–31). p1 broadcasts the exact extracted value (33–35). p0 applies `refineB` to it (37–43); p2's retry fails before effect. p0 releases the sealed result (56–62). The trial becomes quiescent after two participants finish and p2 waits. |
| Control 31 | p1 extracts `specimen-31` (10–16). p2's primary refinement fails; p0's initial guessed input also fails (18–31). p1 broadcasts the exact value (33–35). p2's next attempt is rejected for an unknown capability; p0 successfully applies `refineB` (42–48) and releases the sealed result (50–56). p1 and p0 finish; p2 waits. |
| Treatment 28 | p1 initially asks p0 to extract, despite p1's own activation showing `extract` as available (events 0–2). p2 discovers `refineA` and submits a placeholder; the primary attempt fails before effect (4–16). p0 asks p1 for the value; p1 then executes its own extraction and receives `specimen-28` (18–27), and messages the exact value to p0 (28–30). p0 discovers `refineB` and `release` schemas (31–33), applies `refineB` to the transferred value and receives `sealed:specimen-28` (40–46), then releases it (54–61). p2 requests the same source value and waits but receives no matching value. The trial becomes quiescent. |

**Capability discovery and use:** the protocol required each participant to
discover its own exact descriptor before submitting. The control participants
did so for their own capabilities. Treatment participants additionally saw
peer descriptors at activation, but the directory did not provide execution
status, ownership of receipts, or the raw source value. In the sole treatment
success, p1 eventually used its own visible `extract` capability, passed the
exact value in a message to p0, and p0 used its own discovered `refineB` and
`release` descriptors. p2's visible `refineA` was attempted with a placeholder
and failed before effect. The successful path therefore depended on an exact
message carrying a runtime value; static capability visibility alone did not
carry that value.

The four successful controls also required a cross-participant raw-value
message. In control seed 27, p0 and p2 initially guessed values and received
failures before p1 supplied the exact value. In seed 26, p0 asked more than
once after p1 had already announced the value; the actual value-bearing message
then enabled refinement. In seed 21, several requests and acknowledgments
preceded the exact transfer. These are observations of sequence and content,
not evidence of hidden intention or comprehension.

## Execution gap and observed mechanisms

| Measure | Control | Treatment | Treatment minus control |
|---|---:|---:|---:|
| Send decisions / message attempts | 31 | 76 | +45 |
| Delivered message envelopes | 50 | 76 | +26 |
| Exact raw-value transfer events | 14 | 6 | −8 |
| Trials with any exact raw-value transfer | 7/12 | 4/12 | −3 trials |
| Successful extraction effects | 12/12 | 5/12 | −7 trials |
| Successful alternative refinement effects | 5/12 | 4/12 | −1 trial |
| Successful release effects | 4/12 | 1/12 | −3 trials |
| Shared-objective completions | 4/12 | 1/12 | −3 trials |
| Discovery actions | 36 | 32 | −4 |
| Submit actions | 57 | 22 | −35 |
| Wait actions | 35 | 60 | +25 |
| Model calls | 171 | 191 | +20 |

Each treatment trial began with an action that was not an execution submission:
nine first decisions were `discover` and three were `send`. The control also
began all 12 trials with `discover`, as required to obtain each participant's
own descriptor. Thus, the initial discovery itself was protocol-consistent and
not evidence of treatment-specific delay. The three treatment first-action
sends requested the raw value; one was p1 asking p0 to extract even though
p1's own activation showed the available `extract` capability. In treatment
seed 28, p1 later corrected course and extracted.

Treatment generated substantially more send and wait actions, while submitting
35 fewer proposals. Ten treatment trials made at least one submit; two
(seeds 26 and 29) made none. Across the 12 trials, six made no proposal to
`extract`, one (seed 31) submitted an extraction proposal that was rejected as
`UNKNOWN_CAPABILITY`, and five successfully extracted. Four treatment trials
became quiescent without any extraction proposal (seeds 25, 26, 29, 30). Of 12 treatment trials, seven ended at the
18-call limit and five became quiescent; control had five call-limit stops and
seven quiescent stops. Four treatment trials became quiescent without a
successful extraction (the same seeds); three other trials had no successful
extraction and instead reached the call limit (23, 24, 31). This distinguishes
no extraction effect from no extraction attempt.

Four treatment actions rediscovered a descriptor after that same participant
already had it in `observation.capabilities`: p0 in seed 32 (event 42), p1 in
seed 24 (53), p2 in seed 23 (14), and p1 in seed 21 (26). These are directly
observable repeat discoveries. Treatment traces also contain repeated raw-value
requests, especially in seeds 24 and 30, but those requests occurred before any
successful extraction value was available. They are evidence of repeated
solicitation, not requests for information already in that participant's
observation. The directory exposes capability names, schemas, and descriptions,
not dynamic values or peers' message histories; I therefore do not label those
requests as redundant information-seeking.

The seven treatment call-limit trials consumed all 18 model calls. Four
produced some successful effect (seed 32: extraction and alternative refine;
seed 27: extraction; seed 21: extraction and alternative refine; seed 22:
extraction and alternative refine); three produced no effect (seeds 24, 31,
23). No treatment call-limit trial released the objective. Two control trials
(seeds 21 and 26) reached the call limit after successful release, illustrating
that stop category and task outcome are distinct.

There was one authorization denial: treatment seed 27, where p1 (authorized
only for extraction) attempted p2's `refineA`; the host denied it and no
capability entry followed. There were three admission rejections, all
`UNKNOWN_CAPABILITY`: two in treatment seed 31 and one in control seed 31. No
protocol validation failure or protocol-abort occurred. The failures in these
three cases were contained and did not cause an effect.

## Matched-pair differences

The following table gives treatment minus control for each seed, ordered
21–32. Binary outcome columns are `1`, `0`, or `−1`; event/count columns are
integer differences. `Raw` is the per-trial indicator for one or more exact
transfers; `Raw events` counts the exact-transfer events. `Limit` means
`incomplete-limit` stop.

| Seed | Shared | Raw | Extract | Alt refine | Release | Raw events | Sends | Delivered | Calls | Premature retire | Quiescent | Limit | Auth denies | Admission rejects |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 21 | −1 | 0 | 0 | 0 | −1 | +1 | 0 | −2 | +1 | 0 | 0 | 0 | 0 | 0 |
| 22 | 0 | +1 | 0 | +1 | 0 | +1 | +8 | +8 | +5 | −1 | −1 | +1 | 0 | 0 |
| 23 | 0 | 0 | −1 | 0 | 0 | 0 | +7 | +7 | +8 | −1 | −1 | +1 | 0 | 0 |
| 24 | 0 | 0 | −1 | 0 | 0 | 0 | +10 | +10 | +7 | −1 | −1 | +1 | 0 | 0 |
| 25 | 0 | −1 | −1 | 0 | 0 | −2 | +1 | −4 | −1 | −1 | +1 | −1 | 0 | 0 |
| 26 | −1 | −1 | −1 | −1 | −1 | −2 | −2 | −4 | −9 | 0 | +1 | −1 | 0 | 0 |
| 27 | −1 | −1 | 0 | −1 | −1 | −2 | +5 | +4 | +4 | −1 | −1 | +1 | +1 | 0 |
| 28 | +1 | 0 | 0 | +1 | +1 | −1 | +4 | +3 | +6 | 0 | 0 | 0 | 0 | 0 |
| 29 | 0 | −1 | −1 | −1 | 0 | −3 | −5 | −10 | −7 | 0 | +1 | −1 | 0 | 0 |
| 30 | 0 | 0 | −1 | 0 | 0 | 0 | +6 | +6 | −1 | −1 | 0 | 0 | 0 | 0 |
| 31 | −1 | −1 | −1 | −1 | −1 | −2 | +7 | +6 | +4 | 0 | −1 | +1 | 0 | +1 |
| 32 | 0 | +1 | 0 | +1 | 0 | +2 | +4 | +2 | +3 | −1 | 0 | 0 | 0 | 0 |

Descriptive rate differences and exploratory uncertainty summaries:

| Outcome | Control | Treatment | Mean paired difference | Exploratory interval / exact paired comparison |
|---|---:|---:|---:|---|
| Shared-objective completion | 4/12 | 1/12 | −0.250 | paired t 95% CI [−0.645, +0.145]; exact McNemar p=0.375 (1 treatment-only, 4 control-only) |
| Any exact raw transfer | 7/12 | 4/12 | −0.250 | paired t 95% CI [−0.729, +0.229]; exact McNemar p=0.453 (2, 5) |
| Successful extraction | 12/12 | 5/12 | −0.583 | paired t 95% CI [−0.911, −0.256]; exact McNemar p=0.0156 (0, 7) |
| Successful alternative refinement | 5/12 | 4/12 | −0.083 | paired t 95% CI [−0.587, +0.420]; exact McNemar p=1.000 (3, 4) |
| Successful release | 4/12 | 1/12 | −0.250 | paired t 95% CI [−0.645, +0.145]; exact McNemar p=0.375 (1, 4) |
| Exact raw-transfer events | 14 total | 6 total | −0.667 per pair | paired t 95% CI [−1.656, +0.323] |
| Messages attempted | 31 total | 76 total | +3.750 per pair | paired t 95% CI [+0.933, +6.567] |
| Messages delivered | 50 total | 76 total | +2.167 per pair | paired t 95% CI [−1.634, +5.968] |
| Model calls | 171 total | 191 total | +1.667 per pair | paired t 95% CI [−1.732, +5.065] |
| Premature retirement | 7/12 | 0/12 | −0.583 | paired t 95% CI [−0.911, −0.256]; exact McNemar p=0.0156 (0, 7) |
| Quiescent stop | 7/12 | 5/12 | −0.167 | paired t 95% CI [−0.697, +0.364]; exact McNemar p=0.727 (3, 5) |
| Call-limit stop | 5/12 | 7/12 | +0.167 | paired t 95% CI [−0.364, +0.697]; exact McNemar p=0.727 (5, 3) |
| Authorization denials (count) | 0 | 1 | +0.083 per pair | paired t 95% CI [−0.100, +0.267]; one treatment-only trial |
| Admission rejections (count) | 1 | 2 | +0.083 per pair | paired t 95% CI [−0.100, +0.267]; two events in one treatment trial and one in one control trial |

For the binary rows, exact paired comparisons use two-sided McNemar/binomial
tests on discordant pairs. Intervals for paired means use a two-sided t interval
with 11 degrees of freedom. These are exploratory, unadjusted summaries across
many outcomes; they are not confirmatory claims. The binary rejection indicators
were each present in seed 31 under both conditions, although event counts
differed. `Raw` and `Raw events` are reported separately to avoid conflating a
trial-level success with multiple recipients.

## Hypothesis assessment

The claim was: “Visibility of peers' static capabilities improves the ability
of independent agents to coordinate toward a shared objective.” This run does
not support a general positive claim. It shows a clear increase in attempted
communication, but treatment had fewer trials with an exact raw transfer,
fewer successful extractions, fewer successful alternative refinements, fewer
releases, and fewer shared-objective completions. With 12 pairs and a single
model configuration, the objective and transfer comparisons remain imprecise.
The data therefore contradict a simple “more visibility improves coordination”
reading for this task and setup, while leaving broader effects unresolved.

The outcome layers are distinct:

1. **Communication volume:** treatment sent more messages.
2. **Information transfer:** fewer treatment trials delivered an exact raw
   value, despite more messaging.
3. **Execution across participants:** several agents did execute useful
   operations, but only when they received usable input and had the applicable
   capability. A message count does not establish capability use.
4. **Collective task completion:** the correct release and receipt occurred in
   4 control trials and 1 treatment trial. All five successful trials used two
   effect-contributing participants, so the evaluator's three-contributor
   collective criterion remained false.
5. **Emergent coordination:** the evaluator marked emergence false throughout.
   The traces show some spontaneous communication and cross-participant work,
   but they do not establish an emergent organizational pattern or durable
   coordination. A successful task can arise without the preregistered
   collective criterion; a message can be sent without useful information; a
   transfer can occur without the final release.

Treatment also had no premature-retirement events versus seven in control.
That may preserve opportunities to act, but it did not translate into more
objective completions. Fewer treatment finishes should therefore not be read
as stronger coordination. The exact extraction and retirement differences are
exploratory signals, not causal proof. The provider did not support a seed, the
study used one model and one task, and trial outcomes are sensitive to model
decisions under a tight 18-call budget.

## Phase 4 hypotheses for research decision

These are distinct hypotheses suggested by observed failure mechanisms; none
prescribes a central coordinator or participant roles.

1. **Directory-to-action gap:** making static peer descriptors visible without
   dynamic state may increase solicitation and waiting without improving
   execution. Test whether visibility alone changes action selection relative
   to a matched condition that omits the directory, keeping the protocol and
   task fixed.
2. **Value-transfer bottleneck:** the critical transition may be recognizing
   and delivering the exact extraction result to a participant able to refine
   it. Test whether a narrowly clarified participant-facing rule about sharing
   observed task values changes exact transfer and downstream release, without
   naming owners or assigning roles.
3. **Action-budget allocation:** the 18-call ceiling may interact with repeated
   requests, waits, and failed/invalid submissions, preventing the final
   release. Test whether a larger preregistered call budget changes objective
   completion while keeping communication and discovery affordances fixed.

These hypotheses should be studied separately so the manipulated mechanism is
interpretable. Any protocol change should be equally visible across conditions
unless it is the treatment being tested. Spontaneous participant decisions
remain possible in all three.

## Evidence references and limitations

Primary evidence: `.tmp/veil-005-phase3-v1.2-replacement-001/manifest.json`,
`summary.json`, the 24 `phase3-*.json` trial records and 24 corresponding
`phase3-*.jsonl` ledgers, their SHA-256 sidecars, and checkpoint snapshots.
Representative success traces are `phase3-05-treatment-seed28.json`,
`phase3-19-control-seed21.json`, `phase3-22-control-seed26.json`,
`phase3-10-control-seed27.json`, and `phase3-14-control-seed31.json`.
Outcome definitions are frozen in
`experiments/emergent-coordination/phase3/v1/evaluate.mjs` and
`experiments/emergent-coordination/phase2/evaluate.mjs`; the v1.2 amendments
and protocol are in `experiments/emergent-coordination/phase3/v1.2/`.

Limitations: small exploratory sample; one model/version and task; no provider
seed; single injected primary failure; order counterbalanced but fixed; an
18-call per-trial limit; no access to hidden reasoning; event-derived labels
cannot establish participant comprehension or intent; and the evaluator's
strict three-contributor criterion differs from mere correct release. Provider
reported token accounting was verified against ledgers, not provider invoices.
No causal certainty is claimed.

The evidence-backed short findings are in
[`veil-experiment-005-phase3-v1.2-findings-001.md`](./veil-experiment-005-phase3-v1.2-findings-001.md).

**PHASE 3 v1.2 ANALYSIS COMPLETE — AWAITING RESEARCH DECISION**
