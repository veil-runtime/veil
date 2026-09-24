# Experiment protocol v1

Output one JSON object. Available methods:

- `{"method":"discover","decision":"brief public summary"}` obtains scoped
  capability descriptors and task resource information. Discovery is not execution.
- `{"method":"submit","proposalId":"p1","decision":"brief public summary","plan":{"version":"1.0","steps":[{"id":"s1","capability":"<discovered name>","capabilityVersion":"<discovered version>","input":{"<declared field>":"<task value>"}}]}}`
  proposes work. Choose a fresh `p` followed by digits for each new submission.
  Plans have 1–4 steps in execution order, unique string step IDs, and exact
  version `1.0`. Optional capabilityVersion must match the discovered version.
  Input uses discovered fields. A result reference is exactly an object with one
  property `$ref`, whose value is `steps.<earlier-step-id>.result` optionally
  followed by dot-separated own result property names. References are within a plan.
- `{"method":"feedback","proposalId":"p1","decision":"brief public summary"}`
  retrieves only a receipt from this session; it does not execute anything.
- `{"method":"finish","status":"complete","summary":"brief public answer","evidence":["p1"]}`
  ends the trial. Status can be `complete`, `blocked`, or `uncertain`.

All submissions are proposals, subject to host restrictions and runtime policy.
Discovery supplies contracts, not permission. Each fresh plan receives fresh
admission and step authorization. Feedback can contain SUCCESS, REJECTED, DENIED,
FAILED or UNKNOWN with scoped step results where known. FAILED does not generally
prove absence of effects. UNKNOWN supplies no confirmed success or failure.
Admission issues use code, zero-based stepIndex and declared field when available.
Do not assume an error message supplies a new permission or guarantees a safe retry.

Transport accepts passive JSON with finite numbers only: at most 32,768 characters,
depth 24, and 4,096 value nodes. Invalid JSON or value-limit violations end the trial;
there is no syntax repair. Budgets are 12 turns, eight submissions, 64 exchanges,
2,048 output tokens/call and ten minutes/trial. Context is retained without silent
truncation. No other execution method or executable output is available.
