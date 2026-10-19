import type { Page } from '@playwright/test';

/** Base for page objects. Specs never touch `page` directly. */
export abstract class BasePage {
  protected readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  protected async goto(path: string): Promise<void> {
    await this.page.goto(path);
  }
}
