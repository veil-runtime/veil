import type { DiagnosticCategory } from './acceptance.js';

/** Host-owned case labels. Kept separate from frozen seeds and expected results. */
export const benchmarkDiagnostics: Readonly<Record<string, readonly DiagnosticCategory[]>> = Object.freeze({
  'bounded-integer': ['input-validation', 'input-validation', 'input-validation', 'input-validation', 'input-validation',
    'boundary-handling', 'boundary-handling', 'boundary-handling', 'boundary-handling', 'boundary-handling'],
  'group-totals': ['data-consistency', 'data-consistency', 'data-consistency'],
  'interval-union': ['boundary-handling', 'boundary-handling', 'boundary-handling',
    'boundary-handling', 'boundary-handling', 'boundary-handling'],
  'reservation-ledger': ['state-invariant', 'state-invariant', 'state-invariant', 'state-invariant'],
  'record-recovery': ['error-recovery', 'error-recovery', 'error-recovery'],
});
