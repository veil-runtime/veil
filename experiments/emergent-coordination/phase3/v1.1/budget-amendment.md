# Phase 3 v1.1 prospective budget amendment 001

Status: **Frozen replacement design; not authorized for live execution.**

This replacement budget was designed after observing the incomplete v1
treatment for seed 25. It is not independent of that observation. The source
trace is preserved in the read-only archive at
`.tmp/veil-005-phase3-v1-budget-limited-archive/` and is excluded from all v1.1
matched outcomes and trial counts. The new study reruns all 24 preregistered
trials in their original order; it does not resume or complete the partial v1
trial.

The `.tmp` archive is ignored temporary local archival storage and is not
committed research evidence. Its files are checksum-verified and read-only in
this workspace. The separately committed v1.1 design and freeze manifest
identify the archive and explicitly exclude the partial trial from replacement
outcomes.

## Recorded reservation and settlement sequence

For each call the frozen formula reserves `serialized UTF-8 context bytes +
1,024 framing tokens + 512 output tokens` before dispatch. Valid provider usage
settles to reported input plus output tokens; the released amount is reservation
minus that settlement. Values below are from the v1 treatment ledger and
checkpoint. “Exposure after” is the cumulative settled charged exposure; it is
not cumulative gross reservation.

| Call | Audience | Context bytes | Reservation | Reported input + output | Charged | Exposure after |
|---:|:---:|---:|---:|---:|---:|---:|
| 1 | p0 | 5,698 | 7,234 | 1,296 + 24 | 1,320 | 1,320 |
| 2 | p1 | 5,942 | 7,478 | 1,351 + 21 | 1,372 | 2,692 |
| 3 | p2 | 5,864 | 7,400 | 1,334 + 31 | 1,365 | 4,057 |
| 4 | p1 | 6,896 | 8,432 | 1,599 + 48 | 1,647 | 5,704 |
| 5 | p2 | 7,195 | 8,731 | 1,696 + 69 | 1,765 | 7,469 |
| 6 | p0 | 7,371 | 8,907 | 1,739 + 47 | 1,786 | 9,255 |
| 7 | p1 | 7,970 | 9,506 | 1,874 + 23 | 1,897 | 11,152 |
| 8 | p2 | 8,651 | 10,187 | 2,089 + 25 | 2,114 | 13,266 |
| 9 | p0 | 8,974 | 10,510 | 2,178 + 44 | 2,222 | 15,488 |
| 10 | p2 | 9,735 | 11,271 | 2,378 + 46 | 2,424 | 17,912 |
| 11 | p0 | 10,172 | 11,708 | 2,499 + 21 | 2,520 | 20,432 |
| 12 | p1 | 9,130 | 10,666 | 2,174 + 32 | 2,206 | 22,638 |
| 13 | p2 | 10,909 | 12,445 | 2,689 + 22 | 2,711 | 25,349 |
| 14 | p0 | 11,263 | 12,799 | 2,796 + 24 | 2,820 | 28,169 |
| 15 | p1 | 10,391 | 11,927 | 2,513 + 68 | 2,581 | 30,750 |
| 16 | p0 | 12,377 | 13,913 | 3,096 + 49 | 3,145 | 33,895 |
| 17 | p2 | 11,980 | 13,516 | 2,975 + 27 | 3,002 | 36,897 |

Observed totals: **176,630 gross reservation tokens**, **36,897 charged exposure
tokens**, and **36,897 reported settled tokens**. Contexts ranged from 5,698 to
12,377 bytes; reservations ranged from 7,234 to 13,913 tokens. Context size
grew overall as participant histories accumulated, with non-monotone changes
because the round-robin audience and each audience's own history differ.

The reconstructed, never-dispatched 18th request was p1 at tick 17. Its
treatment context was 11,968 bytes. The unchanged formula required
`11,968 + 1,024 + 512 = 13,504` tokens. Only 13,103 remained, a 401-token
shortfall. Removing only the treatment's `peerCapabilities` observation field
reduces this context by 629 serialized bytes and its reservation to 12,875.
That is a counterfactual calculation, not a control model call or measured
provider usage. It would have admitted that request by 228 tokens, but the
50,401 total needed at this instant says nothing sufficient about other trials,
missing-usage settlements, or worst-case reservation exposure.

## Ceiling derivation

The unchanged v1 driver has a 24,000-token input-bound context limit, an
18-call experiment limit, and a 512-token output cap. For every admissible call:

```text
inputBound = serialized UTF-8 context bytes + 1,024 <= 24,000
reservation = inputBound + 512 <= 24,512
18 fully held reservations <= 18 * 24,512 = 441,216 tokens per trial
```

“Fully held” is the fail-closed case where each response is failed, missing
usage, or otherwise uncertain, so no reservation is released. This is an
upper-bound calculation from frozen limits, not an extrapolation from the 17
settled calls. The exact observed seed-25 call-18 requirement (13,504) is not
used as the ceiling. A recommended **450,000-token per-trial ceiling** covers
the hard 441,216-token reservation bound with 8,784 tokens of headroom (about
2%). The proposed aggregate ceiling is **10,800,000 tokens**, exactly 24 ×
450,000. The hard per-trial bound summed across all 24 trials is 10,589,184;
the aggregate ceiling includes 210,816 tokens of corresponding margin.

These limits preserve the 18-call maximum and existing context bound; they do
not create permission for extra calls. The unchanged runner still stops before
dispatch if a requested reservation does not fit, and still holds full
reservations when usage cannot be validated. A change in model-reported token
usage beyond the reservation remains an accounting failure, not additional
budget.

## Cost estimate and limitations

OpenAI's current GPT-4.1 mini model page lists standard text prices of $0.40 per
million input tokens and $1.60 per million output tokens, and marks the model
deprecated: [model and pricing page](https://developers.openai.com/api/docs/models/gpt-4.1-mini).
For a conservative list-price estimate, count up to the validated 24,000 input
bound and 512 output tokens for every one of 432 calls, with no cached-input
discount:

```text
Input:  432 * 24,000 = 10,368,000 tokens  -> $4.1472
Output: 432 *    512 =    221,184 tokens  -> $0.3538944
Total:                                     -> $4.5010944 (about $4.50)
```

This is a request-usage ceiling estimate at prices checked on 2026-10-15, not a
guaranteed bill or a monetary cap. Actual inputs should generally be below the
conservative byte/framing bound; cached input could lower charges. Prices,
model availability, taxes, and billing treatment can change. The 10.8-million
aggregate token ceiling must not be converted to dollars using a single blended
rate: the input/output mix differs, and the byte-based reservation formula is
deliberately conservative.

## Prospective scope and integrity

Only the v1 per-trial and aggregate token ceilings change. The v1.1 runner
imports v1's frozen driver, host worker, host, and evaluator, and uses the same
model, prompts, provider-failure injection, treatment directory, control
observation, 12 matched seeds, ordering, 18-call maximum, evaluation criteria,
and governance boundaries. The v1.1 manifest records new source and design
hashes plus an explicit exclusion reference to the incomplete v1 archive.
Evidence uses a new exclusive output directory. Review and separate live
authorization are required before any paid call.
