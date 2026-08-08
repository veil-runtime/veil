export type CapabilityRisk = 'read' | 'write' | 'destructive';

export interface CapabilityContext {
  requestId?: string;
}

export interface Capability<TInput = unknown, TResult = unknown> {
  name: string;
  description: string;
  risk: CapabilityRisk;

  execute(
    input: TInput,
    context?: CapabilityContext
  ): Promise<TResult>;
}