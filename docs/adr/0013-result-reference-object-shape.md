# ADR-0013: Result-reference object shape

**Status:** Accepted

**Date:** 2026-09-24

**Accepted:** 2026-09-24

## Context

Veil documents a result reference as an object with exactly one property, `$ref`,
whose string identifies an earlier step result. `ResultReference` is a public
structural TypeScript type with one readonly string field. Every public example,
planner fixture and wire protocol uses the ordinary data form:

```ts
{ $ref: 'steps.source.result.value' }
```

Before this decision, the recognizer did not implement that shape exactly. It
counted enumerable own string keys with `Object.keys`, then read `$ref` through
ordinary property lookup. An object with one unrelated enumerable own key and an inherited `$ref`
could therefore be recognized as a reference. Nonenumerable and symbol-keyed extras
were not counted. The earlier contracts did not say whether `$ref` may be an
accessor or nonenumerable property, whether hidden or symbol extras count, or
whether the prototype affects recognition.

This ambiguity could not be resolved safely as an implementation detail. It changes
which public `ExecutionPlan` inputs are instructions and which remain ordinary
input data. The architecture is locked, so the maintainer explicitly approved the
decision below before source or test changes.

## Evidence of intent

- The result-reference guide says the object has exactly one property, `$ref`, and
  an object with other keys is ordinary input
  (`docs/concepts/result-references.md:6-15,50-52`).
- The ExecutionPlan v1 reference writes the shape exactly as
  `{ $ref: 'steps.<earlier-step-id>.result' }`
  (`docs/reference/execution-plan-v1.md:67-69`).
- The root-exported `ResultReference` interface contains only
  `readonly $ref: string` (`src/runtime/planner/planner.ts:9-11`;
  `src/index.ts:10-16`). `readonly` is a compile-time assignment restriction; it
  does not define a JavaScript descriptor.
- Repository examples, tests and model protocols use object literals or decoded
  JSON with one enumerable data property. No repository caller intentionally uses
  an inherited, accessor-backed or nonenumerable `$ref`, hidden/symbol extras, a
  Proxy wrapper, or a class/null-prototype wrapper.
- ADR-0008 and its regression test deliberately allow an ordinary reference
  object's `$ref` value to change before resolution
  (`docs/adr/0008-structural-execution-ownership.md:27-31`;
  `test/structural-ownership.test.ts:274-293`). That is a sharing/timing rule, not
  evidence for accessor, prototype or hidden-key semantics.
- ADR-0011 preserves existing admission and resolution behavior, including possible
  getter and Proxy execution, but begins only after resolution. It does not define
  the wrapper shape (`docs/adr/0011-governed-value-ownership.md:21-31,129-140`).
- ADR-0012 preserves the existing reference syntax and value model. It does not
  resolve this pre-existing shape ambiguity
  (`docs/adr/0012-structured-admission-diagnostics.md:157-168`).

The strongest supported interpretation is a JSON-like tagged data object. It is
"JSON-like" because its own visible representation is the same single string
field used on wire paths; generic `JSON.stringify` behavior does not define the
contract.

Exactness applies to the submitted JavaScript object's actual own-property
representation, not to a hypothetical lossy JSON projection. A hidden or symbol
own property makes that object a mixed tag/data object even though JSON transport
would omit the extra property. Rejecting such a wrapper from reference
classification does not assert that the extra property is dangerous, inspect its
value, or establish a hostile-object boundary; it gives “exactly one property” one
unambiguous JavaScript meaning. Serializing the object may produce a different
object with different classification after a lossy round trip. This contract does
not promise classification preservation across transformations that discard
properties.

## Decision

A result-reference object has this exact representation:

1. It is a non-null JavaScript object and is not an array.
2. Its complete own-key set is exactly the single string key `$ref`. Complete
   means string and symbol keys, enumerable and nonenumerable, as observed by the
   language's own-key reflection.
3. `$ref` is an own, enumerable data property. An accessor property does not form
   a reference.
4. The data-property value is a primitive string.
5. Writable and configurable flags do not affect recognition.
6. The object's prototype does not affect recognition. Ordinary, null and custom
   prototypes are permitted when the own representation above is satisfied.
   Inherited unrelated properties do not affect classification. An inherited
   `$ref` cannot substitute for the required own data property. A class-created
   instance with the exact own data shape is intentionally eligible; this follows
   structural typing and avoids a prototype restriction, although no repository
   caller currently relies on that form. Private fields and internal slots are not
   own property keys and do not affect wrapper classification.
7. Proxy objects are not categorically rejected. A non-array Proxy is evaluated by
   the same observable own-key and own-descriptor rules. Its traps may run, throw,
   mutate state or report a virtual conforming shape. A later ordinary `$ref` read
   may also invoke its `get` trap. Revoked Proxies and throwing traps may propagate
   exceptions through the existing admission or resolution flow. This decision
   supplies no passive-recognition or hostile-object guarantee.
8. Shape recognition and reference-string parsing remain separate. A conforming
   wrapper with a malformed string is a recognized but invalid reference and is
   handled by the existing parser/diagnostic path. A non-string `$ref` does not
   form a reference and remains ordinary input subject to normal input validation.

The existing parser remains authoritative for syntax. The normal form is
`steps.<nonempty-step-id>.result` followed optionally by dot-separated result path
segments. This decision does not tighten its already documented empty-segment edge
behavior or change earlier-step validation.

This contract applies whenever Veil recognizes a reference during both admission
and execution. It does not freeze the wrapper or change ADR-0008 sharing: an
ordinary data `$ref` may still be changed by the caller before a later recognition
operation observes it.

## Why each rule exists

| Dimension | Rule | Basis |
| --- | --- | --- |
| Own versus inherited | `$ref` must be own | Required for the tag to belong to the submitted object and to correct the known inherited-lookup defect. |
| Data versus accessor | Own data property only | Required by the tagged-data abstraction and wire representation; also prevents an ordinary accessor from supplying a dynamic tag value during the shape check. This is a compatibility tightening, not a general no-callback guarantee: once classified as ordinary input, existing recursive traversal may still invoke that accessor. |
| Enumerability | `$ref` must be enumerable | Required to match the represented field in object literals, JSON and current recursive input enumeration. It also preserves rejection of a sole nonenumerable `$ref`. |
| Writable/configurable | Either value accepted | Descriptor mechanics are not part of reference meaning or wire data. Restricting them would reject frozen/sealed values without semantic benefit. |
| Enumerable string extras | Reject as ordinary input | Already required by the documented exact form and invalid-case rule. |
| Nonenumerable string extras | Reject as ordinary input | Required because the actual wrapper must consist only of the instruction tag; hidden payload makes it a mixed object even if a later serialization would omit it. This classification rule is not a security claim and tightens incidental current acceptance. |
| Symbol extras | Reject as ordinary input | Symbols are actual own properties outside the documented tag. The wrapper is therefore mixed tag/data rather than the exact instruction object. This is not based on symbol danger and tightens incidental current acceptance. |
| Prototype | Do not restrict; do not use inherited `$ref` | Prototype identity contributes no data to the tag. Inherited unrelated properties are ignored. A restriction would be unrelated to reference meaning and would unnecessarily reject structural TypeScript values; exact-shape class instances are intentionally eligible. |
| Arrays | Reject | A JavaScript array always has its own `length` key, so it cannot satisfy the single-own-key rule. The explicit early rejection follows the tagged-record abstraction and preserves current behavior. |
| Proxy | No special rejection | Proxy exclusion would introduce a broader hostile-object/value-domain boundary. Standard reflection may invoke traps; that behavior remains part of the separate pre-capture investigation. |
| Value type | Primitive string | Explicit public type and documentation requirement. Boxed strings are not strings. |
| Syntax | Existing parser and earlier-step rules | Preserves the established grammar, diagnostics and parser edge behavior; object-shape clarification does not redefine selection syntax. |

## Compatibility

| Input representation | Previous behavior | Accepted behavior | Compatibility classification |
| --- | --- | --- | --- |
| Ordinary `{ $ref: 'steps.a.result' }` | Reference | Reference | Supported behavior preserved. |
| Frozen/sealed ordinary wrapper | Reference | Reference | Preserved; writable/configurable flags are irrelevant. |
| `Object.create(null)` with one enumerable data `$ref` | Reference | Reference | Theoretical structural compatibility preserved. |
| Class instance with one own enumerable data `$ref` | Reference | Reference | Intentionally eligible under the accepted structural contract; no repository reliance was found. |
| Inherited `$ref` plus one unrelated enumerable own key | Reference | Ordinary input | Required defect correction. |
| Inherited `$ref` with no own key | Ordinary input | Ordinary input | Preserved. |
| Own enumerable accessor `$ref` returning string | Reference and getter executes | Ordinary input | Compatibility tightening; no repository-supported reliance found. |
| Sole nonenumerable data `$ref` | Ordinary input | Ordinary input | Preserved. |
| Nonenumerable `$ref` plus one unrelated enumerable own key | Reference | Ordinary input | Required by the exact own shape. |
| Own enumerable data `$ref` plus hidden string extra | Reference | Ordinary input | Compatibility tightening of incidental behavior. |
| Own enumerable data `$ref` plus symbol extra | Reference | Ordinary input | Compatibility tightening of incidental behavior. |
| Non-array Proxy reporting the exact data shape | Reference, traps may run | Reference, traps may run | Broad Proxy compatibility preserved; exact trap sequence is not promised. |
| Array carrying `$ref` | Ordinary input | Ordinary input | Preserved. |
| Own `$ref` with non-string value | Ordinary input | Ordinary input | Preserved. |
| Exact wrapper with malformed string | Recognized, then parser rejection | Recognized, then parser rejection | Syntax/diagnostic behavior preserved. |

The rejected JavaScript-only shapes are theoretically accepted today but are not
documented or intentionally tested wrapper representations. All repository-backed
public usage remains accepted.

The complete v1 tightening is limited to values that the current enumerable-count
plus ordinary-read combination overrecognizes:

- an inherited string-valued `$ref` (data or getter) paired with exactly one
  unrelated enumerable own string key;
- a nonenumerable own string-valued `$ref` (data or accessor) paired with exactly
  one unrelated enumerable own string key;
- an enumerable own `$ref` accessor that returns a primitive string;
- an otherwise conforming enumerable data `$ref` accompanied only by one or more
  nonenumerable string or symbol own extras; and
- analogous Proxy-reported shapes that pass current `Object.keys` plus ordinary
  `get` but do not report the accepted exact enumerable own data descriptor.

A sole nonenumerable or inherited `$ref`, arrays, non-string values, and objects
with an additional enumerable string key are already ordinary input and remain so.
Ordinary object literals, frozen/sealed equivalents, exact null/custom-prototype
objects, exact class-created objects, and Proxy wrappers reporting the exact shape
remain eligible.

## Version applicability

This representation contract applies to ExecutionPlan 1.0 and 2.0 as a
correction to their shared recognizer and unversioned public `ResultReference`
contract.

A v2-only rule would leave the known malformed-recognition defect in v1 and create
two wrapper languages that neither the public type nor current documentation can
express. Once a conforming wrapper is recognized, the change does not alter parser
behavior, result selection, value ownership or authorization-to-entry behavior.
Its only semantic change is the explicit wrapper-classification tightening for
unsupported JavaScript representations that conflict with or extend the documented
single-field tag.

The v1 contract itself supplies the correction basis: it documents the one-field
literal, declares other-key objects ordinary input, and exports one string field.
Every repository-backed v1 caller uses that form. No accepted ADR, test, example or
history entry intentionally preserves the overrecognized forms listed above. The
decision preserves ADR-0008's shared wrapper identity and the ability to mutate an
ordinary data `$ref` before resolution. It changes classification only where the
current recognizer departs from the documented tag abstraction.

ADR-0011's requirement to preserve v1 meaning concerns the versioned governed-value
ownership boundary it introduces. This decision does not revise that guarantee or
move its start point; it corrects the separate, pre-existing wrapper syntax shared
by both versions. This ADR is the explicit authority for that cross-version
correction.

## Implementation

`isResultReference` in `src/runtime/execution/result-reference.ts` implements the
approved contract with this small reflective sequence. For an ordinary object, the
sequence remains passive with respect to application callbacks:

1. reject null, non-objects and arrays;
2. obtain the complete own-key set and require the sole key to be `$ref`;
3. obtain the own `$ref` descriptor without reading the property value through the
   object;
4. require an enumerable data descriptor and test its descriptor value as a
   primitive string.

Own-key and descriptor inspection does not invoke an ordinary object's `$ref`
getter. It is not passive for a Proxy: own-key and descriptor traps, conversion of
a trap-reported descriptor, and any later ordinary `$ref` read can execute
Proxy-controlled behavior or throw. No stable snapshot or exact trap-count contract
is implied.

The implementation adds no prototype allowlist, Proxy detector, capture step,
serializer or path-selector change. It requires no parser, path traversal,
ADR-0011 capture, authorization, persistence or Experiment II change.

Focused regressions in `test/result-reference.test.ts` and
`test/governed-value-v2.test.ts` cover:

- ordinary valid wrapper, including frozen/sealed form;
- null/custom-prototype wrapper with an own conforming data property and inherited
  unrelated properties that do not affect classification;
- an eligible class-created wrapper with an own conforming data property;
- inherited `$ref` plus unrelated own property;
- inherited-only `$ref`;
- own accessor `$ref`;
- nonenumerable `$ref`;
- enumerable `$ref` plus nonenumerable string extra;
- enumerable `$ref` plus symbol extra;
- extra enumerable string key;
- missing and non-string `$ref`;
- conforming wrapper with malformed reference text, proving recognition still
  reaches parser rejection;
- Proxy-reported conforming and nonconforming shapes, without asserting passive
  recognition or exact trap counts, plus propagation from a throwing reflection
  trap;
- a regression proving reference recognition does not broaden to arrays, class
  prototype getters, or other reference-shaped ordinary input; and
- unchanged v1/v2 parser and admission-diagnostic behavior for conforming valid and
  malformed-string wrappers.

## Non-goals

This decision does not decide or change:

- traversal of `steps.foo.result.some.path`;
- getter or Proxy behavior on referenced results;
- passive or non-reentrant recognition of hostile input objects;
- recursive literal-input traversal, coercion, iteration or mutation behavior;
- ADR-0011 governed capture, authorization, capability entry or version semantics;
- producer-result validation, serialization, SQLite parity or committed-result
  stability;
- parser grammar, path escaping, array indexing or special-name behavior;
- Experiment II protocols, traces, results or authority claims.

Descriptor-based wrapper recognition must not be described as making result-path
traversal, all admission processing or all resolution passive. In particular, an
accessor-backed `$ref` rejected as a wrapper becomes ordinary input; the existing
`Object.values`/`Object.entries` recursion may then invoke its getter. This decision
only prevents that accessor from defining the instruction tag.

## Alternatives considered

### Enumerable-own-string shape only

Require `Object.keys()` to return only `$ref` and require `$ref` to be own, while
continuing to ignore hidden and symbol extras and accepting accessors. This is the
smallest implementation delta, but it leaves “exactly one property” dependent on
enumerability and permits a mixed instruction/data object not expressible by the
public tag shape.

### Plain-record and Proxy rejection

Require an ordinary or null-prototype record and reject class instances and
Proxies. This would create a broader value-domain and hostile-object boundary. No
reference-abstraction requirement or compatibility evidence justifies it here.

### Serialization-defined recognition

Recognize whatever serializes to the one-field JSON form. Serialization can invoke
`toJSON` and accessors, loses symbols/hidden values, and makes recognition depend on
conversion behavior. It is not an appropriate semantic definition.

### Version-specific strict shape

Apply the exact shape only to v2 or a future plan version. This preserves the v1
defect and splits an unversioned public syntax without changing the meaning of
result selection. The documented contract predates v2, so versioning is not
justified for this correction.

## Acceptance

The maintainer approved this decision as written on 2026-09-24, including its
cross-version compatibility correction, exact own-key/data-descriptor contract,
prototype neutrality, and explicit absence of a Proxy-safe or result-path traversal
guarantee. Acceptance authorizes only the recognizer, focused regression and
contract-documentation changes described here.
