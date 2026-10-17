# Neutral-bank content audit

- **Reviewed file:** `neutral-bank.json`
- **SHA-256:** `b1ad37eb58e9ab514bd926064fb6940cd34ddedb91d64e2e7d63cb89debb1061`
- **Entries reviewed:** 72 (seeds 33–56 × p0, p1, p2)
- **Outcome:** no semantic contamination identified; no text changes indicated.
- **Additional review:** a separate AI-assisted review of all 72 entries was reported on 2026-10-15; it found no semantic contamination.
- **Independence status:** a distinct AI-assisted review is reported, but its reviewer/model provenance and condition-blinding are not documented; the preregistered two-reviewer, blind-review requirement is not verified.

## Review scope and finding

The original second-pass review examined the exact strings in the frozen JSON directly;
the implementation author's earlier neutrality conclusion was not used as
evidence. Every entry was checked for explicit or implicit task hints;
coordination or delegation language; participant, agent, or capability
references; semantic overlap with extraction, refinement, release, messaging,
or recovery; imperatives or behavioral guidance; and private-state leakage.

All 72 entries consist solely of fabricated color, geometric-shape, and
spatial-relation sentences in the repeated form “The [color] [shape] appears
[relation] the [color] [shape].” No entry contains a participant identifier,
capability descriptor, task term, private state, instruction, coordination
language, or operation-specific semantics. Spatial relations describe only
the fabricated geometric content; no sentence connects that content to an
experiment operation. The entries are not psychologically inert by
demonstration: their added prose may still attract attention, as the design
intends to measure.

The lexical allowlist and prohibited-term check in `neutral-content.mjs` are
supporting automated checks, not evidence of semantic neutrality. The separate
AI-assisted review was reported as covering all 72 entries and finding no
semantic contamination. Its reviewer identity, model/tool, review record, and
whether it was blind to condition labels were not provided, so those details
cannot be verified. It is not described as an independent human review. The
proposal requires two reviewers blind to condition labels; until the missing
provenance and blinding condition are established, that preregistered review
prerequisite remains unverified and this audit does not authorize a freeze for
live execution.

## Per-entry audit

Each cell names one exact bank entry and records its result across the review
categories above. “No finding” means no textual hint or leakage was found in
that entry; it is not a claim of psychological inertness.

| Seed | p0 | p1 | p2 |
|---:|---|---|---|
| 33 | No finding | No finding | No finding |
| 34 | No finding | No finding | No finding |
| 35 | No finding | No finding | No finding |
| 36 | No finding | No finding | No finding |
| 37 | No finding | No finding | No finding |
| 38 | No finding | No finding | No finding |
| 39 | No finding | No finding | No finding |
| 40 | No finding | No finding | No finding |
| 41 | No finding | No finding | No finding |
| 42 | No finding | No finding | No finding |
| 43 | No finding | No finding | No finding |
| 44 | No finding | No finding | No finding |
| 45 | No finding | No finding | No finding |
| 46 | No finding | No finding | No finding |
| 47 | No finding | No finding | No finding |
| 48 | No finding | No finding | No finding |
| 49 | No finding | No finding | No finding |
| 50 | No finding | No finding | No finding |
| 51 | No finding | No finding | No finding |
| 52 | No finding | No finding | No finding |
| 53 | No finding | No finding | No finding |
| 54 | No finding | No finding | No finding |
| 55 | No finding | No finding | No finding |
| 56 | No finding | No finding | No finding |

This per-entry table records 24 × 3 = 72 individual findings. A distinct
reviewer must independently inspect these exact strings before the study is
frozen. A reviewer-blinded handoff package is prepared in `reviewer-package/`:
each reviewer has the same 72 entries in shuffled order, anonymous IDs, the
same short rubric, and a separate response template. Package preparation is
not review evidence. The two completed independent responses must be retained
and assessed before freezing.
