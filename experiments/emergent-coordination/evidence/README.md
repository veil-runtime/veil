# Historical evidence

`initial-40-v5/` is the current scripted infrastructure checkpoint. Each trial
has a complete JSON record and an append-only JSONL event ledger. The ledger
preserves events written before an interrupted trial; completed records include
the private world and evaluation. `summary.json` aggregates the frozen matrix.
These are trusted research artifacts and must never be sent to participants.

Earlier directories are retained as pilot evidence:

- `initial-40/`: a quiescence bug stopped two distributed failure trials before
  all three participants had taken an idle turn.
- `initial-40-v2/`: corrected quiescence, but capability names exposed the fault
  label to participants.
- `initial-40-v3/`: opaque capability names; evaluator had a weaker message
  provenance check than the current version.
- `initial-40-v4/`: stronger evaluator, but public capability names still
  encoded a primary/alternative provider preference. Current names are neutral
  `refineA` and `refineB`.

The deterministic policy explicitly encodes message forwarding and recovery.
These traces verify the harness and governance path only; they do not show
emergent coordination, adaptation, or functional specialisation.

The revision directories are preserved as historical snapshots. Seventy trial
files in `initial-40/` are byte-identical to their counterparts in
`initial-40-v2/`; the `summary.json` files in v2 through v5 are also
byte-identical. These duplicates are retained to preserve the revision history.

`provider-checkpoints/live-pilots-001-002.tar.gz` contains the two-trial
provider checkpoints for live pilots 001 and 002. It is kept as a single raw
archive. The historical trial records include private evaluator/world data and
must remain restricted to trusted research use.

`historical-SHA256SUMS` covers this README and every file under `initial-40/`,
`initial-40-v2/`, `initial-40-v3/`, `initial-40-v4/`, `initial-40-v5/` and
`provider-checkpoints/`. It does not hash itself. The per-revision manifests
record source-code hashes; this separate list records the archived file bytes.
