import type { Capability } from '../../runtime/registry/capability.js';
import { createLinuxVerificationSandbox, type VerificationProfile, type VerificationResult } from '../../providers/sandbox/linux-verification-sandbox.js';

/** Register in a trusted host module; intentionally not auto-registered/exported. */
export function createSandboxVerificationCapability(profile: VerificationProfile): Capability<Record<string, never>, VerificationResult> {
  const run = createLinuxVerificationSandbox(profile);
  return {
    name: 'verification.sandbox.run', version: '1.0.0', risk: 'destructive',
    description: 'Run the host-selected verifier against an isolated read-only workspace snapshot. No caller-selected command or configuration.',
    inputSchema: {},
    async execute(input) {
      if (!input || typeof input !== 'object' || Array.isArray(input) || Reflect.ownKeys(input).length) {
        throw new Error('Verification accepts only an empty input object');
      }
      return run();
    },
  };
}
