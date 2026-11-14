---
title: Veil UI
product: ui
description: Build bounded, expressive interfaces with Veil UI independently of Veil Core.
---
# Veil UI

[Open the interactive playground](playground/) to edit definitions and try the pinned UI 0.4.2 demo renderer without installing anything.

Veil UI is an independent interface toolkit. Published v0.5.0 has Developer Preview maturity with a framework-neutral interface controller and optional native DOM adapter. Applications and AI systems can supply bounded JSON definitions; trusted host code chooses the allowed actions, handles events and owns data. UI does not grant execution authority.

[Explore the Agent Monitor showcase](showcase/) to follow a deterministic simulation through tool failure, retry and human approval. Inspect the exact descriptor and actual host modules without leaving the experience. Veil UI renders the interface; host code runs the simulation. No model, backend or Core runtime is connected.

The package also retains capability-description and composition APIs. Those are separate from the universal interface API used here. Use the [published npm package](https://www.npmjs.com/package/@veil-runtime/ui/v/0.5.0) and the showcase's Host Integration and Architecture perspectives as public resources.

## Published v0.5.0 capabilities

- Responsive Grid: 1–4 equal columns, 600px/1024px viewport breakpoints, finite gaps and stable DOM/Tab order.
- Interactive Tables: stable row identities, scalar badges and explicitly allowlisted row actions. Hosts re-resolve and authorize the record; `dispatchRow` requires an exact revision.
- Richer forms: descriptions, accessible help/error associations, conditional disabled fields and read-only text/number Input and Textarea. Validating Buttons focus the first invalid eligible field.
- Host-driven Status phases: loading, ready, empty and error, bounded public messages and focus recovery. Retry is an ordinary host-handled Button.
- Machine-readable capability manifest v5: structural limits and behavioral metadata. The runtime validator remains authoritative; metadata is neither a complete JSON Schema nor authorization policy.

The [official release and migration notes](https://github.com/veil-runtime/veil-ui-lab/releases/tag/v0.5.0) describe the shipped contracts. npm `latest` and `preview` both select v0.5.0; maturity remains **Developer Preview**. The existing playground, showcase and Backend Lab remain pinned to v0.4.2 and do not demonstrate the new v0.5.0 features.

## Install and run

Requires Node.js 24 or newer. Install the published package in an application:

```sh
npm install @veil-runtime/ui
```

Use the `/interface` and `/dom` entry points without Core. The package declares an optional Core peer range of `^0.4.0`; compatibility with Core 0.6.0 is not claimed by this independent browser example. Bundle the modules with your browser build tool.

## Minimal interface

The following TypeScript follows the published v0.5.0 interface contract. Mount it in a page with `<div id="app"></div>` after bundling the application. The package's `/dom` entry point supplies the optional browser renderer.

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

Built-ins are Stack, Row, Grid, Text, Heading, Status, Input, Select, Textarea, Button, Table and List. Keyed DOM updates can retain compatible input focus and local values. Hosts can register trusted custom components. The controller validates definitions and bounds sizes; hosts must still bound raw input bytes before JSON parsing and enforce their own action policy. Agent-generated definitions are proposals, never permissions.

## Core relationship and limits

UI renders without Core. An application may submit a plan to Core from a UI event handler, but that connection is host code, not a built-in integration. Core then applies its own authorization and execution policy. UI does not execute agents or grant permission to perform work.

Select, Textarea, declarative validation, compound visibility conditions and conditional button disabling are supported. Validated submission blocks dispatch for invalid visible, enabled fields; the host still owns authorization and service-side validation. Candidate preparation failures preserve the accepted preview, but a renderer exception during commit cannot generally undo already applied DOM changes or external effects.

The [showcase](showcase/) and [playground](playground/) are tested in Chromium, Firefox and WebKit. Browser-engine tests do not establish physical Safari or assistive-technology qualification. The showcase uses deterministic local events; the playground's AI descriptor is an authored template. Neither connects to a live model or backend.

## Migration and host responsibilities

Manifest-v1 consumers must accept v5 and include Grid in component enumerations. Custom `InterfaceController` implementations must implement `dispatchRow(action, source, rowId, expectedRevision): boolean` with stale-revision, row-membership and allowlist checks. The native DOM adapter requires the supplied controller's private transactional bridge; structural custom controllers need their own adapter. Narrow `InterfaceNode.columns` with `Array.isArray`, and allow optional `rowId` in row events. The documented depth is 15 child edges; aggregate bounds already rejected 16-edge trees.

UI is backend-agnostic. Actions express governed intent, not arbitrary execution. Always provide `allowedActions` for untrusted definitions. Hosts own authentication, record authorization, server validation, external operations, asynchronous orchestration, cancellation and idempotency. Revision guards suppress stale UI updates; they do not cancel external effects. Hidden, disabled and read-only controls are not confidentiality controls.

Developer Preview qualification covers automated Chromium, Firefox and WebKit behavior, not screen-reader certification, announcement timing, physical Safari, zoom/high-contrast modes or arbitrary host themes. Heading remains h2. No sorting, pagination, asynchronous validation or automatic retry is provided. Strict legacy root type consumers need Core declarations; standalone `/interface`, `/composition` and `/dom` work without Core. The qualified optional Core version is 0.4.0, not Core 0.5/0.6.
