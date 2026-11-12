# VEIL-GOV-001 hash-bound approval remediation

This record follows the independent adversarial review of qualification commit
`0e2375d` against `origin/develop` at `b8e2750`. It records the review findings
and subsequent remediation; it does not replace or revise the original review.

## Initial findings

1. Duplicate JSON object keys, including conflicting approval decisions, were
   silently collapsed by `JSON.parse`. The reviewer reproduced acceptance of
   `"decision":"reject","decision":"approve"`.
2. A candidate manifest could replace the reviewer or rationale on a trusted
   approval while retaining the same path, anchor and kind. The governance
   checker still reported that finding as `APPROVED` with status 0. The full
   quality gate separately marked the changed manifest as a verification
   control requiring review.
3. Scope membership used Git-discovered paths. An ignored context file omitted
   from those paths left an approval valid. This was a documented limit of the
   initial design, but prevented complete context-addition coverage.

## Remediation

- A JSON token scan rejects duplicate object keys before schema validation,
  comparing decoded key values so escaped equivalents are also rejected.
  `JSON.parse` remains responsible for normal JSON value parsing.
- Every applicable candidate approval record and its referenced context are
  compared with the trusted-base record and context. A changed or missing
  record is `INVALIDATED` (status 2); only the base record can authorize a
  retained finding. Candidate-only records remain untrusted.
- Candidate context membership is enumerated from the filesystem within the
  scanner's exact `ui-showcase-v1` roots, independent of Git ignore rules.
  Nested regular files count. Symlinks and unsupported entries fail closed;
  traversal has depth and entry-count limits. Context byte hashes remain
  checked separately. The scope definition and twelve unresolved UI findings
  are unchanged, and no approval record was added.

The changed governance checker, quality runner, and tests are verification
controls requiring explicit review. The approval manifest remains empty.

## Validation at the qualification branch

- `npm run test:quality`: 232 tests passed, including an end-to-end quality-gate
  fixture proving that an ignored context addition invalidates a trusted approval.
- `npm run check`: 455 Core tests passed; typecheck and package verification
  passed.
- `python3 tools/verify-documentation.py`: passed source documentation validation.
- `python3 -B tools/verify-documentation.test.py`: 6 tests passed.
- `npm run quality -- --base b8e2750`: exit 2, with the same twelve unresolved
  UI findings and the same five verification controls requiring explicit review.
  No approval record was introduced.
