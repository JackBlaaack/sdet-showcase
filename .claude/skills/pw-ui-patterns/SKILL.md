---
name: pw-ui-patterns
description: "Use when writing or structuring Playwright UI tests with Page Object Model. Triggers on: \"write UI test\", \"Playwright UI test\", \"page object model\", \"POM\", \"how to test UI with Playwright\", \"UI test structure\", \"locator strategy\", \"waiting strategy in Playwright\". Covers POM, locators, assertions, waiting."
---

# Playwright UI Test Patterns

> Project conventions win. Read `README.md`, `src/UI/pages/base.page.ts` and
> `src/UI/fixtures/ui.fixture.ts` first — follow them; this skill covers defaults.

## Code Standards (Critical)

- **Single quotes** everywhere (Prettier `singleQuote: true`)
- **No try-catch** in test files (helpers only)
- **No if-else** in test logic (helpers only)
- **No console.log** in committed tests
- **Await** every action and assertion

## Basic Test Structure

```typescript
import { expect, test } from '../fixtures/ui.fixture.js';

test.describe(
  'UI - Login',
  {
    tag: [
      '@ui',
      '@acceptance',  // REQUIRED: @acceptance or @e2e
      '@smoke',
      '@auth',
      '@allure.label.layer:ui',
    ],
  },
  () => {
    test('Customer logs in and sees the customer navigation', async ({
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
      });
    });
  },
);
```

`shop` (customer, token, product, coupon) is prepared through the API by the
fixture; the page objects `loginPage` and `header` come from `ui.fixture.ts`.

**REQUIRED type tag:** every UI test must have `@acceptance` OR `@e2e`.

**`test.step()`** for every logical phase of a multi-step scenario — steps show
up in Allure/HTML reports and make failures self-explanatory.

## Page Object Model

Page objects extend an abstract `BasePage` holding `protected readonly page` —
specs never touch `page` directly. Locators as getters, actions as methods.

```typescript
// src/UI/pages/feature.page.ts
import type { Locator } from '@playwright/test';
import { BasePage } from './base.page.js';

export class FeaturePage extends BasePage {
  get submitButton(): Locator {
    return this.page.getByTestId('submit-button');
  }

  get emailInput(): Locator {
    return this.page.getByTestId('email-input');
  }

  get successMessage(): Locator {
    return this.page.getByTestId('notify-success');
  }

  async navigate() {
    await this.goto('/feature');
  }

  async fillEmail(email: string) {
    await this.emailInput.fill(email);
  }

  async submit() {
    await this.submitButton.click();
  }
}
```

**Inject page objects through fixtures**, not `new FeaturePage(page)` inside
each test or `beforeEach`:

```typescript
// src/UI/fixtures/ui.fixture.ts — one typed entry per page object
export const test = shopTest.extend<{ featurePage: FeaturePage }>({
  featurePage: async ({ page }, use) => {
    // setup: state, if the page needs any
    await use(new FeaturePage(page));
    // teardown: runs even if the test failed
  },
});
```

Responsibility split: locators + browser mechanics → page object;
orchestration + state/data prep → fixture; scenario steps → test.

## Locator Priority

```typescript
// 1. data-testid (best — stable)
page.getByTestId('submit-button')

// 2. Semantic role
page.getByRole('button', { name: 'Submit' })
page.getByRole('textbox', { name: 'Email' })

// 3. Visible text / label
page.getByText('Success message')
page.getByLabel('Email address')

// AVOID — fragile:
page.locator('div.app-content button.type-primary')  // CSS class
page.locator('#submit-btn-123')                       // dynamic ID
page.locator('div:nth-child(3)')                     // positional
```

## Assertions

```typescript
// Visibility
await expect(element).toBeVisible();
await expect(element).not.toBeVisible();
await expect(element).toBeAttached();

// Text
await expect(element).toHaveText('Exact text');
await expect(element).toContainText('partial');

// Value / Attribute
await expect(input).toHaveValue('expected');
await expect(link).toHaveAttribute('href', '/url');
await expect(button).toBeEnabled();
await expect(button).toBeDisabled();

// Count
await expect(list).toHaveCount(5);

// Custom failure message — cheap, saves debugging time
await expect(row, 'created order must appear in the list').toBeVisible();

// Soft assertions — independent checks of ONE state, all failures reported
await expect.soft(element).toBeVisible();
await expect.soft(element).toContainText('text');

// Structural check of a whole region (modern Playwright)
await expect(page.getByTestId('sidebar')).toMatchAriaSnapshot(`
  - navigation:
    - link "Planning"
    - link "Employees"
`);

// Visual regression — for stable, deterministic screens only
await expect(page.getByTestId('chart')).toHaveScreenshot('chart.png');

// Custom with timeout
await expect(element).toBeVisible({ timeout: 10000 });
```

When standard `expect` is insufficient, move the verification into a page-object
method or a custom matcher — don't inline complex verification logic in specs.

## Waiting Strategies

```typescript
// Playwright auto-waits before actions (visible, stable, interactive)
await button.click(); // already waits

// Explicit — when auto-wait not enough (prefer web-first assertions):
await expect(page.getByTestId('result')).toBeVisible();
await page.waitForURL('**/success');
// AVOID waitForLoadState('networkidle') — officially discouraged, flaky
// with long-polling/websockets; wait for a specific response instead:

// Wait for API response tied to the action:
const [response] = await Promise.all([
  page.waitForResponse('**/api/endpoint'),
  button.click(),
]);

// NEVER:
await page.waitForTimeout(3000); // hardcoded sleep = flaky
```

## Time-Dependent Behavior — page.clock

Don't wait for real time; control it:

```typescript
await page.clock.install({ time: new Date('2026-01-15T10:00:00') });
await page.clock.fastForward('30:00'); // jump 30 minutes
await expect(page.getByTestId('session-expired')).toBeVisible();
```

## Network Mocking — page.route

Isolate UI tests from backend instability; test error handling deterministically:

```typescript
// Mock error state
await page.route('**/api/endpoint', (route) =>
  route.fulfill({ status: 500 }),
);
await page.getByTestId('trigger').click();
await expect(page.getByTestId('error-toast')).toBeVisible();

// Mock payload
await page.route('**/api/list', (route) =>
  route.fulfill({ json: { items: [] } }),
);

// Replay recorded traffic for full isolation
await page.routeFromHAR('./hars/feature.har', { url: '**/api/**' });
```

## Form Interactions

```typescript
await input.fill('text');
await select.selectOption({ value: 'option1' });
await checkbox.check();
await checkbox.uncheck();
await radioButton.click();
await fileInput.setInputFiles('./file.pdf');
```

## Modals and Dialogs

```typescript
await openButton.click();
await expect(modal).toBeVisible();
await expect(modal.getByText('Title')).toBeVisible();
await closeButton.click();
await expect(modal).not.toBeVisible();
```

## Error State Testing

```typescript
test('Shows validation error on empty submit', async ({ page }) => {
  await page.getByTestId('submit').click();
  await expect(page.getByTestId('error-email')).toBeVisible();
  await expect(page.getByTestId('error-email')).toHaveText('Required');
});
```

## Test Data

- Unique data per test: the `shop` fixture and `uniqueSuffix()` (`utils/unique.ts`) —
  hardcoded names collide in parallel runs
- Prepare state through the API; drive only the behaviour under test through the UI
- No shared `let` between tests; each test creates and owns its data

## Tracing and Screenshots

```typescript
// playwright.config.ts
use: {
  trace: 'on-first-retry',
  screenshot: 'only-on-failure',
  video: 'on-first-retry',
}
```

## Run Commands

```bash
pnpm exec playwright test                          # all tests
pnpm exec playwright test --grep '@smoke'         # smoke only
pnpm exec playwright test --grep '@ui'            # UI only
pnpm exec playwright test --project=ui            # the UI project (Chromium)
pnpm exec playwright test --debug                 # debug mode
pnpm exec playwright test --ui                    # UI mode (interactive)
pnpm report                                       # HTML report of the last run
```

## Anti-Patterns

| Bad | Good |
|-----|------|
| `page.locator('.btn-primary')` | `page.getByTestId('submit')` |
| `await page.waitForTimeout(3000)` | `await expect(el).toBeVisible()` |
| `waitForLoadState('networkidle')` | `waitForResponse('**/api/x')` |
| `console.log(...)` in test | Remove before commit |
| Selectors in test file | Page Object class |
| `let featurePage` + `new` in `beforeEach` | Page object from fixture DI |
| `if (condition) expect...` | Separate test cases |
| Shared `let id` between tests | Create data per test |
| Flat 20-line test body | `test.step()` per logical phase |
| Bare `expect(x).toBeVisible()` on non-obvious check | `expect(x, 'why').toBeVisible()` |
