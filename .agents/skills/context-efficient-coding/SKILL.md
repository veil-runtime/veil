---
name: context-efficient-coding
description: Reduce primary-model context use during software engineering through bounded, read-only repository discovery delegation. Use when broad searches or bulk reading would benefit from concise evidence summaries; keep tiny tasks local.
---

# Context-efficient coding

Save context without sacrificing correctness or code quality. Preserve the user's scope and obey applicable AGENTS.md instructions; in Veil, respect the architecture lock and required verification.

The primary frontier model owns task understanding, architecture, difficult reasoning, implementation decisions, debugging, security-sensitive decisions, and final review. Never delegate architecture decisions, security decisions, ambiguous debugging, or final judgement merely to save tokens.

## Discovery workflow

- Delegate bounded repository discovery, broad searches, bulk file reading, evidence gathering, and summarisation to one cheaper read-only worker, preferably `gpt-5.6-terra` at low reasoning effort when available and permitted. Keep the current primary model; do not change model configuration. If delegation is unavailable, perform focused discovery locally.
- Skip delegation for tiny tasks when its overhead exceeds likely context savings. Reuse the worker for related follow-up discovery.
- Give the worker a concrete question, relevant scope, and only the context needed. Require no edits, installations, or other state-changing actions. Keep raw searches and bulk reads in the worker thread.
- Request an evidence-based report normally no longer than 400 words: conclusions, relevant file paths, symbols and line locations, concrete supporting evidence, uncertainties, and unresolved questions. Distinguish observed facts from inference; do not paste raw search output.
- The primary uses the distilled findings and directly inspects the small number of passages needed to validate important conclusions. Request targeted follow-up evidence when needed. Expand direct inspection whenever correctness requires it; a context budget must never prevent adequate investigation.

## Implementation and verification

Before editing, follow the repository's instructions for contracts, ownership, and change scope. For Veil, preserve and obey AGENTS.md, including its architecture-decision requirement for locked contract changes.

After implementation, run the repository's existing functional verification and quality harness when available. In Veil, run `npm run check` and `npm run quality -- --base <commit>` with an appropriate, explicitly selected comparison base. Review findings, repair failures within the authorized scope, and rerun affected checks. Never weaken checks, change the base to obtain a pass, or hide unresolved failures. Report changed files, commands, exact failures, quality deltas, and remaining work as required by AGENTS.md.

This skill guides behaviour only. It does not authorize unrelated changes to source, package configuration, AGENTS.md, hooks, model settings, or CI, and requires no additional infrastructure. Make implementation changes only within the user's task scope. Correctness always takes priority over reduced token usage.
