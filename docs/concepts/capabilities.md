---
title: Capabilities
---
# Capabilities

## What it is

A Capability describes one operation Veil can execute: name, version, description, risk, optional inputSchema, and async execute(input, context?). Risk is exactly read, write, or destructive. The capability is resolved from its name during plan execution.

## A running example

An orders.create capability might declare name orders.create, risk write, fields sku and quantity, and execute a request using an order-system client. The operation contract and risk belong here; remote transport, credentials, and vendor API detail belong in a provider. A companion orders.read would normally be risk read.

## Authoring with the public SDK

createCapability accepts the same contract through a typed CapabilityDefinition. Its execute callback receives { input, context? }, not input directly. The helper applies lifecycle logging by default, optional timeout middleware when timeoutMs is set, then supplied middleware in listed order around the callback.

~~~ts
type CreateOrderInput = { sku: string; quantity: number };
type CreateOrderResult = { id: string };

const createOrder = createCapability<CreateOrderInput, CreateOrderResult>({
  name: 'orders.create', version: '1.0.0',
  description: 'Create an order', risk: 'write',
  inputSchema: {
    sku: { type: 'string', required: true, description: 'Stock keeping unit' },
    quantity: { type: 'number', required: true, description: 'Requested count' },
  },
  async execute({ input, context }) {
    context?.logger.info('Creating order', { sku: input.sku });
    return { id: 'created-order' };
  },
});
~~~

## Validation and execution

The schema supports only declared fields of type string, number, boolean, object, or array. Required fields must exist; unspecified input fields are not rejected by this validator. The runtime validates direct values at plan admission and resolved values immediately before authorization.

## Host-code trust and results

Registration makes a capability available; it does not authorize an invocation.
The runtime's configured host authorizer remains responsible for allow/deny
decisions. After an allow, the installed capability implementation and its
middleware execute as trusted in-process host code, not as code isolated by a Veil
sandbox. This code trust does not give the capability authority to approve itself.

The public result type is unconstrained. A capability can return a live JavaScript
graph containing aliases, getters, Proxies or provider-derived objects. If a later
step selects a path from that result, active language behavior may run before the
receiving value enters ADR-0011 capture and authorization. A host that requires
passive result data must normalize or detach it in its trusted capability/provider
integration; persistence/reload is not a security guarantee. See
[result references](result-references.html), [providers](providers.html), and
[trust boundaries](../architecture/trust-boundaries.html).

## Registration consequences

runtime.use registers module capabilities in a process-global registry. Therefore separate runtime instances share registered capabilities, while their authorizers remain runtime-scoped. Duplicate capability names are rejected, even when their versions differ; use unique stable names, especially in tests.

## When to use it

Create a capability for a governable operation that needs a name, risk, validation metadata, execution context, and audit trail. Do not make a provider itself a capability merely to expose a raw transport. See [modules](capability-modules.html), [providers](providers.html), and [capability API](../reference/capability-api.html).
