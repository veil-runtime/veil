import {
  Capability,
  CapabilityInputField,
  CapabilityRisk,
} from '../../runtime/registry/capability.js';

import { ExecutionContext } from '../../runtime/execution/execution-context.js';

export interface CapabilityExecution<
  TInput,
  TResult
> {
  input: TInput;
  context?: ExecutionContext;
}

export interface CapabilityDefinition<
  TInput = unknown,
  TResult = unknown
> {
  name: string;

  description: string;

  risk: CapabilityRisk;

  inputSchema?: Record<
    string,
    CapabilityInputField
  >;

  execute(
    execution: CapabilityExecution<
      TInput,
      TResult
    >
  ): Promise<TResult>;
}

export type CreatedCapability<
  TInput,
  TResult
> = Capability<TInput, TResult>;