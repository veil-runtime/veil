# Veil

Veil is a governed, capability-driven execution runtime for software systems. Core runs without an AI model or UI.

**Developer documentation:** [GitHub Pages portal](https://veil-runtime.github.io/veil/developer.html) | [repository docs](docs/developer.md)

## The idea

Veil separates reasoning from execution. A human, application, deterministic planner, or AI system produces an ExecutionPlan; OperatorRuntime validates and executes it through registered capabilities.

    Reasoning / application -> ExecutionPlan -> OperatorRuntime
      -> validation -> reference resolution -> authorization
      -> capability -> provider -> external system
      -> job history and events

Planners reason. Strategies orchestrate. Routers select strategies. Capabilities define work. Providers interact with external systems.

## Install

Requires Node.js 24+.

    npm install @veil-runtime/core

This installs the published package. To verify the v0.4.0 candidate before publication, see [candidate installation](docs/getting-started/installation.md).

## Smallest working example

    import { createCapability, OperatorRuntime } from '@veil-runtime/core';

    const echo = createCapability<{ value: string }, string>({
      name: 'example.echo', version: '1.0.0', description: 'Return a value', risk: 'read',
      inputSchema: { value: { type: 'string', required: true, description: 'Text' } },
      async execute({ input }) { return input.value; },
    });
    const module = {
      manifest: { name: 'example', version: '1.0.0', capabilities: [echo.name] },
      capabilities: [echo],
    };
    const runtime = new OperatorRuntime();
    runtime.use(module);
    const job = await runtime.executePlan({ version: '1.0', steps: [{
      id: 'echo', capability: echo.name, capabilityVersion: echo.version,
      input: { value: 'Hello from Veil' },
    }] });

The default authorizer permits reads and denies write/destructive capabilities. Supply a runtime-scoped authorizer to allow selected writes. See [authorization](docs/concepts/authorization.md).

## Status and roadmap

Release candidate: **v0.4.0**, not published. The latest published package is **v0.3.1**. See the [candidate notes](docs/getting-started/v0.4.0.md) for security fixes, compatibility and verification limits. The public API is unchanged. ExecutionPlan V1 remains the default; [V2](docs/reference/execution-plan-v2.md) requires host opt-in. Core contains no UI, Emergence, Caretaker or autonomous repository-task runner.

The currently supported execution platform for v0.4.0 is Linux (qualified on x86_64/WSL2, Node 24). Windows and macOS are unqualified. See the candidate notes for host and filesystem assumptions.

The source-tree development server supports an experimental, opt-in [optional bounded local planner](docs/guides/local-planning.md). It proposes plans through existing admission and authorization. Its implementation and built-in capabilities are internal source-server infrastructure, not additional npm exports. Models never grant authority. General cancellation, isolation, budgets, retries and idempotency enforcement are not Core guarantees.

## Contributing

See [development setup](docs/contributing/development-setup.md), [testing](docs/contributing/testing.md), and the [architecture rules](docs/contributing/architecture-rules.md).

## License and branding

Veil Core is licensed under Apache-2.0. See [LICENSE](LICENSE), [NOTICE](NOTICE), and [TRADEMARKS.md](TRADEMARKS.md).
