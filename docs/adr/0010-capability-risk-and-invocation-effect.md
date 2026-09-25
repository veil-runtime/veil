# ADR-0010 proposal: Capability risk and invocation effect

**Status:** Draft proposal — not accepted; no public contract authorization

**Date:** 2026-09-22

**Current-state note (2026-09-25):** ADR-0011 was subsequently accepted and its
post-resolution ownership boundary implemented as opt-in ExecutionPlan `2.0`.
References below to Draft ADR-0011 or deferred A/B ownership record this proposal's
historical checkpoint. ADR-0010 remains Draft, and V2 does not establish the
provider-operation/effect binding proposed here.

## Context

Veil separates untrusted reasoning from runtime authority. CapabilityRisk is a
static `read | write | destructive` field on a registered capability. Descriptors
copy it. ExecutionAuthorizer receives capability identity/risk, resolved input,
job/step identity and optional host caller. The default permits read and denies
write/destructive. Neither a plan nor a descriptor conveys permission.

This field describes a capability's potential effects, not necessarily the
effects of a particular invocation. `http.request` supports GET through DELETE;
the prior read classification understated its surface. It now uses destructive
risk and host policy can allow narrower inputs. Method alone does not determine
effects: targets, credentials, redirects and remote implementation also matter.

`shell.command.run` formerly used read-risk plus executable/subcommand prefixes.
Arguments could select branch deletion, creation, output files or other effects.
The current restriction matches complete canonical tuples and uses conservative
destructive risk. PATH, environment, cwd, executable/configuration state and
subprocesses still influence effects. A correct argv classification is not a
general effect guarantee.

Outbound MCP illustrates the same issue: a host-configured startup command and
remote tool implementation may have effects beyond the risk declared by a
capability wrapper. Introspection cannot infer their safety.

## Proposed distinction for investigation

Keep capability-level risk as the conservative possible-effect description.
Consider a separate trusted invocation description stating the concrete operation,
resources/targets, relevant effect information and unresolved uncertainty for
one prepared request. A proposal may request work but cannot supply authoritative
classification or downgrade risk. Unknown effects must not silently become read.

Possible future sequence, not an accepted contract:

1. Resolve references into an owned value domain.
2. Prepare/canonicalize the concrete invocation using trusted capability/provider
   rules, without performing the requested external operation.
3. Validate that prepared invocation and its relevant assumptions.
4. Authorize an immutable view including static risk, invocation details and
   host caller.
5. Invoke using the same governed values; fail closed if required assumptions
   cannot be maintained.

For commands this could include exact executable identity, argv, resolved cwd,
relevant environment/configuration assumptions and target resources. For HTTP it
could include method, target and credential scope, with redirect/destination
policy still enforced where the provider connects. Not every environmental
assumption can be frozen; the contract must state its limits.

This depends on the deferred invocation-value model. Adding an `effect` label
without binding it to what is actually invoked would only reproduce the current
problem under a new name. Preparation must not become an alternate execution
entrance, provider-side authorization, or an authority-bearing plan.

The 2026-09-23 [value-ownership investigation](../architecture/value-ownership-investigation.html)
now reproduces divergence through authorizers, producer aliases, memory job
handles, subscribers, SDK middleware and capability/provider reconstruction.
[Draft ADR-0011](0011-governed-value-ownership.html) separates immutable policy
input (A), equivalence at outer capability entry (B), provider-operation
equivalence (C), and stable result commits (D). A/B are prerequisites for binding
an invocation-effect observation to capability input, but do not establish C or D.

In particular, a trusted preparer must bind the actual provider operation to its
prepared value. It cannot authorize descriptive metadata and then permit
capability code to rebuild the request from mutable originals. Even stable
provider request data would not freeze remote or ambient host state. Do not
implement an invocation-effect field as a substitute for the ownership decision.

## Alternatives

- Retain static risk with input-aware host authorization and narrow capabilities.
  This already works for explicit domain operations and may be sufficient.
- Define operation-specific capabilities with fixed, provider-owned behavior.
  Prefer this before introducing a general invocation-effect API.
- Add optional descriptive effect metadata only. This may help policy explain
  decisions, but supplies no value-stability guarantee by itself.
- Introduce a generic effect lattice or command-policy language. No present
  evidence justifies the complexity or a claim of complete effect inference.

## Security implications

The reasoner remains outside the trust boundary. Runtime authorization must
remain mandatory and fail closed. Trusted preparers cannot be replaced through
input, metadata, caller claims or provider handles. Prepared values must not
share mutable aliases that permit a decision on A followed by execution of B.
Side effects that occur after a process/network request starts can still be
uncertain; this model would not imply rollback or safe retries.

## Compatibility and release implications

No ExecutionPlan change is currently justified. Existing authorizers depend on
resolved-input shapes; canonicalizing before authorization, changing result
identity, or binding prepared values changes semantics and needs maintainer
approval under the architecture lock.

Purely additive, optional descriptive metadata might fit a future minor release
if old authorizers keep their behavior and no security guarantee depends on them
understanding the addition. Mandatory preparation or changed authorized-value
semantics should be treated as a breaking migration: a major release under a
stable API policy, or an explicitly announced breaking minor while Veil is 0.x.
Do not promise a release number until the value model and compatibility rules
are accepted. Current local security restrictions retain version strings as
requested; this proposal schedules no release.

## Recommendation

Investigate the distinction, but do not implement dynamic risk now. Review the
independent ADR-0011 value-domain and ownership choices before implementing that
guarantee. Operation-specific fake capabilities remain a possible later fixture;
the external-reasoner experiment has not begun. Resolve ownership and
canonicalization before deciding whether a new effect primitive is necessary.
An explicit maintainer decision is required before changing any locked contract.
