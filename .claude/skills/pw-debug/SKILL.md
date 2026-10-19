---
name: pw-debug
description: "Use when Playwright tests are failing, flaky, or timing out. Triggers on: \"Playwright test fails\", \"UI test broken\", \"flaky test\", \"test timeout\", \"element not found in test\", \"passes locally fails CI\", \"intermittent test failure\", \"how to debug Playwright\". Covers failure patterns, debug tools, selector fixes."
---

# Playwright Test Debugging

## Common Failure Patterns

| Pattern | Symptoms |
|---------|----------|
| Assertion failure | Expected ≠ actual, type mismatch, null/undefined |
| Timeout | Element not found, network timeout, condition never met |
| API error | 400/401/403/404/500 from endpoint |
| Data issue | Test data missing, dirty environment, conflicts |
| Parallel conflict | Race condition, shared state, resource conflict |

## Debugging Commands

```bash
# Verbose output
pnpm exec playwright test --reporter=list --grep 'test name'

# Debug mode (step through)
pnpm exec playwright test --debug
pnpm exec playwright test --grep 'test name' --debug

# UI mode (interactive, visual)
pnpm exec playwright test --ui

# Run many times to catch flaky
pnpm exec playwright test --repeat-each=10

# With trace
pnpm exec playwright test --trace on
pnpm exec playwright show-trace trace.zip
```

## Inspect Network

```typescript
// Log all requests
page.on('request', req => console.log('→', req.method(), req.url()));
page.on('response', res => console.log('←', res.status(), res.url()));

// Wait for specific response
const response = await page.waitForResponse('**/api/endpoint');
console.log(await response.json());
```

## Debugging Checklist

When test fails:
- [ ] Reproducible? (run 3+ times)
- [ ] Test data exists and is correct
- [ ] Environment is clean (old data deleted)
- [ ] Timeouts appropriate (not too short)
- [ ] Selectors stable (using data-testid)
- [ ] Assertions correct
- [ ] Network requests succeed
- [ ] Auth tokens valid
- [ ] Test runs independently (isolated from others)

## Fix: Flaky Selectors

```typescript
// Bad — fails when class changes
await page.locator('.btn-primary').click();

// Good — stable
await page.locator('[data-testid="submit-btn"]').click();

// If element appears slowly:
await page.waitForSelector('[data-testid="result"]', { state: 'visible' });
await expect(page.locator('[data-testid="result"]')).toBeVisible({ timeout: 10000 });
```

## Fix: Timing Issues

```typescript
// Too fast (element not rendered):
await expect(page.locator('.result')).toBeVisible({ timeout: 10000 });

// Waiting for navigation / specific network event
// (avoid waitForLoadState('networkidle') — discouraged, flaky):
await page.waitForURL('**/success-page');

// Wait for response + action together:
await Promise.all([
  page.waitForResponse('**/api/users'),
  button.click(),
]);
```

## Fix: Auth Problems

```typescript
// Session expires → re-init in beforeEach
test.beforeEach(async ({ page }) => {
  // Re-authenticate
  await page.goto('/login');
  await page.fill('[data-testid="email"]', process.env.TEST_USER!);
  await page.fill('[data-testid="password"]', process.env.TEST_PASS!);
  await page.click('[data-testid="submit"]');
  await page.waitForURL('**/dashboard');
});

// OR: use storageState
// playwright.config.ts: use: { storageState: 'auth/user.json' }
```

## Fix: Multiple Tabs/Windows

```typescript
// Always specify which page
const page1 = await context.newPage();
const page2 = await context.newPage();

await page1.locator('[data-testid="btn"]').click();  // explicit page
await page2.locator('[data-testid="btn"]').click();
```

## Fix: CI vs Local

| Issue | Cause | Fix |
|-------|-------|-----|
| Passes local, fails CI | Different test data | Use deterministic seed data |
| Passes local, fails CI | Timing | Add explicit waits, increase timeout |
| Passes local, fails CI | Parallel conflicts | Worker isolation |
| Passes local, fails CI | Different env | Sync config |

```bash
# Replicate CI environment locally
pnpm exec playwright test --workers=4  # same parallelism as CI
```

## Debug Report Format

```markdown
## Test Failure: {test name}

**File:** path/to/test.spec.ts:42
**Error:** {exact error message}
**Frequency:** Always | Intermittent

### Root Cause
{What's causing the failure}

### Fix
```typescript
// Before
failing code

// After
fixed code
```

### Verification
- [ ] Passes locally (5+ runs)
- [ ] Passes in CI
- [ ] No regressions
```
