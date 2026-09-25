/** Structured admission evidence. Legacy Error.message is not safe wire data. */
export type PlanAdmissionIssueCode =
  | 'UNSUPPORTED_PLAN_VERSION'
  | 'EMPTY_PLAN'
  | 'DUPLICATE_STEP_ID'
  | 'UNKNOWN_CAPABILITY'
  | 'CAPABILITY_VERSION_MISMATCH'
  | 'REQUIRED_INPUT_MISSING'
  | 'INPUT_TYPE_MISMATCH'
  | 'UNSUPPORTED_INPUT_SCHEMA'
  | 'INVALID_RESULT_REFERENCE'
  | 'RESULT_REFERENCE_NOT_EARLIER';

export interface PlanAdmissionIssue {
  readonly code: PlanAdmissionIssueCode;
  readonly message: string;
  readonly stepIndex?: number;
  readonly field?: string;
}

export interface PlanAdmissionError extends Error {
  readonly code: 'PLAN_ADMISSION_REJECTED';
  readonly issues: readonly PlanAdmissionIssue[];
}

const messages: Record<PlanAdmissionIssueCode, string> = {
  UNSUPPORTED_PLAN_VERSION: 'The plan version is not supported.',
  EMPTY_PLAN: 'The plan contains no steps.',
  DUPLICATE_STEP_ID: 'A step identifier is repeated.',
  UNKNOWN_CAPABILITY: 'The requested capability is not registered.',
  CAPABILITY_VERSION_MISMATCH: 'The requested capability version does not match.',
  REQUIRED_INPUT_MISSING: 'A required input field is missing.',
  INPUT_TYPE_MISMATCH: 'An input field has an incompatible type.',
  UNSUPPORTED_INPUT_SCHEMA: 'An input field cannot be validated with the declared schema.',
  INVALID_RESULT_REFERENCE: 'A result reference was not accepted by the admission parser.',
  RESULT_REFERENCE_NOT_EARLIER: 'A result reference must target an earlier declared step.',
};

// Internal only: never expose ownership through plans, contexts, errors or events.
export type AdmissionOwner = object;
const issued = new WeakMap<object, { owner: AdmissionOwner; message: string }>();

/** Local issuance only; current-call certainty requires the direct executePlan boundary. */
export function isPlanAdmissionError(value: unknown): value is PlanAdmissionError {
  return typeof value === 'object' && value !== null && issued.has(value);
}

export function issuePlanAdmissionError(
  owner: AdmissionOwner,
  message: string,
  issues: readonly { code: PlanAdmissionIssueCode; stepIndex?: number; field?: string }[]
): PlanAdmissionError {
  const details = Object.freeze(issues.map(issue => Object.freeze({
    code: issue.code,
    message: messages[issue.code],
    ...(issue.stepIndex === undefined ? {} : { stepIndex: issue.stepIndex }),
    ...(issue.field === undefined ? {} : { field: issue.field }),
  })));
  const error = new Error(message) as PlanAdmissionError;
  Object.defineProperties(error, {
    code: { value: 'PLAN_ADMISSION_REJECTED', writable: false, configurable: false, enumerable: false },
    issues: { value: details, writable: false, configurable: false, enumerable: false },
  });
  issued.set(error, { owner, message });
  return error;
}

/** Prevent a genuine diagnostic from another submission becoming this call's evidence. */
export function containForeignAdmissionError(owner: AdmissionOwner, error: unknown): unknown {
  if (!isPlanAdmissionError(error)) return error;
  const record = issued.get(error)!;
  return record.owner === owner ? error : new Error(record.message, { cause: error });
}
