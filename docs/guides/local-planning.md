---
title: Optional local planning
---
# Optional local planning

Core needs no model. Its public `Planner` contract returns an `ExecutionPlan`;
the application passes that plan to `runtime.executePlan()`. Discovery supplies
passive metadata and never permission. An application can always construct plans
deterministically. The internal adapter below is source-server infrastructure;
it is not a new npm import or provider export.

## Source-server setup

Start a compatible local inference service and install the desired Qwen model
separately. This repository neither installs models nor starts inference servers.
From the repository root, after `npm ci`:

```bash
OPERATOR_LOCAL_PLANNERS=1 QWEN_BASE_URL=http://127.0.0.1:11434/v1 QWEN_MODEL=qwen3:0.6b npm start
```

Then explicitly select the planner:

```bash
curl http://127.0.0.1:3333/api/jobs/run \
  -H 'content-type: application/json' \
  -d '{"goal":"Read README.md with filesystem.file.read","planner":"qwen-local"}'
```

This is an optional manual live smoke, not an automated release claim. Use the
exact model identifier exposed by `/v1/models`. Goal execution remains host-owned
and can read allowed local data; inspect configuration before running it. The
bundled HTTP server is for trusted local use, not an authenticated network service.
The deterministic default supports goals containing a URL and requires no model.

`PlannerRouter` selects a strategy. The strategy obtains a proposed plan. The
adapter always constructs V1 with host-generated step IDs and advertised capability
versions; a model-supplied version cannot upgrade plan semantics. `OperatorRuntime`
then applies ordinary admission, resolved-input validation and authorization.
Default policy denies write/destructive work even when the model requests it.
Approval/caller fields in generated envelopes are rejected, not treated as policy.

## Bounds and failure handling

The source adapter defaults to 15-second generation and five-second health
deadlines, a 65,536-byte serialized request cap, a 131,072-byte streamed response
cap, 1,024 requested maximum output tokens and 16 steps. Internal host construction
can set bounded overrides; the model cannot. Response limits apply to health
checks too. Stalled fetch/body operations time out and abort their transport.
Redirects, embedded credentials and remote plaintext HTTP are rejected. Errors
do not echo response bodies or transport credentials. Malformed, truncated or otherwise incomplete generations and unknown
capabilities fail; execution still validates capability field types independently.

There is no automatic provider retry. An explicitly chosen fallback/reviewer
strategy can call more than one provider, with each call bounded separately.
These are local inference transport bounds, not runtime-wide budgets, cancellation
of capability work, exact token metering or monetary guarantees. Request
serialization and the host's capability catalogue remain trusted host memory.
The host must limit concurrent requests and control the model process itself.
Never send tenant/private goals to an endpoint without the appropriate host policy;
the global catalogue and historical job hints are not tenant-filtered.

The existing public `Planner` interface remains sufficient for an application-owned
adapter using `runtime.listCapabilities()` and `executePlan()`. Do not deep-import
this internal provider from a published package. See
[public exports](../reference/public-exports.html).
