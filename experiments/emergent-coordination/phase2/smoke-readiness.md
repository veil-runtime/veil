# Phase 2 targeted live smoke readiness

This is an integration diagnostic using `phase2-actions-v2`, not an emergence
trial. It runs only central discovery and restricted distributed interaction on
seed 11. The central condition allows two host activations and two model calls:
the second observation can show the descriptors returned by discovery. The
distributed condition allows six activations and six calls, which permits one
turn for each independent participant and a second round if the shared budget
allows it. Neither condition guarantees a valid discovery, message, or proposal;
the model chooses every action. The host never repairs an action.

The two conditions share a hard 30,000-token reservation ceiling. Before each
call the parent reserves UTF-8 input bytes, 1,024 framing tokens, and 512
output tokens. The smoke OpenAI request caps output at 512 tokens; the seven-trial
pilot continues to use 2,048. No reservation
is refunded, and the runner stops at the first provider, protocol, budget,
worker, or governance checkpoint. The budget can stop the distributed trial
before its six activations. In the mocked budget rehearsal, two central calls
and two distributed calls fit; this does not fund a full distributed
discover-then-submit sequence. The central reasoner can submit a discovered
descriptor on its second call, which is the smoke's shortest governed execution
path. There are no automatic provider or execution
retries. The host worker receives only `PATH`; credentials stay in the parent.
The adapter uses Responses `json_object` text mode, `store:false`, and no tools.
Only experiment-local fixture capabilities are registered in the V2-only host.

From the repository root, compile the existing offline host dependency first:

```sh
npx tsc --project tsconfig.test.json
```

Set the key in the operator shell or secret manager. Use a fresh output path
every time. The model below is the identifier recorded in Pilot 004; replace
it only if the intended model differs, and retain the manifest for comparison.

```sh
export OPENAI_API_KEY='<secret supplied outside the repository>'
export VEIL_005_MODEL='gpt-4.1-mini'
VEIL_005_MAX_TOKENS=30000 VEIL_005_TEMPERATURE=omit VEIL_005_GIT_DIRTY=true node experiments/emergent-coordination/phase2/run.mjs --live-smoke --out .tmp/veil-005-live-smoke-001
```

`OPENAI_API_KEY`, `VEIL_005_MODEL`, and the exact
`VEIL_005_MAX_TOKENS=30000` value are required. Temperature defaults to
`omit`; `0` is also supported. `VEIL_005_GIT_DIRTY` and optional
`VEIL_005_INPUT_RATE`/`VEIL_005_OUTPUT_RATE` annotate the manifest but do not
control execution. The token ceiling bounds reservations, not the monetary
price of a selected model; model usage is reported separately when the
provider supplies it.

The new directory contains `manifest.json` and `manifest.sha256`, an
append-only `smoke-N-CONDITION.jsonl` ledger for every attempted condition,
`smoke-N-CONDITION.json` and its SHA-256 file for each completed condition,
and a checkpointed `summary.json`. The manifest records source hashes,
model/sampling settings, limits, and the two-condition matrix. The summary
separates protocol-valid and invalid actions, discoveries and central receipt
visibility, messages, proposals, admissions, authorizations, effects, calls,
reservations, reported usage, and stop reasons. Incomplete ledgers remain on
worker interruption. The runner refuses an existing output directory.

Review both the ledger and the summary before another paid pilot. Passing
this smoke establishes only that the live model and governed host can
communicate through the protocol; it does not establish task completion,
adaptation, specialisation, or emergence.
