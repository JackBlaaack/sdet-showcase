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
