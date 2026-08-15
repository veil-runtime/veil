export interface CapabilityModuleManifest {
  name: string;

  version: string;

  description?: string;

  capabilities: string[];

  providerRequirements?: string[];

  permissions?: string[];

  operator?: {
    minVersion?: string;
  };
}