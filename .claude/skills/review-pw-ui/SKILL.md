---
name: review-pw-ui
description: "Use when reviewing Playwright UI test code quality before committing. Triggers on: \"review UI test\", \"check UI test\", \"UI test quality\", \"before committing UI tests\", \"audit Playwright UI tests\". Checklist: POM, locators (data-testid), assertions, async/await, screenshots, structure."
---

# Playwright UI Test Review Checklist

> Project conventions win: read `README.md`, `src/UI/pages/base.page.ts`,
> `src/UI/fixtures/ui.fixture.ts` and the neighbouring specs first — flag
> violations of the project convention even when this generic checklist allows
> the pattern.

## Step 0 — Mechanical Enforcement (run BEFORE manual review)

Deterministic checks on the changed files. Any hit = finding, no judgment call:

```bash
# changed AND new (untracked) files — an Automator mostly adds new ones
FILES=$( (git diff --name-only --diff-filter=ACM HEAD; git ls-files --others --exclude-standard) | grep -E '\.(spec|page|component|fixture)\.ts$')
SPECS=$(echo "$FILES" | grep '^src/UI/tests/.*\.spec\.ts$')

# scan <ERE pattern> <file list>: grep each listed file; works in bash and zsh
# (zsh does not split an unquoted multi-line $FILES into separate arguments)
scan() { printf '%s\n' "$2" | while IFS= read -r f; do [ -n "$f" ] && grep -nHE -e "$1" "$f"; done; }

# Hard sleeps
scan 'waitForTimeout|setTimeout' "$FILES"

# Discouraged waiting
scan 'networkidle' "$FILES"

# Debug leftovers
scan 'console\.log|page\.pause\(\)|\.only\(' "$FILES"

# Fragile selectors in specs (locators belong in page objects)
scan 'page\.locator\(|getByTestId\(|getByRole\(' "$SPECS"

# nth-child / positional selectors anywhere
scan 'nth-child|nth\(' "$FILES"

# Shared mutable state between tests
scan '^\s*let ' "$SPECS"

# try-catch / if-else in specs
scan 'try \{|\} catch|if \(' "$SPECS"

# Non-awaited expect on locator (async matchers); multi-line expects may give false positives
scan '^\s*expect\(' "$SPECS" | grep -v 'expect\.soft\|expect\.poll\|await'

# Layer boundary: UI code must not import from the API layer
scan "from '[^']*/API/" "$(echo "$FILES" | grep '^src/UI/')"

# Page objects created with `new` in a spec instead of a fixture
scan 'new [A-Z][A-Za-z]*(Page|Component)\(' "$SPECS"
```

Also verify file names: ASCII only (catch Cyrillic look-alikes like `с` vs `c`):

```bash
echo "$FILES" | grep -P '[^\x00-\x7F]'
```

## Page Object Model

- [ ] UI logic in Page Objects, not in test files
- [ ] Page objects extend project `BasePage`; specs never touch `page` directly
- [ ] Page objects delivered to tests via fixture DI — no `let po` + `new` in `beforeEach`
- [ ] Tests only call PO methods/locator getters, no raw selectors in spec

## Locators

- [ ] Priority respected: `getByTestId` → `getByRole`/`getByLabel` → `getByText`
- [ ] No CSS classes, XPath, dynamic IDs, nth-child/positional selectors

## Async / Await

- [ ] All actions and web-first assertions awaited
- [ ] Web-first assertions / `waitForResponse` / `waitForURL` instead of sleeps
- [ ] No `waitForLoadState('networkidle')`
- [ ] Time-dependent logic uses `page.clock`, not real waiting

## Assertions

- [ ] `expect(locator).toBeVisible()`, not `expect(await locator.isVisible()).toBe(true)`
- [ ] Custom message on non-obvious asserts: `expect(x, 'why').toBeVisible()`
- [ ] `expect.soft()` for independent checks of one state
- [ ] Project custom matchers used where standard expect is insufficient
- [ ] Every test ends with an assertion (no assert-free "smoke" bodies)

## Structure

- [ ] `test.describe` groups by feature/page
- [ ] `test.step()` wraps logical phases of multi-step scenarios
- [ ] `test.skip()` only for feature flags; `test.fixme()` for known bugs
- [ ] Tags per project taxonomy: `@ui`, `@acceptance`|`@e2e`, `@smoke`|`@regression`, `@{feature}`, `@allure.label.layer:ui`
- [ ] One behavior per test

## Isolation

- [ ] Tests don't depend on each other's state or execution order
- [ ] Setup/cleanup in fixture (after `await use()`), `afterEach` only when no fixture owns the resource
- [ ] Unique data per test (generator, not hardcoded values)
- [ ] Backend isolation via `page.route()`/HAR where the test doesn't target the backend

## Failure Diagnostics (config-level, not per-test code)

- [ ] `trace: 'on-first-retry'`, `screenshot: 'only-on-failure'` in `playwright.config.ts`
- [ ] No manual `page.screenshot()` in `afterEach` — config handles it

## Code Style

- [ ] Single quotes throughout
- [ ] No try-catch in tests (belongs in helpers)
- [ ] No if-else in test logic (use helpers or split into separate tests)
- [ ] No `console.log`, `.only`, `page.pause()` leftovers
