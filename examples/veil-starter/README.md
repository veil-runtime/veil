# Veil Starter — Lesson 01: Hello Veil

Learn the smallest useful Veil flow:

1. Define a capability.
2. Register it with `OperatorRuntime`.
3. Create an `ExecutionPlan`.
4. Execute the plan and inspect the returned job.

## Install and run

From the repository root, build Veil so this example consumes its public package
entrypoint:

```bash
npm install
npm run build
cd examples/veil-starter
npm install
cd client
npm install
```

Start the local trusted-side application server:

```bash
cd examples/veil-starter
npm run dev:server
```

In another terminal, start the browser UI:

```bash
cd examples/veil-starter/client
npm run dev
```

Open the Vite URL, normally `http://127.0.0.1:5173`.

## The three panels

- **Capabilities** shows `demo.greet`, something Veil is allowed to execute.
- **Execution Plan** shows the deterministic plan created by the application
  server for the supplied name.
- **Execution** sends the input to the local server and shows Veil's real
  response.

The browser does not run Veil:

```text
Browser UI
  -> Application Server
  -> Veil OperatorRuntime
  -> Capability
  -> Execution Result
```

Veil runs on the trusted side of the application. The browser is only the
interface used to propose and inspect execution.

## Where Veil is integrated

`server/veil/capabilities.ts` defines `demo.greet`. `server/veil/runtime.ts`
registers it and constructs the real `ExecutionPlan`. Both use only the public
`@veil-runtime/core` package entrypoint. `server/index.ts` exposes the two
Lesson 01 endpoints.

## Try breaking it

Select **Try invalid input**. The server sends an empty `name` in a real plan.
Veil rejects that required input during plan validation, and the browser shows
the returned rejection details.

## What comes next

Lesson 02 can add a second capability and show how later plan steps can use an
earlier result.
