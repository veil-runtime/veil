---
title: Governed value implementation — domain classification blocker
---
# Governed value implementation — domain classification blocker

Date: 2026-09-24. Fixed source comparison base:
`103521d0d92a14d030ad56bb89e7c0a5ea902d87`.

**Resolved by maintainer clarification.** The probes below are retained as
historical blocker evidence, but they no longer block implementation. ADR-0011
now normatively chooses inspectable structural eligibility. No v2 admission,
partial boundary, helper, test conversion, package change or governance allowance
was introduced by the earlier blocker investigation.

## Clarification that resolves the blocker

The [accepted ADR](../adr/0011-governed-value-ownership.html) admits ordinary/
null-prototype passive records, requires rejection of unsupported resolved
values, and requires capture without evaluating user code. The readiness report
now defines passive classification and excluded native brands while explicitly
declining to attest hidden state or provenance. Its native brand checks cover
examples such as disguised Date and Map; they are not used to prove that every
accepted record has no inaccessible semantics.

The maintainer chose **structural record eligibility**: Veil governs the complete
passively inspectable own-data representation and allowed container prototype.
It does not attest hidden state/object provenance that is not represented there.
An object whose visible representation passes is accepted as that representation;
hidden/private/native state and custom behavior are outside the governed value.

The ownership mechanism is unchanged: private copies own the admitted structural
data and keep policy input stable. This clarification is a domain contract
choice, not provider equivalence, persistence parity or a request to redesign
reference traversal.

## Reproduction 1: stateful built-in iterator

On the repository's Node v24.18.1, a genuine array iterator with its prototype
replaced by null has exactly the same observations as an empty null-prototype
record under the proposed descriptor/prototype inspection, Array.isArray, and
all available node:util.types predicates. It still owns iterator state. Calling
its native next method can consume that state and invoke an array getter.

This standalone, inert probe was run; it does not implement capture or modify
runtime/behavioral tests:

```js
const assert = require('node:assert/strict');
const { types } = require('node:util');
let getterCalls = 0;
const source = [];
Object.defineProperty(source, '0', {
  get() { getterCalls++; return 'stateful'; },
  enumerable: true, configurable: true,
});
const iterator = source.values();
const next = Object.getPrototypeOf(iterator).next;
Object.setPrototypeOf(iterator, null);
const passive = Object.create(null);

function inspect(value) {
  return {
    nullPrototype: Object.getPrototypeOf(value) === null,
    descriptors: Object.getOwnPropertyDescriptors(value),
    keys: Reflect.ownKeys(value),
    array: Array.isArray(value),
    nativeBrands: Object.entries(types)
      .filter(([, predicate]) => predicate(value))
      .map(([name]) => name),
  };
}
assert.deepEqual(inspect(iterator), inspect(passive));
assert.equal(getterCalls, 0);
assert.throws(() => next.call(passive), TypeError);
assert.deepEqual(next.call(iterator), { value: 'stateful', done: false });
assert.equal(getterCalls, 1);
```

Observed for both inputs: null prototype; no own properties; not an array;
no positive native type predicate. The explicit final next call distinguishes
them, but is not an acceptable capture classifier: it invokes input-dependent
behavior and mutates iterator state. No global/built-in modification, Proxy or
native addon is involved in this counterexample.

A producer can return this iterator as its result. Whole-result `$ref` selection
returns the terminal directly, without enumerating its contents again, so the
value can reach the proposed capture boundary. This is not a value already erased
by literal resolution or SQLite JSON conversion; memory execution is sufficient.

## Reproduction 2: hidden private state

The same probe family compared these two values:

```js
class PrivateState {
  #state = { mutable: true };
  static hasState(value) { return #state in value; }
}
const plain = { value: 1 };
const instance = new PrivateState();
instance.value = 1;
Object.setPrototypeOf(instance, Object.prototype);
```

Both have Object.prototype, one identical enumerable/writable/configurable data
member, the tag `[object Object]`, and no positive node:util.types predicate.
The class's private-brand test distinguishes them: false for plain, true for
instance. The runtime does not possess such a private-brand predicate for every
possible class. These observations do not prove that every conceivable engine
inspection API is incapable of distinguishing the objects; they demonstrate
that the readiness mechanism cannot establish the claimed general classification.
Treating both as records is a possible structural contract, but must be explicit
rather than an undocumented interpretation of “plain/passive” and “other rich”.

Earlier native probes correctly rejected disguised Date/Map via their dedicated
brand predicates and detected normal/revoked proxies without traps. Those facts
remain valid. They do not justify extrapolating native brand coverage to every
rich object or private-state instance. This gap was found before implementation,
not hidden behind a best-effort rejection list.

## Why the probes no longer block the approved representation

- Accepting every allowed-prototype, data-descriptor shape is now the chosen
  structural record definition. It captures the visible data safely and makes no
  categorical promise about hidden rich/private state.
- A finite list of recognized native brands is useful but is not a proof that
  every unmatched value is a plain record. New checks for particular examples
  do not resolve arbitrary private provenance.
- Rejecting all uncertain records would also reject ordinary records required by
  the accepted domain, including empty null-prototype records.
- Invoking instance methods or trying operations on the input is not harmless
  reflection; the iterator example shows getter execution and state consumption.
- JSON or unrestricted structuredClone is not a domain definition or a lossless
  replacement for the accepted record prototype, descriptor and alias rules.
  A different carefully restricted classification mechanism would need evidence
  for the exact contract; no such mechanism is claimed by this report.
- A new host-issued brand, producer registration/provenance mechanism or engine
  introspection subsystem would broaden the smallest receiving-input boundary
  and require architectural approval, rather than being an incidental copier.

The threat model does not promise hostile-code isolation. That limit does not by
itself settle which values a trusted custom producer is permitted to return for
capture, or which unsupported values must fail. No malicious built-in tampering
is necessary to create either example. Conversely, merely accepting their
visible data under a clarified structural contract would not itself disprove
A0 ≡ C0: the semantic choice and the security claim must be kept separate.

## Concrete maintainer decision needed

The accepted clarification is:

> Governed record eligibility is defined by the approved inspectable own-data
> structure and allowed prototype. Hidden private/native state and original
> construction provenance are not part of the governed value or its structural
> equivalence. State explicitly which native brands are rejected, and whether
> an otherwise eligible unrecognized object is projected to an owned record.

This is now the normative interpretation of ADR-0011. Both probes are accepted
or rejected solely by their inspectable representation: the iterator with a
null prototype and no own data is an empty governed record; the private-state
instance with an allowed prototype and enumerable data is governed by that data.
Their iterator/private behavior is not copied or protected. No provenance
attestation is attempted.

Once resolved, the remaining authorized plan can resume: explicit host opt-in,
private per-invocation version selection across active SQLite reload, receiving
capture before validation, frozen detached policy input, allow, detached mutable
capability input, and paired v1/v2 tests. Safe `$ref` traversal remains excluded.

## Governance and unchanged guarantees

No execution/governance anchor changed in this task. The four prospective sites
were located individually for eventual review:

| Site | Current trusted anchor | Present disposition |
| --- | --- | --- |
| JobManager.executePlan → this.execute | `75b4703be8dcf754f100d3231e3da7a1fd53e3a04ac00b132be0953305ca87bc` | Unchanged; no replacement submitted. |
| JobManager.execute → capability.execute | `db7d11c496d45d0718ae5a3bb1c0b98fa7a1ee42ff113f63572d653801e6eb2c` | Unchanged; no replacement submitted. |
| OperatorRuntime.executePlan → JobManager | `815c4aa9b00ff58a8ddfa02a86ddd489d3f1c79f39eba998da9b89c1ea369d93` | Unchanged; no replacement submitted. |
| OperatorRuntime.run → strategy.execute | `0c72436533d158d736935e3f29f2033715f419f886e716d89bb4c861b111e4bf` | Unchanged; no replacement submitted. |

The checker and baseline remain unchanged; candidate machinery was not
self-authorized. Fixed comparison remains the implementation-start trusted
checkpoint above, not a later or easier base.

**No new runtime guarantee is established by this clarification.** Current v1
shared identity, mutable policy input, getter/Proxy reference reads and
persistence behavior remain as before. ADR-0011's ownership guarantee remains
approved but unimplemented.
Provider-operation/effect equivalence, committed-result stability, exactly-once
execution and general hostile-code isolation remain outside scope. Experiment II
is untouched and supplies no evidence for this missing classification rule.

## Verification

There is no v2 implementation, so v2 prevention tests cannot be truthfully
reported as passing; their creation/conversion awaits the implementation task.
These
checks verify the unchanged baseline only:

- Focused run:
  `node --test .tmp/test-build/test/result-reference.test.js .tmp/test-build/test/value-ownership.test.js .tmp/test-build/test/structural-ownership.test.js .tmp/test-build/test/plan-version.test.js`:
  exit 0, all four test-file subtests passed.
- `npm run check`: exit 0 outside the sandbox under existing approval;
  typecheck, all 294 functional tests, build and package-consumer verification
  passed (104 packaged files). No live Experiment II trials were run.
- `npm run test:quality`: initial sandbox run exited 1; both
  `tools/quality-governance.test.mjs:1:1` and `tools/quality.test.mjs:1:1` reported
  only `test failed`. The authorized outside-sandbox rerun exited 0 with all
  216 tests passing. No checker or test was changed to obtain that result.
- `npm run quality -- --base 103521d0d92a14d030ad56bb89e7c0a5ea902d87`:
  exit 0; source, test and harness deltas each +0/-0, dependencies/lockfile and
  verification controls unchanged, no unapproved execution references or
  unsupported accesses. Base and baseline are unchanged.
- `git diff --check` and documentation whitespace/fence/source-link checks
  passed. Complete task addition reviewed; preceding documentation work is
  retained. Scoped diffs confirm no source, test, governance, experiment,
  package or CI edits. No repository site-build command exists; source-link
  verification is not a claim that a published site was rebuilt.

No verification failure remains. The former classification blocker is resolved;
checks on legacy code do not establish the future ownership property and no v2
prevention tests were claimed as passing.

Final outcome: **READY_TO_IMPLEMENT_VERSIONED_BOUNDARY**.
