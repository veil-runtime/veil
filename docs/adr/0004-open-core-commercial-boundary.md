# ADR-0004: Open-Core and Commercial Boundary

**Status:** Accepted

**Date:** 2026-08-16

---

# Context

Veil Core was released as `@veil-runtime/core@0.1.0` under Apache-2.0. Future
development needs a clear ownership boundary so commercial functionality is not
accidentally incorporated into the Apache-licensed core.

---

# Decision

The following Veil Core surfaces remain open and Apache-2.0 licensed:

- `@veil-runtime/core`
- Core runtime contracts
- `OperatorRuntime`
- `ExecutionPlan` contracts
- Capability extension contracts
- Planner extension contracts
- SDK and public extension surfaces deliberately included in Veil Core

The licensing and ownership of community capabilities, community providers,
community integrations, and additional ecosystem packages are package-specific
future decisions.

The following are outside the scope of Apache-licensed Veil Core and are
reserved as potential proprietary or commercial product boundaries. They are
not implemented by this decision:

- Veil Enterprise
- Veil Control Plane
- Veil Cloud or service implementations
- Enterprise management functionality
- Commercial administration or governance functionality
- Designated commercial integrations or capabilities

Veil names, logos, and branding are governed separately from the Apache-2.0
software license under `TRADEMARKS.md`.

---

# Consequences

This decision does not change the Apache-2.0 license of v0.1.0 or modify Veil
Core's runtime architecture or public API. It establishes a boundary for future
development: proposed proprietary enterprise functionality requires an explicit
decision and must not be incorporated into Apache-licensed Veil Core by
default.
