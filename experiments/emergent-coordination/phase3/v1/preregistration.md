# Experiment 005 Phase 3: peer capability visibility v1

Status: **preregistered research design; not implemented or authorized for live
execution.** This proposal does not alter Experiment 005 Phase 2 criteria,
evidence, conditions, prompts, thresholds, or archived files.

## Research question

When independent participants can see the other participants' capability
descriptions, does this improve spontaneous recognition and execution of a
cross-participant dependency in the existing task?

The seed-13 traces show that a successful extraction result remained private,
participants attempted refinement without that value, and the extractor
finished before messages were sent. They do not reveal whether the extractor
failed to recognize a dependency, chose not to communicate, or would have acted
differently with clearer knowledge of peers' capabilities. Phase 3 tests one
environmental information variable while keeping participants' action space,
prompts, authority, task, and private receipts unchanged.

## Falsifiable hypotheses

- **H1 (dependency discovery):** Peer capability visibility increases the
  proportion of trials where the extractor sends the exact raw value to a
  different participant with a compatible refine capability before the
  extractor retires.
- **H2 (workflow completion):** Peer capability visibility increases confirmed
  shared-objective success under the existing evaluator.
- **H0 (no detectable effect):** Peer capability visibility does not increase
  either outcome in the preregistered matched sample. A null result will not be
  interpreted as proof that participants cannot coordinate.

H1 is the primary mechanistic hypothesis. H2 is secondary because value transfer
alone is not completion and the primary provider failure remains part of the
task. A lower raw-value transfer rate or more premature finishes in treatment
would count against H1.

## Single independent variable and conditions

The sole independent variable is whether a participant's observation contains
a read-only **peer capability directory**.

- **Treatment:** Each participant receives, in a new observation field, the
  participant IDs and their public capability descriptors (capability name,
  version, description, risk, and input schema). The participant's own
  descriptors remain where they are. The directory does not expose peer
  receipts, histories, messages, output values, scopes, hidden fault schedule,
  or evaluator information. It assigns no roles and recommends no action.
- **Negative control:** The current Phase 2 observation unchanged, with no peer
  directory. All other context, prompts, host mechanics, objective text, and
  protocol wording are byte-identical to the treatment except for the
  preregistered observation field and its description in the protocol needed to
  define that field.

The protocol clarification is limited to the new field's schema and factual
semantics; it must not tell participants to communicate, assign responsibilities,
describe the task sequence, or explain the objective. The control does not get an
empty placeholder field, avoiding a visual cue that peer information was
withheld. No progress broadcast, dependency graph, lifecycle reminder, prompt
rewrite, output descriptor, or provider-feedback change is included.

Spontaneous action selection and messaging remain available. Participants are
free to discover, send, submit, wait, or finish under the existing protocol.

## Matched seeds and ordering

Use 12 preregistered seeds, `21–32`, each run once in treatment and once in
control, with assignment and initial scheduler order held constant within each
seed. Reset model histories and memory for every trial. Use the same model
identifier and provider settings for all trials; temperature is omitted (or
explicitly zero if required), with no provider seed claimed because the existing
adapter does not support one.

Before any live call, publish the exact seed list, condition order, model
configuration, source commit, and hashes. Use a constrained randomized order
that keeps each seed's pair adjacent while balancing which condition runs first:
randomly permute the 12 seed pairs using a recorded seed, then alternate
Treatment→Control and Control→Treatment by pair position. Do not reorder or
replace a trial because an earlier result looks favorable, a budget is low, or a
participant appears inactive. Stop on provider, protocol, accounting,
governance, or worker integrity failure and mark all later trials unattempted.

This sample is exploratory: report paired counts and exact outcomes without
claiming statistical significance, estimating general model incapability, or
establishing emergence. A missing pair member is excluded from paired
differences and is never imputed as failure.

## Outcomes

### Primary mechanistic outcome

Per trial, a binary **informed raw-value transfer before retirement**: after a
successful extraction receipt becomes visible to its owner and before that owner
finishes, does that informed participant deliver a message containing the exact
raw value to a different participant whose visible directory entry (treatment)
or own capability record (control evidence) shows a refine capability? Count
only delivered `message-queued` events; attempted sends do not count. The
trusted evaluator may compare message content with the raw extraction result
after the trial, but that value must never enter model context except through a
participant's own extraction receipt or a participant-authored message.

The control remains measurable because trusted traces record assignment and
capability ownership; the control participants themselves do not see that
assignment directory.

### Secondary outcomes

- Confirmed shared-objective success using the existing Experiment 005
  definition: correct release effect plus public SUCCESS release receipt.
- Any cross-participant message after extraction; whether it contains the exact
  raw value; sender and recipient; timing relative to extraction and finish.
- Extractor finishes before an exact raw-value transfer.
- First post-extraction action by each participant and whether the action uses
  an observed value, requests it, waits, retries, or finishes.
- Successful refine and release effects; recovery following a visible
  provider-failure receipt; repeated same-capability attempts; stop reason.
- Attempted sends, delivered envelopes, discovery actions, proposal outcomes,
  model calls, reserved/charged/reported tokens, and activation counts.

All event labels will use the versioned Phase 3 taxonomy in the analysis
protocol. Every label must point to event IDs. Internal recognition, intention,
and comprehension remain unobserved and will not be inferred from a single
message or action summary.

The existing Phase 2 primary and secondary criteria remain frozen for its
historical analysis. The outcomes above are new prospective Phase 3 measures,
not retroactive reinterpretations.

## Confounding factors and interpretation limits

- Showing peer capabilities also increases context length and may draw general
  attention to the roster. A positive result supports the directory treatment
  as a whole; it does not isolate capability semantics from added information
  or attention.
- The design does not expose dependency relationships, shared progress,
  lifecycle consequences, or explicit roles. A null result therefore leaves
  those alternatives open.
- The output value remains private until shared. The design tests whether a
  directory helps participants choose to coordinate, not whether a message
  mechanism can carry information once selected.
- The primary provider failure remains hidden as a schedule; only its returned
  receipt is visible to the caller. Failure recovery may vary independently of
  directory effects.
- Repeated trials with one model and provider may have temporal, sampling, or
  service variation. Matched assignment and scheduler seeds do not make model
  outputs deterministic.
- Twelve pairs provide exploratory behavioural evidence, not a powered claim
  of absence, causal mechanism at scale, or emergence. A successful task could
  still occur without observed communication; report the event path.
- Retaining private receipts, exact outputs, and raw values in trusted evidence
  enables audit but requires keeping those records out of participant-facing
  contexts and general publication.

## Proposed exposure and execution boundaries

No live execution is authorized by this preregistration. If reviewed and
separately approved for implementation and execution:

- Maximum 12 seeds × 2 conditions = 24 trials.
- Maximum 18 model calls per trial = **432 model calls maximum**.
- Proposed per-trial charged-reservation ceiling: 50,000 tokens.
- Proposed aggregate charged-reservation ceiling: **1,200,000 tokens**.
- The 50,000 / 18-call trial limits, output cap, context ceiling, and host
  activation/proposal/message limits should match the frozen Phase 2 comparison
  unless an amendment is reviewed before any live trial. No retry, skip, or
  reordering to fit exposure. Use a new exclusive evidence directory.
- Token ceilings are exposure limits, not monetary billing caps. The expected
  usage is unknown; Phase 2 used 238,920 settled tokens for 12 trials, but this
  is not a price estimate or guarantee. Record model-reported usage and charged
  reservations per trial. Do not invoke paid APIs during research-design review.

## Evidence integrity and reproducibility

Before implementation, preserve this preregistration with a content hash and
record the approval state. Before any live call, require a clean source commit
and an exclusive output directory. The run manifest must record the exact
source commit and dirty state, model/provider configuration, adapter and host
hashes, treatment/control observation and protocol hashes, this preregistration
hash, seed list, condition order, budget settings, and evaluation definitions.

Retain append-only event ledgers, full model inputs/outputs, per-trial records,
checkpoints, final summary, and SHA-256 checksums. Verify every checksum before
analysis. Keep evaluator-only raw value and outcome fields out of model input;
validate this boundary from serialized contexts. Preserve incomplete traces,
mark unattempted trials, and report exact commands and failures. No automatic
model or effectful execution retries. Any change to the variable, prompt,
outcome, budget, or ordering after evidence begins requires a dated, versioned
amendment before further execution; never overwrite v1.

## Review gate

This phase ends at research design. The next action after review is a separately
approved implementation plan for an offline-validatable runner change. Live
execution requires separate authorization after the runner, tests, budgets, and
evidence protections are reviewable. No paid API call, new runner, prompt
change, or execution is part of this version.
