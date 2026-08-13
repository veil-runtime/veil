import { Capability } from '../registry/capability.js';

import {
  CapabilityModuleManifest,
} from './capability-module-manifest.js';

export interface CapabilityModule {
  manifest: CapabilityModuleManifest;

  capabilities: Capability[];
}