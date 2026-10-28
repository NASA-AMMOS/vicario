// The published pages: the report overview (support/overview-reporter.ts) and
// the GitHub Pages site (scripts/build-site.mjs). Each feature's drop-down test
// table must link every test to its entry on the procedures page.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '../support/test';
import { E2E_ROOT } from '../support/env';
import { ABOUT, about } from '../support/features';
import { run } from '../support/run';

/** A real feature, so the nested run's tests land in its row. */
const FEATURE = 'vicar-io';
const TESTS = [
  { title: 'sample passes', body: '', result: 'Passed' },
  { title: 'sample fails', body: 'expect(1).toBe(2);', result: 'Failed' },
  { title: 'sample is skipped', body: 'test.skip();', result: 'Skipped' },
];

/**
 * Runs a nested Playwright run of three sample tests (passed, failed, skipped)
 * through the overview reporter. Returns the report folder.
 */
async function sampleReport(testInfo: import('@playwright/test').TestInfo): Promise<string> {
  const dir = testInfo.outputPath('sample'); // under tests/e2e, so @playwright/test resolves
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'sample.spec.ts'), `import { expect, test } from '@playwright/test';
${TESTS.map((t) => `test(${JSON.stringify(t.title)}, { tag: ['@${FEATURE}', '@nominal'],
  annotation: { type: ${JSON.stringify(ABOUT)}, description: ${JSON.stringify(`Sample: ${t.title}.`)} } }, () => { ${t.body} });`).join('\n')}
`);
  const report = path.join(dir, 'report');
  writeFileSync(path.join(dir, 'playwright.config.ts'), `export default {
  testDir: '.', testMatch: 'sample.spec.ts', outputDir: 'results', workers: 1,
  reporter: [[${JSON.stringify(path.join(E2E_ROOT, 'support', 'overview-reporter.ts'))}, { outputFolder: ${JSON.stringify(report)} }]],
};
`);
  const r = await run(['npx', 'playwright', 'test', '--config', path.join(dir, 'playwright.config.ts')], { cwd: E2E_ROOT });
  await testInfo.attach('nested-run.log', { body: `exit ${r.exitCode}\n${r.stdout}\n${r.stderr}`, contentType: 'text/plain' });
  expect(existsSync(path.join(report, 'index.html')), 'the reporter wrote the overview').toBe(true);
  return report;
}

/** The feature's drop-down rows on a page: [link target, test title, result label]. */
function dropDownRows(html: string, prefix: string) {
  return [...html.matchAll(new RegExp(`<tr><td><a href="${prefix}procedures\\.html#([^"]+)">([^<]+)</a></td><td>.*?</td><td><span class="pill[^"]*">([^<]+)</span>`, 'g'))]
    .map((m) => ({ anchor: decodeURIComponent(m[1]), title: m[2], result: m[3] }));
}

/** Checks the sample tests' rows link to anchors that exist on the procedures page. */
function expectLinkedRows(page: string, procedures: string, prefix: string) {
  const rows = dropDownRows(readFileSync(page, 'utf8'), prefix);
  const ids = new Set([...readFileSync(procedures, 'utf8').matchAll(/<li id="([^"]+)"/g)].map((m) => m[1]));
  for (const t of TESTS) {
    const row = rows.find((r) => r.title === t.title);
    expect(row, `${t.title} is in the drop-down`).toBeTruthy();
    expect(row!.result, t.title).toBe(t.result);
    expect(ids.has(row!.anchor), `${t.title} links to an entry on the procedures page`).toBe(true);
  }
  for (const r of rows) expect(ids.has(r.anchor), `${r.title}: link target exists`).toBe(true);
}

test.describe('Test report and site pages', { tag: ['@registry', '@fast'] }, () => {
  test('the report overview lists each feature\'s tests, linked to their procedures', about(
    `Runs a nested Playwright run of three sample tests (one passes, one fails, one is skipped) through the report's overview reporter. Passes when the feature's drop-down table on the overview lists all three with the right result, and every link in it points at an existing test entry on the procedures page.`,
    '@suite', '@nominal',
  ), async ({}, testInfo) => {
    const report = await sampleReport(testInfo);
    expectLinkedRows(path.join(report, 'index.html'), path.join(report, 'procedures.html'), '');
    const summary = JSON.parse(readFileSync(path.join(report, 'summary.json'), 'utf8'));
    expect(summary.features.find((f: { id: string }) => f.id === FEATURE).tests).toHaveLength(TESTS.length);
  });

  test('the site lists each capability\'s tests, linked to their procedures', about(
    `Builds the GitHub Pages site from a sample report: a nested Playwright run of three sample tests (one passes, one fails, one is skipped). Passes when the capability's drop-down table lists the three sample tests with the right result, and every link in it points at an existing test entry on the published procedures page.`,
    '@suite', '@nominal',
  ), async ({}, testInfo) => {
    const report = await sampleReport(testInfo);
    const site = testInfo.outputPath('site');
    const r = await run(['node', path.join(E2E_ROOT, 'scripts', 'build-site.mjs'), '--report', report, '--out', site], { cwd: E2E_ROOT });
    expect(r.exitCode, r.stderr).toBe(0);
    expectLinkedRows(path.join(site, 'index.html'), path.join(site, 'tests', 'procedures.html'), 'tests/');
  });

  test('the site builds without test results', about(
    `Builds the GitHub Pages site from an empty report folder (no test run yet). Passes when the build succeeds, the page says there are no test results yet, and no capability has a drop-down test table.`,
    '@suite', '@off-nominal',
  ), async ({}, testInfo) => {
    const empty = testInfo.outputPath('no-report');
    mkdirSync(empty, { recursive: true });
    const site = testInfo.outputPath('site');
    const r = await run(['node', path.join(E2E_ROOT, 'scripts', 'build-site.mjs'), '--report', empty, '--out', site], { cwd: E2E_ROOT });
    expect(r.exitCode, r.stderr).toBe(0);
    const html = readFileSync(path.join(site, 'index.html'), 'utf8');
    expect(html).toContain('No test results yet.');
    expect(html).not.toContain('<details class="tests">');
  });
});
