# Lifecycle comparison 001: findings

This is the preregistered exploratory Phase 2 comparison. The raw evidence is in
[`../../evidence/lifecycle-comparison-001/`](../../evidence/lifecycle-comparison-001/).
Its manifest identifies frozen source commit `5c5fcb19d45add63804f8cb8a70dd68185230c84`,
model `gpt-4.1-mini`, omitted temperature, the 12-trial order, prompt and source
hashes, and the token limits. `SHA256SUMS` covers every copied raw file,
including JSONL ledgers; the original JSON checksum sidecars are preserved.

## Observations

- All 12 scheduled trials produced complete records: three matched seeds in
  each of A (messaging, baseline), B (no messaging, baseline), C (messaging,
  clarified lifecycle), and D (no messaging, clarified lifecycle). Nine
  stopped as `quiescent`; three stopped at `incomplete-limit`.
- The private evaluator found 0/12 confirmed shared-objective successes.
  Each trial had one extract effect; none had a successful refine or release
  effect. Successful raw-value transfers and provider-failure recoveries were
  both zero.
- Message actions occurred only in seed 13, conditions A and C. Each had two
  send attempts and three delivered envelopes. Those envelopes did not meet
  the preregistered raw-value-transfer measure.
- A, B, C, and D each had 0/3 primary successes. Lifecycle clarification
  showed no observed improvement in the primary outcome for these seeds.
- The host and private evaluator reported governance containment in all 12
  trials. There were 147 model calls and 238,920 provider-reported tokens.
  The settled charged exposure was also 238,920 tokens, below the 600,000-token
  aggregate ceiling and each 50,000-token trial ceiling.

## Interpretation and limits

Messaging availability produced observed message exchange in one seed, while
neither messaging nor the lifecycle clarification produced a confirmed shared
objective in this 12-trial sample. This does not establish emergence or model
incapability. Three seeds, one model configuration, bounded turns and token
exposure, and a deliberately failing primary provider limit the inference.
The message contents and local observations require a separate behavioural
analysis before explaining why the exchanges did not lead to collective action.

## Next research question

**Why did the seed-13 message exchanges fail to produce collective action?**

This is future work. No follow-up trial, prompt, hypothesis, or evaluation
change is part of this checkpoint.

## Integrity check

From the archive directory, run `sha256sum -c SHA256SUMS`. The original
`*.json.sha256` files remain alongside their records. The append-only ledgers,
trial records, checkpoints, manifest, and summary were copied byte for byte
from `.tmp/veil-005-lifecycle-comparison-001/`.
