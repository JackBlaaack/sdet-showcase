# Allure report in CI: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** every CI run publishes its Allure report to GitHub Pages (`main` in the root, a pull request in `pr/<number>/`) and the Telegram summary links to it; `main` accepts only pull requests with green tests.

**Architecture:** the `tests` job runs the tests and generates the Allure report once, inside the tests image, with the history of `main` read from `gh-pages`. A separate `report` job, the only one allowed to push, publishes the report to `gh-pages` with `scripts/report-site.sh`, waits for GitHub Pages and sends the summary. A cleanup workflow removes the report of a closed pull request.

**Tech Stack:** GitHub Actions, Allure 3.21.0 (JavaScript CLI), Playwright 1.64.1, Docker Compose, POSIX sh, Node 22 `node:test`, git worktrees, GitHub Pages from a branch, repository rulesets.

Design: [2026-10-25-allure-report-in-ci.md](2026-10-25-allure-report-in-ci.md).

## Global Constraints

- Allure version: the one in the lockfile, `allure` 3.21.0; never `npx allure@...` in CI.
- Site branch: `gh-pages`; site URL: `https://jackblaaack.github.io/sdet-showcase/`; a pull request: `.../pr/<number>/`.
- History file: `allure-history/history.jsonl` locally and in CI, `history.jsonl` in the root of `gh-pages`; `historyLimit: 30`.
- Only the `report` job and `report-cleanup.yml` get `contents: write`; both use `concurrency: gh-pages` with `cancel-in-progress: false`.
- Required status check context: `API and UI tests` (the name of the `tests` job; do not rename it).
- Action versions: `actions/checkout@v7`, `actions/upload-artifact@v7`, `actions/download-artifact@v8`; lint with `rhysd/actionlint:1.7.12`; secret scan with `zricethezav/gitleaks:v8.30.1`.
- `git worktree add --orphan` needs git 2.42 or newer (local 2.49, runner 2.55).
- Commits: Conventional Commits in English, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; work on branch `ci/allure-report`, never push to `main`.
- The repository visibility changes only after an explicit confirmation of the user at that moment.
- No `pnpm` on the local PATH: run local binaries as `./node_modules/.bin/<tool>`.

## File structure

| File | Responsibility |
| --- | --- |
| `allurerc.mjs` (new) | Allure config: name, output, history, single-file report |
| `package.json` | `report:allure` uses the config; new `test:scripts` |
| `.gitignore`, `.dockerignore` | ignore `allure-history/` |
| `docker-compose.yml` | mount `allure-report/` and `allure-history/` into the tests container |
| `scripts/report-site.sh` (new) | the site on `gh-pages`: `fetch-history`, `publish`, `remove` |
| `scripts/report-site.test.mjs` (new) | tests of `report-site.sh` against a local bare repository |
| `scripts/notify-telegram.mjs` | link to the Allure report, note when publishing failed |
| `scripts/notify-telegram.test.mjs` (new) | tests of the links in the message |
| `.github/workflows/tests.yml` | `tests` job generates the report; new `report` job publishes and notifies |
| `.github/workflows/report-cleanup.yml` (new) | removes `pr/<number>/` when a pull request is closed |
| `README.md` | CI, Allure report, ruleset, project structure |

---

## Phase A: generation, publishing code, workflows (repository still private)

### Task 1: Allure config and generation in Docker

**Files:**
- Create: `allurerc.mjs`
- Modify: `package.json:21` (`report:allure`), `.gitignore`, `.dockerignore`, `docker-compose.yml` (volumes of `tests`)

**Interfaces:**
- Produces: `pnpm report:allure` reads `allure-results/` and `allure-history/history.jsonl`, writes `allure-report/index.html` and appends to the history. Inside Docker: `docker compose run --rm --no-deps tests pnpm report:allure`.

- [ ] **Step 1: Show that the current setup does not generate the report through Docker**

In the CI layout used before (`<scratchpad>/ci/sdet-showcase` next to `<scratchpad>/ci/orders-sut`, copied with `git ls-files -co --exclude-standard | rsync -a --files-from=- . <copy>/`):

Run: `sh scripts/test-docker.sh test:api && docker compose run --rm --no-deps tests pnpm report:allure; ls allure-report/index.html allure-history/history.jsonl`
Expected: `allure-report/` is not mounted, so `ls` fails with `No such file or directory` for both files.

- [ ] **Step 2: Create `allurerc.mjs`**

```js
// Allure 3 configuration for pnpm report:allure, locally and in CI.
//
// CI copies the history of main from the gh-pages branch to
// allure-history/history.jsonl before it generates the report
// (scripts/report-site.sh fetch-history), so the report shows the trend of main
// and marks new failures.
import { defineConfig } from 'allure';

export default defineConfig({
  name: 'sdet-showcase',
  output: './allure-report',
  historyPath: './allure-history/history.jsonl',
  historyLimit: 30,
  plugins: {
    // One self-contained index.html: it opens from a downloaded artifact and from
    // GitHub Pages alike.
    awesome: { options: { singleFile: true } },
  },
});
```

- [ ] **Step 3: Point `report:allure` at the config and add `test:scripts`**

In `package.json` replace

```json
    "report:allure": "allure generate allure-results -o allure-report --clean",
```

with

```json
    "report:allure": "rm -rf allure-report/* && allure generate allure-results --config allurerc.mjs",
```

Not `--clean`: it removes the output directory itself, and inside the container `allure-report/` is a mount point (`EBUSY: resource busy or locked, rmdir '/tests/allure-report'`). The directory still has to be emptied: Allure writes the report to `allure-report/awesome/` and moves it to the root only when that is the one report directory in the output (`@allurereport/core/dist/report.js`, `shouldFlattenOutput`), so an old report left there keeps the new one in the subdirectory.

and after `"test:algo": ...,` add

```json
    "test:scripts": "node --test \"scripts/**/*.test.mjs\"",
```

- [ ] **Step 4: Ignore the history**

Add `allure-history/` after `allure-report/` in both `.gitignore` and `.dockerignore`.

- [ ] **Step 5: Mount the report and the history into the tests container**

In `docker-compose.yml`, under `services.tests.volumes`, after `- ./allure-results:/tests/allure-results` add:

```yaml
      - ./allure-report:/tests/allure-report
      - ./allure-history:/tests/allure-history
```

- [ ] **Step 6: Run the generation again in the CI layout**

Copy the working tree into the CI layout again, then:

Run: `sh scripts/test-docker.sh test:api && docker compose run --rm --no-deps tests pnpm report:allure && ls -la allure-report/index.html && wc -l < allure-history/history.jsonl`
Expected: `index.html` of about 3 MB exists, the history has 1 line; a second `docker compose run ...` makes it 2 lines.

- [ ] **Step 7: Generate locally without Docker**

Run: `PATH="$PWD/node_modules/.bin:$PATH" sh -c "$(node -p "require('./package.json').scripts['report:allure']")" && ls allure-report`
Expected: `index.html`, `summary.json`, `test-results.json` in the root of `allure-report/`, also when an old report was there before (proves `import { defineConfig } from 'allure'` resolves from the project; Allure creates `allure-history/` itself).

- [ ] **Step 8: Typecheck and commit**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: no output, exit code 0.

```bash
git add allurerc.mjs package.json .gitignore .dockerignore docker-compose.yml
git commit -m "build(allure): generate a single-file Allure report with history

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 2: `scripts/report-site.sh`, the site on `gh-pages`

**Files:**
- Create: `scripts/report-site.sh`, `scripts/report-site.test.mjs`

**Interfaces:**
- Produces, run inside a clone whose `origin` can be pushed to; `SITE_BRANCH` overrides `gh-pages`:
  - `sh scripts/report-site.sh fetch-history <file>`: writes `history.jsonl` of the root of the site to `<file>`; exit 0 and no file when the branch or the file does not exist.
  - `sh scripts/report-site.sh publish <report-dir> <target> [<history-file>]`: `<target>` is `.` (main) or `pr/<number>`; `.` replaces everything in the root except `.nojekyll` and `pr/`; `pr/<number>` replaces that folder only; `<history-file>` becomes `history.jsonl` in the root. Creates the orphan branch with `.nojekyll` the first time. Commits as `github-actions[bot]` and pushes; prints `Nothing to publish` when nothing changed.
  - `sh scripts/report-site.sh remove <target>`: deletes `<target>` and pushes; exit 0 when the site does not exist.

- [ ] **Step 1: Write the failing tests**

`scripts/report-site.test.mjs`:

```js
// Tests of report-site.sh against a bare repository that plays origin.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const script = new URL('./report-site.sh', import.meta.url).pathname;

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' });
}

/** A bare origin with one commit on main, and a clone of it to run the script in. */
function setUp() {
  const root = mkdtempSync(join(tmpdir(), 'report-site-'));
  const origin = join(root, 'origin.git');
  const clone = join(root, 'clone');
  git(root, 'init', '--quiet', '--bare', '--initial-branch=main', origin);
  git(root, 'clone', '--quiet', origin, clone);
  git(clone, '-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '--quiet', '--allow-empty', '-m', 'init');
  git(clone, 'push', '--quiet', 'origin', 'HEAD:main');
  return { root, origin, clone };
}

function site(clone, ...args) {
  return execFileSync('sh', [script, ...args], {
    cwd: clone,
    encoding: 'utf8',
    env: { ...process.env, GITHUB_SHA: '' },
  });
}

/** A report directory with one index.html. */
function report(root, name, html) {
  const dir = join(root, name);
  mkdirSync(dir);
  writeFileSync(join(dir, 'index.html'), html);
  return dir;
}

function siteFiles(origin) {
  return git(origin, 'ls-tree', '-r', '--name-only', 'gh-pages').trim().split('\n').sort();
}

function siteFile(origin, path) {
  return git(origin, 'show', `gh-pages:${path}`);
}

test('fetch-history writes nothing while the site does not exist', () => {
  const { root, clone } = setUp();
  site(clone, 'fetch-history', join(root, 'history', 'history.jsonl'));
  assert.equal(existsSync(join(root, 'history', 'history.jsonl')), false);
});

test('publishing main creates the site with the report and its history', () => {
  const { root, origin, clone } = setUp();
  writeFileSync(join(root, 'history.jsonl'), '{"run":1}\n');
  site(clone, 'publish', report(root, 'main-1', 'main 1'), '.', join(root, 'history.jsonl'));
  assert.deepEqual(siteFiles(origin), ['.nojekyll', 'history.jsonl', 'index.html']);
  assert.equal(siteFile(origin, 'index.html'), 'main 1');
  assert.equal(siteFile(origin, 'history.jsonl'), '{"run":1}\n');
});

test('a pull request goes to pr/<number> and keeps the report of main', () => {
  const { root, origin, clone } = setUp();
  site(clone, 'publish', report(root, 'main-1', 'main 1'), '.');
  site(clone, 'publish', report(root, 'pr-7', 'pr 7'), 'pr/7');
  assert.deepEqual(siteFiles(origin), ['.nojekyll', 'index.html', 'pr/7/index.html']);
  assert.equal(siteFile(origin, 'index.html'), 'main 1');
  assert.equal(siteFile(origin, 'pr/7/index.html'), 'pr 7');
});

test('a new report of main replaces the old one and keeps the pull requests', () => {
  const { root, origin, clone } = setUp();
  const old = report(root, 'main-1', 'main 1');
  writeFileSync(join(old, 'summary.json'), '{}');
  site(clone, 'publish', old, '.');
  site(clone, 'publish', report(root, 'pr-7', 'pr 7'), 'pr/7');
  site(clone, 'publish', report(root, 'main-2', 'main 2'), '.');
  assert.deepEqual(siteFiles(origin), ['.nojekyll', 'index.html', 'pr/7/index.html']);
  assert.equal(siteFile(origin, 'index.html'), 'main 2');
});

test('remove deletes the report of a pull request', () => {
  const { root, origin, clone } = setUp();
  site(clone, 'publish', report(root, 'main-1', 'main 1'), '.');
  site(clone, 'publish', report(root, 'pr-7', 'pr 7'), 'pr/7');
  site(clone, 'remove', 'pr/7');
  assert.deepEqual(siteFiles(origin), ['.nojekyll', 'index.html']);
});

test('remove does nothing while the site does not exist', () => {
  const { clone } = setUp();
  assert.match(site(clone, 'remove', 'pr/7'), /No site yet/);
});

test('publishing the same report again pushes nothing', () => {
  const { root, clone } = setUp();
  const dir = report(root, 'main-1', 'main 1');
  site(clone, 'publish', dir, '.');
  assert.match(site(clone, 'publish', dir, '.'), /Nothing to publish/);
});

test('fetch-history copies the history of main', () => {
  const { root, clone } = setUp();
  writeFileSync(join(root, 'history.jsonl'), '{"run":1}\n{"run":2}\n');
  site(clone, 'publish', report(root, 'main-1', 'main 1'), '.', join(root, 'history.jsonl'));
  const out = join(root, 'allure-history', 'history.jsonl');
  site(clone, 'fetch-history', out);
  assert.equal(readFileSync(out, 'utf8'), '{"run":1}\n{"run":2}\n');
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test "scripts/**/*.test.mjs"`
Expected: FAIL, 8 tests, `sh: .../scripts/report-site.sh: No such file or directory` (exit code 127).

- [ ] **Step 3: Write `scripts/report-site.sh`**

```sh
#!/bin/sh
# Keeps the Allure reports on the gh-pages branch, which GitHub Pages serves: the
# report of main in the root with its history (history.jsonl), the report of pull
# request N in pr/N/.
#
#   scripts/report-site.sh fetch-history <file>
#   scripts/report-site.sh publish <report-dir> <target> [<history-file>]
#   scripts/report-site.sh remove <target>
#
# <target> is . for main or pr/<number>. Run it inside a clone whose origin can be
# pushed to (fetch-history only reads). SITE_BRANCH overrides the branch name.
set -eu

branch="${SITE_BRANCH:-gh-pages}"

# Fetches the site branch into FETCH_HEAD; fails when origin has no such branch yet.
fetch_site() {
  git ls-remote --exit-code --heads origin "$branch" > /dev/null || return 1
  git fetch --quiet --depth 1 origin "$branch"
}

# Checks the site out into a new worktree and prints its path. The first time it
# starts the branch from scratch, with .nojekyll so that Pages serves files as is.
open_site() {
  site="$(mktemp -d)/site"
  if fetch_site; then
    git worktree add --quiet --detach "$site" FETCH_HEAD
  else
    git worktree add --quiet --orphan -b "$branch" "$site"
    touch "$site/.nojekyll"
  fi
  echo "$site"
}

commit_and_push() {
  site="$1"
  message="$2"
  git -C "$site" add -A
  if git -C "$site" diff --cached --quiet; then
    echo "Nothing to publish"
  else
    git -C "$site" -c user.name='github-actions[bot]' \
      -c user.email='41898282+github-actions[bot]@users.noreply.github.com' \
      commit --quiet -m "$message${GITHUB_SHA:+ for $GITHUB_SHA}"
    git -C "$site" push --quiet origin "HEAD:refs/heads/$branch"
    echo "Pushed $(git -C "$site" rev-parse --short HEAD) to $branch"
  fi
  git worktree remove --force "$site"
}

fetch_history() {
  file="$1"
  if fetch_site && git cat-file -e FETCH_HEAD:history.jsonl 2> /dev/null; then
    mkdir -p "$(dirname "$file")"
    git show FETCH_HEAD:history.jsonl > "$file"
    echo "Copied the history of main ($(wc -l < "$file" | tr -d ' ') runs) to $file"
  else
    echo "No history of main yet"
  fi
}

publish() {
  report="$1"
  target="$2"
  history="${3:-}"
  site=$(open_site)
  if [ "$target" = . ]; then
    # The report of main replaces everything but the reports of pull requests.
    find "$site" -mindepth 1 -maxdepth 1 ! -name .git ! -name .nojekyll ! -name pr -exec rm -rf {} +
  else
    rm -rf "${site:?}/$target"
  fi
  mkdir -p "$site/$target"
  cp -R "$report"/. "$site/$target"/
  if [ -n "$history" ]; then
    cp "$history" "$site/history.jsonl"
  fi
  commit_and_push "$site" "Publish the report of $target"
}

remove() {
  target="$1"
  if ! git ls-remote --exit-code --heads origin "$branch" > /dev/null; then
    echo "No site yet"
    return
  fi
  site=$(open_site)
  rm -rf "${site:?}/$target"
  commit_and_push "$site" "Remove the report of $target"
}

command="${1:-}"
[ $# -gt 0 ] && shift
case "$command" in
  fetch-history) fetch_history "$@" ;;
  publish) publish "$@" ;;
  remove) remove "$@" ;;
  *)
    echo "usage: $0 fetch-history <file> | publish <report-dir> <target> [<history-file>] | remove <target>" >&2
    exit 2
    ;;
esac
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test "scripts/**/*.test.mjs"`
Expected: `# pass 8`, `# fail 0`.

- [ ] **Step 5: Lint the script**

Run: `docker run --rm -v "$PWD:/mnt" -w /mnt koalaman/shellcheck:v0.11.0 scripts/report-site.sh`
Expected: no output, exit code 0.

- [ ] **Step 6: Commit**

```bash
git add scripts/report-site.sh scripts/report-site.test.mjs
git commit -m "ci: keep the Allure reports on the gh-pages branch

scripts/report-site.sh publishes the report of main to the root of the
site with its history and the report of a pull request to pr/<number>/,
removes the report of a closed pull request and copies the history of
main for the next run.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 3: link to the Allure report in the Telegram summary

**Files:**
- Modify: `scripts/notify-telegram.mjs` (header comment, new `links()`, the `text` array)
- Create: `scripts/notify-telegram.test.mjs`

**Interfaces:**
- Consumes (environment): `REPORT_URL` (set only when the report was published), `PUBLISH_OUTCOME` (`success`, `failure`, `skipped` or empty).
- Produces: last lines of the message: `<a href="REPORT_URL">Allure report</a> · <a href="RUN_URL">Run, reports and traces</a>`; or a warning line and the run link when `PUBLISH_OUTCOME=failure`; or the run link only.

- [ ] **Step 1: Write the failing tests**

`scripts/notify-telegram.test.mjs`:

```js
// Tests of the links at the end of the Telegram summary. Without Telegram
// credentials the script only prints the message.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const script = new URL('./notify-telegram.mjs', import.meta.url).pathname;
const runLink = '<a href="https://github.com/owner/repo/actions/runs/1">Run, reports and traces</a>';

function message(env) {
  return execFileSync('node', [script], {
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      GITHUB_SERVER_URL: 'https://github.com',
      GITHUB_REPOSITORY: 'owner/repo',
      GITHUB_RUN_ID: '1',
      GITHUB_EVENT_NAME: 'push',
      HEAD_REF: 'main',
      HEAD_SHA: 'abcdef1234567',
      // A skipped test step does not read test-results/results.json.
      TESTS_OUTCOME: 'skipped',
      ...env,
    },
  });
}

test('links the Allure report next to the run', () => {
  const out = message({ REPORT_URL: 'https://owner.github.io/repo/pr/7/', PUBLISH_OUTCOME: 'success' });
  assert.ok(out.includes(`<a href="https://owner.github.io/repo/pr/7/">Allure report</a> · ${runLink}`));
});

test('says when the report could not be published', () => {
  const out = message({ PUBLISH_OUTCOME: 'failure' });
  assert.ok(out.includes('⚠️ The Allure report was not published, it is in the artifact of the run'));
  assert.ok(out.includes(runLink));
  assert.ok(!out.includes('>Allure report</a>'));
});

test('links only the run when nothing was published', () => {
  const out = message({ PUBLISH_OUTCOME: 'skipped' });
  assert.ok(!out.includes('Allure report'));
  assert.ok(out.includes(runLink));
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test "scripts/**/*.test.mjs"`
Expected: the first two new tests FAIL (`The expression evaluated to a falsy value`), the third and the 8 tests of Task 2 pass.

- [ ] **Step 3: Add the links to `scripts/notify-telegram.mjs`**

In the header comment, after the line `//   PR_NUMBER, PR_TITLE, BASE_REF   on pull_request runs only` add:

```js
//   REPORT_URL      the Allure report on GitHub Pages, when it was published
//   PUBLISH_OUTCOME outcome of the publish step: success, failure or skipped
```

After the function `results(report)` add:

```js
function links() {
  const run = `<a href="${runUrl}">Run, reports and traces</a>`;
  if (env.REPORT_URL) {
    return [`<a href="${env.REPORT_URL}">Allure report</a> · ${run}`];
  }
  if (env.PUBLISH_OUTCOME === 'failure') {
    return ['⚠️ The Allure report was not published, it is in the artifact of the run', run];
  }
  return [run];
}
```

In the `text` array replace the last element

```js
  `<a href="${runUrl}">Run, reports and traces</a>`,
```

with

```js
  ...links(),
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test "scripts/**/*.test.mjs"`
Expected: `# pass 11`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add scripts/notify-telegram.mjs scripts/notify-telegram.test.mjs
git commit -m "ci: link the Allure report in the Telegram summary

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 4: workflow, generation in `tests`, publishing in `report`

**Files:**
- Modify: `.github/workflows/tests.yml` (whole file below)

**Interfaces:**
- Consumes: `report-site.sh` (Task 2), `notify-telegram.mjs` with `REPORT_URL` / `PUBLISH_OUTCOME` (Task 3), `pnpm report:allure` and the compose volumes (Task 1).
- Produces: job `tests` (check `API and UI tests`) with output `outcome`; job `report` (check `Allure report and summary`); artifact `reports` with `playwright-report/`, `allure-results/`, `allure-report/`, `allure-history/`, `test-results/results.json`.

- [ ] **Step 1: Replace `.github/workflows/tests.yml`**

```yaml
# Runs the API and UI tests against orders-sut on every pull request to main and on
# every push to main, publishes the Allure report to GitHub Pages and sends a summary
# to Telegram.
#
# Repository secrets:
#   SUT_REPO_TOKEN       fine-grained token with read access to the contents of orders-sut
#   TELEGRAM_BOT_TOKEN   bot that sends the summary
#   TELEGRAM_CHAT_ID     chat the summary goes to
name: Tests

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
  workflow_dispatch:

# A new commit in a pull request cancels the run of the previous one; runs on main all finish.
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

permissions:
  contents: read

jobs:
  # The name is the required status check of the ruleset on main.
  tests:
    name: API and UI tests
    runs-on: ubuntu-latest
    timeout-minutes: 20
    outputs:
      outcome: ${{ steps.tests.outcome }}
    steps:
      # Both repositories side by side, so docker-compose.yml finds orders-sut at its
      # default path ../orders-sut.
      - name: Check out sdet-showcase
        uses: actions/checkout@v7
        with:
          path: sdet-showcase

      - name: Check out orders-sut
        uses: actions/checkout@v7
        with:
          repository: ${{ github.repository_owner }}/orders-sut
          token: ${{ secrets.SUT_REPO_TOKEN }}
          path: orders-sut

      - name: Test the CI scripts
        working-directory: sdet-showcase
        run: node --test "scripts/**/*.test.mjs"

      # The image layers are cached in the GitHub Actions cache (docker-compose.ci.yml).
      # The BuildKit of the Docker daemon exports a cache only with the containerd image
      # store, and it reads the credentials of the cache from runtime variables that run
      # steps do not get.
      - name: Switch Docker to the containerd image store
        run: |
          config=/etc/docker/daemon.json
          current=$(sudo cat "$config" 2>/dev/null || echo '{}')
          echo "daemon.json before: $current"
          echo "$current" | jq '.features["containerd-snapshotter"] = true' | sudo tee "$config" > /dev/null
          sudo systemctl restart docker
          docker info --format 'Docker {{.ServerVersion}}, storage {{.Driver}} {{.DriverStatus}}'

      - name: Expose the Actions runtime to BuildKit
        uses: crazy-max/ghaction-github-runtime@v4

      - name: Run the tests against orders-sut
        id: tests
        working-directory: sdet-showcase
        env:
          COMPOSE_FILE: docker-compose.yml:docker-compose.ci.yml
        run: sh scripts/test-docker.sh test

      # With the history of main the report shows its trend and marks new failures.
      - name: Generate the Allure report
        if: ${{ !cancelled() && steps.tests.outcome != 'skipped' }}
        working-directory: sdet-showcase
        env:
          COMPOSE_FILE: docker-compose.yml:docker-compose.ci.yml
        run: |
          sh scripts/report-site.sh fetch-history allure-history/history.jsonl
          docker compose run --rm --no-deps tests pnpm report:allure

      - name: Upload the reports
        if: ${{ !cancelled() }}
        uses: actions/upload-artifact@v7
        with:
          name: reports
          path: |
            sdet-showcase/playwright-report
            sdet-showcase/allure-results
            sdet-showcase/allure-report
            sdet-showcase/allure-history
            sdet-showcase/test-results/results.json
          if-no-files-found: ignore
          retention-days: 14

  # The only job that can push, and no code of the pull request runs in it. Pull
  # requests from forks get neither secrets nor a token that can push; their report
  # stays in the artifact.
  report:
    name: Allure report and summary
    needs: tests
    if: ${{ !cancelled() && (github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository) }}
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      contents: write
      pages: read
    # One push to gh-pages at a time, shared with report-cleanup.yml.
    concurrency:
      group: gh-pages
      cancel-in-progress: false
    steps:
      - name: Check out sdet-showcase
        uses: actions/checkout@v7

      # Missing when the tests job failed before it produced anything.
      - name: Download the reports
        continue-on-error: true
        uses: actions/download-artifact@v8
        with:
          name: reports

      # main goes to the root of the site, a pull request to pr/<number>/, other runs
      # are not published.
      - name: Choose where the report goes
        id: target
        env:
          PR_NUMBER: ${{ github.event.pull_request.number }}
        run: |
          if [ -n "$PR_NUMBER" ]; then
            target="pr/$PR_NUMBER"
          elif [ "$GITHUB_REF" = refs/heads/main ]; then
            target=.
          else
            target=
          fi
          owner=$(echo "$GITHUB_REPOSITORY_OWNER" | tr '[:upper:]' '[:lower:]')
          site="https://$owner.github.io/${GITHUB_REPOSITORY#*/}/"
          echo "target=$target" >> "$GITHUB_OUTPUT"
          case "$target" in
            '') ;;
            .) echo "url=$site" >> "$GITHUB_OUTPUT" ;;
            *) echo "url=$site$target/" >> "$GITHUB_OUTPUT" ;;
          esac

      - name: Publish the report to GitHub Pages
        id: publish
        if: ${{ steps.target.outputs.target != '' && hashFiles('allure-report/index.html') != '' }}
        env:
          TARGET: ${{ steps.target.outputs.target }}
        run: |
          if [ "$TARGET" = . ]; then
            sh scripts/report-site.sh publish allure-report . allure-history/history.jsonl
          else
            sh scripts/report-site.sh publish allure-report "$TARGET"
          fi
          echo "commit=$(git ls-remote origin refs/heads/gh-pages | cut -f1)" >> "$GITHUB_OUTPUT"

      # Pages builds gh-pages after the push; until then the link opens the previous report.
      - name: Wait for GitHub Pages
        if: ${{ steps.publish.outcome == 'success' }}
        env:
          GH_TOKEN: ${{ github.token }}
          COMMIT: ${{ steps.publish.outputs.commit }}
        run: |
          for _ in $(seq 36); do
            if ! build=$(gh api "repos/$GITHUB_REPOSITORY/pages/builds/latest" --jq '"\(.status) \(.commit)"' 2> /dev/null); then
              echo "::warning::GitHub Pages is not enabled for this repository"
              exit 0
            fi
            case "$build" in
              "built $COMMIT") echo "GitHub Pages serves $COMMIT"; exit 0 ;;
              "errored $COMMIT") echo "::error::GitHub Pages failed to build $COMMIT"; exit 1 ;;
            esac
            sleep 5
          done
          echo "::warning::GitHub Pages has not built $COMMIT within 3 minutes"

      - name: Send the summary to Telegram
        if: ${{ !cancelled() }}
        env:
          TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          TELEGRAM_CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}
          TESTS_OUTCOME: ${{ needs.tests.outputs.outcome }}
          REPORT_URL: ${{ steps.publish.outcome == 'success' && steps.target.outputs.url || '' }}
          PUBLISH_OUTCOME: ${{ steps.publish.outcome }}
          HEAD_REF: ${{ github.head_ref || github.ref_name }}
          HEAD_SHA: ${{ github.event.pull_request.head.sha || github.sha }}
          PR_NUMBER: ${{ github.event.pull_request.number }}
          PR_TITLE: ${{ github.event.pull_request.title }}
          BASE_REF: ${{ github.base_ref }}
        run: node scripts/notify-telegram.mjs
```

- [ ] **Step 2: Lint**

Run: `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.12 -no-color .github/workflows/tests.yml`
Expected: no output, exit code 0.

- [ ] **Step 3: Rehearse the steps of the `tests` job in the CI layout**

Copy the working tree into the CI layout again, then:

Run: `sh scripts/report-site.sh fetch-history allure-history/history.jsonl; sh scripts/test-docker.sh test && docker compose run --rm --no-deps tests pnpm report:allure && ls allure-report/index.html`
Expected: `No history of main yet` (the copy is not a git clone, so `git ls-remote` takes `origin` for a path and prints `fatal: 'origin' does not appear to be a git repository` before it), `2 passed`, the file exists.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/tests.yml
git commit -m "ci: publish the Allure report to GitHub Pages

The tests job generates the report once, inside the tests image, with
the history of main read from gh-pages. A separate report job, the only
one that can push, publishes it to the root for main or to
pr/<number>/ for a pull request, waits for GitHub Pages and sends the
Telegram summary with a link to the report.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 5: remove the report of a closed pull request

**Files:**
- Create: `.github/workflows/report-cleanup.yml`

**Interfaces:**
- Consumes: `sh scripts/report-site.sh remove pr/<number>` (Task 2), concurrency group `gh-pages` (Task 4).

- [ ] **Step 1: Write the workflow**

```yaml
# Removes the Allure report of a pull request from GitHub Pages once the pull
# request is merged or closed (see the report job in tests.yml).
name: Report cleanup

on:
  pull_request:
    types: [closed]

permissions:
  contents: write

# One push to gh-pages at a time, shared with the report job in tests.yml.
concurrency:
  group: gh-pages
  cancel-in-progress: false

jobs:
  remove:
    name: Remove the report of the pull request
    if: ${{ github.event.pull_request.head.repo.full_name == github.repository }}
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      # The merge ref of a pull request closed without merging may be gone.
      - name: Check out sdet-showcase
        uses: actions/checkout@v7
        with:
          ref: ${{ github.event.repository.default_branch }}

      - name: Remove pr/<number> from gh-pages
        env:
          PR_NUMBER: ${{ github.event.pull_request.number }}
        run: sh scripts/report-site.sh remove "pr/$PR_NUMBER"
```

- [ ] **Step 2: Lint**

Run: `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.12 -no-color`
Expected: no output, exit code 0 (lints every workflow).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/report-cleanup.yml
git commit -m "ci: remove the report of a closed pull request from GitHub Pages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 6: README

**Files:**
- Modify: `README.md` (roadmap row, Getting started, Docker section, Continuous integration, project structure)

- [ ] **Step 1: Roadmap row**

Replace the cell `In progress: tests on every pull request and push to \`main\`, summary sent to Telegram` with `In progress: tests on every pull request and push to \`main\`, Allure report on GitHub Pages, summary sent to Telegram, merges to \`main\` only with green tests; sharding planned`.

- [ ] **Step 2: Getting started**

After the line `pnpm report       # open the HTML report of the last run` add:

```
pnpm report:allure        # Allure report of the last run in allure-report/
pnpm report:allure:open   # open it
```

- [ ] **Step 3: Docker section**

Replace the bullet that starts with `` - `playwright-report/`, `test-results/` and `allure-results/` are mounted from the host`` with:

```
- `playwright-report/`, `test-results/`, `allure-results/`, `allure-report/` and `allure-history/` are mounted from the host, so `pnpm report` and `pnpm report:allure` work after a run, on the host or with `docker compose run --rm --no-deps tests pnpm report:allure`.
```

- [ ] **Step 4: Continuous integration**

Replace the paragraph from `` `.github/workflows/tests.yml` runs both projects `` up to and including the numbered item 4 with:

```
`.github/workflows/tests.yml` runs both projects on every pull request to `main`, on every push to `main` and on demand (Run workflow in the Actions tab). The job `API and UI tests`:

1. Checks out this repository and orders-sut side by side, so `docker-compose.yml` finds the SUT at its default path.
2. Tests the CI scripts (`pnpm test:scripts`).
3. Runs `scripts/test-docker.sh test` against the reference build, the same command as `pnpm test:docker`.
4. Generates the Allure report inside the tests image (`pnpm report:allure`) with the history of `main`.
5. Uploads `playwright-report/`, `allure-results/`, `allure-report/`, `allure-history/` and `test-results/results.json` as the `reports` artifact of the run (kept 14 days).

The job `Allure report and summary` then publishes the Allure report to GitHub Pages and sends a summary to Telegram with `scripts/notify-telegram.mjs`: the result, the pull request or commit, passed, failed, flaky and skipped counts, up to ten failed tests, a link to the Allure report and a link to the run. It is the only job that can push, and no code of the pull request runs in it.
```

After the paragraph about the image layer cache add:

```
### Allure report

- `main`: https://jackblaaack.github.io/sdet-showcase/, with the history of `main`.
- A pull request: https://jackblaaack.github.io/sdet-showcase/pr/<number>/, the latest run of the pull request. Tests that fail there but passed on `main` are marked as new failures. The folder is removed when the pull request is closed (`.github/workflows/report-cleanup.yml`).

`scripts/report-site.sh` keeps the reports on the `gh-pages` branch, which GitHub Pages serves. A failed test shows the error, the steps, a screenshot (UI tests), the snapshot of the page and, on the first retry, the Playwright trace: download it and open it at https://trace.playwright.dev or with `npx playwright show-trace`. The HTML report of Playwright in the `reports` artifact has the trace viewer built in.

Allure 3 adds Google Analytics to the report (the Allure version and the id of the report, no test data); it has no option to turn it off.

`main` accepts changes only through pull requests whose `API and UI tests` check passed (a repository ruleset).
```

- [ ] **Step 5: Project structure**

After the line `  bug-reports/  defects found, with reproduction steps` add `  design/       design notes and implementation plans`.

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs: describe the Allure report on GitHub Pages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Phase B: public repository and GitHub Pages

### Task 7: secret scan and the visibility switch

- [ ] **Step 1: Scan the whole history**

Run: `docker run --rm -v "$PWD:/repo" zricethezav/gitleaks:v8.30.1 git /repo --redact --no-banner`
Expected: `no leaks found`, exit code 0. On findings: stop and show them to the user (values redacted).

- [ ] **Step 2: Check that no local environment file was ever committed**

Run: `git log --all --diff-filter=A --name-only --format= | grep -E '(^|/)\.env' || echo "no .env in history"`
Expected: `no .env in history`.

- [ ] **Step 3: Show the user what becomes public and ask**

List: the tracked `.claude/` files (`git ls-files .claude`), the gitleaks result, that orders-sut stays private, that fork pull requests will fail at the checkout of orders-sut. Ask for an explicit confirmation to switch; ask whether `.claude/` stays.

- [ ] **Step 4: Switch the visibility after the confirmation**

Run: `gh repo edit JackBlaaack/sdet-showcase --visibility public --accept-visibility-change-consequences && gh repo view JackBlaaack/sdet-showcase --json visibility --jq .visibility`
Expected: `PUBLIC`.

### Task 8: first publication and GitHub Pages

- [ ] **Step 1: Push the branch and open the pull request**

```bash
git push -u origin ci/allure-report
gh pr create --base main --head ci/allure-report --title "CI: Allure report on GitHub Pages" --body-file <scratchpad>/pr-body.md
```

The body summarizes the design and the verification of Task 10 and ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

- [ ] **Step 2: Watch the run**

Run: `gh run watch <run-id> --exit-status`
Expected: `API and UI tests` passes; `Allure report and summary` passes with the warning `GitHub Pages is not enabled for this repository`; `git ls-remote origin gh-pages` shows the new branch and `git ls-tree -r --name-only origin/gh-pages` (after `git fetch origin gh-pages`) lists `.nojekyll` and `pr/<number>/index.html`.

- [ ] **Step 3: Enable Pages from the root of `gh-pages`**

Run: `gh api -X POST repos/JackBlaaack/sdet-showcase/pages -f 'source[branch]=gh-pages' -f 'source[path]=/' --jq .html_url`
Expected: `https://jackblaaack.github.io/sdet-showcase/`.

- [ ] **Step 4: Re-run the report job and open the report**

Run: `gh run rerun <run-id> --job <id of the report job>`, then `curl -sf https://jackblaaack.github.io/sdet-showcase/pr/<number>/ | grep -c 'sdet-showcase'`
Expected: the job logs `GitHub Pages serves <commit>`; `curl` finds the report name (count ≥ 1); the Telegram summary has the `Allure report` link.

---

## Phase D: ruleset and end-to-end check

### Task 9: ruleset on `main`

- [ ] **Step 1: Create the ruleset**

```bash
gh api -X POST repos/JackBlaaack/sdet-showcase/rulesets --input - <<'EOF'
{
  "name": "main",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "bypass_actors": [],
  "rules": [
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [{ "context": "API and UI tests", "integration_id": 15368 }]
      }
    }
  ]
}
EOF
```

`15368` is the app id of GitHub Actions, so only a check from Actions satisfies the rule.

- [ ] **Step 2: Verify**

Run: `gh api repos/JackBlaaack/sdet-showcase/rules/branches/main --jq '.[].type'`
Expected: `pull_request` and `required_status_checks`.

### Task 10: end-to-end check on the pull request

- [ ] **Step 1: Push a deliberately failing UI test to the pull request**

`src/UI/tests/zz-ci-red-check.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('CI red check: a missing element fails with a screenshot', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('does-not-exist')).toBeVisible({ timeout: 2000 });
});
```

```bash
git add src/UI/tests/zz-ci-red-check.spec.ts
git commit -m "test: fail on purpose to check the red path of the report

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

- [ ] **Step 2: Check the red pull request**

Expected:
- `API and UI tests` fails, `Allure report and summary` passes;
- `https://jackblaaack.github.io/sdet-showcase/pr/<number>/` loads and contains `CI red check`;
- the Telegram summary says `❌ Tests failed`, lists the test and links the report;
- `gh pr view <number> --json mergeStateStatus --jq .mergeStateStatus` prints `BLOCKED`.

Open the report and confirm the screenshot, the `error-context` and the downloadable trace of the first retry.

- [ ] **Step 3: Revert the failing test**

```bash
git revert --no-edit HEAD
git push
```

Expected: both checks pass, `mergeStateStatus` is `CLEAN`.

- [ ] **Step 4: Merge after the user confirms**

Run: `gh pr merge <number> --merge --match-head-commit <full head sha>`
Expected after the run on `main`: the root of the site shows the report of `main`; `git show origin/gh-pages:history.jsonl | wc -l` prints 1; `pr/<number>/` is gone (the run of `report-cleanup.yml` passed).
