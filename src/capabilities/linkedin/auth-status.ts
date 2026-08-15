import { Capability } from '../../runtime/registry/capability.js';
import { createLinkedInSession } from '../../providers/browser/browser-session.js';

interface LinkedInAuthStatusResult {
  authenticated: boolean;
  url: string;
  title: string;
}

export const linkedinAuthStatusCapability: Capability<
  undefined,
  LinkedInAuthStatusResult
> = {
  name: 'linkedin.auth.status',

  version: '1.0.0',

  description:
    'Check whether the saved LinkedIn browser session is authenticated',

  risk: 'read',

  async execute() {
    const session = await createLinkedInSession();

    try {
      await session.page.goto('https://www.linkedin.com/feed/', {
        waitUntil: 'domcontentloaded',
      });

      await session.page.waitForTimeout(2000);

      const url = session.page.url();

      return {
        authenticated:
          url.includes('/feed') &&
          !url.includes('/login') &&
          !url.includes('/checkpoint'),

        url,
        title: await session.page.title(),
      };
    } finally {
      await session.close();
    }
  },
};
