# Pilot 004 diagnostic review

Pilot 004 is diagnostic evidence, not a test of H1, H2, or H3. The complete
trial 2–4 ledgers each match their retained trial trace and checksum: 6, 6,
and 85 ledger rows respectively. The fixed A control completed; the three
model-controlled trials had no successful execution effects. The suite stopped
after four trials at 109,906 of 120,000 reserved tokens and 14 model calls.
The disruption and open-choice trials were never attempted.

## Exact rejection and execution findings

| Trial | Actor / proposal | Observed validator result |
| --- | --- | --- |
| 2 central | `discover` without `participant` | Host rejected before discovery: `Invalid central action`; the exact missing field was `participant`. No proposal reached Veil. |
| 3 p2 | `p2-1` | Host rejected before Veil: proposal IDs must match `^p[0-9]+$`; `p2-1` contains a hyphen. Its plan was never admitted, so its other fields have no observed admission result. |
| 4 p2 | `p1`, `refineA`, version `""`, input `{}` | Veil admission: `CAPABILITY_VERSION_MISMATCH`, `REQUIRED_INPUT_MISSING` (`raw`). |
| 4 p1 | `p1`, `extract`, version `""` | Veil admission: `CAPABILITY_VERSION_MISMATCH`. |
| 4 p0 | `p1`, `refineB`, version `""`, input `{}` | Veil admission: `CAPABILITY_VERSION_MISMATCH`, `REQUIRED_INPUT_MISSING` (`raw`). |
| 4 p2 | `p2`, `refineA`, version `"1.0"` | Veil admission: `CAPABILITY_VERSION_MISMATCH`. |
| 4 p1 | `p2`, `extract`, version `"1.0"` | Veil admission: `CAPABILITY_VERSION_MISMATCH`. |
| 4 p2 | `p3`, `refineA`, version `"1.0"` | Veil admission: `CAPABILITY_VERSION_MISMATCH`. |
| 4 p1 | `p3`, `extract`, version `"1.0"` | Veil admission: `CAPABILITY_VERSION_MISMATCH`. |

The seven admission rejections occurred before authorization or capability
entry. Two later p0 proposals used the registered version `"1"`, passed
admission and authorization, and entered capabilities. The `refineB` proposal
failed because its `raw` value did not match the private source; the `release`
proposal failed because its `refined` value was invalid while the world had
not yet released. Both failed before effect. No participant successfully ran
`extract`, so no model participant observed the source value. These findings
come from the admission receipts, host trace, and private evaluator state,
not from the model's decision summaries.

## Configuration boundary

Pilot 004 used the v1 instruction text in its retained source-hashed manifest:

| File | Pilot 004 SHA-256 | New v2 SHA-256 |
| --- | --- | --- |
| `participant-prompt.txt` | `08dd670a6eb88ba224f28b174977b7b4ab6b73bca497217b8c46b158da44c12a` | `77d5f1895950acff5dfad26be7e49c4911bee5acdb85e48216b6584d7c759916` |
| `central-prompt.txt` | `4956539153ff66b5a90700e1ca6b4e48e5749b681cd57539fc43dd28187bd7ec` | `9022134246dfcd66cfc9ea1c6434e161d54d1ff1eb939d5a27988984698ec4de` |
| `protocol.md` | `fc43c7b6f204b52ec9df4fb8304d3f6a8c7573bff4b6da2c48ace8fea7463171` | `c4071ec3add2e9d41f56fc1bfa8f1cdc2c4344d13e744eddb2b5b6552e2cc335` |

Future manifests explicitly record `instructionRevision: phase2-actions-v2` and
hash these files plus the revised host, driver, and evaluator. Central actor
syntax and proposal-ID examples are protocol-format corrections. Explaining
discovery, exact descriptor versions, and known input values may alter when
participants act and how many tokens they use; it must be treated as a new
experimental configuration, not pooled with Pilot 004 as unchanged evidence.
The new diagnostics do not alter participant observations or evaluator success
thresholds. No action is repaired or retried by the host.

## Next paid step

Run a smaller, separately labeled and source-hashed smoke test before another
seven-trial pilot: exercise one central discovery turn and a few distributed
turns under a low shared token ceiling, then inspect protocol and admission
codes. The present runner has only the fixed seven-trial matrix, so a targeted
smoke invocation needs an explicit small matrix option prepared and tested
first. Do not treat that smoke as primary evidence or silently substitute it
for a full pilot.
