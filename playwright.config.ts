import { defineConfig, devices } from '@playwright/test';

/**
 * The system under test (orders-sut) is started separately with Docker
 * Compose, see README. Point the tests at another instance with BASE_URL.
 */
const baseURL = process.env['BASE_URL'] ?? 'http://localhost:3000';
const isCI = Boolean(process.env['CI']);

export default defineConfig({
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['allure-playwright', { resultsDir: 'allure-results' }],
    // Read by scripts/notify-telegram.mjs to send the CI summary.
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    baseURL,
    // Retries are off locally, so keep the trace of every failure there.
    trace: isCI ? 'on-first-retry' : 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'api',
      testDir: './src/API/tests',
    },
    {
      name: 'ui',
      testDir: './src/UI/tests',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
