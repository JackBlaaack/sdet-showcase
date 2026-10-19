---
name: test-code-review
description: "Use for comprehensive review of Playwright test code covering both API and UI tests. Triggers on: \"review test code\", \"review test PR\", \"check tests quality\", \"full test review\", \"audit all tests\". Covers formatting, structure, data management, assertions, anti-patterns, security."
---

# Playwright Test Code Review

## Universal Rules (API + UI)

- [ ] Single quotes everywhere (not double quotes)
- [ ] No `try-catch` in test files (helpers only)
- [ ] No `if-else` in test logic (helpers only)  
- [ ] No `console.log` in committed test files
- [ ] All async operations `await`ed
- [ ] `test.describe` groups tests logically
- [ ] Test names are descriptive and specific
- [ ] Tags appropriate (`@smoke`, `@api`/`@ui`, `@feature`)
- [ ] Tests independent (no shared state, no order dependency)
- [ ] Cleanup in `afterEach`/`afterAll`

## API Tests

### Design
- [ ] Uses `request` fixture or custom API fixture
- [ ] Base URL from config/env vars, not hardcoded
- [ ] Negative scenarios in `/error/` directory

### Data
- [ ] No hardcoded data in test body → fixtures, builders or data helpers
- [ ] Unique data per test (generated, no static IDs — here `uniqueSuffix()` and the `shop` fixture)
- [ ] A provider/builder pattern for test data access, not repeated inline literals

### Validation
- [ ] Status code validated
- [ ] Response schema validated (AJV/Zod), not just status
- [ ] Specific fields validated (not just `isDefined()`)
- [ ] Error responses validated with error DTOs
- [ ] Soft assertions for multiple field checks

### Cleanup
- [ ] Created entities deleted in `afterEach`
- [ ] Tests don't leave dirty data
- [ ] Parallel safe (no race conditions)

### Auth
- [ ] `storageState` reused between tests
- [ ] Separate context per role
- [ ] Headers checked when relevant

## UI Tests

### Structure
- [ ] Uses Page Object Model (no selectors in test file)
- [ ] Each page/component has own PO class
- [ ] Required type tag: `@acceptance` OR `@e2e`

### Locators
- [ ] `data-testid` attributes used (not CSS class, not dynamic ID)
- [ ] No positional selectors (`nth-child`, `nth-of-type`)
- [ ] No XPath unless absolutely necessary

### Waiting
- [ ] No `waitForTimeout()` (hardcoded sleep)
- [ ] Uses `expect(el).toBeVisible()` not `sleep + check`
- [ ] `waitForResponse` paired with action when checking API side effects

### Assertions
- [ ] Visibility assertions (`toBeVisible`, `not.toBeVisible`)
- [ ] Text assertions with exact expected text
- [ ] State change verified after action
- [ ] Error messages verified

## Anti-Patterns Table

| ❌ Bad | ✅ Good |
|--------|---------|
| `page.locator('.btn-primary')` | `page.getByTestId('submit')` |
| `await page.waitForTimeout(3000)` | `await expect(el).toBeVisible({ timeout: 10000 })` |
| `let sharedId; beforeAll(() => sharedId = ...)` | Create data per test |
| `if (response.status === 200) expect(...)` | Direct assertion |
| `import { x } from "module"` | `import { x } from 'module'` (single quotes) |
| `console.log('debug')` | Remove before commit |
| Hardcoded `{ name: 'Test User' }` in test | DTO file |
| No cleanup after `api.create()` | `afterEach` deletes created resource |
| Only `expect(status).toBe(200)` | + schema validation + field checks |

## Security Checks

- [ ] 401 returned on missing/invalid token
- [ ] 403 returned on wrong role
- [ ] Input sanitization tested (SQL injection patterns, XSS)
- [ ] Sensitive data not exposed in error responses

## Review Report Format

```markdown
# Code Review: {file/PR}

**Quality:** Excellent | Good | Fair | Poor
**Score:** X/10
**Critical:** N | **Warnings:** N | **Suggestions:** N

## Critical (Must Fix)

### {Issue}
**Location:** path/to/file.ts:line  
**Problem:** {what's wrong}  
**Fix:** {specific change}

## Warnings (Should Fix)

### {Issue}
**Location:** path/to/file.ts:line
**Problem:** {what's wrong}
**Fix:** {suggestion}

## Checklist
- [x] Single quotes
- [ ] Schema validation (MISSING)
- [x] Cleanup
- [ ] Error scenarios (MISSING)
```
