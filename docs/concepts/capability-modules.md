---
title: Capability modules
---
# Capability modules

## What it is

CapabilityModule is packaging, not execution. It has a manifest and a capabilities array. The manifest contains name, version, optional description, declared capability names, and optional providerRequirements, permissions, and operator minimum-version metadata.

## Running example

An orders module can group orders.create and orders.read:

~~~ts
const ordersModule = {
  manifest: {
    name: 'orders', version: '1.0.0',
    capabilities: ['orders.create', 'orders.read'],
    providerRequirements: ['orders-api'],
  },
  capabilities: [createOrder, readOrder],
};
runtime.use(ordersModule);
~~~

## What runtime.use enforces

use builds a set from manifest.capabilities and rejects any supplied capability whose name is absent from it. It then registers each supplied capability. It does not enforce optional providerRequirements, permissions, or operator.minVersion. It also does not, in this check, reject a manifest name for which no capability is supplied.

## Why it exists

A module gives an application an explicit composition unit and makes exposed capability names reviewable. It does not provide provider construction, permission enforcement, runtime isolation, or automatic dependency resolution in v0.1.3.

## Common mistakes

Do not assume manifest permissions configure ExecutionAuthorizer. Do not put unrelated capabilities in one module merely because they use the same transport. Do not use a module as a substitute for capability-level risk and input schemas.

Related: [capabilities](capabilities.html), [compose a module](../guides/compose-a-module.html), [public API boundary](../architecture/public-api-boundary.html).
