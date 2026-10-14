# Experiment 005: Emergent Coordination — preregistered design

## Question and boundaries

Can three independently controlled participants with local observations, partial capability access, a shared objective, bounded messages, and Veil-governed execution coordinate without assigned organisational roles or a central action selector? The architecture at `v0.1.0-arch-lock` is unchanged. This experiment uses only the public `OperatorRuntime` API with `planVersions: ['2.0']`. The legacy V1 fixture and prior traces remain baselines, not multi-participant infrastructure.

The initial deterministic policies in this directory are **scripted infrastructure baselines**. Their successes cannot establish emergence. The experiment's future variable is the participant decision policy; the host, world, observation protocol, limits, conditions, evaluator, and preregistered scenarios must be held fixed before testing unscripted policies. No real model call is part of this phase.

## Independent, falsifiable hypotheses

| Hypothesis | Evidence required beyond task completion | Falsifier in the proposed 30-seed primary matrix |
| --- | --- | --- |
| H1 collective coordination | Condition C completes the three-capability objective through at least three distinct participant-controlled successful actions, with message provenance linking needed data to later proposals; C exceeds the no-message negative control and is compared with A and B. | C does not exceed the no-message control, or purported cooperation is entirely host-selected/scripted. |
| H2 adaptive reorganisation | After an unannounced primary provider failure, a participant other than the failed proposer independently selects the alternative capability using only visible failure information, without a host recovery hint; recovery rate and latency are measured against fixed A and adaptive central B. | No C recovery, recovery before failure evidence, or recovery instructions/selection originate with transport or host. |
| H3 functional specialisation | Across rotated capability assignments and repeated trials, participant action distributions become stably differentiated by function, measured against a permutation null and an identical-policy/no-interaction control; transitions from initially non-specialised behavior and decision provenance must be observable. | Differentiation is fully explained by fixed capability access, assigned policy branches, actor ID, or chance. |

H1, H2, and H3 are separate outcomes. Goal completion alone does not support any of them. In particular, this phase's policy branches encode the workflow and recovery rule; its H1/H2 paths validate measurement and infrastructure only, while H3 is ineligible for an emergence claim.

## Conditions and controls

- **A, fixed predefined orchestration:** a central script chooses the extract, primary refine, release sequence. It stops after failure. This is a task-completion reference.
- **B, central adaptive orchestration:** a central script sees receipts and chooses the alternative refine action after a primary failure. This is an adaptive upper reference with centralized information.
- **C, distributed coordination:** three separate policy instances receive only their own descriptors, inbox, and receipts. The transport schedules activations and delivers messages; it never chooses an action or repair. In this phase C uses the same deterministic scripted policy at each participant.
- **Negative controls:** C with messages disabled tests the need for exchange. A forged cross-participant capability proposal tests authorization containment. A released effect with lost receipt tests uncertainty handling. Future H3 analysis also requires identical full-capability access and shuffled actor labels, with action choices compared to a permutation null; that control is specified here but is not implemented in phase 2.

The world requires extracting a hidden source value, refining it, and releasing the exact refined value. Each participant sees a strict subset of capabilities; one can extract, one has the primary refine capability, and one can release and has an alternative refine capability. Assignment to opaque participant IDs rotates by seed. There is no participant role field or initial leader. Alternative capability access is visible before failure; the scripted policy waits for a failure message, which is why its recovery is not evidence of spontaneous adaptation.

## Frozen trial plan and measurements

Infrastructure matrix: five seeds (`1..5`) × A/B/C × normal/primary-provider-failure = 30 trials, plus five C/no-message trials and five C/lost-release-receipt trials. This 40-trial run is a plumbing and negative-control checkpoint, not the H1–H3 primary test. The future primary matrix is 30 predeclared seeds per condition/scenario, frozen policy/model configuration, and no replacement of failed trials. Any extra stress run is separately labeled. The comparison base for repository quality is `5f5bbf6`.

Per trial record the seed, assignment, condition, fault, decision origin, each exact participant observation, action, queued/delivered message, proposal, Veil admission/authorization, capability entry/effect, public receipt, stop reason, private world, and evaluator output. Exclude nondeterministic Veil Job IDs/timestamps from the reproducible projection. Count actions, distinct successful contributors, message-dependent transitions, goal attainment, failure exposure, recovery after exposure, recovery latency in activations, admission/authorization denials, invocation/effect mismatches, and unknown outcomes. Preserve incomplete and failed records. Causal claims about a message require that its delivery precede the recipient's decision; transcript interpretation alone is insufficient.

For H3, let each participant's functional action vector count extract/refine/release over successive windows. Measure normalized entropy within participant, between-participant Jensen–Shannon divergence, assignment-adjusted mutual information between participant and function, and stability across seeds after permuting IDs and capabilities. Compare to a null distribution generated by shuffling actor labels within feasible capability sets (at least 10,000 permutations); report effect sizes and uncertainty intervals. The current capability layout creates structural differentiation, so its observed divergence is explicitly ineligible as emergent specialization. A future open-choice scenario with overlapping capabilities and equal initial access is required before evaluating H3.

Task success requires the private world to contain exactly one valid release effect. Governance containment requires every capability entry to have a matching prior Veil authorization allow, no effect after denial or admission rejection, no participant-controlled caller/scope change, and no silent V1 fallback. A governance violation invalidates the trial and stops the run. An unknown receipt cannot establish confirmed success even if the private oracle shows an effect. Provider failure before effect and receipt loss after effect are different classifications; neither triggers an automatic retry.

Limits: three participants, at most 48 activations, 12 proposals, 24 bounded message envelopes, 256 serialized characters per body, one step per proposal, one action per activation, and fixed seeded round scheduling. The runner uses a new output directory, retains every JSON trial trace and summary, and does not overwrite evidence. Exhaustion is recorded as incomplete.

## Isolation and limitations

Participant observations contain the shared objective, local descriptors, delivered messages and own public receipts. They exclude world state, other participants' receipts, authorization logs, assignment map, failure schedule, and evaluator findings. The evaluator is a separate module and receives the private trace only after execution. The in-process deterministic policy is not a security sandbox; future real independent model trials require process separation and a frozen serialized adapter boundary. SQLite logging and runtime registries are process-global, so this offline harness runs trials sequentially in an isolated temporary working directory with unique capability namespaces.

The world is small, deterministic, and synthetic. Five seeds establish reproducibility, not statistical significance. The scripted policy encodes a workflow and recovery behavior. No Phase 2 result should be reported as emergent coordination, adaptation, or specialisation. The next research gate is an unscripted participant policy with no shared hidden state, plus the H3 open-choice control, preregistered before any primary runs.
