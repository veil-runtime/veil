---
title: Veil UI Developer Preview
product: ui
description: Build bounded, expressive interfaces with Veil UI independently of Veil Core.
---
# Veil UI

[Open the interactive playground](playground/) to edit definitions and try the real UI 0.3.0 renderer without installing anything.

Veil UI is an independent interface toolkit. Published 0.3.0 is a Developer Preview with a framework-neutral interface controller and optional native DOM adapter. Applications and AI systems can supply bounded JSON definitions; trusted host code chooses the allowed actions, handles events and owns data. UI does not grant execution authority.

The package also retains deterministic capability descriptions and one-screen composition APIs. Those are distinct from the universal interface API. The [0.3.0 GitHub Release](https://github.com/veil-runtime/veil-ui-lab/releases/tag/v0.3.0), [interface contract](https://github.com/veil-runtime/veil-ui-lab/blob/v0.3.0/packages/ui/docs/UNIVERSAL-INTERFACE.md) and [API inventory](https://github.com/veil-runtime/veil-ui-lab/blob/v0.3.0/packages/ui/docs/API.md) document their respective boundaries.

The versioned interface guide still carries an `0.3.0-rc.2` heading inside the published `0.3.0` tarball. The npm package and GitHub Release establish the published version; the example below was checked against that tarball's exports.

## Install and run

Requires Node.js 24 or newer. Install the published package in an application:

```sh
npm install @veil-runtime/ui@0.3.0
```

The package can be used without Core through its `/interface` and `/dom` entry points. The [universal example](https://github.com/veil-runtime/veil-ui-lab/tree/v0.3.0/packages/ui/examples/universal) and [interface guide](https://github.com/veil-runtime/veil-ui-lab/blob/v0.3.0/packages/ui/docs/UNIVERSAL-INTERFACE.md#smallest-working-interface) show a working browser integration. The older [standalone capability example](https://github.com/veil-runtime/veil-ui-lab/blob/v0.3.0/packages/ui/examples/standalone/index.mjs) needs Core separately:

```sh
npm install @veil-runtime/ui@0.3.0 @veil-runtime/core@0.4.0
# Copy packages/ui/examples/standalone/index.mjs into this application, then:
node index.mjs
```

UI 0.3.0 declares an optional Core peer range of `^0.4.0` for its capability-derived APIs. npm rejects a combined install with Core 0.6.0. The universal `/interface` and `/dom` APIs run without Core. The local `0.3.0-rc.2` checkout is an earlier candidate, not the published `0.3.0` artifact.

## Minimal interface

The following TypeScript follows the published 0.3.0 interface contract. Mount it in a page with `<div id="app"></div>` after bundling the application. The package's `/dom` entry point supplies the optional browser renderer.

```ts
import { type BuiltinInterfaceDefinition } from '@veil-runtime/ui/interface';
import { createMountedInterface } from '@veil-runtime/ui/dom';

const definition = {
  id: 'hello', actions: ['greet'], state: { name: '' }, data: { message: '' },
  screen: { key: 'root', component: 'Stack', children: [
    { key: 'title', component: 'Heading', text: 'Greeting' },
    { key: 'name', component: 'Input', label: 'Name', binding: { source: 'state', path: 'name' } },
    { key: 'greet', component: 'Button', text: 'Greet', action: 'greet' },
    { key: 'message', component: 'Status', text: { source: 'data', path: 'message' } },
  ] },
} satisfies BuiltinInterfaceDefinition;

const target = document.getElementById('app');
if (!target) throw new Error('Missing app element');
const ui = createMountedInterface(target, definition, {
  allowedActions: ['greet'],
  onEvent(event) { ui.updateData({ message: `Hello ${event.state.name}` }, event.revision); },
});
// On teardown: ui.dispose();
```

Built-ins are Stack, Row, Text, Heading, Status, Input, Button, Table and List. Keyed DOM updates can retain compatible input focus and local values. Hosts can register trusted custom components. The controller validates definitions and bounds sizes; hosts must still bound raw input bytes before JSON parsing and enforce their own action policy. Agent-generated definitions are proposals, never permissions.

## Core relationship and limits

UI can render without Core. An application may handle a UI event by submitting a plan to Core, but that connection is host code, not a built-in integration. Core then applies its own authorization and execution policy. The current published package pair is UI 0.3.0 with Core 0.4.0; integration with Core 0.6.0 is not qualified. The published UI release is a Developer Preview, not a complete autonomous application-building platform. Read the [release limits](https://github.com/veil-runtime/veil-ui-lab/releases/tag/v0.3.0) and [ecosystem architecture](ecosystem.html).
