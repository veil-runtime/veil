import { CapabilityRisk } from '../registry/capability.js';

export interface PermissionDecision {
  allowed: boolean;
  requiresApproval: boolean;
  reason?: string;
}

export function checkPermission(
  risk: CapabilityRisk,
  approved = false
): PermissionDecision {
  if (risk === 'read') {
    return {
      allowed: true,
      requiresApproval: false,
    };
  }

  if (risk === 'write') {
    if (approved) {
      return {
        allowed: true,
        requiresApproval: false,
      };
    }

    return {
      allowed: false,
      requiresApproval: true,
      reason: 'Write capability requires explicit approval.',
    };
  }

  if (risk === 'destructive') {
    if (approved) {
      return {
        allowed: true,
        requiresApproval: false,
      };
    }

    return {
      allowed: false,
      requiresApproval: true,
      reason: 'Destructive capability requires explicit approval.',
    };
  }

  return {
    allowed: false,
    requiresApproval: false,
    reason: 'Unknown capability risk.',
  };
}