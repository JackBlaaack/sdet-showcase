import { expect, test } from '../fixtures/ui.fixture.js';

test.describe(
  'UI - Login',
  {
    tag: ['@ui', '@acceptance', '@smoke', '@auth', '@allure.label.layer:ui'],
  },
  () => {
    test('Customer logs in through the form and gets the customer navigation', async ({
      shop,
      loginPage,
      header,
    }) => {
      await test.step('Open the login page and submit valid credentials', async () => {
        await loginPage.navigate();
        await loginPage.logIn(shop.customer.email, shop.customer.password);
      });

      await test.step('The header shows the logged-in customer', async () => {
        await expect(
          header.userEmail,
          'header must show the email of the logged-in user',
        ).toHaveText(shop.customer.email);
        await expect(header.logoutButton).toBeVisible();
        await expect(header.ordersLink).toBeVisible();
        await expect(
          header.loginLink,
          'the login link must be replaced after logging in',
        ).toBeHidden();
      });

      await test.step('Admin-only navigation is not offered', async () => {
        await expect(
          header.adminLink,
          'a customer must not see the Admin link',
        ).toBeHidden();
      });
    });
  },
);
