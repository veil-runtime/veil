# Veil

Veil is a governed, capability-driven execution runtime for AI and software systems.

**Developer documentation:** [GitHub Pages portal](https://veil-runtime.github.io/veil/developer.html) | [repository docs](docs/developer.html)

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

The default authorizer permits reads and denies write/destructive capabilities. Supply a runtime-scoped authorizer to allow selected writes. See [authorization](docs/concepts/authorization.html).

## Status and roadmap

Current release: **v0.1.3**. ExecutionPlan v1 is linear. DAGs, parallel execution, conditionals, cancellation, and retry policies are roadmap work, not current behavior.

## Contributing

See [development setup](docs/contributing/development-setup.html), [testing](docs/contributing/testing.html), and the [architecture rules](docs/contributing/architecture-rules.html).

## License and branding

Veil Core is licensed under Apache-2.0. See [LICENSE](LICENSE), [NOTICE](NOTICE), and [TRADEMARKS.md](TRADEMARKS.md).
