# Experiment 005 Phase 3 v1 — prospective amendment 002

Date: 2026-10-15
Status: recorded before Phase 3 live data collection.

## Purpose

Freeze the model configuration and evaluation identifier for reproducibility.
This is an operational specification only. It does not change the hypotheses,
outcomes, thresholds, exposure limits, trial ordering, or peer-capability
directory treatment in the preregistration and amendment 001.

## Frozen model configuration

- Provider: OpenAI Responses API (`responses-v1`), JSON object output.
- Model identifier: `gpt-4.1-mini`, matching the Phase 2 lifecycle comparison.
- Temperature: omitted.
- Maximum output: 512 tokens per model call.
- Provider seed: unsupported by the existing adapter; none is claimed.
- All 24 trials use this same configuration. The Phase 3 live CLI rejects any
  other model identifier or temperature setting before constructing a run.

The run manifest records the model, API and wire format, temperature, source
revision, design version, evaluator version, exact matrix, source and prompt
hashes, and budget configuration. No live data existed when this amendment was
recorded.
