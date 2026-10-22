// Playwright reporter that writes the report's landing page (report/index.html):
// every feature from features.yml with its description, status and results,
// linking into the Playwright HTML report (report/playwright/) filtered to that
// feature. It also writes report/overview.md for the GitHub job summary.
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { FullConfig, FullResult, Reporter, Suite, TestCase } from '@playwright/test/reporter';
import { E2E_ROOT } from './env';
import { features, tagOf, type Feature } from './features';

interface Row {
  feature?: Feature;
  key: string;
  name: string;
  description: string;
  passed: number;
  failed: number;
  known: number;
  skipped: number;
  images: Picture[];
}
interface Picture { src: string; caption: string; testId: string; synthetic: boolean; hash: string }
interface Item { title: string; testId: string; feature: string; issue: string; why: string; error?: string }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const PW = 'playwright/index.html';

export default class OverviewReporter implements Reporter {
  private suite!: Suite;
  private project = '';
  private start = new Date();
  private outDir: string;

  constructor(options: { outputFolder?: string } = {}) {
    this.outDir = path.resolve(E2E_ROOT, options.outputFolder ?? 'report');
  }

  onBegin(config: FullConfig, suite: Suite) {
    this.suite = suite;
    this.project = suite.suites.map((s) => s.title).filter(Boolean).join(', ');
    this.start = new Date();
  }

  async onEnd(result: FullResult) {
    const reg = features();
    const rows = new Map<string, Row>();
    for (const f of reg.filter((x) => x.status === 'active')) {
      rows.set(f.id, { feature: f, key: f.id, name: f.name, description: f.description.trim(), passed: 0, failed: 0, known: 0, skipped: 0, images: [] });
    }
    const infra = (key: string, name: string, description: string) =>
      rows.get(key) ?? rows.set(key, { key, name, description, passed: 0, failed: 0, known: 0, skipped: 0, images: [] }).get(key)!;
    const failures: Item[] = [];
    const known: Item[] = [];

    for (const t of this.suite.allTests()) {
      const row = this.rowFor(t, reg, rows, infra);
      const last = t.results.at(-1);
      const outcome = t.outcome();
      const issueNote = [...t.annotations, ...(last?.annotations ?? [])].find((a) => a.type === 'issue')?.description ?? '';
      const [issue, ...why] = issueNote.split(': ');
      const item = { title: t.titlePath().slice(3).join(' › '), testId: t.id, feature: row.name, issue: issue || '', why: why.join(': ') };
      if (outcome === 'skipped') row.skipped++;
      else if (outcome === 'unexpected' || outcome === 'flaky') {
        row.failed++;
        failures.push({ ...item, error: (last?.error?.message ?? '').replace(/\u001b\[[0-9;]*m/g, '').split('\n')[0] });
      } else if (last && (last.status === 'failed' || last.status === 'timedOut')) {
        row.known++;
        known.push(item);
      } else row.passed++;
      for (const a of last?.attachments ?? []) {
        const m = a.name.match(/^(.*) preview( \[mission data\])?$/);
        if (a.contentType !== 'image/png' || !a.path || !m || !existsSync(a.path)) continue;
        row.images.push({ src: a.path, caption: m[1], testId: t.id, synthetic: !m[2],
          hash: createHash('sha256').update(readFileSync(a.path)).digest('hex').slice(0, 16) });
      }
    }
    this.pickGallery([...rows.values()]);

    const all = [...rows.values()];
    const totals = all.reduce((a, r) => ({ passed: a.passed + r.passed, failed: a.failed + r.failed, known: a.known + r.known }),
      { passed: 0, failed: 0, known: 0 });
    const notAutomated = reg.filter((f) => f.status !== 'active');
    const info = this.runInfo(result);

    mkdirSync(this.outDir, { recursive: true });
    writeFileSync(path.join(this.outDir, 'summary.json'), JSON.stringify({
      status: result.status, ...totals, ...info,
      features: all.map((r) => ({ id: r.key, name: r.name, passed: r.passed, failed: r.failed, known: r.known })),
    }, null, 2));
    writeFileSync(path.join(this.outDir, 'index.html'), this.html(all, totals, failures, known, notAutomated, info, result));
    writeFileSync(path.join(this.outDir, 'overview.md'), this.markdown(all, totals, failures, known, notAutomated, info, result));
  }

  /**
   * Up to six distinct previews per feature, real mission products first, copied
   * to report/images so the landing page does not depend on the Playwright data folder.
   */
  private pickGallery(rows: Row[]) {
    const dir = path.join(this.outDir, 'images');
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    for (const r of rows) {
      const seen = new Set<string>();
      const ordered = [...r.images.filter((i) => !i.synthetic), ...r.images.filter((i) => i.synthetic)];
      r.images = ordered.filter((i) => !seen.has(i.hash) && seen.add(i.hash)).slice(0, 6).map((i) => {
        const name = `${i.hash}.png`;
        copyFileSync(i.src, path.join(dir, name));
        return { ...i, src: `images/${name}` };
      });
    }
  }

  private rowFor(t: TestCase, reg: Feature[], rows: Map<string, Row>,
    infra: (k: string, n: string, d: string) => Row): Row {
    const f = reg.find((x) => t.tags.includes(tagOf(x)));
    if (f && rows.has(f.id)) return rows.get(f.id)!;
    if (t.tags.includes('@registry')) {
      return infra('registry', 'Test suite integrity', 'Feature registry, specs and test-data manifest are consistent.');
    }
    return infra('junit', 'Unit tests not assigned to a feature', 'JUnit classes missing from a feature\'s junit: list in features.yml.');
  }

  private runInfo(result: FullResult) {
    let commit = process.env.GITHUB_SHA ?? '';
    if (!commit) {
      try { commit = execSync('git rev-parse HEAD', { cwd: E2E_ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { /* not a checkout */ }
    }
    const server = process.env.GITHUB_SERVER_URL;
    const repo = process.env.GITHUB_REPOSITORY;
    const runId = process.env.GITHUB_RUN_ID;
    return {
      tier: this.project || 'all',
      date: this.start.toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
      duration: `${Math.round(result.duration / 1000)} s`,
      commit: commit.slice(0, 7),
      commitUrl: server && repo && commit ? `${server}/${repo}/commit/${commit}` : '',
      runUrl: server && repo && runId ? `${server}/${repo}/actions/runs/${runId}` : '',
    };
  }

  private html(rows: Row[], totals: { passed: number; failed: number; known: number }, failures: Item[], known: Item[],
    notAutomated: Feature[], info: ReturnType<OverviewReporter['runInfo']>, result: FullResult): string {
    const ok = result.status === 'passed';
    const testLink = (i: Item) => `<a href="${PW}#?testId=${encodeURIComponent(i.testId)}">${esc(i.title)}</a>`;
    const featureRows = rows.map((r) => {
      const state = r.failed ? 'fail' : r.known ? 'warn' : 'pass';
      const label = r.failed ? 'Failing' : r.known ? 'Passing, with known issues' : 'Passing';
      const link = r.feature ? `${PW}#?q=${encodeURIComponent(tagOf(r.feature))}` : `${PW}#?q=${encodeURIComponent('@' + r.key)}`;
      const gallery = r.images.length ? `<div class="gallery">${r.images.map((i) =>
        `<a href="${PW}#?testId=${encodeURIComponent(i.testId)}" title="${esc(i.caption)}"><img src="${i.src}" alt="${esc(i.caption)}" data-public="${!i.synthetic}" loading="lazy"><span>${esc(i.caption)}</span></a>`).join('')}</div>` : '';
      return `<tr>
  <td><a class="fname" href="${link}">${esc(r.name)}</a><div class="desc">${esc(r.description)}</div>${gallery}</td>
  <td><span class="pill ${state}">${label}</span></td>
  <td class="num">${r.passed}</td><td class="num ${r.failed ? 'bad' : ''}">${r.failed}</td><td class="num">${r.known}</td>
</tr>`;
    }).join('\n');

    const byIssue = new Map<string, Item[]>();
    for (const k of known) byIssue.set(k.issue, [...(byIssue.get(k.issue) ?? []), k]);
    const knownHtml = [...byIssue].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })).map(([issue, items]) => `
<details><summary><span class="issue">${esc(issue || 'untracked')}</span> ${esc(items[0].why)} <span class="count">${items.length} test${items.length > 1 ? 's' : ''}</span></summary>
<ul>${items.map((i) => `<li>${esc(i.feature)}: ${testLink(i)}</li>`).join('')}</ul></details>`).join('\n');

    const failHtml = failures.length ? `<section><h2>Failures</h2><ul class="fails">${failures.map((f) =>
      `<li><strong>${esc(f.feature)}</strong>: ${testLink(f)}<div class="err">${esc(f.error ?? '')}</div></li>`).join('')}</ul></section>` : '';

    const notAutoHtml = notAutomated.length ? `<section><h2>Not yet automated</h2><table>
<thead><tr><th>Feature</th><th>Status</th></tr></thead><tbody>
${notAutomated.map((f) => `<tr><td><span class="fname">${esc(f.name)}</span><div class="desc">${esc(f.description.trim())}</div></td>
<td>${f.status === 'planned' ? `Planned (${esc(f.milestone ?? '')})` : `Excluded: ${esc((f.reason ?? '').trim())}`}</td></tr>`).join('\n')}
</tbody></table></section>` : '';

    const meta = [
      `Tier: <strong>${esc(info.tier)}</strong>`, esc(info.date), `Duration ${esc(info.duration)}`,
      info.commit ? (info.commitUrl ? `Commit <a href="${info.commitUrl}">${info.commit}</a>` : `Commit ${info.commit}`) : '',
      info.runUrl ? `<a href="${info.runUrl}">Workflow run</a>` : '',
    ].filter(Boolean).join(' · ');

    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>VICARIO Feature Tests</title>
<style>
:root { --bg:#ffffff; --fg:#1f2328; --muted:#59636e; --line:#d1d9e0; --card:#f6f8fa; --link:#0969da;
  --pass:#1a7f37; --pass-bg:#dafbe1; --warn:#9a6700; --warn-bg:#fff8c5; --fail:#d1242f; --fail-bg:#ffebe9; }
@media (prefers-color-scheme: dark) { :root { --bg:#0d1117; --fg:#e6edf3; --muted:#9198a1; --line:#3d444d; --card:#151b23;
  --link:#4493f8; --pass:#3fb950; --pass-bg:#12261e; --warn:#d29922; --warn-bg:#272115; --fail:#f85149; --fail-bg:#2d1214; } }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--fg); font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif; }
main { max-width:1100px; margin:0 auto; padding:24px 16px 48px; }
h1 { font-size:24px; margin:0 0 4px; } h2 { font-size:18px; margin:32px 0 12px; }
a { color:var(--link); text-decoration:none; } a:hover { text-decoration:underline; }
.meta { color:var(--muted); font-size:13px; }
.banner { display:flex; flex-wrap:wrap; gap:12px; margin:20px 0 8px; }
.stat { background:var(--card); border:1px solid var(--line); border-radius:8px; padding:12px 16px; min-width:150px; }
.stat b { display:block; font-size:24px; } .stat span { color:var(--muted); font-size:13px; }
.stat.ok b { color:var(--pass); } .stat.bad b { color:var(--fail); } .stat.warn b { color:var(--warn); }
.scroll { overflow-x:auto; }
table { width:100%; border-collapse:collapse; } th, td { text-align:left; padding:10px 8px; border-bottom:1px solid var(--line); vertical-align:top; }
th { font-size:12px; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); }
.num { text-align:right; font-variant-numeric:tabular-nums; width:72px; } .num.bad { color:var(--fail); font-weight:600; }
.fname { font-weight:600; } .desc { color:var(--muted); font-size:13px; margin-top:2px; }
.pill { display:inline-block; font-size:12px; padding:2px 10px; border-radius:999px; white-space:nowrap; }
.pill.pass { color:var(--pass); background:var(--pass-bg); } .pill.warn { color:var(--warn); background:var(--warn-bg); }
.pill.fail { color:var(--fail); background:var(--fail-bg); }
details { border:1px solid var(--line); border-radius:8px; padding:8px 12px; margin:8px 0; background:var(--card); }
summary { cursor:pointer; } .issue { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:13px; font-weight:600; margin-right:6px; }
.count { color:var(--muted); font-size:12px; margin-left:6px; } details ul { margin:8px 0 0; padding-left:20px; }
.fails { padding-left:20px; } .err { color:var(--fail); font-family:ui-monospace,Menlo,monospace; font-size:12px; overflow-wrap:anywhere; }
.gallery { display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }
.gallery a { display:flex; flex-direction:column; width:112px; color:var(--muted); font-size:11px; }
.gallery img { width:112px; height:84px; object-fit:contain; background:#000; border:1px solid var(--line); border-radius:6px; image-rendering:auto; }
.gallery span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:2px; }
.howto { color:var(--muted); font-size:13px; margin-top:32px; border-top:1px solid var(--line); padding-top:12px; }
</style></head>
<body><main>
<h1>VICARIO feature tests</h1>
<div class="meta">${meta}</div>
<div class="banner">
  <div class="stat ${ok ? 'ok' : 'bad'}"><b>${ok ? 'Passed' : 'Failed'}</b><span>overall result</span></div>
  <div class="stat ok"><b>${totals.passed}</b><span>tests passed</span></div>
  <div class="stat ${totals.failed ? 'bad' : 'ok'}"><b>${totals.failed}</b><span>unexpected failures</span></div>
  <div class="stat warn"><b>${totals.known}</b><span>known issues (expected to fail)</span></div>
</div>
${failHtml}
<section><h2>Features</h2><div class="scroll"><table>
<thead><tr><th>Feature</th><th>Status</th><th class="num">Passed</th><th class="num">Failed</th><th class="num">Known issues</th></tr></thead>
<tbody>
${featureRows}
</tbody></table></div></section>
${known.length ? `<section><h2>Known issues</h2><p class="meta">Bugs reproduced by the tests and tracked by issue. Each test is marked "expected to fail" and turns red once the bug is fixed, so the marker is removed with the fix.</p>${knownHtml}</section>` : ''}
${notAutoHtml}
<p class="howto">Click a feature to see its tests in the <a href="${PW}">full Playwright report</a>, with commands, logs and image previews for every conversion.</p>
</main></body></html>
`;
  }

  private markdown(rows: Row[], totals: { passed: number; failed: number; known: number }, failures: Item[], known: Item[],
    notAutomated: Feature[], info: ReturnType<OverviewReporter['runInfo']>, result: FullResult): string {
    const out = [`### VICARIO feature tests: ${result.status === 'passed' ? 'passed' : '**failed**'}`, '',
      `${totals.passed} passed, ${totals.failed} failed, ${totals.known} known issues (${info.tier} tier, ${info.duration})`, '',
      '| Feature | Passed | Failed | Known issues |', '|---|---:|---:|---:|',
      ...rows.map((r) => `| ${r.name} | ${r.passed} | ${r.failed ? `**${r.failed}**` : 0} | ${r.known} |`)];
    if (failures.length) out.push('', '**Failures**', '', ...failures.map((f) => `- ${f.feature}: ${f.title}: ${f.error ?? ''}`));
    if (known.length) {
      const issues = [...new Set(known.map((k) => `${k.issue}: ${k.why}`))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      out.push('', `<details><summary>Known issues (${issues.length})</summary>`, '', ...issues.map((i) => `- ${i}`), '', '</details>');
    }
    if (notAutomated.length) {
      out.push('', `Not yet automated: ${notAutomated.map((f) => `${f.name} (${f.status === 'planned' ? f.milestone : 'excluded'})`).join(', ')}.`);
    }
    out.push('', 'Full report: download the `feature-report` artifact (kept 5 days) and open `index.html`.');
    return out.join('\n') + '\n';
  }
}
