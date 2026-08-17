import { ExecutionCaller } from '../execution/execution-context.js';
import { CapabilityRisk } from '../registry/capability.js';
import { checkPermission } from './permissions.js';

export interface CapabilityAuthorizationContext {
  readonly jobId: string;
  readonly stepId: string;
  readonly capability: {
    readonly name: string;
    readonly version: string;
    readonly risk: CapabilityRisk;
  };
  readonly input: unknown;
  readonly caller?: ExecutionCaller;
}

export type CapabilityAuthorizationDecision =
  | {
      readonly decision: 'allow';
    }
  | {
      readonly decision: 'deny';
      readonly reason?: string;
    };

export interface ExecutionAuthorizer {
  authorize(
    context: CapabilityAuthorizationContext
  ): Promise<CapabilityAuthorizationDecision>;
}

export const defaultExecutionAuthorizer: ExecutionAuthorizer = {
  async authorize({ capability }) {
    const permission = checkPermission(capability.risk);

    if (permission.allowed) {
      return { decision: 'allow' };
    }

    return {
      decision: 'deny',
      reason: permission.reason,
    };
  },
};
