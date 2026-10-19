import type { Locator } from '@playwright/test';
import { BasePage } from './base.page.js';

export class LoginPage extends BasePage {
  get form(): Locator {
    return this.page.getByTestId('auth-page');
  }

  get emailInput(): Locator {
    return this.page.getByTestId('auth-email');
  }

  get passwordInput(): Locator {
    return this.page.getByTestId('auth-password');
  }

  get submitButton(): Locator {
    return this.page.getByTestId('auth-submit');
  }

  get errorMessage(): Locator {
    return this.page.getByTestId('auth-error');
  }

  async navigate(): Promise<void> {
    await this.goto('/#/login');
    await this.form.waitFor();
  }

  async logIn(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
