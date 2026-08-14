import {
  PlannerRouter,
} from './planner-router.js';

class PlannerRouterRegistry {
  private readonly routers =
    new Map<string, PlannerRouter>();

  private defaultRouterId?: string;

  register(
    id: string,
    router: PlannerRouter,
    options: {
      default?: boolean;
    } = {}
  ): void {
    if (this.routers.has(id)) {
      throw new Error(
        `Planner router already registered: ${id}`
      );
    }

    this.routers.set(
      id,
      router
    );

    if (options.default) {
      this.defaultRouterId =
        id;
    }
  }

  get(
    id: string
  ): PlannerRouter | undefined {
    return this.routers.get(id);
  }

  getDefault():
    | PlannerRouter
    | undefined {
    if (!this.defaultRouterId) {
      return undefined;
    }

    return this.routers.get(
      this.defaultRouterId
    );
  }

  getDefaultId():
    | string
    | undefined {
    return this.defaultRouterId;
  }

  list(): Array<{
    id: string;
    default: boolean;
  }> {
    return Array.from(
      this.routers.keys()
    ).map((id) => ({
      id,
      default:
        id ===
        this.defaultRouterId,
    }));
  }
}

export const plannerRouterRegistry =
  new PlannerRouterRegistry();