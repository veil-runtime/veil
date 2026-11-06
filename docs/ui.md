---
title: Veil UI
product: ui
description: Build bounded, expressive interfaces with Veil UI independently of Veil Core.
---
# Veil UI

[Open the interactive playground](playground/) to edit definitions and try the real UI 0.4.2 renderer without installing anything.

Veil UI is an independent interface toolkit. Published 0.4.2 is a stable release with a framework-neutral interface controller and optional native DOM adapter. Applications and AI systems can supply bounded JSON definitions; trusted host code chooses the allowed actions, handles events and owns data. UI does not grant execution authority.

[Explore the Agent Monitor showcase](showcase/) to follow a deterministic simulation through tool failure, retry and human approval. Inspect the exact descriptor and actual host modules without leaving the experience. Veil UI renders the interface; host code runs the simulation. No model, backend or Core runtime is connected.

The package also retains capability-description and composition APIs. Those are separate from the universal interface API used here. Use the [published npm package](https://www.npmjs.com/package/@veil-runtime/ui/v/0.4.2) and the showcase's Host Integration and Architecture perspectives as public resources.

## Install and run

Requires Node.js 24 or newer. Install the published package in an application:

```sh
npm install @veil-runtime/ui@0.4.2
```

Use the `/interface` and `/dom` entry points without Core. The package declares an optional Core peer range of `^0.4.0`; compatibility with Core 0.6.0 is not claimed by this independent browser example. Bundle the modules with your browser build tool.

## Minimal interface

The following TypeScript follows the published 0.4.2 interface contract. Mount it in a page with `<div id="app"></div>` after bundling the application. The package's `/dom` entry point supplies the optional browser renderer.

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

Built-ins are Stack, Row, Text, Heading, Status, Input, Select, Textarea, Button, Table and List. Keyed DOM updates can retain compatible input focus and local values. Hosts can register trusted custom components. The controller validates definitions and bounds sizes; hosts must still bound raw input bytes before JSON parsing and enforce their own action policy. Agent-generated definitions are proposals, never permissions.

## Core relationship and limits

UI renders without Core. An application may submit a plan to Core from a UI event handler, but that connection is host code, not a built-in integration. Core then applies its own authorization and execution policy. UI does not execute agents or grant permission to perform work.

Select, Textarea, declarative validation, compound visibility conditions and conditional button disabling are supported. Validated submission blocks dispatch for invalid visible fields; the host still owns authorization and service-side validation. Candidate preparation failures preserve the accepted preview, but a renderer exception during commit cannot generally undo already applied DOM changes or external effects.

The [showcase](showcase/) and [playground](playground/) are tested in Chromium, Firefox and WebKit. Browser-engine tests do not establish physical Safari or assistive-technology qualification. The showcase uses deterministic local events; the playground's AI descriptor is an authored template. Neither connects to a live model or backend.
