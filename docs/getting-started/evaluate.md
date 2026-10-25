---
title: Evaluate Veil for your organisation
description: Choose a bounded workflow, identify the authority to act, and evaluate Veil's execution outcomes without replacing your existing systems.
---
# Evaluate Veil for your organisation

Veil provides a governed path from a request to an operation in your systems.
Your application decides which operations exist and supplies the policy that
permits or denies them. Veil validates and executes the request, returning a job
with results and lifecycle events. It works without an AI model.

## Start with one bounded workflow

Choose a read-only operation such as checking an order's status. Identify the
system owner, the existing API or code that performs the lookup, and the person
responsible for authorization policy. Define the inputs and the result that
would count as success. These are possible integration patterns, not built-in
connectors or claims of customer deployments.

Then evaluate four concrete cases with a developer:

1. A valid request for a registered operation completes and returns a result.
2. Invalid declared input is rejected before the operation runs.
3. A valid request that policy denies produces no capability invocation.
4. An allowed operation that fails produces a failed outcome rather than a claim
   of successful completion.

The [five-minute example](five-minutes.html) demonstrates a deterministic read
without an external service. The [production-denial cookbook](../cookbook/deny-production-action.html)
shows a policy example. Your real integration and policy still need their own
tests; these examples do not certify your application.

## Decide what the boundary must own

| Evaluation question | What to establish |
| --- | --- |
| Which actions may be requested? | A small, reviewed catalogue of named capabilities. |
| Who may request them? | Authenticated caller information supplied by the trusted application. Veil does not verify identity for you. |
| When may work proceed? | An explicit authorization policy for the caller, operation and resolved input. Registration alone grants no permission. |
| Is human approval required? | Your application collects and protects an approval decision, then checks it in its authorizer. Core has no approval inbox or pause/resume approval service. |
| How will the outcome be reviewed? | Job status, step results and lifecycle events, with host-configured storage, retention and access. |
| What happens outside Veil? | Credentials, provider permissions, external side effects, failures and recovery remain application responsibilities. |

## Where Veil can fit

Possible applications include AI-assisted service requests, ordered process
automation, reusable internal integrations, controlled operational tools and
incremental wrappers around legacy systems. Each requires application-owned
implementation and policy. Veil does not replace the enterprise application or
prove that an operation's business logic is correct.

A useful first evaluation keeps the existing system in place and routes one
operation through Veil. Compare permitted, denied and failed outcomes. Assess
whether the common boundary helps your team review policy and reuse integrations;
do not assume savings, certification or enterprise readiness from the examples.

## Understand the current release boundary

Core v0.4.0 is a **Linux-qualified, unpublished candidate**. The current published
package is v0.3.1. Windows and macOS are unqualified for v0.4.0. Local Ollama/Qwen
planning is experimental and opt-in, with failed write-planning probes documented.
It is not a reliable autonomous agent.

Core, UI and Emergence are independent products/packages. UI is independently
developed for system-described interfaces. Emergence covers experimental reasoning
and coordination and is moving into its own package. Neither is included in Core
v0.4.0. Sandbox, repository-task and browser capabilities are not published Core
features.

Core does not provide identity management, compliance certification, tenant
isolation, general cancellation, retries, parallel plans or exactly-once effects.
Read the [candidate notes](v0.4.0.html) and
[trust boundaries](../architecture/trust-boundaries.html) with your technical owner.

## Continue with a technical evaluation

Follow [what Veil is](overview.html), the
[mental model](../developer.html#the-mental-model), and
[run Core in five minutes](five-minutes.html). Then review
[authorization](../concepts/authorization.html),
[architecture](../architecture/overview.html) and the
[public API](../reference/public-exports.html).
