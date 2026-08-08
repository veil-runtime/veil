import { Capability } from '../../core/capability.js';
import { createLinkedInSession } from '../../browser/browser.js';

interface LinkedInSelfProfileResult {
  name: string | null;
  headline: string | null;
  company: string | null;
  location: string | null;
  profileUrl: string;
}

export const linkedinSelfProfileCapability: Capability<
  undefined,
  LinkedInSelfProfileResult
> = {
  name: 'linkedin.profile.self',

  description:
    'Read the authenticated LinkedIn user profile name, headline, company, location and profile URL',

  risk: 'read',

  async execute() {
    const session = await createLinkedInSession();

    try {
      await session.page.goto('https://www.linkedin.com/in/me/', {
        waitUntil: 'domcontentloaded',
      });

      await session.page.waitForTimeout(3000);

      const profileUrl = session.page.url();

      const main = session.page.locator('main');

      const firstSection = main.locator('section').first();

      const rawText = await firstSection
        .innerText()
        .catch(() => '');

      const lines = rawText
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .filter((line) => line !== '·');

const name = lines[0] ?? null;
const headline = lines[1] ?? null;

const location =
  lines.find(
    (line) =>
      line.includes('South Africa') ||
      line.includes('Western Cape') ||
      line.includes('Cape Town')
  ) ?? null;

const company =
  lines.find(
    (line) =>
      line !== name &&
      line !== headline &&
      line !== location &&
      !line.includes('Contact info') &&
      !line.includes('connections') &&
      !line.includes('followers') &&
      !line.includes('Open to') &&
      !line.includes('Visit my website')
  ) ?? null;

return {
  name,
  headline,
  company,
  location,
  profileUrl,
};
    } finally {
      await session.close();
    }
  },
};