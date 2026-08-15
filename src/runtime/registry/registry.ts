import { Capability } from './capability.js';

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

  list() {
    return Array.from(this.capabilities.values()).map((capability) => ({
      name: capability.name,
      version: capability.version,
      description: capability.description,
      risk: capability.risk,
      inputSchema: capability.inputSchema ?? {},
    }));
  }
}

export const capabilityRegistry = new CapabilityRegistry();
