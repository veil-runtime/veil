# Veil Starter — Lessons 01 and 02

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

## Lesson 02: One runtime, different capabilities

Lesson 01 proved that one capability could execute. Lesson 02 proves that the
same runtime can execute capabilities from very different domains:

- **Personal** presents `notes.create` as **Save a Note**.
- **Developer** presents `service.health` as **Check Service**.

The scenario definitions live only in `client/src/scenarios/`. They are
presentation metadata for the Starter UI, not Veil contracts, capability
registration data, or authorization inputs. Veil does not know what
"Personal" or "Developer" means; both remain normal capabilities registered
with the same `OperatorRuntime`.

```text
Personal                  Developer
notes.create              service.health
     \                       /
      \                     /
       ---- ExecutionPlan ---
                |
         OperatorRuntime
                |
        Job / Events / Result
```

Use **Experience** for user-facing inputs and outputs, or **Learn** to see the
same execution's selected capability, real `ExecutionPlan`, `Job`, events, and
result. The mode changes presentation only: it does not change the server
request, plan, capability, policy, or runtime behavior.

The invalid-input button still sends a real plan to Veil. Empty required fields
are rejected by Veil's input validation path and returned by the server as an
HTTP 422 response.
