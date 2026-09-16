---
title: Outbound MCP
---
# Outbound MCP

The repository contains an internal MCP provider that launches a downstream stdio MCP client for each call, invokes a named tool, and closes it. Its internal helper creates a capability with an optional `arguments` object. Neither is a root public export in v0.1.3. Treat it as implementation material, not a supported consumer extension API.

The trusted local integration author owns risk classification and must pass an explicit `CapabilityRisk` (`read`, `write`, or `destructive`) as the final argument to `createMcpCapability(name, description, downstreamToolName, provider, risk)`. Unclassified tools and invalid classifications are refused at construction, before provider execution. The declared risk is preserved for runtime authorization; default authorization blocks `write` and `destructive` capabilities.

Remote MCP annotations are not governance authority. Risk is never inferred from tool names, descriptions, annotations, or other remote metadata. The local author must classify the downstream tool's behavior correctly.
