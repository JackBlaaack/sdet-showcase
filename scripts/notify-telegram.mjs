// Sends a summary of a CI test run to Telegram.
//
// Reads the Playwright JSON report (test-results/results.json) and the outcome of the
// test step, prints the message and sends it with the bot TELEGRAM_BOT_TOKEN to the
// chat TELEGRAM_CHAT_ID. Without these two variables it only prints the message.
//
// The workflow sets:
//   TESTS_OUTCOME   outcome of the test step: success, failure, cancelled or skipped
//   HEAD_REF        branch that was tested
//   HEAD_SHA        commit that was tested
//   PR_NUMBER, PR_TITLE, BASE_REF   on pull_request runs only
//   REPORT_URL      the Allure report on GitHub Pages, when it was published
//   PUBLISH_OUTCOME outcome of the publish step: success, failure or skipped
// The rest (GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID) comes from GitHub Actions.
import { readFile } from 'node:fs/promises';

const reportPath = new URL('../test-results/results.json', import.meta.url);
const maxListedFailures = 10;

const env = process.env;
const repoUrl = `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}`;
const runUrl = `${repoUrl}/actions/runs/${env.GITHUB_RUN_ID}`;

async function readReport() {
  try {
    return JSON.parse(await readFile(reportPath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/** Flattens the suite tree of the JSON report into one entry per test and project. */
function collectTests(suites, titlePath = []) {
  return suites.flatMap((suite) => {
    const path = suite.title ? [...titlePath, suite.title] : titlePath;
    const own = (suite.specs ?? []).flatMap((spec) =>
      spec.tests.map((test) => ({
        title: `[${test.projectName}] ${[...path, spec.title].join(' › ')}`,
        status: test.status,
      })),
    );
    return [...own, ...collectTests(suite.suites ?? [], path)];
  });
}

function escapeHtml(text) {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function formatDuration(ms) {
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function headline(report) {
  if (env.TESTS_OUTCOME === 'success') {
    return '✅ <b>Tests passed</b>';
  }
  if (report) {
    return '❌ <b>Tests failed</b>';
  }
  return env.TESTS_OUTCOME === 'skipped'
    ? '⚠️ <b>Tests did not run</b> (an earlier step failed)'
    : '⚠️ <b>Test run broke before any results</b> (see the run log)';
}

function trigger() {
  const commit = `<code>${escapeHtml((env.HEAD_SHA ?? '').slice(0, 7))}</code>`;
  if (env.PR_NUMBER) {
    return [
      `<a href="${repoUrl}/pull/${env.PR_NUMBER}">PR #${env.PR_NUMBER}</a> ${escapeHtml(env.PR_TITLE ?? '')}`,
      `${escapeHtml(env.HEAD_REF ?? '')} → ${escapeHtml(env.BASE_REF ?? '')} · ${commit}`,
    ];
  }
  const event = env.GITHUB_EVENT_NAME === 'workflow_dispatch' ? 'Manual run on' : 'Push to';
  return [`${event} ${escapeHtml(env.HEAD_REF ?? '')} · ${commit}`];
}

function results(report) {
  if (!report) {
    return [];
  }
  const { expected, unexpected, flaky, skipped, duration } = report.stats;
  const lines = [
    '',
    `Passed ${expected} · Failed ${unexpected} · Flaky ${flaky} · Skipped ${skipped} · ${formatDuration(duration)}`,
  ];

  const failed = collectTests(report.suites).filter((test) => test.status === 'unexpected');
  if (failed.length > 0) {
    lines.push('', '<b>Failed:</b>');
    lines.push(...failed.slice(0, maxListedFailures).map((test) => `• ${escapeHtml(test.title)}`));
    if (failed.length > maxListedFailures) {
      lines.push(`…and ${failed.length - maxListedFailures} more`);
    }
  }
  if (report.errors?.length > 0) {
    lines.push('', `Errors outside tests: ${report.errors.length}`);
  }
  return lines;
}

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

// A skipped test step wrote nothing, so a results.json on disk would be left from an older run.
const report = env.TESTS_OUTCOME === 'skipped' ? null : await readReport();
const text = [
  headline(report),
  escapeHtml(env.GITHUB_REPOSITORY ?? ''),
  ...trigger(),
  ...results(report),
  '',
  ...links(),
].join('\n');

console.log(text);

const token = env.TELEGRAM_BOT_TOKEN;
const chatId = env.TELEGRAM_CHAT_ID;
if (!token || !chatId) {
  console.log('::warning::TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not set, the report was not sent');
  process.exit(0);
}

const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
  }),
});
if (!response.ok) {
  throw new Error(`Telegram sendMessage answered ${response.status}: ${await response.text()}`);
}
console.log('Sent the report to Telegram');
