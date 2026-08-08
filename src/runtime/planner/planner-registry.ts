import { PlannerProvider } from './planner-provider.js';

class PlannerRegistry {
  private readonly providers =
    new Map<string, PlannerProvider>();

  private defaultProviderName: string | null = null;

  register(
    provider: PlannerProvider,
    options?: {
      default?: boolean;
    }
  ): void {
    if (this.providers.has(provider.name)) {
      throw new Error(
        `Planner provider already registered: ${provider.name}`
      );
    }

    this.providers.set(provider.name, provider);

    if (options?.default || !this.defaultProviderName) {
      this.defaultProviderName = provider.name;
    }
  }

  get(name: string): PlannerProvider | undefined {
    return this.providers.get(name);
  }

  getDefault(): PlannerProvider {
    if (!this.defaultProviderName) {
      throw new Error('No default planner provider configured');
    }

    const provider = this.providers.get(
      this.defaultProviderName
    );

    if (!provider) {
      throw new Error(
        `Default planner provider not found: ${this.defaultProviderName}`
      );
    }

    return provider;
  }

  list() {
    return Array.from(this.providers.values()).map(
      (provider) => ({
        name: provider.name,
        default:
          provider.name === this.defaultProviderName,
      })
    );
  }
}

export const plannerRegistry = new PlannerRegistry();