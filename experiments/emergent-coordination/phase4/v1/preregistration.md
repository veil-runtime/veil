# Veil Experiment 005 — Phase 4 preregistration v1 candidate

- **Status:** implementation candidate; not frozen or authorized for live calls
- **Design lineage:** Phase 3 v1.2, 12 matched pairs; Phase 4 is not an independent replication.
- **Conditions:** C18, P18, D18, D27; 24 blocks, 96 trials.

## Conditions and freeze

| Arm | Model-visible condition field | Global model-call ceiling | Directory |
|---|---|---:|---|
| C18 | None | 18 | No |
| P18 | `notes` with frozen neutral text | 18 | No |
| D18 | `peerCapabilities` | 18 | Yes |
| D27 | `peerCapabilities` | 27 | Yes |

The seed-block orders are the 24 unique permutations recorded in `run.mjs`
(seeds 33–56). Every seed occurs once per arm and each order occurs once.
Trials receive fresh worker processes, participant histories, memory, inboxes,
receipts and world state. Only the host seed is shared within a matched block.
The prompt, action protocol, task, capability allocation, injected failure,
model request format, evaluator, host admission and authorization remain the
Phase 3 v1.2 versions. The same host scheduler and deterministic seed-derived
per-round participant shuffle are used in every arm. Calls 1–18 use the same
scheduling rules and activation ceiling in every arm. D27 continues that same
scheduler for up to nine further model activations; the host's per-round
participant-order shuffles continue from the same seed-derived stream. A
participant who has finished is skipped according to the existing scheduler.
No communication, scheduling, proposal, message, or exposure allowance is
increased in D27. Calls 1–18 are the common landmark; events first achieved on
calls 19–27 are separately reported.

The host retains the existing 24 delivered-message-envelope cap, 256-character
message body cap and 12 calls per audience. Proposal allowance is 18, matching
the reviewed Phase 4 preregistration. Each run stops on provider/model
mismatch, protocol failure, invalid accounting, governance violation, or
worker-integrity failure. There are no retries, replacements, outcome-based
stops, or resumptions. A budget ceiling stops that trial; partial evidence is
kept.

The model configuration is `gpt-4.1-mini`, expected reported identifier
`gpt-4.1-mini-2025-04-14`, Responses API, JSON object output, temperature
omitted, 512 output tokens/call, 24,000 context tokens, 180,000 ms/trial,
and 12 calls/audience. The provider does not accept a seed. The 18-call arms
have an activation ceiling of 27, as does D27; the driver stops before a
model request beyond that arm's call ceiling. The assigned call ceiling is not
included in model-visible observations or instructions. On 2026-10-15, the
official GPT-4.1 mini model page marked the model deprecated while listing the
Responses endpoint and the frozen snapshot; OpenAI's API help page says the
GPT-4.1 family remains available through the API. These public documents do
not establish account-specific access or guarantee future availability. No
live availability probe was made. Preserve this model and snapshot; resolve
any availability change as an explicit scientific decision before execution.

### Pre-freeze amendment 001: scheduler description

Before freezing or collecting Phase 4 data, the originally proposed cyclic
activation order is corrected to describe the existing Phase 3 v1.2 scheduler.
That scheduler deterministically shuffles participant order once per round
using its seed-derived xorshift stream. The Phase 4 implementation preserves
that scheduler unchanged. All four conditions use the same scheduling code,
activation rules, and seed-derived order stream. The D27 continuation uses
that same stream after call 18. Finished participants are skipped under the
same existing rule, so realized audiences can diverge if model decisions
differ; no condition-specific scheduling policy is introduced. This is a
transparent pre-freeze correction to the proposed cyclic order, not a change
to the scheduler implementation.

## Frozen neutral bank and token matching

`neutral-bank.json` is a frozen deterministic bank of 72 geometric prose
notes (one for each seed × participant). Each note contains only color, shape,
spatial-relation, and neutral sentence-form words. It has no participant IDs,
capability names, task terms, provider details, values, private state,
instructions, imperatives, or coordination language. A strict word allowlist
and prohibited-term scan run during construction and tests. The generator uses
the Phase 4 seed and participant only; it does not adapt to live events.

The tokenizer is `js-tiktoken@1.0.21`, `o200k_base`; the exact rank asset hash,
package lock hash, bank hash and source hashes are recorded in
`freeze-manifest.json`. Matching counts the tokenizer encoding of the complete
canonical serialized one-property JSON payload:
`JSON.stringify({notes: note})` versus
`JSON.stringify({peerCapabilities: directory})`. Every D/P occurrence is
rechecked when constructing each actual model request, for the current
observation and every retained observation in that participant's history.
The ledger records each occurrence count, occurrence number, summed payload
tokens and complete serialized-context token count. Exact property matching
does not imply equal full-context counts: different field names, content,
escaping, and histories can change full-context tokenization. No adaptive
padding is applied. Missing or extra property occurrences stop that trial as
`token-mismatch`.

The bank's geometric statements are fabricated and are not sourced from any
world state. They cannot be asserted psychologically inert; they may still
affect attention. Their actual serialized content and hash are the record for
the lexical neutrality audit.

## Outcomes and analysis

Primary outcome: trial-level successful extraction by model call 18, compared
within seed blocks for D18 minus P18. The primary null is equal paired
extraction probability; the two-sided exact McNemar test and 95% Tango paired
risk-difference interval are reported. The SESOI is ±0.40 absolute risk
difference. Secondary confirmatory extraction contrasts are P18–C18,
D27–D18 (each arm's assigned ceiling), and D18–C18, with exact paired
McNemar tests and Holm adjustment across those three p-values. Report all four
paired outcome cells and risk differences. Binary outcomes beyond those
contrasts and event counts remain descriptive. Use paired t intervals for
mean event-count differences and 10,000-block bootstrap intervals for median
differences (xorshift32 seed 20261017). The 90% Tango interval is used only
for the preregistered equivalence interpretation: an interval wholly within
±0.40 is evidence against effects at least that large; otherwise an
inconclusive result remains unresolved. Do not infer equality from a
nonsignificant test.

Measurements are derived from activation, decision, proposal, admission,
authorization, capability-entry, effect, receipt, discovery, message, finish,
and trial-stop events. The implementation records first submit and first
authorized capability entry separately; extraction attempts and successes;
send actions and delivered envelopes before first entry; repeated discovery
of already-observed descriptors; calls before first extraction attempt and
success; exact raw-value messages and delivered transfers; alternative
refinement; successful release; shared-objective and collective completion;
premature retirement; governance denials and admission rejections; quiescent,
call-limit and other termination. The event-derived exporter is
`metrics.mjs`. Call-18 extraction is reported in every arm; D27 additionally
reports outcomes first achieved during calls 19–27 and final by-call-27
outcomes.

Action sequences and communication counts are exploratory descriptions, not
direct attention measures or causal mediation. Phase 3 findings motivating
the arms were higher send and wait counts, fewer proposals and extractions,
more call-limit terminations under directory visibility, and higher average
input tokens/call. Phase 3 did not isolate directory semantics from context
length or budget. Reuse of the same task, prompts, model family, host lineage,
fault, capability structure and evaluator makes Phase 4 a prospective
mechanism study, not independent replication. New seeds do not remove
investigator learning or model nondeterminism.

## Exposure and cost

Each call reserves at most 24,512 tokens (24,000 input + 512 output). Per-trial
ceiling is 700,000 reserved tokens; aggregate ceiling is 50,000,000. The
call-limited worst case is 1,944 calls and 47,651,328 reserved tokens:

| Arm | Trials | Calls/trial | Calls total | Reserved-token maximum |
|---|---:|---:|---:|---:|
| C18 | 24 | 18 | 432 | 10,589,184 |
| P18 | 24 | 18 | 432 | 10,589,184 |
| D18 | 24 | 18 | 432 | 10,589,184 |
| D27 | 24 | 27 | 648 | 15,883,776 |
| **Total** | **96** | — | **1,944** | **47,651,328** |

At the currently published GPT-4.1 mini standard rates ($0.40/1M input and
$1.60/1M output tokens), assuming every call reaches the respective 24,000
input and 512 output maximum and no cached-input discount, the estimated
model-token cost ceiling is approximately **$20.26 USD**. It is an estimate,
not a provider quote or invoice ceiling; actual usage can be lower, pricing
may change, and the 50M reserved-token hard ceiling alone is not a billing
amount. The pricing source is the [official API pricing page](https://developers.openai.com/api/docs/pricing),
checked 2026-10-15. The [model page](https://developers.openai.com/api/docs/models/gpt-4.1-mini)
and [API availability guidance](https://help.openai.com/en/articles/20001051-retiring-gpt-4o-and-other-chatgpt-models)
were checked on 2026-10-15. No built-in tools are enabled.

The source freeze and output manifest are prerequisites to live execution.
The proposed command is documented in `README.md`; it has not been executed.
