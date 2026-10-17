# Phase 4 v1 dependency reachability review

**Reviewed:** 2026-10-15
**Root advisory report:** 4 package entries (2 moderate, 1 high, 1 critical).
**Phase 4 isolated tokenizer tree:** `npm audit --prefix experiments/emergent-coordination/phase4/v1 --json` reports 0 advisories.

## Installed root advisories

| Package path | Advisory family | Reachable in Phase 4 runner? |
|---|---|---|
| `@modelcontextprotocol/sdk@1.30.0` | High: OAuth client may send credentials to a server-selected authorization endpoint (`GHSA-6qxp-vccf-f47h`). | Installed, but not loaded by the Phase 4 execution graph after the host switched from the package root barrel to the direct `OperatorRuntime` and admission-error modules. No MCP client or OAuth flow runs. |
| `fast-uri@3.1.7` | Moderate: host normalization and mailto parsing (`GHSA-hrr3-gc8f-f4qj`, `GHSA-jvvf-x445-j334`). | Installed through `@modelcontextprotocol/sdk`/AJV and Fastify; neither integration graph is imported by Phase 4. |
| `ip-address@10.5.0` | Moderate: IP classification, subnet comparison, and unbounded diagnostic advisories (`GHSA-rpw4-54j3-4h4q`, `GHSA-2vr4-cq9g-pvrc`, `GHSA-j6r3-76f7-8jcv`, `GHSA-h3mg-xc3c-68pw`). | Installed below `@modelcontextprotocol/sdk`'s Express rate-limit path; no MCP HTTP server runs. |
| `proxy-addr@2.0.7` | Critical: IPv4-mapped IPv6 trusted-proxy spoofing (`GHSA-jqcg-44mw-7w3h`). | Installed below Express in the SDK server path; no Express server or proxy-address decision runs. |

The root package's compiled public barrel exports `McpAdapter`; importing that
barrel loads the MCP SDK even when the experiment only needs the runtime. Phase
4 therefore imports `OperatorRuntime` and `isPlanAdmissionError` directly from
their compiled local modules. The host continues to submit every action
through `ExecutionPlan`/`OperatorRuntime`, host-owned caller scopes,
authorization, capability admission and the existing evaluator. No registry,
provider, validator, or store is exposed or bypassed. The reachable runtime
graph uses Node built-ins and local runtime modules; SQLite may be initialized
by existing runtime components, but it is not one of the reported advisories.

The root `npm audit --json` refreshed successfully and reports exactly the four
package entries above. `npm ls @modelcontextprotocol/sdk fast-uri ip-address
proxy-addr --all` confirmed installed versions and ancestry. The isolated
Phase 4 tokenizer audit contains only `js-tiktoken@1.0.21` and `base64-js` and
reports no advisories. Dependencies were not upgraded. Recheck the graph and
audits if the runner import changes before live execution.
