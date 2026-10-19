import { expect } from '@playwright/test';
import type { UiPagesFixture } from '../../interfaces/fixtures.interface.js';
import { HeaderComponent } from '../pages/header.component.js';
import { LoginPage } from '../pages/login.page.js';
import { test as shopTest } from './shop.fixture.js';

/** Shop data plus the page objects that UI tests need. */
export const test = shopTest.extend<UiPagesFixture>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  header: async ({ page }, use) => {
    await use(new HeaderComponent(page));
  },
});

export { expect };
