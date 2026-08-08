import {
  chromium,
  Browser,
  BrowserContext,
  Page,
} from 'playwright';

class BrowserProvider {
  private browser: Browser | null = null;

  private async ensureBrowser(): Promise<Browser> {
    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }

    this.browser = await chromium.launch({
      channel: 'chrome',
      headless: false,
    });

    return this.browser;
  }

  async createPublicContext(): Promise<BrowserContext> {
    const browser = await this.ensureBrowser();

    return browser.newContext();
  }

  async createAuthenticatedContext(
    storageStatePath: string
  ): Promise<BrowserContext> {
    const browser = await this.ensureBrowser();

    return browser.newContext({
      storageState: storageStatePath,
    });
  }

  async createPage(
    context: BrowserContext
  ): Promise<Page> {
    return context.newPage();
  }

  async shutdown(): Promise<void> {
    if (!this.browser) {
      return;
    }

    await this.browser.close();
    this.browser = null;
  }
}

export const browserProvider = new BrowserProvider();