---
title: Providers
---
# Providers

## What it is

A provider is implementation-side code that interacts with an external system. The repository contains browser, HTTP, SQLite, and MCP provider implementations. A capability may call a provider, but provider types are not a general root-package extension API in v0.1.3.

## In the orders example

orders.create is the governed capability; an OrdersProvider-like client is the implementation that sends the remote create request. The capability's name, risk, and input schema are visible to validation and authorization. The provider holds protocol details, endpoint use, connection/session handling, and vendor-specific failure handling.

## Why the distinction matters

If remote I/O occurs inside a capability without a clear operation boundary, authorization cannot distinguish a harmless lookup from a production write. Conversely, making every HTTP primitive a public capability exposes transport rather than business operation. Put the smallest meaningful governed action in a capability and factor reusable external-system mechanics into a provider.

## Lifecycle

Veil does not call a provider directly. It validates, resolves input, authorizes, and calls capability.execute; only then can that capability use a provider. A provider failure surfaces as a capability execution failure and fails the current job. Veil makes no broader guarantee about remote-system transactionality, credential storage, or retries.

## Current limits

Built-in provider implementations and outbound MCP provider helpers are internal paths. Do not import them from src or dist as a consumer. Use application-owned provider code behind public capability APIs.

Related: [capabilities](capabilities.html), [trust boundaries](../architecture/trust-boundaries.html), [inbound MCP](../guides/inbound-mcp.html).
