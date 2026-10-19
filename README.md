# sdet-showcase

A portfolio project for SDET work: API and UI test automation in strict TypeScript, written against a purpose-built system under test, with the test design, defect reports and CI that go around the code.

> Status: work in progress (week 1 of 12). The repository layout and tooling are in place; the test suites are being added area by area. See the [roadmap](#roadmap) for what exists today.

## What this shows

How one engineer approaches testing a system end to end:

1. Read the requirements and design tests from them (test design before test code).
2. Automate the API layer with a typed client and schema validation.
3. Automate the UI with Page Objects and stable locators.
4. Check contracts between API versions, performance and resilience.
5. Run everything in CI and publish a report anyone can open.
6. Write up the defects that the tests find.

## System under test

The tests run against **orders-sut**, a small orders service that lives in its own repository (link to be added once it is published). It exists to be tested:

- REST API on Fastify and TypeScript, Postgres, a lightweight web UI, an external payment stub and an OpenAPI specification (26 operations).
- Roles `admin` and `customer`, bearer-token (JWT) authentication.
- A business domain with real rules: order lifecycle (`NEW` → `PAID` → `SHIPPED` → `DELIVERED`, plus cancel and refund), stock reservation, coupons, idempotent payments, order expiry.
- Two API versions (`/api/v1` and `/api/v2/orders/:id`) for contract testing.
- Test hooks, available only with `ENABLE_TEST_API=true`: reset and seed the data, control the application clock, run the expiry sweep, mint tokens, and inject failures and latency. Tests use these instead of `sleep` and shared fixtures.
- Two builds, selected with `SUT_BUGS`: `none` is the reference build, `all` contains planted defects.

A good test is green on the reference build and red, for the right reason, on the build with defects.

### Running the system under test

Clone `orders-sut` next to this repository, then from its directory:

```bash
# reference build (no planted defects)
SUT_BUGS=none docker compose up --build -d --wait

# check it is up
curl -s http://localhost:3000/health
```

The application is at `http://localhost:3000` (Swagger UI at `/docs`), the payment stub at `http://localhost:4000`, Postgres at `localhost:5432`. Stop it with `docker compose down`; the database lives in memory, so every restart is a clean slate.

## Roadmap

| Area | What it demonstrates | Status |
| --- | --- | --- |
| Project setup | Strict TypeScript (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), pnpm, typecheck script | Done |
| Test design | Checklists, decision tables (coupon rules), state-transition model of the order lifecycle | Planned |
| API tests | Service layer, types and response validators generated from the OpenAPI document, seed and token fixtures | In progress: first test (order with a coupon) |
| UI tests | Playwright, Page Objects, `data-testid` locators, authentication via stored state, handling deliberately flaky UI behaviour | In progress: first test (login through the form) |
| Contract tests | `GET /api/v1/orders/:id` against `GET /api/v2/orders/:id` | Planned |
| Resilience | Payment failures and latency through the failure-injection flags, flaky-test tracking | Planned |
| Performance | k6 scenarios: order creation against limited stock, order list under jitter | Planned |
| CI and reporting | GitHub Actions with sharding, Allure report published to GitHub Pages | Planned |
| Defect reports | Findings from the build with planted defects, with reproduction steps | Planned |

## Getting started

Requirements:

- Node.js 22 or newer
- pnpm 12 (the exact version is pinned in `package.json`)
- Docker, to run the system under test

```bash
pnpm install
pnpm browsers:install   # downloads Chromium only
pnpm typecheck
```

Run the tests with the system under test up (see [Running the system under test](#running-the-system-under-test)):

```bash
pnpm test:api   # API tests, no browser
pnpm test:ui    # UI tests, Chromium
pnpm test       # both projects
pnpm report     # open the HTML report of the last run
```

The tests target `http://localhost:3000`; set `BASE_URL` to use another instance.

### Running the tests in Docker

One command starts orders-sut, waits until its API is healthy, runs the tests in a container and removes everything afterwards. No Node.js, pnpm or browsers needed on the host, only Docker with Compose 2.20 or newer.

```bash
pnpm test:docker       # both projects
pnpm test:docker:api   # API tests only
pnpm test:docker:ui    # UI tests only
```

How it fits together:

- `docker-compose.yml` pulls in the compose file of orders-sut with `include`, so the SUT and the `tests` service share one network and the tests reach the API at `http://api:3000`.
- orders-sut is expected next to this repository (`../orders-sut`). If it lives elsewhere, set `SUT_DIR` in a local `.env` (git-ignored), for example `SUT_DIR=../../orders-sut`.
- The reference build is used (`SUT_BUGS=none`). Run `SUT_BUGS=all pnpm test:docker` for the build with planted defects.
- `scripts/test-docker.sh` runs `docker compose up --exit-code-from tests`, then `docker compose down`, and exits with the code of the tests, so it can gate CI.
- The SUT binds ports 3000, 4000 and 5432 on the host: stop an orders-sut started on its own (`docker compose down` in its directory) before a run.
- `playwright-report/`, `test-results/` and `allure-results/` are mounted from the host, so `pnpm report` and `pnpm report:allure` work after a run.
- The image is `mcr.microsoft.com/playwright` with the same version as `@playwright/test`: bump the tag in `Dockerfile` together with the package.

## Generated API code

The API types and the response validators come from the OpenAPI document of the system under test, so a change in the API shows up as a diff in this repository:

```bash
pnpm generate:api     # needs the system under test running
```

It does two things:

1. `generate:spec` saves the document served at `/openapi.json` to `spec/openapi.json` (set `OPENAPI_SOURCE` to a URL or a file path to read it from elsewhere).
2. `generate:types` turns it into `clients/generated/schema.ts` with `openapi-typescript`.

Both generated files are committed. How they are used:

- `clients/types.ts` gives the types short names (`Order`, `Product`, `SeedRequest`, ...) and is the only place that imports the generated file.
- `utils/validators.ts` builds AJV validators from `components.schemas` in `spec/openapi.json`, and closes every object so that an unexpected extra field in a response fails the check.
- The service layer in `clients/sut-api.ts` stays hand-written on top of Playwright's `APIRequestContext`. A generated fetch or axios client would bypass Playwright's traces and report steps.

`openapi-typescript` needs the classic TypeScript 5 compiler API, which TypeScript 7 (used by this project) no longer ships. The generator therefore runs through `pnpm dlx` with `typescript@5.9.3` pinned, and only its output, plain `.ts` types, is checked by the project's own compiler.

If `pnpm` is not installed, get it with `npm install --global pnpm@12` or `brew install pnpm`. Corepack 0.31, which ships with Node 22.14, cannot launch pnpm 12 (it fails with a missing `pnpm.cjs`), so do not rely on `corepack enable` with that version.

## Project structure

```
playwright.config.ts   projects: api (no browser) and ui (Chromium)
spec/           openapi.json saved from the system under test
scripts/        fetch-spec.mjs, the first step of pnpm generate:api
clients/        service layer over the HTTP API, short type names (used by both layers)
  generated/    types generated from the OpenAPI document
utils/          helpers both layers use: response validators built from the OpenAPI document, unique names, shop seeding, DataProvider
src/
  interfaces/   types only, no logic: DTO<T>, domain shapes (Shop, ShopSeed), fixture interfaces
  API/          API layer: tests/, fixtures/ (seeded shop), dto/ (DTO<T>[] test data)
  UI/           UI layer: tests/, fixtures/ (seeded shop, page objects), pages/ (Page Objects), dto/ (DTO<T>[] test data)
algo/           algorithm practice solutions
docs/
  test-design/  checklists, decision tables, state models
  bug-reports/  defects found, with reproduction steps
.github/
  workflows/    CI pipelines
```

Directories that are still empty hold a `.gitkeep` and are filled as the roadmap advances.

## Principles

These apply to every test added to the repository:

- Each test creates the state it needs through the seed hook and does not depend on another test.
- No fixed waits: time is controlled through the application clock, everything else waits on an explicit condition.
- Tests can run in parallel without interfering with each other.
- Expected results are derived from the requirements, not copied from observed behaviour.
- No secrets in the repository; the only credentials used are those of the local test environment.

## License

MIT
