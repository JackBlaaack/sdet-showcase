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
