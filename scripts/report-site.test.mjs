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
