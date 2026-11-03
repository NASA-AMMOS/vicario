#!/usr/bin/env node
// Prints the test report as one PDF: the overview (report/index.html) with
// every drop-down open, followed by the test procedures (report/procedures.html),
// in light colours with tables unclipped. Links between the two pages become
// links inside the PDF. Needs Chromium: `npx playwright install chromium`.
//
//   node scripts/report-pdf.mjs [--report report] [--out report/pdf/vicario-test-report.pdf]
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] ? args[i + 1] : fallback; };
const reportDir = path.resolve(opt('report', 'report'));
const out = path.resolve(opt('out', path.join(reportDir, 'pdf', 'vicario-test-report.pdf')));

for (const page of ['index.html', 'procedures.html']) {
  if (!existsSync(path.join(reportDir, page))) {
    console.error(`report-pdf: no ${page} in ${reportDir}; run the tests first`);
    process.exit(1);
  }
}
let summary = {};
try { summary = JSON.parse(readFileSync(path.join(reportDir, 'summary.json'), 'utf8')); } catch { /* footer without run details */ }
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Print-only layout: nothing scrolls or clips, rows don't split across pages. */
const PRINT_CSS = `
main { max-width:none !important; padding:0 !important; }
.scroll { overflow:visible !important; }
th, td { overflow-wrap:anywhere; }
details.tests td:first-child { width:auto !important; }
/* a feature's row holds its whole test table, so only the small rows stay whole */
tr, details { break-inside:auto; } details.tests tr, .procs li, .gallery a, .summary tr { break-inside:avoid; }
details > summary { list-style:none; } details > summary::-webkit-details-marker { display:none; }
button.scope, script { display:none !important; }
.pdf-procedures { break-before:page; }
.gallery img { max-height:120px; }
`;

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ colorScheme: 'light' });
  const procedures = await context.newPage();
  await procedures.goto(pathToFileURL(path.join(reportDir, 'procedures.html')).href);
  const extra = await procedures.evaluate(() => ({
    style: [...document.querySelectorAll('style')].map((s) => s.textContent).join('\n'),
    main: document.querySelector('main')?.innerHTML ?? document.body.innerHTML,
  }));

  const page = await context.newPage();
  await page.goto(pathToFileURL(path.join(reportDir, 'index.html')).href);
  await page.evaluate(({ extra, css }) => {
    // the procedures page's styles go first, so the overview's own rules win
    document.head.insertAdjacentHTML('afterbegin', `<style>${extra.style}</style>`);
    document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`);
    const main = document.querySelector('main') ?? document.body;
    main.insertAdjacentHTML('beforeend', `<div class="pdf-procedures">${extra.main}</div>`);
    for (const d of document.querySelectorAll('details')) d.open = true;
    for (const a of document.querySelectorAll('a[href^="procedures.html#"]')) a.setAttribute('href', a.getAttribute('href').slice('procedures.html'.length));
    for (const img of document.querySelectorAll('img[loading="lazy"]')) img.loading = 'eager';
    // a test's "Run details" open the Playwright report, which is not in the PDF; keep "Source"
    for (const links of document.querySelectorAll('p.links')) {
      links.querySelectorAll('a[href^="playwright/"]').forEach((a) => a.remove());
      links.innerHTML = links.innerHTML.trim().replace(/^·\s*/, '');
    }
  }, { extra, css: PRINT_CSS });
  await page.waitForLoadState('load');
  await page.evaluate(() => Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; })))));

  const footer = [summary.tier && `${summary.tier} tier`, summary.date, summary.commit && `commit ${summary.commit}`].filter(Boolean).map(esc).join(' · ');
  mkdirSync(path.dirname(out), { recursive: true });
  await page.pdf({
    path: out, format: 'Letter', landscape: true, scale: 0.75, printBackground: true, outline: true, tagged: true,
    margin: { top: '0.5in', bottom: '0.6in', left: '0.4in', right: '0.4in' },
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: `<div style="font-size:8px;width:100%;padding:0 0.4in;display:flex;justify-content:space-between;color:#59636e">
<span>VICARIO test report${footer ? ` · ${footer}` : ''}</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
  });
  console.log(`report-pdf: wrote ${path.relative(process.cwd(), out)}`);
} finally {
  await browser.close();
}
