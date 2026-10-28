// The published pages: the report overview (support/overview-reporter.ts) and
// the GitHub Pages site (scripts/build-site.mjs). Each feature's drop-down test
// table must link every test to its entry on the procedures page, the overview's
// summary must count new and modified tests against the baseline release, and
// image previews must appear with the test that made them.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '../support/test';
import { E2E_ROOT } from '../support/env';
import { ABOUT, ADDED, MODIFIED, about } from '../support/features';
import { run } from '../support/run';

/** A real feature, so the nested run's tests land in its row. */
const FEATURE = 'vicar-io';
/** The release the nested run counts against (VICARIO_BASELINE_RELEASE). */
const BASELINE = { tag: 'v9.9.9', date: '2026-02-01' };
/** A 1 x 1 PNG, attached as an image preview by the passing sample. */
const PNG_1X1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==';
const TESTS = [
  { title: 'sample passes', result: 'Passed', added: '2026-01-01', modified: '2026-03-01', change: 'Modified',
    body: `const f = test.info().outputPath('dot.png'); writeFileSync(f, Buffer.from('${PNG_1X1}', 'base64'));
  await test.info().attach('dot.png preview', { path: f, contentType: 'image/png' });` },
  { title: 'sample fails', result: 'Failed', added: '2026-03-01', change: 'New', body: 'expect(1).toBe(2);' },
  { title: 'sample is skipped', result: 'Skipped', added: '2026-01-01', change: '', body: 'test.skip();' },
];

/**
 * Runs a nested Playwright run of three sample tests (passed, failed, skipped;
 * one modified and one added since the baseline release, one with an image
 * preview) through the overview reporter. Returns the report folder.
 */
async function sampleReport(testInfo: import('@playwright/test').TestInfo): Promise<string> {
  const dir = testInfo.outputPath('sample'); // under tests/e2e, so @playwright/test resolves
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'sample.spec.ts'), `import { writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
${TESTS.map((t) => `test(${JSON.stringify(t.title)}, { tag: ['@${FEATURE}', '@nominal'], annotation: ${JSON.stringify([
    { type: ABOUT, description: `Sample: ${t.title}.` }, { type: ADDED, description: t.added },
    ...(t.modified ? [{ type: MODIFIED, description: t.modified }] : [])])} }, async () => {
  ${t.body}
});`).join('\n')}
`);
  const report = path.join(dir, 'report');
  writeFileSync(path.join(dir, 'playwright.config.ts'), `export default {
  testDir: '.', testMatch: 'sample.spec.ts', outputDir: 'results', workers: 1,
  reporter: [[${JSON.stringify(path.join(E2E_ROOT, 'support', 'overview-reporter.ts'))}, { outputFolder: ${JSON.stringify(report)} }]],
};
`);
  const r = await run(['env', `VICARIO_BASELINE_RELEASE=${BASELINE.tag}@${BASELINE.date}`,
    'npx', 'playwright', 'test', '--config', path.join(dir, 'playwright.config.ts')], { cwd: E2E_ROOT });
  await testInfo.attach('nested-run.log', { body: `exit ${r.exitCode}\n${r.stdout}\n${r.stderr}`, contentType: 'text/plain' });
  expect(existsSync(path.join(report, 'index.html')), 'the reporter wrote the overview').toBe(true);
  return report;
}

/** The feature's drop-down rows on a page: link target, test title, result label and change label. */
function dropDownRows(html: string, prefix: string) {
  return [...html.matchAll(new RegExp(`<tr><td><a href="${prefix}procedures\\.html#([^"]+)">([^<]+)</a></td><td>.*?</td><td><span class="pill[^"]*">([^<]+)</span></td>(?:<td>(?:<span class="pill change">([^<]+)</span>)?</td>)?</tr>`, 'g'))]
    .map((m) => ({ anchor: decodeURIComponent(m[1]), title: m[2], result: m[3], change: m[4] ?? '' }));
}

/** The cells of the overview summary row whose first cell links to (or reads) `name`. */
function summaryRow(html: string, name: RegExp) {
  const table = html.match(/<table class="summary">[\s\S]*?<\/table>/)![0];
  const row = [...table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) => [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)]
    .map((c) => c[1].replace(/<[^>]+>/g, '').trim())).find((cells) => name.test(cells[0]));
  expect(row, `summary row ${name}`).toBeTruthy();
  return row!;
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
    `Runs a nested Playwright run of three sample tests (one passes, one fails, one is skipped) through the report's overview reporter. Passes when the feature's drop-down table on the overview lists all three with the right result, every link in it points at an existing test entry on the procedures page, the drop-down ends with a "Detailed procedures" link to the feature's section there, and the overview shows no image previews.`,
    '@suite', '@nominal', { added: '2026-10-28' },
  ), async ({}, testInfo) => {
    const report = await sampleReport(testInfo);
    expectLinkedRows(path.join(report, 'index.html'), path.join(report, 'procedures.html'), '');
    const html = readFileSync(path.join(report, 'index.html'), 'utf8');
    const dropDown = html.match(new RegExp(`<tr id="f-${FEATURE}">[\\s\\S]*?</details>`))?.[0] ?? '';
    expect(dropDown, 'the drop-down links to the detailed procedures').toContain(`<a href="procedures.html#${FEATURE}">Detailed procedures</a>`);
    expect(readFileSync(path.join(report, 'procedures.html'), 'utf8')).toContain(`<section id="${FEATURE}"`);
    expect(html, 'no images on the overview').not.toContain('<img');
    const summary = JSON.parse(readFileSync(path.join(report, 'summary.json'), 'utf8'));
    expect(summary.features.find((f: { id: string }) => f.id === FEATURE).tests).toHaveLength(TESTS.length);
  });

  test('the overview summary counts each feature\'s tests, and those new or modified since the last release', about(
    `Runs the three sample tests with the baseline release set to ${BASELINE.tag} (${BASELINE.date}): one was added before it and modified after, one added after it, one untouched since. Passes when the overview's summary row for the feature counts 3 tests, 1 passed, 1 failed, 1 skipped, 1 new and 1 modified, the total row agrees with summary.json, the note names the baseline release, and the drop-down marks each test New, Modified or nothing.`,
    '@suite', '@nominal', { added: '2026-10-28' },
  ), async ({}, testInfo) => {
    const report = await sampleReport(testInfo);
    const html = readFileSync(path.join(report, 'index.html'), 'utf8');
    const summary = JSON.parse(readFileSync(path.join(report, 'summary.json'), 'utf8'));
    const name = summary.features.find((f: { id: string }) => f.id === FEATURE).name;
    // Feature, Tests, Passed, Failed, Known issues, Skipped, New, Modified
    expect(summaryRow(html, new RegExp(`^${name}$`))).toEqual([name, '3', '1', '1', '0', '1', '1', '1']);
    const total = summaryRow(html, /^Total$/);
    expect(total.slice(2).map(Number)).toEqual([summary.passed, summary.failed, summary.known, summary.skipped, summary.added, summary.modified]);
    expect(html).toContain(`since release <a href="https://github.com/NASA-AMMOS/vicario/releases/tag/${BASELINE.tag}">${BASELINE.tag}</a> (published ${BASELINE.date})`);
    const rows = dropDownRows(html, '');
    for (const t of TESTS) expect(rows.find((r) => r.title === t.title)?.change, t.title).toBe(t.change);
  });

  test('the procedures page shows each test\'s history and image previews', about(
    `Runs the three sample tests; the passing one attaches an image preview. Passes when that test's entry on the procedures page shows its added and modified dates and the preview, copied into the report's images folder, and no other sample test shows an image.`,
    '@suite', '@nominal', { added: '2026-10-28' },
  ), async ({}, testInfo) => {
    const report = await sampleReport(testInfo);
    const html = readFileSync(path.join(report, 'procedures.html'), 'utf8');
    const entry = (title: string) => html.match(new RegExp(`<li id="[^"]+"[^>]*>\\s*<div class="head"><span class="ptitle">${title}</span>[\\s\\S]*?</li>`))?.[0] ?? '';
    const passes = entry('sample passes');
    expect(passes).toContain('Added 2026-01-01, modified 2026-03-01');
    const img = passes.match(/<img src="(images\/[0-9a-f]+\.png)" alt="dot.png"/);
    expect(img, 'the preview is shown with its test').toBeTruthy();
    expect(existsSync(path.join(report, img![1])), 'the preview is copied into the report').toBe(true);
    expect(entry('sample fails')).toContain('Added 2026-03-01<');
    for (const t of ['sample fails', 'sample is skipped']) expect(entry(t), t).not.toContain('<img');
  });

  test('the site lists each capability\'s tests, linked to their procedures', about(
    `Builds the GitHub Pages site from a sample report: a nested Playwright run of three sample tests (one passes, one fails, one is skipped). Passes when the capability's drop-down table lists the three sample tests with the right result, and every link in it points at an existing test entry on the published procedures page.`,
    '@suite', '@nominal', { added: '2026-10-28' },
  ), async ({}, testInfo) => {
    const report = await sampleReport(testInfo);
    const site = testInfo.outputPath('site');
    const r = await run(['node', path.join(E2E_ROOT, 'scripts', 'build-site.mjs'), '--report', report, '--out', site], { cwd: E2E_ROOT });
    expect(r.exitCode, r.stderr).toBe(0);
    expectLinkedRows(path.join(site, 'index.html'), path.join(site, 'tests', 'procedures.html'), 'tests/');
  });

  test('the site builds without test results', about(
    `Builds the GitHub Pages site from an empty report folder (no test run yet). Passes when the build succeeds, the page says there are no test results yet, and no capability has a drop-down test table.`,
    '@suite', '@off-nominal', { added: '2026-10-28' },
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
