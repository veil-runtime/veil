---
title: Public API boundary
---
# Public API boundary

## Published boundary

package.json publishes one export: the package root. src/index.ts is the source of truth for that root surface. The package verifier packs the module and asserts that source, tests, tools, API server, built-in capabilities, and most provider/integration paths are excluded. Consumers should import from @veil-runtime/core only.

## What is public

The root exposes OperatorRuntime and its default instance, execution/capability/module/job/planner/authorization/runtime-event types, the capability SDK, and inbound McpAdapter. This is the supported integration surface. See the exhaustive [public exports reference](../reference/public-exports.html).

## What is internal

Capability registry and registration functions, job manager/store/memory, plan validator/reference resolver, event-bus implementation, planner registry/router/strategies/providers, built-in capabilities, API routes/server, browser/HTTP/SQLite providers, logging sinks, and outbound MCP helper/provider are internal. A file being present under dist does not make it public.

## Why it matters

Internal classes coordinate global services and may change with repository architecture. Depending on them bypasses package verification and can make a consumer fail after a patch release. Use public capabilities/modules/authorizer/runtime methods instead. For a need not expressed by public contracts, treat it as an architecture question rather than importing internals.

## Packaging evidence

verify-package packs the current package, checks expected files, rejects internal directories, installs the tarball into a consumer fixture, typechecks it, and runs consumer verification. This is evidence for the root boundary, not a guarantee that arbitrary repository paths will remain usable.
