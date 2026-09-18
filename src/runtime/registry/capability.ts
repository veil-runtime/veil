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

/** Detached execution metadata. Introspection is not authorization. */
export interface CapabilityDescriptor {
  name: string;
  version: string;
  description: string;
  risk: CapabilityRisk;
  /** Limited Veil field contract, not full JSON Schema. */
  inputSchema: Record<string, CapabilityInputField>;
}
