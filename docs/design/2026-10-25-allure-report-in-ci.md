# Allure report in CI

Date: 2026-10-25. Status: approved, not implemented yet.

## Goal

Every CI run produces an Allure report that opens with one click from the Telegram summary:

- a pull request: its latest report at `https://jackblaaack.github.io/sdet-showcase/pr/<number>/`;
- `main`: the latest report with the history of `main` at `https://jackblaaack.github.io/sdet-showcase/`.

A failing pull request is where a failure gets investigated, because a red pull request is not merged. A ruleset on `main` makes that a rule: the merge button stays disabled until the tests pass.

## What is already there

- `allure` 3.21.0 and `allure-playwright` 3.13.0 are in the lockfile. The Allure 3 CLI is JavaScript, no Java is needed.
- `playwright.config.ts` writes `allure-results/`, takes a screenshot on failure and records a trace on the first retry; CI retries a failed test twice.
- `.github/workflows/tests.yml` uploads `playwright-report/` and `allure-results/` as the `reports` artifact and sends a summary to Telegram with `scripts/notify-telegram.mjs`.
- There is no Allure config file; `report:allure` runs `allure generate allure-results -o allure-report --clean`.

Checked on a deliberately failing UI test run in Docker: each of the three attempts carries the error with its stack, the steps with the failed one marked, a `screenshot` (image/png) and an `error-context` (the Playwright snapshot of the page); the first retry also carries a `trace`. Allure 3.21.0 offers the trace as a download (`@allurereport/web-commons/dist/attachments.js`, the Playwright trace content type is handled as an archive); it opens at https://trace.playwright.dev or with `npx playwright show-trace`. The HTML report of Playwright in the `reports` artifact has the trace viewer built in.

## Design

### 1. Generating the report

- `allurerc.mjs` in the repository root, used both locally and in CI: report name `sdet-showcase`, output `allure-report/`, history `allure-history/history.jsonl`, single-file report (`plugins.awesome.options.singleFile: true`, one `index.html` of about 3 MB that opens without a server), history limited to 30 entries.
- `report:allure` uses this config. `allure-history/` is git-ignored.
- In CI the report is generated once, in the `tests` job, inside the tests image with `docker compose run --rm --no-deps tests pnpm report:allure`, so the Allure version is the one in the lockfile and nothing is downloaded. The step runs whether the tests passed or failed.
- Before generating, the `tests` job reads `history.jsonl` from the root of `gh-pages` (the history of `main`) into `allure-history/`; reading needs only `contents: read`. When the branch or the file does not exist yet, the report starts without history.

### 2. Jobs and permissions

`tests` (as today, `contents: read`): runs the tests, generates the Allure report with the history of `main`, uploads the `reports` artifact with the Playwright HTML report, `allure-results/`, the Allure report, `allure-history/` and `test-results/results.json`.

`report` (`needs: tests`, runs unless the run was cancelled and unless the pull request comes from a fork; `contents: write` for this job only, so the code of a pull request, which runs in `tests`, never gets a token that can push):

1. Downloads the artifact.
2. Checks out `gh-pages`; creates it as an orphan branch with `.nojekyll` when it does not exist.
3. For `main`: puts the report in the root and `allure-history/history.jsonl`, which now includes this run, next to it as `history.jsonl`.
4. For a pull request: puts the report in `pr/<number>/` and leaves the history of `main` untouched. The report was generated with that history, so Allure marks tests that fail now but passed on `main` as new failures.
5. Commits and pushes `gh-pages`.
6. Waits until GitHub Pages has built that commit (at most 3 minutes), so the link in Telegram does not open the previous report.
7. Sends the Telegram summary.

Every job that pushes to `gh-pages` uses `concurrency: gh-pages`, so two pushes never race. A manual run on a branch other than `main` is not published; its report is in the artifact only.

### 3. Telegram summary

`scripts/notify-telegram.mjs` gets the report URL and adds an "Allure report" link next to the link to the run. If publishing failed, the message says so and points to the artifact.

### 4. Cleanup

`.github/workflows/report-cleanup.yml` runs when a pull request is closed or merged and removes `pr/<number>/` from `gh-pages`, in the same `gh-pages` concurrency group.

### 5. Making the repository public

GitHub Pages of a private repository needs a paid plan, and a Pages site is public even then. The repository becomes public; orders-sut stays private.

1. Scan the whole history for secrets with gitleaks in Docker, pinned version; review the tracked files, including `.claude/`, and decide what stays public.
2. Switch the visibility, only after an explicit confirmation at that moment.
3. Enable Pages from the root of `gh-pages`.
4. Ruleset on `main`: the status check "API and UI tests" is required and changes go through pull requests, with no bypass. It can be relaxed later.

Pull requests from forks get no secrets, so they fail at the checkout of orders-sut. This is accepted: the project has no outside contributors.

### 6. Accepted as is

- Allure 3.21.0 embeds Google Analytics in the report (`analyticsEnable: true` in `@allurereport/plugin-awesome/dist/generators.js`, no option to turn it off); it sends the Allure version, the report id and the single-file flag, not test data. Stripping it from the generated HTML would patch the output of a dependency and break on upgrades.
- Error messages and screenshots of orders-sut are public on Pages.

## Verification

1. actionlint; the report generated locally in the CI layout (both repositories side by side).
2. A pull request with a deliberately failing test: `pr/<number>/` shows the error, the screenshot and the trace; the Telegram summary links to it; the ruleset blocks the merge.
3. The failing test is reverted, the pull request turns green and is merged: the root of the site shows the report of `main` and its history; `pr/<number>/` is removed.

## Order of work

A. Generation and artifact (works while the repository is private).
B. Secret scan, public visibility, Pages.
C. Publishing, Telegram link, cleanup.
D. Ruleset, then the verification above.
