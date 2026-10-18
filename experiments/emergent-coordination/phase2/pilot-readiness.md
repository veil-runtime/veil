# Live pilot readiness

The instruction text is now `phase2-actions-v2` after Pilot 004. A future
manifest records this revision and fresh source hashes. Pilot 004 remains
diagnostic evidence from the earlier configuration; see
[pilot-004-diagnostic.md](pilot-004-diagnostic.md). A smaller targeted smoke
test is recommended before repeating the seven-trial paid pilot.

## Prepared boundary

The pilot runner requires an explicit `--live-pilot` flag, a new output
directory, an available OpenAI model ID, a key, and a positive suite token
ceiling no greater than 250,000. It uses the existing Experiment II OpenAI
Responses adapter: `json_object` text mode, one unambiguous assistant
`output_text` proposal, no tools, `store:false`, no automatic provider retry,
and at most 2,048 output tokens per call. The parent process alone receives
`OPENAI_API_KEY`; the trusted Veil host worker receives only `PATH`.

The seven scheduled pilot trials are: fixed A, central B, distributed C, and
no-communication D on the same restricted normal seed; C with a hidden
`refineA` failure on another restricted seed; and two open-choice C episodes
with persistent participant-authored local memories. Fixed A makes zero model calls.
The two open-choice episodes are a transport rehearsal, not an H3 test.

## Verification and dry run

Run from the repository root. Use a new output path each time.

```sh
npx tsc --project tsconfig.test.json
node --test --test-isolation=none experiments/emergent-coordination/phase2/offline.test.mjs
VEIL_005_MODEL='YOUR_AVAILABLE_MODEL_ID' VEIL_005_MAX_TOKENS=120000 VEIL_005_TEMPERATURE=omit VEIL_005_GIT_DIRTY=true node experiments/emergent-coordination/phase2/run.mjs --dry-run --out .tmp/veil-005-dry-run-NEW
```

The dry run writes `manifest.json`, `manifest.sha256`, and a `NOT RUN`
`summary.json`. It does not read a credential or construct an API request.

## Optional later paid pilot

Set the key in the operator's shell or secret manager; do not put it in a
committed file or a CLI argument. Set the exact model ID supported by the
account, and record published token prices separately if cost accounting is
needed.

```sh
export OPENAI_API_KEY='<secret supplied outside the repository>'
export VEIL_005_MODEL='<available model ID>'
export VEIL_005_MAX_TOKENS=120000
export VEIL_005_TEMPERATURE=omit
export VEIL_005_GIT_DIRTY=true
node experiments/emergent-coordination/phase2/run.mjs --live-pilot --out .tmp/veil-005-live-pilot-NEW
```

With this command the **maximum reserved token exposure is 120,000 tokens
across the entire pilot**. Before each call the driver reserves UTF-8 input
bytes plus 1,024 framing tokens plus the adapter's 2,048-output-token cap;
reservations are never refunded. Calls stop at the ceiling, 30 calls per
trial, 12 per audience, 24,000 input-bound tokens per call, or three minutes
per trial, whichever comes first. The pilot may end at a budget checkpoint
before all seven trials. There is no silent budget increase or replacement
trial. Actual API usage and model ID, when reported, are recorded separately
from reservations. Monetary cost depends on the operator's chosen model rate.

The new output directory contains a source-hashed manifest, `summary.json`,
one append-only `trial-N.jsonl` ledger for each attempted trial, and a complete
`trial-N.json` plus SHA-256 checksum for each completed trial. Partial ledgers
remain after interruption. The record separates exact public model contexts
and outputs, trusted host admission/authorization/effects, private oracle,
model usage, and offline evaluation. Never feed trial records or private
evaluation back to a participant. The runner stops on governance, provider,
worker, or budget checkpoints and never retries an uncertain execution.
Phase 2 projects HTTP error status, a bounded safe provider error code, and
parsed `Retry-After` timing into model-call evidence. A 429 with
`insufficient_quota` is reported separately from `rate_limit_exceeded`; neither
is retried. Earlier pilot ledgers retain their original coarser classification.

Before any primary trials, review the pilot, freeze source/prompt/protocol/
model/sampling hashes, and authorize a separate budget. No primary runner is
provided in this phase.
