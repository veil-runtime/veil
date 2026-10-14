# Participant interaction protocol (offline v1)

The host calls each participant policy with one detached JSON observation:

```json
{"tick":0,"objective":"Release the refined source value","capabilities":[],"inbox":[],"receipts":[]}
```

`capabilities` are only that participant's public Veil descriptors. `inbox` contains `{from,body}` for delivered participant messages. `receipts` contains only that participant's new public proposal outcomes. The policy may retain its own local state. IDs (`p0`, `p1`, `p2`) carry no role meaning; the assignment rotates with the seed. No assignment map, world value, other participant receipt, scheduler future, fault schedule, authorization trace, or evaluator output appears in an observation.

Exactly one action is accepted per activation:

```json
{"type":"send","to":"all","body":{"kind":"raw","value":"..."}}
{"type":"submit","proposalId":"p1","plan":{"version":"2.0","steps":[{"id":"s","capability":"...","input":{}}]}}
{"type":"idle"}
```

The transport forwards bounded messages verbatim at the next recipient activation. It does not parse message meaning, select recipients beyond the sender's `to`, assign a leader, create a proposal, or recover a failure. Unknown/malformed/oversize actions stop the trial. A proposal is untrusted. The host enforces transport limits, submits its bounded passive plan to a V2-only `OperatorRuntime`, and supplies the caller and scopes from host-owned participant assignment. The host does not adopt caller/scopes from the plan, input, or message. Each invocation still requires Veil admission and authorization. Responses are `SUCCESS`, `FAILED`, `DENIED`, `REJECTED`, or `UNKNOWN`; `UNKNOWN` carries no proof of success or failure. There is no automatic retry.

The deterministic policy uses public result values and failure messages to choose its next action. That programmed behavior is a scripted baseline, not an instance of emergent organization.
