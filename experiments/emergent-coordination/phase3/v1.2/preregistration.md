# Experiment 005 Phase 3 v1.2 — prospective replacement protocol

Status: **prepared for freeze review; live execution is not authorized.**

## Relationship to prior studies

v1.2 is a new, independently versioned replacement for the incomplete v1.1
study. The v1.1 run stopped after six completed trials and three complete
matched pairs, after seven trials had been attempted. Preserve its checkpoint,
seven trial records, event ledgers, manifests, checksums, and summary as
separate evidence. Exclude every v1.1 record and outcome from v1.2 trial counts,
matched pairs, and analyses. Do not resume v1.1 or pool its observations with
v1.2.

The original Phase 3 question and hypotheses remain unchanged: test whether
read-only visibility of peers' static capability descriptions changes
spontaneous recognition and execution of the cross-participant dependency.
The primary outcome remains informed exact raw-value transfer before the
extractor retires; shared-objective success remains secondary. Three complete
v1.1 pairs are descriptive historical evidence only.

## Prospective amendment

The effective action protocol now explicitly states:

> A message may be addressed to another participant or `all`. A participant
> may not address a message to itself.

This sentence is visible to all participants in both conditions and to the
central audience. It clarifies the existing host rule. It does not recommend
messaging, assign roles, describe task strategy, or disclose values or progress.
The host validation, immediate protocol abort, no-retry rule, and all authority
and capability restrictions remain unchanged.

The participant and central prompt files remain byte-identical to the frozen
v1.1 prompts. The only shared model-visible change is the recipient sentence in
the action protocol. The treatment still adds only the initially visible,
read-only `peerCapabilities` directory; the control has no such field.
[`context-comparison.md`](./context-comparison.md) describes the recorded
context comparison, and offline tests compare actual v1.1 and v1.2 contexts.

## Frozen matched design

- 12 matched seeds, 21–32, and the exact v1.1 order generated using order seed
  `20261015`; assignment and scheduler order are unchanged within each pair.
- 24 trials, with a fresh model history and memory for each trial.
- Model `gpt-4.1-mini`, OpenAI Responses API, JSON-object output, 512-token
  output cap, temperature omitted, and no provider seed claimed.
- Treatment receives static descriptors for other participants only. Control
  receives the existing observation without a `peerCapabilities` field.
- Private receipts and raw values remain participant-local; capabilities,
  scopes, caller identity, hidden fault schedule, and evaluator state remain
  governed as in v1.1.
- Same hidden primary-provider failure, task, scheduler, evaluator, outcomes,
  call limit, and immediate stop behavior.
- Maximum 18 model calls per trial; 450,000 token exposure ceiling per trial;
  10,800,000 aggregate. No retries, correction, or extra feedback.

The full inherited hypotheses, outcome definitions, event taxonomy, and
interpretation limits remain in the v1.1 preregistration. This prospective
amendment changes no hypothesis or outcome definition.

## Evidence and authorization

Before live execution, freeze this design and require separate authorization, a
clean committed source tree, and a new exclusive output directory. Record
source/design hashes and model-visible protocol and prompt hashes in the
manifest. Retain append-only ledgers and checksums. Stop on provider, protocol,
accounting, governance, or worker-integrity failure and mark later trials
unattempted. Do not invoke paid APIs as part of implementation or review.

This remains an exploratory single-model study. Even a positive result would
support only the capability-directory treatment in this task; message volume
alone does not establish coordination or emergence. A null or incomplete run
does not establish that participants cannot coordinate.
