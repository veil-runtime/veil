# Veil Experiment 005 — Phase 4 preregistration and design proposal 001

**Status:** revised for final scientific review; not frozen or authorized for live execution  
**Prior evidence:** Phase 3 v1.2, 12 matched seed pairs  
**Scope:** distinguish directory semantics, added context length, and the fixed call ceiling  
**Live model calls:** none

## Research question

Phase 3 v1.2 treatment trials communicated more and completed the objective
less often than controls. The study did not independently manipulate directory
semantics, observation length, or call budget. Phase 4 will test whether
capability-directory semantics change execution when context length is
controlled, whether added task-irrelevant context changes execution, and
whether extra model-call opportunities rescue execution in the directory
condition.

The experiment remains decentralized. Prompts will not instruct participants
to collaborate, execute first, share values, or take roles. The objective,
capability allocation, injected primary failure, action vocabulary, private
receipts, scheduler, and governance rules will remain as in Phase 3 v1.2 except
for the common limits needed to fit the budget comparison below.

## What Phase 3 v1.2 observed

The evidence summaries provide candidate mechanisms, not mechanism tests.

| Candidate | Supporting observations | Contradictory or limiting observations |
|---|---|---|
| Attention displacement toward communication and discovery | Treatment produced 76 send actions versus 31, 60 waits versus 35, and 22 submissions versus 57. Six treatment trials made no extraction proposal; one more proposal was rejected. Five treatment trials extracted successfully versus 12 controls. | Both arms began all trials with `discover`, which the protocol requires for an actor's own descriptor. Treatment made fewer discovery actions overall (32 versus 36). Sending an exact value is necessary to transfer private extraction output; messages cannot all be treated as distraction. Treatment had no premature retirement versus seven controls, which may have left more opportunities to act. |
| Context interference from additional observation content | Treatment model requests used 398,859 input tokens across 191 calls (2,088 per call on average), versus 287,857 across 171 calls (1,683 per call) in control. Treatment also had lower extraction and release rates. The treatment observation included peer capability descriptors. | These totals include different message histories and action sequences caused by condition; they do not isolate the token cost of the directory itself. The directory and its semantics were introduced together, so Phase 3 cannot distinguish useful information from context load. No provider input-token threshold was reached. |
| Competition for the fixed call budget | Seven treatment trials stopped at 18 calls versus five control trials. All seven treatment limit-stopped trials used all 18 calls; none released the objective. Treatment used 191 calls overall versus 171 control calls despite fewer successful extractions. | Five controls also reached the limit, and two control trials completed release before later hitting it. Four of the seven treatment limit-stopped trials had at least one successful effect. The call limit was the same in both conditions, so its causal contribution to the treatment gap is unknown. |

Treatment's mean input-token count is a useful burden indicator, not an estimate
of the directory's isolated token cost: longer treatment conversations also
create longer later contexts. In the proposed study, the placebo block's
tokenized length will be matched to the directory block on each activation,
and provider-reported input usage will remain a separate outcome.

## Conditions

Use four conditions within each matched seed block. The first three form the
primary, length-controlled comparison; the fourth is a budget-rescue diagnostic.

| Code | Observation | Model-call limit | Purpose |
|---|---|---:|---|
| C18 | Original control observation, with no peer directory or added block | 18 | Baseline |
| P18 | Control observation plus a task-irrelevant neutral notes block, token-matched to the directory payload | 18 | Estimate added-context effect |
| D18 | Original read-only `peerCapabilities` directory treatment | 18 | Estimate directory semantics at matched added length |
| D27 | Same observation as D18 | 27 | Estimate whether extra calls rescue the directory condition |

### Observation freeze

- C18 uses the existing control observation byte-for-byte, apart from trial
  identifiers required by the runner. Trial identifiers are generated without
  condition labels and do not encode arm, budget ceiling, seed, or order in
  model-visible text.
- P18 adds only a frozen `notes` value. The generic field name does not label
  the content relevant or irrelevant, or tell participants to ignore it. The
  allowed notes state
  fabricated geometric and color facts about cards, shapes, and pages (for
  example, “A blue square is beside a yellow circle.”). They contain no agent
  or peer identifiers, capability names or descriptions, action words,
  objective terms, raw or refined values, fault details, receipts, progress,
  ownership, roles, requests, sequencing language, or references to messages
  or cooperation. The complete candidate bank and the selected per-actor text
  are frozen and hashed before the run. Two reviewers blind to condition
  labels inspect the bank and mapping for task hints, coordination cues, and
  private-state disclosures; an automated denylist scan checks the same
  categories. Any flagged phrase is removed before freezing. This establishes
  a reviewable content audit, not proof that neutral facts have no cognitive
  effect.
- Token matching uses the frozen OpenAI `tiktoken` encoding `o200k_base`,
  pinned package version and encoding-data SHA-256. The encoding is the
  published mapping for the `gpt-4.1` model family. Define the condition
  payload as the UTF-8 bytes of the canonical one-property JSON object
  (`JSON.stringify({fieldName: fieldValue})`), using the same JSON serializer
  version and Unicode normalization in every arm. Encode that complete object,
  including braces, key, quotes, escaping, colon, and value; matching only the
  prose value is insufficient. For every seed block and
  participant (`p0`, `p1`, `p2`), the P18 property token count must equal the
  corresponding D18/D27 `peerCapabilities` property token count exactly.
  The same property is emitted unchanged at every activation, and the count is
  rechecked and recorded on every model request. Matching is therefore
  participant-specific and applies to every repeated exposure, not just the
  first observation. A missing activation in one arm does not create a
  synthetic comparison; report the actually observed activation counts.
- For audit, parse every occurrence of the condition property from the current
  observation and every observation retained in that participant's history
  inside the actual request. Record the per-occurrence token count, number of
  occurrences, and summed condition-payload tokens for that request. Pair
  matching checks by seed block, participant, and that participant's
  activation ordinal. If an arm has no corresponding activation, record it as
  unmatched. The per-occurrence payload size stays exact; the cumulative sum
  may differ when prior activation histories differ and is reported as an
  observed exposure, never corrected with adaptive filler.
- This matches the added condition-property payload, not total prompt length.
  Different decisions create different histories, so complete context length
  can diverge after the first activation. Record exact full-context tokenizer
  counts and provider-reported input usage by call as separate outcomes; never
  pad a later context based on model behavior. The matched property length
  itself reveals the aggregate token size of the omitted directory payload
  and may act as a weak signal of descriptor count. This is an unavoidable
  structural cue in a length-matched control; the neutral text carries no
  descriptor labels, mapping, or peer capability content.
- D18 and D27 use the original v1.2 directory content and shape, visible at
  each activation as before. The directory contains peer identifiers and
  static descriptors only. It is read-only descriptive data: it does not grant
  invocation authority, change caller identity, bypass capability admission,
  or expose peer receipts, private histories, or execution status. Every
  effect still requires the existing host admission, authorization, provider,
  and evaluator path.
- The base objective, prompts, protocol, history format, own available
  capability names, receipts, message rules, and all other observation fields
  are identical across arms. No observations expose peer receipts, current
  execution status, private histories, hidden fault state, or evaluator data.
- The neutral block's exact serialized text, token count, tokenizer version,
  insertion point, and per-actor mapping will be frozen and hashed before any
  live run. The present proposal does not include that text bank, so accidental
  lexical overlap cannot be certified at this review stage. Publication of the
  exact bank, two-reviewer audit record, denylist results, and per-actor token
  manifest are freeze prerequisites. Do not adapt placebo text during a run.

P18 versus C18 estimates the effect of the notes block and its added context.
D18 versus P18 estimates directory content at the same condition-property
token length. D18 versus C18 estimates the total directory treatment relative
to the original baseline. Neutrality is supported by the content audit above;
psychological inertness is not assumed.

### Call-budget arm

D27 is the smallest direct budget diagnostic: relative to D18 it changes only
the global model-call ceiling from 18 to 27. The scheduler and activation
ceiling are identical in all arms: it may request up to 27 participant
activations, in the same frozen cyclic order, and continues that order after
call 18 only in D27. Each activation can produce the same action choices as
before. The per-audience ceiling is 12 in every arm. The common proposal
maximum is 18 submissions, the message cap is 24 delivered envelopes per
trial, and each message body remains limited to 256 characters. These
per-activation choices and caps are the same in all arms. The nine additional
model calls in D27 do give participants up to nine additional opportunities
to choose any action, including communication; they do not increase the
24-envelope cap or alter delivery, recipient, or scheduling rules. D27's
exposure ceiling is larger only because nine more model calls are allowed.
The model is not told
which global call ceiling applies. If all participants retire or the trial
quiesces, the scheduler stops as it does in every arm; D27 does not force
extra activity.

Calls 1–18 are the common landmark window in every condition. D27 and D18
have identical prompts, observations, action limits, scheduler, and budget
notices through call 18; the assigned ceiling is not visible to the model.
Calls 19–27 exist only in D27. Report outcomes first achieved in this late
window separately from the common landmark outcomes.

D27 versus D18 can show whether additional opportunities help in the directory
condition. It does not estimate whether the budget effect differs between
directory, placebo, and baseline contexts. A full context-by-budget factorial
would require six arms (C18/C27, P18/P27, D18/D27); that is not necessary for
this first diagnostic. Use that larger design only if Phase 4's budget result
justifies estimating those interactions.

## Hypotheses and estimands

### Primary hypothesis: directory semantics and extraction

Let `pD18` and `pP18` be the proportions of trials with a successful extraction
effect by the 18th model call in D18 and P18.

- **H1:** `pD18` differs from `pP18`; the direction is not assumed. If D18 has
  lower extraction and more communication/discovery before first execution,
  that pattern supports attention displacement by directory semantics.
- **Null:** `pD18 = pP18`.
- **Primary contrast:** paired D18 minus P18 extraction success, using the
  matched seed block.

### Secondary mechanism hypotheses

- **H2, context length:** P18 differs from C18 in extraction by call 18 and
  time to first executable proposal. Lower P18 execution with D18 similar to
  P18 is consistent with context interference. Null: P18 and C18 have equal
  extraction probability.
- **H3, call ceiling:** D27 differs from D18 in extraction by its assigned
  ceiling. Higher D27 success and fewer call-limit stops are consistent with a
  binding call budget. The confirmatory comparison is extraction by assigned
  ceiling; successful release and late-window rescue are secondary
  descriptions. Null: extraction probabilities by assigned ceiling are equal.
- **H4, total directory effect:** D18 differs from C18. This comparison
  reproduces the total treatment contrast while the other two contrasts
  decompose semantics and length descriptively.

Action sequences can support an attention-displacement account, but they do
not prove that communication caused an execution failure. Mediation analyses
will be exploratory because action selection is post-treatment and no hidden
reasoning is observed.

## Measurements

All outcomes are trial-level unless explicitly marked as event counts. Preserve
the underlying events and report attempted and successful actions separately.

| Measure | Event-derived definition | Available from current ledgers? |
|---|---|---|
| Time to first executable capability proposal | First `proposal` whose plan passes admission, is authorized, and reaches a matching `capability-entry`. Report the associated `decision.provenance.callId`, activation index, and event sequence. Also report time to first submit separately so invalid proposals remain visible. No qualifying proposal is right-censored at the arm's call limit. | Yes: proposal, admission, authorization, entry, decision call ID, and activation events are recorded. |
| Extraction attempts | Count submitted proposals naming the actor's assigned `.extract` capability, including rejected/denied attempts, with status split by admission, authorization, entry, and receipt. | Yes. |
| Extraction successes | Binary trial outcome and event count based on `effect.kind === "extract"` with corresponding successful receipt. | Yes. |
| Communication before first execution | Count send decisions before the first capability entry; separately count queued/delivered envelopes before that entry. Broadcast recipients count as separate envelopes. | Yes. |
| Redundant descriptor discovery | Count `discovery` results where the same actor already has the same descriptor in the current observation or a prior discovery. Retain exact descriptor names and event IDs. | Yes: activation observations and discovery receipts are present. |
| Calls consumed before extraction | One-based model call ID of the first extraction proposal and, separately, the first successful extraction effect. Report both; no proposal/success is right-censored at the last available call. | Yes: call IDs, proposal and effect events are present. |
| Exact raw-value transfer | Report attempted exact-value envelopes queued before extractor finish separately from delivered exact-value transfers. A transfer must contain the exact extracted raw string and be addressed to another participant with an assigned refinement capability. Report trial-level any-delivered-transfer and envelope counts. | Yes: extraction receipt, message text/recipient, delivery, assignment, and finish events are present. |
| Alternative refinement | Binary trial outcome and count of successful `effect.kind === "alternative"` events. | Yes. |
| Successful release | Binary release effect plus public SUCCESS release receipt; retain effect and receipt sequence numbers. | Yes. |
| Shared-objective completion | Correct sealed release effect and SUCCESS receipt, using the existing evaluator definition. Separately report the stricter three-contributor collective criterion. | Yes. |
| Premature retirement | Any participant `finish` before successful release, with participant and sequence. | Yes. |
| Governance containment | Per trial, zero unauthorized capability entries/effects, zero trace/evaluator violations, and valid containment of admission, authorization, and protocol rejections. Report denials/rejections by type. | Yes. |
| Quiescence and termination | Report the first stop category and call: quiescence, global/per-audience call limit, time, context, token budget, protocol/provider failure, or worker-integrity failure. Treat call-limit/time/budget stops as censored opportunities, not failures to rerun. | Yes: trial stop result and model-call count are recorded. |
| Context and call usage | Provider-reported input/output tokens by call and trial; total model calls; call-limit stop; actual context text; reserved and settled exposure. | Yes for usage and contexts; recompute local placebo token counts from frozen tokenizer. |

For every arm, report extraction success by call 18 as the common landmark
binary outcome. For D27 only, separately report first extraction on calls
19–27, release first achieved on calls 19–27, and shared-objective completion
first achieved in calls 19–27. Also report D27's final by-call-27 outcomes.
These late-window events do not replace the by-call-18 comparison. “Late
rescue” means a D27 trial without the outcome by call 18 that first achieves
it during calls 19–27; this is descriptive and conditions on a post-assignment
landmark result.

No new host event type is needed for these outcomes. The runner must retain the
same event and JSONL fields as v1.2. Add a pre-trial configuration record for
condition, call ceiling, placebo token target, tokenizer/version, and hashes.
Store a derived `addedObservationTokens` count per activation so reviewers can
verify matching without reconstructing the entire prompt. This is design
metadata, not a participant-visible field. Do not record or infer private
chain-of-thought. The event taxonomy does not measure attention or
comprehension directly.

## Assignment, sample size, and analysis

- Use **24 matched seed blocks**, each containing C18, P18, D18, and D27, for
  **96 trials** total. Freeze 24 new, unique host seeds before execution; do
  not reuse Phase 3 seeds 21–32. Keep world/task configuration, capability
  allocation, fault schedule, and scheduler fixed within each block. Every
  trial uses fresh participant histories and memory; no prompt, message,
  receipt, or private state crosses trials. API calls are stateless requests
  containing only that trial's frozen prompt and history.
- Use host seeds **33–56**, one block for each seed. Generate all 24
  permutations of `(C18, P18, D18, D27)` in lexicographic order, then apply a
  descending Fisher–Yates shuffle using unsigned xorshift32 state
  (`x ^= x << 13; x ^= x >>> 17; x ^= x << 5`) initialized to `20261016`; at
  each index `i`, set `j = floor(u × (i + 1))` for the next unsigned state
  divided by `2^32`. Assign the
  resulting orders in sequence to seeds 33–56 as listed below. Each permutation
  appears once, balancing every condition at every ordinal position. Trials
  are isolated, so order does not carry participant
  state; retain order to inspect time/provider drift. Analyze within-seed
  contrasts and do not treat four rows from a seed as independent. This design
  continues the same task and evidence lineage as Phase 3; it is not an
  independent replication.
- The allocation is exactly 24 blocks × 4 conditions = 96 trials. Each
  condition appears 24 times, each block has one trial per condition, and
  each possible condition order appears once. Within a trial, each participant
  retains only its own history and memory plus host-provided public
  observations and delivered messages. Private receipts and values stay local
  unless the participant sends a message. Across trials, histories, memory,
  messages, receipts, and request context reset. No participant role,
  coordinator, or forced message is added.

| Seed block | Trial order |
|---:|---|
| 33 | D18 → D27 → P18 → C18 |
| 34 | D27 → P18 → D18 → C18 |
| 35 | C18 → D18 → P18 → D27 |
| 36 | P18 → D27 → C18 → D18 |
| 37 | D18 → C18 → P18 → D27 |
| 38 | D27 → D18 → C18 → P18 |
| 39 | C18 → P18 → D18 → D27 |
| 40 | C18 → D27 → P18 → D18 |
| 41 | D18 → C18 → D27 → P18 |
| 42 | P18 → D18 → D27 → C18 |
| 43 | D27 → P18 → C18 → D18 |
| 44 | D18 → P18 → C18 → D27 |
| 45 | D27 → D18 → P18 → C18 |
| 46 | C18 → P18 → D27 → D18 |
| 47 | D18 → P18 → D27 → C18 |
| 48 | P18 → D27 → D18 → C18 |
| 49 | C18 → D27 → D18 → P18 |
| 50 | P18 → C18 → D27 → D18 |
| 51 | D27 → C18 → D18 → P18 |
| 52 | D27 → C18 → P18 → D18 |
| 53 | P18 → D18 → C18 → D27 |
| 54 | P18 → C18 → D18 → D27 |
| 55 | D18 → D27 → C18 → P18 |
| 56 | C18 → D18 → D27 → P18 |
- Primary endpoint: extraction success by call 18, paired D18 minus P18 risk
  difference. Use a two-sided exact McNemar test. Report the matched risk
  difference and 95% Tango paired-score interval for the risk difference. Set
  the smallest effect of scientific interest (SESOI) at 0.40 absolute risk
  difference. With 24 pairs,
  a planning scenario with 0.50 discordant pairs and a 0.40 net paired
  difference gives approximately 0.80 power under an exact two-sided
  paired-binomial calculation. This is a large-effect design; it will not
  reliably resolve smaller effects. This calculation is a planning scenario,
  not guaranteed power.
- Secondary confirmatory contrasts use one binary endpoint each: H2 P18–C18
  extraction by call 18; H3 D27–D18 extraction by each arm's assigned ceiling
  (18 vs 27); H4 D18–C18 extraction by call 18. Report exact paired McNemar
  p-values and 95% Tango paired-score risk-difference intervals. Apply Holm
  adjustment across these three secondary p-values. The primary test is
  reported separately at two-sided alpha .05. Release, shared-objective
  completion, raw-value transfer, refinement, and governance outcomes are
  prespecified secondary outcomes but are descriptive; do not add unplanned
  significance tests.
- For binary outcomes, always show the four paired cells (both success,
  treatment-only success, control-only success, neither) and the risk
  difference. For event counts, show per-block paired differences, mean,
  median, range, and 95% paired t interval for the mean; also provide a
  10,000-resample block bootstrap interval for the median using xorshift32
  seed `20261017`. Counts and their intervals are descriptive; do not treat
  events as independent trials.
- Interpret a statistically inconclusive contrast as unresolved unless its
  90% Tango paired-score interval is wholly inside the SESOI bounds
  `[-0.40, +0.40]`.
  Only that prespecified equivalence result supports ruling out effects at
  least as large as the SESOI for that binary endpoint. A nonsignificant test
  alone is not evidence of equality. If the interval includes zero and also
  extends beyond either SESOI bound, report that the design is inconclusive.
- Exploratory analyses: action-type distribution before first capability
  entry; call IDs and input tokens before extraction; duplicate discoveries;
  transfer timing; effect of stop category; and the relation between delivered
  exact values and later alternative refinement/release. These are descriptive
  and do not identify causal mediation.

## Frozen model, limits, and stopping rules

- Request `gpt-4.1-mini` through the same Responses API and JSON-object
  interface used in v1.2. The v1.2 ledgers report
  `gpt-4.1-mini-2025-04-14`; the Phase 4 freeze must state the exact expected
  reported identifier and stop if the provider reports another. Freeze
  temperature as omitted and output-token cap at 512. The provider does not
  support a seed; record this limitation.
- Keep a 24,000-token context ceiling, 180,000 ms trial ceiling, 12 calls per
  audience, 256-character message bodies, and the same provider/capability
  governance. Maximum model calls are 18 in C18/P18/D18 and 27 in D27.
- Reserve at most 24,000 input-context tokens plus 512 output tokens per call
  (24,512 reserved tokens/call). Set each trial's hard ceiling to 700,000
  reserved tokens. This covers D27's 27-call maximum of 661,824 tokens, with
  38,176 tokens of per-trial margin. An 18-call trial can reserve at most
  441,216 tokens.
- The maximum planned call/exposure matrix is:

  | Arm | Trials | Calls/trial | Maximum calls | Maximum reserved tokens |
  |---|---:|---:|---:|---:|
  | C18 | 24 | 18 | 432 | 10,589,184 |
  | P18 | 24 | 18 | 432 | 10,589,184 |
  | D18 | 24 | 18 | 432 | 10,589,184 |
  | D27 | 24 | 27 | 648 | 15,883,776 |
  | **Total** | **96** | — | **1,944** | **47,651,328** |

  The aggregate hard ceiling is 50,000,000 reserved tokens, leaving
  2,348,672 tokens above the calculated worst case. The 24-trial-per-arm
  allocation is the matched-block matrix, not extra replication. Summing all
  96 per-trial ceilings would permit 67,200,000 tokens, but this amount is
  unreachable under the stated call and per-call reservation caps; the
  50,000,000 aggregate ceiling is the hard outer bound. Actual input may be
  lower; output, retries, and failures still consume the frozen reservation
  rules. Do not increase any ceiling after observing results.
- Do not retry provider failures or resume partial trials. On provider/model
  mismatch, protocol failure, accounting mismatch, governance violation, or
  worker-integrity failure, stop the run immediately, preserve append-only
  evidence, and mark later scheduled trials unattempted. Do not replace
  missing trials or change seeds after seeing outcomes.
- Complete the fixed 96-trial schedule unless a stop rule fires. No early
  stopping for a favorable, unfavorable, or null result. A budget-limit stop
  is an outcome and a censored opportunity, not a failed trial to rerun.
- Freeze source, prompt, protocol, tokenizer, placebo strings, matrix, evaluator,
  budgets, and hashes in a new exclusive output directory before separately
  authorizing any live execution. v1.2 evidence remains untouched and excluded
  from Phase 4 outcome counts.

## Interpretation guide

| Result pattern | Interpretation supported (not proved) |
|---|---|
| D18 has lower extraction than P18; P18 is close to C18; D18 has more pre-execution sends/discoveries | Directory semantics may displace early execution with communication/discovery. |
| P18 and D18 both underperform C18 by similar amounts, with D18 close to P18 | Added context length/content burden is a plausible contributor; directory semantics add little detectable effect at matched length. |
| D18 underperforms P18, and P18 underperforms C18 | Both semantic attention shifts and context burden may contribute. |
| D27 gains extraction or release first in calls 19–27, and reduces call-limit censoring relative to D18 | The 18-call ceiling may bind directory trials; this does not show that the same effect holds in C18 or P18. Report the common call-18 landmark separately. |
| D27 uses more calls but does not improve extraction/release | More opportunities alone did not rescue execution under this design; other bottlenecks remain possible. |
| Contrasts are imprecise or inconsistent | Mechanisms remain unresolved; do not interpret a null as evidence of equivalence. |

## Limitations

The model has no provider seed, so matched environment seeds do not make model
outputs deterministic or provide independent replications. The single task,
fixed capability allocation, injected primary failure, and small number of
blocks limit generalization. A length-matched neutral block may itself affect
attention; the content audit can rule out the listed informational content but
cannot establish psychological inertness. Token payload matching does not
equalize the complete prompts after conversation histories diverge. The D27
arm is a budget-rescue diagnostic only and does not estimate context-by-budget
interaction. First-action and communication measures are observable behavior,
not direct attention measurements. Successful release, shared-objective
completion, and three-contributor collective completion remain distinct
outcomes.

Phase 4 is not an independent replication of Phase 3: it uses the same
research lineage, task, model family, participant prompt and protocol, fault,
capability allocation, and evaluator, while reusing the Phase 3 observations
to select the mechanism contrasts. New seeds and a frozen factorial order
reduce direct reuse but do not remove design dependence, investigator
learning, model stochasticity, or shared implementation effects. Treat Phase
4 as a prospective mechanism study informed by Phase 3, not as independent
confirmation of its result.

## Dependency advisory review (design-time)

The workspace `npm audit` report has four vulnerable package entries
(2 moderate, 1 high, 1 critical; eight distinct advisory IDs in their
transitive `via` records): `@modelcontextprotocol/sdk` 1.30.0 (high, OAuth
client may send credentials to a server-chosen authorization endpoint,
[GHSA-6qxp-vccf-f47h](https://github.com/advisories/GHSA-6qxp-vccf-f47h)),
`fast-uri` 3.1.7 and 4.1.4 (moderate URL normalization/mailto parsing issues,
[GHSA-hrr3-gc8f-f4qj](https://github.com/advisories/GHSA-hrr3-gc8f-f4qj),
[GHSA-jvvf-x445-j334](https://github.com/advisories/GHSA-jvvf-x445-j334)),
`ip-address` 10.5.0 (moderate address classification, subnet comparison, and
unbounded diagnostic issues,
[GHSA-rpw4-54j3-4h4q](https://github.com/advisories/GHSA-rpw4-54j3-4h4q),
[GHSA-2vr4-cq9g-pvrc](https://github.com/advisories/GHSA-2vr4-cq9g-pvrc),
[GHSA-j6r3-76f7-8jcv](https://github.com/advisories/GHSA-j6r3-76f7-8jcv),
[GHSA-h3mg-xc3c-68pw](https://github.com/advisories/GHSA-h3mg-xc3c-68pw)), and
`proxy-addr` 2.0.7 (critical IPv4-mapped IPv6 trusted-proxy spoofing,
[GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h)).
The frozen Phase 3 runner obtains model output
through its direct Responses API HTTP adapter and uses a child process for the
host; it does not start the MCP HTTP server or trust proxy address headers.
The audit paths therefore do not appear reachable in the study execution
path as currently designed. Recheck the exact Phase 4 dependency tree and
runner imports before any live run; this review changed no dependencies. The
encoding choice follows OpenAI's `gpt-4.1` tokenizer mapping
([tiktoken model map](https://github.com/openai/tiktoken/blob/main/tiktoken/model.py));
freeze the exact package and encoding-data hashes in the run manifest.

No runner, host, Phase 3 source, or evidence file is changed by this proposal.
No model calls have been made. Live execution would require review, a frozen
Phase 4 source and manifest, a new evidence directory, and separate execution
authorization.

**PHASE 4 DESIGN REVIEW COMPLETE — AWAITING FREEZE DECISION**
