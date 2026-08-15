# Veil Copilot Instructions

Veil is a governed execution platform that separates reasoning from execution.

## Core architectural laws

- Planners reason.
- Strategies orchestrate.
- PlannerRouter selects strategies.
- ExecutionPlan is the boundary between reasoning and execution.
- OperatorRuntime governs execution.
- Capabilities define work.
- Providers interact with external systems.

## Architecture constraints

Do not introduce implementation-specific knowledge into Veil Core.

Avoid hard-coding knowledge of specific models such as Qwen, Llama, Claude, Codex, or OpenAI into generic planner contracts.

Prefer extension through existing contracts over modifying core abstractions.

Do not introduce a new core abstraction unless the existing contracts cannot express the required use case.

## Planning subsystem

The primary reasoning path is:

Goal
→ PlannerRouter
→ PlannerStrategy
→ PlannerProvider(s)
→ ExecutionPlan
→ OperatorRuntime

Keep planner registration, runtime state, health, eligibility, routing, and strategy orchestration as separate responsibilities.

## Execution subsystem

OperatorRuntime must remain independent of how an ExecutionPlan was produced.

Execution should remain governed through capability validation, policy, lifecycle handling, observability, and provider boundaries.

## Development expectations

- Use TypeScript.
- Keep changes small and composable.
- Run `npm run typecheck` after changes.
- Preserve existing public contracts unless a change is justified.
- Update documentation when architecture changes.
- Prefer explicit behavior over implicit magic.