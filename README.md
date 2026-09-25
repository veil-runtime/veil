# Veil

Veil is a governed, capability-driven execution runtime for AI and software systems.

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

This installs the published package. To verify the v0.3.0 candidate before publication, see [candidate installation](docs/getting-started/installation.md).

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

Release candidate: **v0.3.0**. See the [v0.3.0 release notes](docs/getting-started/v0.3.0.md). The latest published package remains **v0.2.0** until publication. ExecutionPlan V1 remains the default; opt-in [ExecutionPlan V2](docs/reference/execution-plan-v2.md) adds governed receiving-value ownership. Both are linear. DAGs, parallel execution, conditionals, cancellation, and retry policies are roadmap work, not current behavior.

## Contributing

See [development setup](docs/contributing/development-setup.md), [testing](docs/contributing/testing.md), and the [architecture rules](docs/contributing/architecture-rules.md).

## License and branding

Veil Core is licensed under Apache-2.0. See [LICENSE](LICENSE), [NOTICE](NOTICE), and [TRADEMARKS.md](TRADEMARKS.md).
