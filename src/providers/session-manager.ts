import { BrowserContext } from 'playwright';
import { browserProvider } from './browser-provider.js';

export type SessionName =
  | 'public'
  | 'linkedin';

class SessionManager {
  async create(name: SessionName): Promise<BrowserContext> {
    if (name === 'public') {
      return browserProvider.createPublicContext();
    }

    if (name === 'linkedin') {
      return browserProvider.createAuthenticatedContext(
        'playwright/.auth/linkedin.json'
      );
    }

    throw new Error(`Unknown session: ${name}`);
  }
}

export const sessionManager = new SessionManager();