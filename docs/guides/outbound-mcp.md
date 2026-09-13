---
title: Outbound MCP
---
# Outbound MCP

The repository contains an internal MCP provider that launches a downstream stdio MCP client for each call, invokes a named tool, and closes it. Its internal helper creates a capability with an optional `arguments` object. Neither is a root public export in v0.1.3. Treat it as implementation material, not a supported consumer extension API.
