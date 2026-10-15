# Experiment 005 Phase 3: seed-13 evidence analysis v1

Status: research analysis only. This document interprets the archived Phase 2
trace; it does not change its protocol, conditions, outcomes, or evaluator.

## Baseline and evidence boundary

The working tree was clean at `bbb432c` on `research/005-emergent-coordination`.
The frozen lifecycle comparison is `5c5fcb1`; its evidence was archived by
`1494410` and `bbb432c`. The evidence manifest names frozen source commit
`5c5fcb19d45add63804f8cb8a70dd68185230c84` and records `gitDirty: true` at
capture time. That archive-time flag is preserved as provenance; it does not
describe the current clean checkout. The comparison includes the 12 scheduled
trials and its preregistration and findings remain unchanged.

The primary evidence below is the append-only event ledger plus the exact
participant observations and outputs retained in it:

- Condition A: [`comparison-06-A-seed13.jsonl`](../../evidence/lifecycle-comparison-001/comparison-06-A-seed13.jsonl)
  (`comparison-06-A-seed13.json` is the corresponding trial record).
- Condition C: [`comparison-08-C-seed13.jsonl`](../../evidence/lifecycle-comparison-001/comparison-08-C-seed13.jsonl)
  (`comparison-08-C-seed13.json` is the corresponding trial record).
- Event sequence numbers below refer to the nested host event `seq` in each
  JSONL line, rather than the outer ledger line number.

Participants' observable knowledge is reconstructed only from their logged
observations, receipts, delivered inbox, prior public history, and selected
action. The private evaluator and world state are not used to claim that a
participant knew something. Trusted `effect` and receipt events are used only
to establish what operation occurred and what result was returned to its
caller.

## Chronological timeline

Seed 13 assigns the same actors in A and C: `p1` has `extract`; `p2` has the
failing `refineA`; `p0` has `refineB` and `release`. Capability names are
session-scoped and differ between trials, so the table uses the neutral kinds.
The shared objective in each activation is “Release the refined source value.”

| Order / events | Participant observation and action | Data knowledge and consequence |
|---|---|---|
| A seq 0–8; C seq 0–8 (ticks 0–2) | `p2`, `p0`, and `p1` each discover their own descriptors. | `p1` sees only `extract`; `p2` sees only `refineA`; `p0` sees `refineB` and `release`. No participant observation lists peers or their capabilities. No raw value has yet been returned. |
| A seq 9–16; C seq 9–16 (tick 3) | `p1` submits extraction. The successful receipt returned to `p1` contains `{"raw":"specimen-13"}`; the trusted effect records extraction of `specimen-13`. | **Only `p1` possesses the extracted raw value in its observable receipts/history.** `p0` and `p2` receive no receipt or message containing it. This critical extraction event precedes every message in A and C. |
| A seq 17–24; C seq 17–24 (tick 4) | `p2` submits to `refineA`. A supplies raw input `Release the refined source value`; C supplies `source`. | In both logged observations, `p2` has only its descriptor and discovery receipt, no raw value and no inbox. The result is `FAILED: Primary provider unavailable before effect`. The provider failure means this attempt does not establish whether the supplied raw string would otherwise have passed validation. `p2` has no observed evidence of who holds the extracted value. |
| A seq 25–31; C seq 25–31 (tick 5) | `p0` submits to `refineB`. A supplies `raw source value`; C supplies `source value`. | `p0` has no raw receipt or inbox in either condition. Both operations return `FAILED: Invalid source value before effect`. This is the first explicit feedback to `p0` that its supplied value is invalid. `p0` has not received the extracted raw value. |
| A seq 32–39; C seq 32–33 (tick 6) | In A, `p2` retries `refineA` with `Release the refined source value`; it fails with the same provider-unavailable error. In C, `p2` waits after its first failure. | `p2` still has no raw value. C's clarified text has told participants that local completion may not complete the shared objective, but it has not revealed peer capabilities or data ownership. |
| A seq 40–42; C seq 34–36 (tick 7) | `p1` is activated with its own successful extraction receipt and chooses `finish(status="complete")`. A's summary says extraction succeeded and the refined value was released; C's says the extracted value was published as required. | `p1` still has `specimen-13` in its own history and has received no refine or release receipt. No message has yet been sent. `finish` permanently retires `p1`; the summaries are recorded model outputs, not evidence that a release happened or that `p1` had a release receipt. This is the earliest decisive loss of the active participant that visibly holds the raw value. |
| A seq 43–49; C seq 37–43 (tick 8) | `p0` retries `refineB` with a different non-raw string (`refine input` in A; `refined source input` in C). Both attempts fail with invalid-source feedback. | `p0` remains without `specimen-13`. It is the participant whose own descriptors include both the alternative refinement and release operations, but it has no peer capability directory and no data transfer. |
| A seq 50–53 (tick 10); C seq 44–45 (tick 10) | A: `p0` chooses `send to all` with exact body: **“Requesting a valid raw source value to proceed with refinement step.”** The host queues one envelope to `p1` and one to `p2`. C: `p0` waits, citing a need for a valid raw source value. | At send time in A, `p0` has two failed `refineB` receipts, no raw value, and no inbox. Recipients receive only that request text; it does not include a raw value, capability map, or provider-failure report. `p1` has already retired, so this message cannot prompt an action from the extractor. |
| A seq 54–58 (tick 11–12); C seq 46–57 (tick 11–12) | A: `p2` receives `p0`’s request and sends to `p0`: **“Cannot proceed with refinement due to provider unavailability, please provide a valid raw source value to retry.”** `p0` receives it next and waits. C: `p2` retries `refineA` with `source`, gets the same provider failure, then `p0` sends to all: **“Requesting the correct raw source value for refinement to proceed with releasing the refined source value.”** The host queues it to `p1` and `p2`. | A's `p2` has a visible provider-unavailable receipt but no raw value; its reply explicitly identifies provider unavailability and asks `p0` for data. `p0`’s next observation contains that request but still no raw value; it waits. In C, `p0`’s message is sent after extraction and after `p1` retired, and neither recipient receives a data value. |
| A seq 59–64 (ticks 14–16); C seq 58–64 (ticks 14–16) | A: `p2` waits; `p0` receives no reply with data and waits; `p2` waits again. C: `p2` receives the request and replies to `p0`: **“Please provide the correct raw source value to proceed with refinement and release.”** `p0` receives the reply and waits; `p2` then waits. | In C, the sender `p2` has its own failed provider receipt and the request from `p0`, but no raw value. `p0` sees only the request for a value. The reply does not change the available data. Both archived trial ledgers end at `incomplete-limit`; neither has a confirmed shared-objective event in the recorded outcome. |

### Message-by-message knowledge and decision effect

| Condition / host event | Sender knowledge at send | Recipient(s) and exact received content | Subsequent observable action / change |
|---|---|---|---|
| A, seq 52–53, tick 10, `p0` → `p1`,`p2` | Own failed `refineB` receipts; own `refineB`/`release` descriptors; no raw value; no inbox. | Both get “Requesting a valid raw source value to proceed with refinement step.” | `p1` is retired and takes no later action. `p2` sends a request for the value while reporting provider unavailability; no raw value is sent. The request changes the next observable message but not an execution decision. |
| A, seq 56, tick 11, `p2` → `p0` | Own failed `refineA` receipts, including “Primary provider unavailable before effect”; received `p0`’s request; no raw value. | `p0` gets “Cannot proceed with refinement due to provider unavailability, please provide a valid raw source value to retry.” | `p0` next waits. No value transfer or execution follows. |
| C, seq 56–57, tick 12, `p0` → `p1`,`p2` | Own two failed `refineB` receipts; no raw value; no inbox at send. | Both get “Requesting the correct raw source value for refinement to proceed with releasing the refined source value.” | `p1` is retired. `p2` later asks `p0` for the value. No value transfer or execution follows. |
| C, seq 60, tick 14, `p2` → `p0` | Own failed `refineA` receipts with provider-unavailable text; received `p0`’s request; no raw value. | `p0` gets “Please provide the correct raw source value to proceed with refinement and release.” | `p0` next waits. No value transfer or execution follows. |

Each trial has two send actions and three delivered envelopes because each
`to: "all"` send fans out to the other two participants. No message in either
trial contains `specimen-13`. Neither sender possessed the raw value. The
informed extractor `p1` sent no message before or after extraction. The archived
finding's zero raw-value transfers is consistent with these ledger events.

## Evidence-linked causal failure map

The earliest observable **handoff gap** is immediately after the tick-3
extraction receipt: `p1` has the required raw value, while the active refinement
participants at ticks 4–5 have no such value in their observations and no
message from `p1` (A seq 16–18 and 24–26; C seq 16–18 and 24–26). Their attempted
refinement does not advance to a successful effect. The earliest decisive
**retirement** is `p1`'s tick-7 `finish` (A seq 40–42; C seq 34–36). Later messages
cannot reach `p1` as an active participant. These are observed stopping points;
the traces do not establish internal reasons.

| Taxonomy v1 classification | Evidence and scope |
|---|---|
| `INFORMATION_NOT_SHARED` | `p1` has `specimen-13` in its successful extraction receipt (A/C seq 16), but no subsequent send action appears in either ledger. All later message bodies ask for the value and contain no raw value (A seq 51–56; C seq 55–60). This is a trace-level description, not a claim about why `p1` did not send. |
| `PREMATURE_RETIREMENT` | `p1` chooses `finish(status="complete")` after extraction, without any observed refine/release receipt in its history (A seq 40–42; C seq 34–36). The public objective remains release of the refined value. The recorded completion summaries overstate the work visible in that participant's history; no motive is inferred. |
| `INFORMATION_NOT_ACTIONED` | `p0` receives `p2`'s raw-value request and then chooses wait (A seq 56–58); in C, `p0` receives `p2`'s request and then waits (C seq 60–62). The requested value is not in `p0`'s observation, so the trace does not show that `p0` could have fulfilled the request. This classification is limited to a received request followed by wait, not a claim that a feasible action was ignored. |
| `UNSUCCESSFUL_RECOVERY` | `p2` repeats `refineA` after the visible provider-unavailable receipt in A (seq 32–39) and C (seq 46–53); `p0` retries `refineB` with different non-raw strings after invalid-source feedback (A seq 43–49; C seq 37–43). No retry produces a successful refine effect. The traces do not show whether those participants knew about `refineB` or the primary-failure schedule. |
| `QUIESCENCE_WITH_UNMET_OBJECTIVE` | Not assigned: these two ledgers stop at `incomplete-limit`, rather than a recorded `quiescent` stop. The absence of release is supported by the recorded trial outcome and effect/receipt events, not used to infer participant knowledge. |
| `DEPENDENCY_UNRECOGNISED` | Not assigned. There is no direct observable event establishing whether a participant recognized the extract → refine → release dependency. Wrong or missing inputs and completion summaries are insufficient to infer recognition state. |
| `INSUFFICIENT_EVIDENCE` | Applies to the causal explanation overall: one matched seed pair, model-call variation, only logged actions (not private reasoning), and the later messages occurring after `p1` retires prevent distinguishing failure to recognize the handoff from a decision not to transmit, misreading of available context, or other causes. |

## Environmental limitations and coordination opportunity

| Concept | Evidence-based assessment |
|---|---|
| Capability availability | A successful extractor exists (`p1`). The failing primary refine is assigned to `p2`. A separate alternative refine and release are assigned to `p0`, who can execute both locally. The primary-failure schedule is hidden from participants; the returned provider error is visible only to its caller. The traces show no successful refinement or release. |
| Information availability | `p1` receives the extraction result privately. `p0` and `p2` see only their own receipts and inbox. Each sees the shared objective but no peer capability list, peer progress, or shared receipt stream. Their descriptor schemas say what input fields are required, but not who can provide those values. The output value is returned only in the caller's receipt. |
| Coordination opportunity | Spontaneous communication is available in A/C; messages can be addressed to a named participant or `all`, and the host delivers them as inbox entries. A valid sequence is possible in principle: `p1` could send its raw receipt value to `p0`; `p0` could use its alternative refinement, then release. No special executor is needed for those last two steps. But no peer roster/capability directory helps identify `p0`, and receipt privacy means participants cannot see others' progress. This makes coordination possible but poorly signposted. |

Environmental ambiguity that can confound interpretation:

- The participant prompt says there are no assigned roles and that capabilities,
  messages, and receipts are local, but it does not enumerate peers or describe
  their capabilities. Discovery returns only the caller's descriptors.
- `send to all` fans out, but the prompt does not define that addressing
  semantics in ordinary prose; the protocol example supplies the shape. A
  recipient cannot reply to a retired sender in a way that reactivates it.
- Descriptors expose required inputs and descriptions, but no explicit output
  descriptor or cross-capability dependency graph. Successful results appear
  only in private receipts.
- `finish` has permanent consequences. Condition C clarifies that local
  completion need not equal shared completion, but `p1` still finishes with
  summaries claiming completion. This makes a lifecycle-only explanation an
  inadequate standalone account for this pair, while not ruling out attention
  or sampling effects in broader trials.
- The primary provider failure is concealed as a scheduled treatment but its
  error message is visible to the caller. In A/C, only `p2` receives that
  failure; the alternative capability holder `p0` receives invalid-source
  feedback, not the primary failure. This asymmetry complicates claims about
  adaptation after failure.
- The scheduler is shuffled by seed and advances active participants in rounds;
  finished participants are skipped and waits are cleared by later non-wait
  actions. The messages in these traces arrive only after the value holder has
  retired, and the trials end at the activation horizon. Neither ending should
  be described as quiescence.

These limitations make `DEPENDENCY_UNRECOGNISED`, `INFORMATION_NOT_SHARED`,
`INFORMATION_NOT_ACTIONED`, and `UNSUCCESSFUL_RECOVERY` distinguishable as
trace events only in part. The trace supports that a value was not transferred,
that a participant retired, that requests were exchanged, and that retries did
not produce effects; it cannot identify the unobserved internal mechanism.
