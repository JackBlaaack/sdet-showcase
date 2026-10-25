import { test, expect } from '@playwright/test';

test('CI red check: a missing element fails with a screenshot', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('does-not-exist')).toBeVisible({ timeout: 2000 });
});
