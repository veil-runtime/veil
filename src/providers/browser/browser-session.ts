import {
  BrowserContext,
  Page,
} from 'playwright';

import {
  sessionManager,
  SessionName,
} from './session-manager.js';

export interface BrowserSession {
  context: BrowserContext;
  page: Page;

  close(): Promise<void>;
}

export async function createSession(
  name: SessionName
): Promise<BrowserSession> {
  const context = await sessionManager.create(name);

  const page = await context.newPage();

  return {
    context,
    page,

    async close() {
      await context.close();
    },
  };
}

export function createLinkedInSession() {
  return createSession('linkedin');
}

export function createPublicSession() {
  return createSession('public');
}