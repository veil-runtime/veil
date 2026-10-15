# Experiment 005 Phase 3 v1 — prospective amendment 001

Date: 2026-10-15
Status: recorded before Phase 3 implementation and before any Phase 3 live data.

## Purpose

Make the preregistered peer-capability directory operationally precise for the
runner. This amendment does not add an experimental variable or change the
seed list, hypotheses, outcomes, exposure limits, or interpretation rules in
[`preregistration.md`](./preregistration.md). If any wording below conflicts
with v1, this amendment governs the implementation details below.

## Frozen directory boundary

1. **Read-only:** the directory is constructed by the host and cannot be
   modified through participant actions. It confers no authority and is not an
   executable action.
2. **Initially available:** in treatment, the complete directory is included
   in every participant's first observation and remains the same on later
   activations for that trial. No discover call is required to see it.
3. **Static peer data only:** it contains only each *other* participant ID and
   the static capability descriptors assigned at trial setup: capability name,
   version, description, risk, and input schema. It contains no self entry.
4. **Strict exclusions:** it contains no private receipts; proposals or
   execution status; intermediate or returned values; inbox, message history,
   participant history or memory; provider result or failure state; scopes,
   evaluator state, world state, or hidden fault schedule.
5. **Matched equivalence:** for each seed, treatment and control use the same
   participant assignment, capability definitions and opaque capability names,
   extraction value, injected provider failure, objective, scheduler order,
   limits, model settings and execution semantics. The only observation
   difference is treatment's added `peerCapabilities` field. To ensure names
   are identical within a matched pair without exposing condition or seed, the
   Phase 3 host uses one opaque name namespace derived deterministically from
   the seed for both members of its pair. Names remain trial-local to separate
   runtimes and do not encode the condition, role, fault, or seed.
6. **Control fidelity:** control uses the existing Phase 2 participant
   observation fields and semantics and contains no `peerCapabilities` key.
   Session capability names are the opaque, pair-stable names defined above.
   The treatment field is an observation-only addition; no participant prompt
   or protocol prose is changed. The field's schema and exclusions are defined
   here and in trusted runner documentation, not injected as another treatment
   cue.
7. **Order seed:** use `20261015` for the constrained pair-order permutation;
   retain the generated order in the manifest and in the Phase 3 run guide.

The Phase 3 runner will compare normalized initial observations and all
non-directory trial configuration for each seed pair before any model call.
Any mismatch fails closed. Live execution remains subject to a separate review
and authorization gate; this amendment authorizes implementation and offline
validation only.
