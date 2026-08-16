import { ExecutionContext } from '../execution/execution-context.js';

export type CapabilityRisk =
  | 'read'
  | 'write'
  | 'destructive';

export interface CapabilityInputField {
  type: string;
  required: boolean;
  description: string;
}

export interface Capability<
  TInput = unknown,
  TResult = unknown
> {
  readonly name: string;

  readonly version: string;

  readonly description: string;

  readonly risk: CapabilityRisk;

  inputSchema?: Record<
    string,
    CapabilityInputField
  >;

  execute(
    input: TInput,
    context?: ExecutionContext
  ): Promise<TResult>;
}
