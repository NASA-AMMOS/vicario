#!/usr/bin/env node
// Builds the GitHub Pages site: a project home page generated from
// features.yml, the pom version and the latest test summary, with the feature
// test report (report/) published under tests/.
//
//   node scripts/build-site.mjs [--report report] [--out site]
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(root, '..', '..');
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const reportDir = join(root, opt('--report', 'report'));
const outDir = join(root, opt('--out', 'site'));

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const features = parse(readFileSync(join(root, 'features.yml'), 'utf8')).features;
const version = readFileSync(join(repoRoot, 'pom.xml'), 'utf8').match(/<semver>([^<]+)<\/semver>/)?.[1] ?? '';
const summary = existsSync(join(reportDir, 'summary.json')) ? JSON.parse(readFileSync(join(reportDir, 'summary.json'), 'utf8')) : null;
const repoUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY
  ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}` : 'https://github.com/NASA-AMMOS/vicario';

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
if (existsSync(reportDir)) cpSync(reportDir, join(outDir, 'tests'), { recursive: true });

// a strip of real products from the latest run's galleries (synthetic test patterns excluded)
const heroImgs = [];
const overview = existsSync(join(reportDir, 'index.html')) ? readFileSync(join(reportDir, 'index.html'), 'utf8') : '';
for (const m of overview.matchAll(/<img src="(images\/[0-9a-f]+\.png)" alt="([^"]*)" data-public="true"/g)) {
  if (!heroImgs.some((h) => h.src === `tests/${m[1]}`)) {
    heroImgs.push({ src: `tests/${m[1]}`, alt: m[2] });
  }
}

const statusOf = (f) => f.status === 'active' ? ['tested', 'Tested every build']
  : f.status === 'planned' ? ['planned', `Planned (${f.milestone})`] : ['excluded', 'Not in public CI'];
const counts = new Map((summary?.features ?? []).map((f) => [f.id, f]));

const featureCards = features.map((f) => {
  const [cls, label] = statusOf(f);
  const c = counts.get(f.id);
  const result = c ? `<div class="res">${c.passed} passed${c.failed ? `, <b class="bad">${c.failed} failed</b>` : ''}${c.known ? `, ${c.known} known issue${c.known > 1 ? 's' : ''}` : ''}</div>` : '';
  const link = f.status === 'active' ? `tests/playwright/index.html#?q=${encodeURIComponent('@' + f.id)}` : '';
  return `<article class="card">
  <div class="card-head"><h3>${link ? `<a href="${link}">${esc(f.name)}</a>` : esc(f.name)}</h3><span class="chip ${cls}">${label}</span></div>
  <p>${esc(f.description.trim())}</p>${result}
</article>`;
}).join('\n');

const results = summary ? `
<section class="results ${summary.status === 'passed' ? 'ok' : 'bad'}">
  <div>
    <h2>Latest test run: ${summary.status === 'passed' ? 'passed' : 'failed'}</h2>
    <p class="muted">${esc(summary.tier)} tier · ${esc(summary.date)}${summary.commit ? ` · commit ${summary.commitUrl ? `<a href="${summary.commitUrl}">${esc(summary.commit)}</a>` : esc(summary.commit)}` : ''}${summary.runUrl ? ` · <a href="${summary.runUrl}">workflow run</a>` : ''}</p>
  </div>
  <div class="nums">
    <div><b>${summary.passed}</b><span>passed</span></div>
    <div><b class="${summary.failed ? 'bad' : ''}">${summary.failed}</b><span>failed</span></div>
    <div><b>${summary.known}</b><span>known issues</span></div>
  </div>
  <a class="button" href="tests/index.html">Open the test report</a>
</section>` : '';

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>VICARIO</title>
<meta name="description" content="VICARIO: Java image I/O and format translation for planetary science data (VICAR, PDS3, PDS4, FITS).">
<style>
:root { --bg:#ffffff; --fg:#1f2328; --muted:#59636e; --line:#d1d9e0; --card:#f6f8fa; --link:#0969da; --accent:#0b3d91;
  --pass:#1a7f37; --pass-bg:#dafbe1; --warn:#9a6700; --warn-bg:#fff8c5; --fail:#d1242f; --fail-bg:#ffebe9; --code:#eff2f5; }
@media (prefers-color-scheme: dark) { :root { --bg:#0d1117; --fg:#e6edf3; --muted:#9198a1; --line:#3d444d; --card:#151b23;
  --link:#4493f8; --accent:#7aa2ff; --pass:#3fb950; --pass-bg:#12261e; --warn:#d29922; --warn-bg:#272115; --fail:#f85149; --fail-bg:#2d1214; --code:#1f2630; } }
* { box-sizing:border-box; }
body { margin:0; background:var(--bg); color:var(--fg); font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif; }
a { color:var(--link); text-decoration:none; } a:hover { text-decoration:underline; }
header { border-bottom:1px solid var(--line); }
.wrap { max-width:1100px; margin:0 auto; padding:0 16px; }
nav { display:flex; align-items:center; justify-content:space-between; height:56px; }
nav .brand { font-weight:700; letter-spacing:.06em; color:var(--fg); }
nav .links a { margin-left:20px; font-size:14px; }
.hero { padding:48px 0 24px; }
.hero h1 { font-size:36px; line-height:1.2; margin:0 0 12px; }
.hero p { font-size:18px; color:var(--muted); max-width:760px; margin:0; }
.strip { display:flex; gap:8px; overflow-x:auto; padding:20px 0 4px; }
.strip img { height:120px; border-radius:6px; border:1px solid var(--line); background:#000; flex:none; }
h2 { font-size:22px; margin:40px 0 12px; }
.muted { color:var(--muted); font-size:14px; margin:4px 0 0; }
.results { display:flex; flex-wrap:wrap; align-items:center; gap:24px; justify-content:space-between; margin-top:32px;
  border:1px solid var(--line); border-left:6px solid var(--pass); border-radius:10px; padding:16px 20px; background:var(--card); }
.results.bad { border-left-color:var(--fail); } .results h2 { margin:0; font-size:20px; }
.nums { display:flex; gap:28px; } .nums div { text-align:center; } .nums b { display:block; font-size:26px; } .nums span { color:var(--muted); font-size:13px; }
.bad { color:var(--fail); }
.button { display:inline-block; background:var(--accent); color:#fff; padding:10px 16px; border-radius:8px; font-weight:600; }
.button:hover { text-decoration:none; opacity:.92; }
.grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:14px; }
.card { border:1px solid var(--line); border-radius:10px; padding:14px 16px; background:var(--card); }
.card-head { display:flex; justify-content:space-between; align-items:flex-start; gap:8px; }
.card h3 { font-size:16px; margin:0; } .card p { font-size:14px; color:var(--muted); margin:8px 0 0; }
.res { font-size:13px; margin-top:8px; }
.chip { font-size:11px; padding:2px 8px; border-radius:999px; white-space:nowrap; }
.chip.tested { color:var(--pass); background:var(--pass-bg); } .chip.planned { color:var(--warn); background:var(--warn-bg); }
.chip.excluded { color:var(--muted); background:var(--code); }
pre { background:var(--code); border-radius:8px; padding:12px 14px; overflow-x:auto; font-size:13px; }
.cols { display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:16px; }
footer { border-top:1px solid var(--line); margin-top:48px; padding:20px 0 40px; color:var(--muted); font-size:13px; }
@media (max-width:600px) { .hero h1 { font-size:28px; } nav .links a { margin-left:12px; } }
</style></head>
<body>
<header><div class="wrap"><nav><span class="brand">VICARIO</span>
<span class="links"><a href="tests/index.html">Test report</a><a href="${repoUrl}">GitHub</a><a href="https://central.sonatype.com/artifact/gov.nasa.jpl.ammos.ids/vicario">Maven Central</a></span></nav></div></header>
<main class="wrap">
<section class="hero">
  <h1>Image format translation for planetary science data</h1>
  <p>VICARIO is a Java library and command-line tool (jConvertIIO) that reads and writes VICAR, PDS3, PDS4 and FITS images and converts them to and from standard formats such as TIFF, PNG and JPEG, preserving the label metadata. It is part of NASA's AMMOS Instrument Data Subsystem.</p>
  ${heroImgs.length >= 3 ? `<div class="strip">${heroImgs.slice(0, 8).map((i) => `<img src="${i.src}" alt="${esc(i.alt)}" title="${esc(i.alt)}" loading="lazy">`).join('')}</div>
  <p class="muted">Public mission products (Mars 2020, MSL, MER, Cassini and others) decoded by the latest test run.</p>` : ''}
</section>
${results}
<h2>Capabilities</h2>
<p class="muted">Each capability is a feature in the test suite. Tested features run on every change; click one to see its tests, with commands, logs and image previews.</p>
<div class="grid">
${featureCards}
</div>
<h2>Get VICARIO</h2>
<div class="cols">
<div><p class="muted">Maven</p><pre>&lt;dependency&gt;
  &lt;groupId&gt;gov.nasa.jpl.ammos.ids&lt;/groupId&gt;
  &lt;artifactId&gt;vicario&lt;/artifactId&gt;
  &lt;version&gt;${esc(version)}&lt;/version&gt;
&lt;/dependency&gt;</pre></div>
<div><p class="muted">Gradle</p><pre>implementation("gov.nasa.jpl.ammos.ids:vicario:${esc(version)}")</pre>
<p class="muted">Command line</p><pre>java -jar vicario-${esc(version)}-FAT.jar inp=image.vic out=image.png format=png</pre></div>
</div>
</main>
<footer><div class="wrap">VICARIO is developed by the Multimission Image Processing Laboratory for NASA AMMOS.
Source, issues and testing guide on <a href="${repoUrl}">GitHub</a> (<a href="${repoUrl}/blob/main/docs/TESTING.md">docs/TESTING.md</a>).
This page and its test report are regenerated on every change to main and nightly.</div></footer>
</body></html>
`;
writeFileSync(join(outDir, 'index.html'), html);
writeFileSync(join(outDir, '.nojekyll'), '');
console.log(`site written to ${outDir}${summary ? '' : ' (no test summary found)'}`);
