import { Capability, CapabilityDescriptor } from './capability.js';

class CapabilityRegistry {
  private capabilities = new Map<string, Capability>();

  register(capability: Capability): void {
    if (this.capabilities.has(capability.name)) {
      throw new Error(`Capability already registered: ${capability.name}`);
    }

    this.capabilities.set(capability.name, capability);
  }

  get(name: string): Capability | undefined {
    return this.capabilities.get(name);
  }

  describe(name: string, version?: string): CapabilityDescriptor | undefined {
    const capability = this.get(name);
    if (!capability || (version !== undefined && version !== capability.version)) {
      return undefined;
    }
    return describeCapability(capability);
  }

  list(): CapabilityDescriptor[] {
    return Array.from(this.capabilities.values(), describeCapability);
  }
}

export const capabilityRegistry = new CapabilityRegistry();

// Explicitly project passive metadata; never copy implementation properties.
function describeCapability(capability: Capability): CapabilityDescriptor {
  return {
    name: capability.name,
    version: capability.version,
    description: capability.description,
    risk: capability.risk,
    inputSchema: Object.fromEntries(
      Object.entries(capability.inputSchema ?? {}).map(([name, field]) => [name, {
        type: field.type,
        required: field.required,
        description: field.description,
      }])
    ),
  };
}
