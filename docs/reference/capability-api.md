---
title: Capability API
---
# Capability API

A Capability has name, version, description, risk, optional inputSchema, and async execute(input, context). Use createCapability from the root SDK. See [capabilities](../concepts/capabilities.html).

`CapabilityDescriptor` (unreleased v0.1.4) is the public metadata projection:
`name: string`, `version: string`, `description: string`, `risk: CapabilityRisk`,
and `inputSchema: Record<string, CapabilityInputField>`. Runtime introspection
returns detached mutable copies, with `{}` for missing schemas; it never returns
capability implementations. See [OperatorRuntime](operator-runtime.html) for list,
exact lookup, global inventory scope and ownership semantics.

Each input field has `type: string`, `required: boolean`, and `description: string`.
Current validation supports string, number, boolean, object and array fields.
This is a limited Veil field contract, not full JSON Schema and not necessarily
the complete requirements imposed by capability code. Metadata is passive and
author-supplied. **Introspection is not authorization.** Provider readiness is not
implied by a descriptor.
