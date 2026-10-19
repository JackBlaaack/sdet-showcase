---
name: pw-api-demo
description: "Use when writing or structuring Playwright API tests in TypeScript against an OpenAPI spec. Triggers on: \"write API test\", \"create Playwright API test\", \"automate the API\", \"API test structure\", \"schema validation in tests\", \"fixture for API tests\", \"напиши API-тесты\", \"покрой спеку тестами\". Covers spec-first test design, structure, a thin service layer, fixtures, AJV schema validation, error-body assertions, parallel safety, anti-patterns. Vendor-neutral: plain @playwright/test + ajv with a hand-written service layer, no proprietary client layer."
---

# Playwright API Test Patterns

Flexible skill — adapt to the repo. Project conventions win: if the repo has a
`README.md` section on conventions, a service layer, or a house style, follow it;
this skill covers the defaults when nothing else says otherwise.

Stack assumed here: plain `@playwright/test` (`APIRequestContext`) plus `ajv`
for schema validation, with a **thin hand-written service layer** between the
tests and the HTTP calls. No generated client, no internal packages. In this
repo that layer is `SutApi` (`clients/sut-api.ts`), which returns an
`ApiResponse<T>` (`clients/api-response.ts`).

## The one rule that matters

**The spec is the source of truth, not the running code.** Write the assertion
the specification demands. If the implementation disagrees, the test goes red
and that red is the finding — never rewrite the assertion to match observed
behavior. Mark such a test so the failure is self-explanatory:

```typescript
// BUG-DETECTOR: spec says 201 Created; the SUT may answer 200
expect(response.status, response.text).toBe(http.HTTP_STATUS_CREATED);
```

When a test fails, classify before touching anything: **product bug** (code
violates spec) / **test bug** (assertion or setup is wrong) / **environment
issue** (SUT down, stale data, missing `ENABLE_TEST_API`). Only the second one
justifies editing the test.

## Code standards

- Single quotes — match the repo's formatting
- Relative imports end with `.js` (NodeNext modules)
- No `try/catch` in spec files (helpers only)
- No `if/else` in test logic (helpers only) — branching hides skipped assertions
- Direct assertions, one scenario per test
- Status codes via `node:http2` constants: `import { constants as http } from 'node:http2'`

## Basic test structure

```typescript
import { constants as http } from 'node:http2';
import { validateOrder } from '../../../utils/validators.js';
import { expect, test } from '../fixtures/shop.fixture.js';

test.describe(
  'API - Orders',
  {
    tag: ['@api', '@e2e', '@orders', '@coupons', '@allure.label.layer:api'],
  },
  () => {
    test('Order with a percent coupon is discounted', async ({ shop }) => {
      const { api, customer, product, coupon } = shop;

      const response = await api.createOrder(customer.token, {
        items: [{ productId: product.id, quantity: 2 }],
        couponCode: coupon.code,
      });

      expect(response.status, response.text).toBe(http.HTTP_STATUS_CREATED);
      const order = response.data;
      expect(
        validateOrder(order),
        JSON.stringify(validateOrder.errors, null, 2),
      ).toBe(true);
      expect(order.totalCents, '2 x 1000 minus 10%').toBe(1800);
    });
  },
);
```

- `expect(response.status, response.text)` — the body becomes the failure message
- `response.data` is the success body, `response.error` the error body; reading the wrong one throws, so assert the status first
- `expect(value, 'why this matters')` — the custom message costs one string and
  saves the next person a debugging session
- multi-call scenarios: wrap each phase in `test.step()` so the report reads
  like a scenario, not a stack trace

## File structure

Flat and predictable. One spec per resource + operation group:

```
src/API/
├── tests/        orders-coupon.spec.ts, orders-create.spec.ts, orders-pay.spec.ts
├── fixtures/     shop.fixture.ts (customer, token, product, coupon per test)
└── dto/          shop-seed.dto.ts: DTO<T>[] with UPPER_CASE type, data: () => ({...})
src/interfaces/   types only: DTO<T>, Shop/ShopSeed, fixture interfaces
clients/          sut-api.ts (one method per endpoint), api-response.ts, types.ts — used by both layers
utils/            what the API and UI layers both use
├── validators.ts (validateX = schemaValidator('X'))
├── unique.ts     uniqueSuffix()
├── shop.ts       seeds the shop through the test hooks
└── data-provider.ts  DataProvider.getData('TYPE') over a DTO list
```

Bigger suites split by outcome instead: `{resource}/success/` and `{resource}/error/`.
The API layer never imports from the UI layer (`src/UI/**`); share through `clients/` and `utils/`.

## Service layer

Tests never call `request.post(...)` directly. A new endpoint is a new method
that returns a typed `ApiResponse<T>`; `T` is a short name for a generated type:

```typescript
cancelOrder(token: string, orderId: string): Promise<ApiResponse<Order>> {
  return toApiResponse(
    this.request.post(`/api/v1/orders/${orderId}/cancel`, {
      headers: bearer(token),
    }),
  );
}
```

Why a hand-written layer and not a generated client: it stays on Playwright's
`APIRequestContext`, so traces and report steps keep working.

## Fixtures — setup and idempotent teardown

Resource lifecycle belongs in the fixture, not `afterEach`: code after
`await use()` runs even when the test fails, and it keeps specs scenario-only.
The `shop` fixture seeds a customer, a product and a coupon per test through
the test hooks (`POST /test/seed`, `POST /test/token`) and asserts both steps —
a silent setup failure would surface later as a confusing assertion error.

```typescript
export const test = base.extend<{ shop: Shop }>({
  shop: async ({ request }, use) => {
    const api = new SutApi(request);
    const seedResponse = await api.seed({ /* unique users, products, coupons */ });
    expect(seedResponse.status, seedResponse.text).toBe(http.HTTP_STATUS_CREATED);

    await use({ api, customer, product, coupon });

    // teardown here if the API offers a delete; tolerate 404 — the test may have removed it already
  },
});
```

This SUT has no delete endpoints, so there is no teardown: the data is wiped by
`POST /test/reset` or by restarting the database container. Tests therefore
create their own data and never rely on data from another test.

Setup helpers may accept the *current* behavior where a bug-detector test
already covers the spec violation — otherwise every unrelated test fails for
the same known reason.

## Test data — unique per test, overrides visible

`uniqueSuffix()` (`utils/unique.ts`) keeps names, SKUs and coupon codes
unique across parallel workers and repeated runs. For request payloads, a
builder with overrides makes the test intent visible at a glance:

```typescript
function orderPayload(productId: string, overrides: Partial<CreateOrderRequest> = {}): CreateOrderRequest {
  return { items: [{ productId, quantity: 1 }], ...overrides };
}

// the override IS the test intent
const response = await api.createOrder(token, orderPayload(product.id, { couponCode: 'NO-SUCH-COUPON' }));
```

## Schema validation

Validate the schema on every success response — a status code proves nothing
about the contract. Validators are built from the OpenAPI document
(`utils/validators.ts`), so a spec change shows up as a diff:

```typescript
export const validateOrder = schemaValidator('Order');   // validators.ts

expect(
  validateOrder(order),
  JSON.stringify(validateOrder.errors, null, 2),   // always surface the validator errors — a bare `false` is undebuggable
).toBe(true);
```

The builder closes every object (`additionalProperties: false`) when the spec
does not say otherwise: it catches undocumented fields the implementation leaks,
which is a real documentation defect worth reporting.

## Error responses

Never assert the status alone — the error body is part of the contract. The spec
defines one error schema, `ApiError` (`{ error: { code, message, details? } }`):

```typescript
export const validateApiError = schemaValidator('ApiError');   // validators.ts

test('Order with a quantity above the limit is rejected', async ({ shop }) => {
  const { api, customer, product } = shop;

  const response = await api.createOrder(customer.token, {
    items: [{ productId: product.id, quantity: 100 }], // spec: quantity maximum 99
  });

  expect(response.status, response.text).toBe(http.HTTP_STATUS_BAD_REQUEST);
  expect(
    validateApiError(response.error),
    JSON.stringify(validateApiError.errors, null, 2),
  ).toBe(true);
});
```

The spec types `code` as a plain string, so assert a concrete `code` only when a
requirement or a confirmed case names it; otherwise raise an open question.

Auth-protected endpoints get explicit negative scenarios: no header, malformed
header, wrong token — each asserting `401` plus the error body.

## Coverage from the spec

Derive cases, don't improvise them. For every endpoint in the OpenAPI spec:

- **BVA** on every numeric/length constraint — `min-1`, `min`, `max`, `max+1`
  (`quantity` 1..99 → test 0, 1, 99, 100; the off-by-one lives at the boundary)
- **Equivalence classes** for enums, formats, dates
- **Required-field matrix** — each required field omitted in turn
- **Type violations** — string where a number is documented
- **Auth matrix** — endpoint × (no token / bad token / customer / admin)
- **State transitions** — NEW → PAID → SHIPPED → DELIVERED, plus the forbidden ones
- **Documented-vs-actual gaps** — response fields the spec omits, status codes
  the spec never mentions: each one is a finding, not a test to skip

## Assertions

```typescript
// status codes — constants, with the body as the message
expect(response.status, response.text).toBe(http.HTTP_STATUS_OK);
expect(response.status, response.text).toBe(http.HTTP_STATUS_CREATED);

// structure without over-asserting
expect(order).toMatchObject({ status: 'NEW', couponCode: coupon.code });

// independent checks of one response — all reported, not just the first
expect.soft(order.subtotalCents).toBe(2000);
expect.soft(order.discountCents).toBe(200);

// eventual consistency — poll, never sleep
await expect
  .poll(async () => (await api.getProduct(product.id)).data.stock, { timeout: 10_000 })
  .toBe(3);
```

## Parallel safety

- `fullyParallel: true` is the default — assume tests run simultaneously
- Seeded/shared data is **read-only**; anything mutated must be created by the test
- No module-level mutable state (`let sharedId` → broken under parallelism)
- Unique names from `uniqueSuffix()`, never hardcoded SKUs, emails or coupon codes
- `test.describe.configure({ mode: 'serial' })` only as a last resort — serial
  suites hide isolation bugs and slow the run

## Config

The SUT runs separately (Docker Compose), so the config does not start it:

```typescript
const baseURL = process.env['BASE_URL'] ?? 'http://localhost:3000';

export default defineConfig({
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL },
  projects: [
    { name: 'api', testDir: './src/API/tests' },
    { name: 'ui', testDir: './src/UI/tests' },
  ],
});
```

When results look impossible, check the SUT first — `curl -s http://localhost:3000/health`
— and make sure it is the instance you expect (a stale container serves the run)
before blaming the code.

## Run commands

```bash
pnpm test:api                                              # API project
pnpm exec playwright test --project=api --grep 'coupon'    # one case by title
pnpm typecheck                                             # types, incl. generated
pnpm report                                                # HTML report of the last run
```

## Anti-patterns

| Bad | Good |
|-----|------|
| Assertion rewritten to match actual behavior | Assert the spec, let it go red, report the bug |
| `expect(isValid).toBe(true)` bare | `expect(isValid, JSON.stringify(validate.errors, null, 2)).toBe(true)` |
| Error test = status check only | Status + `response.error` against the `ApiError` schema |
| Success test = status check only | Status + schema validation |
| `request.post(...)` straight in a spec | A `SutApi` method returning `ApiResponse<T>` |
| `response.data` read before the status was asserted | Assert the status first (the getter throws on an error response) |
| `afterEach` cleanup for fixture-owned data | Teardown after `await use()` |
| `await new Promise(r => setTimeout(r, 5000))` | `expect.poll(...)` |
| Hardcoded SKU, email or coupon code | `uniqueSuffix()` / the `shop` fixture |
| `expect([200, 201]).toContain(status)` to get green | The spec's status; the red test is the finding |
| `if (response.status === 200) { ... }` | Deterministic expectation, one scenario per test |
