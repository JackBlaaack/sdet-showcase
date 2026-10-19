import type { Locator } from '@playwright/test';
import { BasePage } from './base.page.js';

/** The navigation bar shown on every page. */
export class HeaderComponent extends BasePage {
  get userEmail(): Locator {
    return this.page.getByTestId('user-email');
  }

  get logoutButton(): Locator {
    return this.page.getByTestId('logout-button');
  }

  get loginLink(): Locator {
    return this.page.getByTestId('nav-login');
  }

  get ordersLink(): Locator {
    return this.page.getByTestId('nav-orders');
  }

  get adminLink(): Locator {
    return this.page.getByTestId('nav-admin');
  }
}
