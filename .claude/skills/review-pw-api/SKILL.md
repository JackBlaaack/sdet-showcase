---
name: review-pw-api
description: "Use when reviewing Playwright API test code quality before committing. Triggers on: \"review API test\", \"check API test\", \"API test quality\", \"before committing API tests\", \"audit Playwright API tests\". Checklist: service layer, schema validation, auth, cleanup, parallel safety, code style."
---

# Playwright API Test Review Checklist

> Project conventions win: read `README.md` and the neighbouring specs, the
> service layer (`clients/sut-api.ts`) and the validators
> (`utils/validators.ts`) first — flag violations of the project
> convention even when this generic checklist allows the pattern.

## Step 0 — Mechanical Enforcement (run BEFORE manual review)

Deterministic checks on the changed files. Any hit = finding, no judgment call:

```bash
# changed AND new (untracked) files — an Automator mostly adds new ones
FILES=$( (git diff --name-only --diff-filter=ACM HEAD; git ls-files --others --exclude-standard) | grep -E '\.(spec|fixture)\.ts$')
SPECS=$(echo "$FILES" | grep '^src/API/tests/.*\.spec\.ts$')

# scan <ERE pattern> <file list>: grep each listed file; works in bash and zsh
# (zsh does not split an unquoted multi-line $FILES into separate arguments)
scan() { printf '%s\n' "$2" | while IFS= read -r f; do [ -n "$f" ] && grep -nHE -e "$1" "$f"; done; }

# Sleeps instead of polling
scan 'setTimeout|waitForTimeout' "$FILES"

# Raw HTTP calls where the SutApi service layer exists
scan 'request\.(post|get|put|patch|delete)\(|fetch\(|axios' "$SPECS"

# Magic status numbers instead of node:http2 constants
scan 'status.*\.toBe\([0-9]+\)' "$SPECS"

# Bare schema validation (no error output on failure)
scan 'expect\(validate[A-Za-z]*\([^)]*\)\)\.toBe\(true\)|expect\((isValid|valid)\)\.toBe\(true\)' "$SPECS"

# Debug leftovers
scan 'console\.log|\.only\(' "$FILES"

# Shared mutable state between tests
scan '^\s*let ' "$SPECS"

# try-catch / if-else in specs
scan 'try \{|\} catch|if \(' "$SPECS"

# A spec without any schema validation — each API spec must hit one:
printf '%s\n' "$SPECS" | while IFS= read -r f; do [ -n "$f" ] && ! grep -q 'validate[A-Z]' "$f" && echo "$f"; done

# Layer boundary: API code must not import from the UI layer
scan "from '[^']*/UI/" "$(echo "$FILES" | grep '^src/API/')"

# Generated files must never be edited by hand
git diff --name-only HEAD | grep -E '^(clients/generated/|spec/openapi\.json)'
```

Also verify file names: ASCII only (catch Cyrillic look-alikes like `с` vs `c`):

```bash
echo "$FILES" | grep -P '[^\x00-\x7F]'
```

## Service Layer

- [ ] Calls go through `SutApi` methods returning `ApiResponse<T>` — no raw `request.*`/`fetch`/`axios` in specs
- [ ] A new endpoint is a new method in `clients/sut-api.ts`, typed with a name from `clients/types.ts`
- [ ] Base URL from `BASE_URL` in `playwright.config.ts`, not hardcoded
- [ ] HTTP logic in the service layer/fixtures, not inline in tests

## Schema Validation (critical)

- [ ] EVERY success response schema-validated with a `validateX` built from the OpenAPI document (`schemaValidator('X')` in `validators.ts`)
- [ ] Validator errors surfaced in assertion message: `expect(validateX(x), JSON.stringify(validateX.errors, null, 2)).toBe(true)`
- [ ] Not just status code — field types, required fields, enum values (the validator closes every object, so undocumented extra fields fail too)
- [ ] The expected values come from the spec or the confirmed case, never from what the SUT happened to return

## Error Scenario Coverage

- [ ] Error tests validate status AND error body (`response.error` against the `ApiError` schema, plus the specific value the case expects)
- [ ] 4xx cases covered: validation (400), unauthorized (401), forbidden (403), not found (404)
- [ ] `response.data` is read only on success and `response.error` only on an error response (the getters throw otherwise) — the status is asserted first

## Data Management & Cleanup

- [ ] Each test gets its own customer/product/coupon from the `shop` fixture — no data left over from another test
- [ ] Extra names, SKUs, emails, coupon codes via `uniqueSuffix()` — no hardcoded values that can collide
- [ ] Payload builders with overrides (if used) keep the test intent visible; no large inline literals repeated across specs
- [ ] Resource lifecycle in fixture teardown (after `await use()`), not `afterEach`; `afterEach` only when no fixture owns the resource
- [ ] Cleanup idempotent — tolerates already-deleted resources (404). The SUT has no delete endpoints, so "no teardown" is correct here

## Auth & Context

- [ ] Auth through the API layer: tokens from fixtures (`shop.customer.token`), no browser `storageState` in API tests
- [ ] Separate token/fixture per user role (customer vs admin)
- [ ] Negative auth (401/403) tested as explicit scenarios, not side effects

## Assertions

- [ ] `expect.poll()` for eventually-consistent state (not sleeps, not manual retry loops)
- [ ] Status via `node:http2` constants (`http.HTTP_STATUS_CREATED`), with the body as the message: `expect(response.status, response.text)`
- [ ] Correct semantics: 201 create, 200 read/update
- [ ] Custom message on non-obvious asserts
- [ ] `expect.soft()` for independent checks of one response
- [ ] No magic numbers in assertions without explanation (a derived total gets a comment: `2 x 1000 minus 10%`)
- [ ] No assertion bent to the current behavior (`[200, 201]`, a removed check) — a red test against the spec is the finding

## Parallel Execution Safety

- [ ] Tests thread-safe (`fullyParallel: true` compatible)
- [ ] Unique identifiers per test (`uniqueSuffix()`, the `shop` fixture)
- [ ] No shared state between tests
- [ ] `mode: 'serial'` absent, or justified in a comment

## Structure

- [ ] `test.describe` by resource
- [ ] `test.step()` wraps logical phases of multi-call scenarios
- [ ] `test.skip()` for feature flags only, `test.fixme()` for bugs
- [ ] Tags: `@api`, `@e2e`|`@integration`, `@smoke`|`@regression`, `@{feature}`, `@allure.label.layer:api`
- [ ] Relative imports end with `.js` (NodeNext)

## Environment

- [ ] API URL via `BASE_URL`/config
- [ ] No secrets committed (`.env` is git-ignored)

## Code Style

- [ ] Single quotes throughout
- [ ] No try-catch in test files (helpers only)
- [ ] No if-else in test logic
- [ ] No `console.log`, `.only` leftovers
