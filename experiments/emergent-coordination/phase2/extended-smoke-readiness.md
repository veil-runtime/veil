# Extended coordination smoke readiness

This is a separately labeled integration diagnostic, not an emergence trial.
Its participant instructions remain `phase2-actions-v2`. The new configuration
revision is `phase2-extended-smoke-v1`; the budget revision is
`phase2-settlement-v1`. The manifest hashes both revisions' implementation and
this report. It runs one restricted distributed condition on seed 12 with the
existing hidden primary-provider failure. All three participants retain
independent contexts. The host assigns no organisational roles or actions.

The condition allows up to **18 host activations and 18 model calls** across
participants, with a 512-token output cap per call. Existing host limits of 12
proposals, 24 message envelopes, 256 characters per message body, and three
minutes per trial remain. These bounds allow several rounds for discovery,
peer messages, V2 proposals, public receipts, and decisions after missing
information or failure. They do not guarantee that a model will choose those
actions. The trial stops at the first provider, protocol, budget, worker, or
governance checkpoint. No provider or execution retry is automatic.

## Reservation accounting

The first targeted smoke reserved 29,154 tokens for four calls. Its serialized
model contexts occupied 23,010 UTF-8 bytes: 5,501 and 6,891 central; 5,309
and 5,309 distributed. The second central context grew by 1,390 bytes after
discovery and history were included. The driver added 1,024 framing tokens and
512 possible output tokens per call: 4,096 + 2,048 more. The provider reported
5,116 input and 148 output tokens, 5,264 total. The byte count is a safe
model-independent input bound, not a prediction of provider tokenization.

The extended smoke retains that full bound **before every call**. A successful
completed response with valid `inputTokens` and `outputTokens` settles its own
reservation to the provider's reported total. The report must fit both the
input byte bound and the 512 output-token cap. Missing or uncertain usage
holds the full reservation; inconsistent usage stops the trial before an
action reaches the host. At every call, cumulative settled usage plus full
bounds for unresolved or unreported calls must fit the shared **50,000-token
exposure ceiling**. Gross reservations can exceed 50,000 over the run because
completed calls release unused portions. No historical average is used for
admission. `ceil(UTF-8 bytes / 4)` is recorded only as a diagnostic estimate;
it never grants budget.

The [official OpenAI token-counting guide](https://developers.openai.com/api/docs/guides/token-counting)
describes reported output usage as including nonvisible generated tokens and
the request's `max_output_tokens` as limiting them. The Responses usage fields
may be absent, so the runner conservatively holds the reservation in that
case. The extended mode does not call a separate token-count endpoint.

The central trial in the first targeted smoke ended with `incomplete-limit`
because its configured `activationLimit` was two. Its tick 0 discovery and
tick 1 proposal both passed action validation. The proposal passed admission
and authorization, then failed inside the fixture capability before an effect
because its raw input was not the source value. No third activation was
scheduled. This was an expected configured loop limit, not a runtime crash or
an evaluator success. The extended mode does not rerun the central condition.

## Exact live invocation

Compile the existing offline host dependency, then use a new output path from
the repository root. Keep the key in the operator shell or secret manager.

```sh
npx tsc --project tsconfig.test.json
export OPENAI_API_KEY='<secret supplied outside the repository>'
export VEIL_005_MODEL='gpt-4.1-mini'
VEIL_005_MAX_TOKENS=50000 VEIL_005_TEMPERATURE=omit VEIL_005_GIT_DIRTY=true node experiments/emergent-coordination/phase2/run.mjs --live-extended-smoke --out .tmp/veil-005-live-extended-smoke-001
```

The exact `VEIL_005_MAX_TOKENS=50000` value is required; no larger value is
accepted. `VEIL_005_TEMPERATURE` may be omitted or set to `0`, and its value is
recorded. Optional `VEIL_005_INPUT_RATE` and `VEIL_005_OUTPUT_RATE` annotate
the manifest. The key remains in the parent process; the governed V2 host
worker receives only `PATH`. The adapter sends no tools and uses `store:false`.

The new directory contains `manifest.json`, `manifest.sha256`,
`extended-smoke-1-distributed.jsonl`, a completed trial JSON and SHA-256 file
when available, and `summary.json`. The ledger records full model contexts,
outputs, decisions, reservations, settlements, public host events, and the
private evaluator's result after the trial. The summary separates heuristic
estimates, gross reservations, provider-reported usage, and current budget
exposure, along with discoveries, messages, admissions, authorization, effects,
and stop reasons. Partial ledgers remain on interruption. Existing evidence
directories are refused. Review the ledger before drawing any behavioural
conclusion; successful task completion here does not establish emergence.
