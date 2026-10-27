#!/usr/bin/env node
// Builds the GitHub Pages site: a VICARIO introduction and help page (drawn
// from the README and jConvertIIO's HELP text) ending in a capabilities table
// from features.yml and the latest test summary, with the feature test report
// (report/) published under tests/.
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
const jar = `vicario-${version}-FAT.jar`;

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

// --- help content (from jConvertIIO HELP and the README; every recipe was run against the FAT jar) ---

const recipes = [
  ['VICAR to PNG', 'inp=image.vic out=image.png format=png'],
  ['Floating-point image to an 8-bit PNG (stretched to 0..255)', 'inp=real.vic out=real.png format=png OFORM=BYTE'],
  ['VICAR to PDS3 with an attached label', 'inp=image.vic out=image.img format=pds'],
  ['PDS3 or PDS4 product to VICAR', 'inp=product.xml out=image.vic format=vicar'],
  ['Cut out a region (x, y, width, height)', 'inp=image.vic out=region.vic format=vicar SOURCE_REGION=(10,10,200,100)'],
  ['Quarter-size preview (every 4th sample and line)', 'inp=image.vic out=thumb.png format=png SUBSAMPLING=(4,4,0,0)'],
  ['Batch: one conversion per line of jobs.txt, 4 at a time', 'ARGFILE=jobs.txt PARALLEL_BATCH=4'],
];

const keywordGroups = [
  ['Input and output', [
    ['INP', 'Input file or http(s) URL.'],
    ['OUT', 'Output file.'],
    ['FORMAT', 'Output format: vicar, pds, tif, png, jpg, jpeg2000, raw, ... (case-insensitive aliases).'],
    ['ARGFILE', 'Read one set of arguments per line from a file (batch run).'],
    ['PARALLEL_BATCH', 'Run batch lines in parallel, N at a time, or AVAILABLE_CORES.'],
    ['IMAGE_INDEX', 'Image to read from a multi-image file (default 0).'],
    ['SILENT', 'No printing to stdout.'],
  ]],
  ['Data type', [
    ['OFORM', 'Output data type: BYTE, HALF, SHORT, USHORT, FULL, INT, REAL, FLOAT, DOUB, DOUBLE. Default: keep the input type.'],
    ['RESCALE', 'Rescale values into the new type (default true when OFORM changes the type).'],
    ['RESCALE_CONSTANT, RESCALE_OFFSET', 'Explicit scale and offset for the conversion.'],
    ['VALID_MINIMUM, VALID_MAXIMUM', 'Use this range instead of the data range when rescaling.'],
    ['CLAMP', '(min,max): clamp values after reading.'],
  ]],
  ['Regions and bands', [
    ['SOURCE_REGION', '(x,y,width,height): read only this region.'],
    ['SUBSAMPLING', '(xStep,yStep,xOffset,yOffset): read every Nth sample and line.'],
    ['READ_BANDS', 'Bands to read, from 0: READ_BANDS=0,1,2.'],
    ['BANDS', 'Build a new image from these bands after reading.'],
    ['SCALE', '(xFactor,yFactor,xShift,yShift): resample after reading.'],
    ['2RGB', 'Expand a single-band image to RGB.'],
  ]],
  ['PDS labels', [
    ['XSL', 'Stylesheet that maps the input label to the PDS label. XSL=- uses the default in the jar.'],
    ['PDS_LABEL_TYPE', 'PDS3 (default), ODL3, MSL_ODL or PDS4.'],
    ['PDS_STATS', 'addStatistics or calcStatistics: add image statistics to the label.'],
    ['EMBED_VICAR_LABEL', 'Embed the VICAR label in the PDS label.'],
    ['PDS_DETACHED_LABEL, PDS_DETACHED_ONLY', 'Write a detached label, optionally without rewriting the image.'],
    ['PDS_OBJECT', 'Which OBJECT of a PDS3 input label to read (e.g. RFL_IMAGE).'],
    ['ADD_BINARY_HEADER, ADD_BLOB', 'Carry the VICAR binary header into the output.'],
    ['VELO_TEMPLATE, VELO_CONFIG, PDS4_NAMESPACE_FILE', 'Velocity template and setup for a PDS4 detached label.'],
  ]],
  ['Help and debugging', [
    ['HELP', 'Print the full keyword list.'],
    ['PLUGINS', 'List the registered ImageIO readers and writers.'],
    ['XML', 'Write the label as XML files (debugging).'],
    ['DEBUG', 'Extra debug printing.'],
  ]],
];

const formats = [
  ['VICAR', 'yes', 'yes', 'All data types and organizations (BSQ, BIL, BIP), binary headers and line prefixes.'],
  ['PDS3', 'yes', 'yes', 'Attached or detached labels; PDS3, ODL3 or MSL ODL labels written through XSL transcoders.'],
  ['PDS4 images', 'yes', 'label', 'Reads PDS4 array products; PDS4 labels are generated from Velocity templates.'],
  ['PDS4 tables', 'yes', 'text', 'Exported to CSV or fixed-width text with <code>ExtractTableJPL</code>.'],
  ['ISIS cubes', 'yes', '', 'ISIS2 / ISIS3 cube reader.'],
  ['FITS', 'yes', '', 'Primary image HDU.'],
  ['Magellan', 'yes', '', 'F-BIDR and resampled products.'],
  ['TIFF, PNG, JPEG, JPEG 2000', 'yes', 'yes', 'Through the Java ImageIO and JAI Image I/O plugins.'],
  ['Raw', '', 'yes', 'Headerless pixel data.'],
];

// --- capabilities and test results ---

const counts = new Map((summary?.features ?? []).map((f) => [f.id, f]));
const RESULT = { passed: ['pass', 'Passed'], failed: ['fail', 'Failed'], known: ['warn', 'Known issue'], skipped: ['', 'Skipped'] };
// a collapsed summary table of a feature's tests, each linking to its procedure
const testTable = (tests) => `<details class="tests"><summary>${tests.length} test${tests.length === 1 ? '' : 's'}</summary><div class="scroll"><table>
<thead><tr><th>Test</th><th>Scope</th><th>Result</th></tr></thead><tbody>
${tests.map((t) => {
    const [cls, label] = RESULT[t.result] ?? ['', t.result];
    return `<tr><td><a href="tests/procedures.html#${encodeURIComponent(t.anchor)}">${esc(t.title)}</a></td>`
      + `<td>${t.scopes.map((sc) => `<span class="scope">${esc(sc.slice(1))}</span>`).join(' ')}</td><td><span class="pill ${cls}">${label}</span></td></tr>`;
  }).join('\n')}
</tbody></table></div></details>`;
const capabilityRows = features.filter((f) => f.status === 'active').map((f) => {
  const c = counts.get(f.id);
  const total = c ? c.passed + c.failed + c.known : null;
  const link = `tests/procedures.html#${encodeURIComponent(f.id)}`;
  const scopes = Object.entries(c?.scopes ?? {}).map(([sc, n]) => `<span class="scope">${esc(sc.slice(1))} ${n}</span>`).join(' ');
  return `<tr>
  <td><a class="fname" href="${link}">${esc(f.name)}</a><div class="desc">${esc(f.description.trim())}</div>${scopes ? `<div class="scopes">${scopes}</div>` : ''}${c?.tests?.length ? testTable(c.tests) : ''}</td>
  <td class="num">${total ?? '–'}</td><td class="num">${c ? c.passed : '–'}</td><td class="num ${c?.failed ? 'bad' : ''}">${c ? c.failed : '–'}</td>
</tr>`;
}).join('\n');

const totalTests = summary ? summary.passed + summary.failed + summary.known : 0;
const statusLine = summary
  ? `<span class="dot ${summary.status === 'passed' ? 'ok' : 'bad'}"></span>Latest test run ${summary.status === 'passed' ? 'passed' : '<b class="bad">failed</b>'}: ${totalTests} tests, ${summary.failed} failed · ${esc(summary.date)}${summary.commit ? ` · commit ${summary.commitUrl ? `<a href="${summary.commitUrl}">${esc(summary.commit)}</a>` : esc(summary.commit)}` : ''}`
  : 'No test results yet.';

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>VICARIO</title>
<meta name="description" content="VICARIO: Java image I/O and format translation for planetary science data (VICAR, PDS3, PDS4, ISIS, FITS).">
<style>
:root { --bg:#ffffff; --fg:#1f2328; --muted:#59636e; --line:#d1d9e0; --card:#f6f8fa; --link:#0969da; --accent:#0b3d91;
  --pass:#1a7f37; --fail:#d1242f; --code:#eff2f5; }
@media (prefers-color-scheme: dark) { :root { --bg:#0d1117; --fg:#e6edf3; --muted:#9198a1; --line:#3d444d; --card:#151b23;
  --link:#4493f8; --accent:#7aa2ff; --pass:#3fb950; --fail:#f85149; --code:#1f2630; } }
* { box-sizing:border-box; }
html { scroll-behavior:smooth; }
body { margin:0; background:var(--bg); color:var(--fg); font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif; }
a { color:var(--link); text-decoration:none; } a:hover { text-decoration:underline; }
header { border-bottom:1px solid var(--line); position:sticky; top:0; background:var(--bg); z-index:1; }
.wrap { max-width:1000px; margin:0 auto; padding:0 16px; }
nav { display:flex; align-items:center; justify-content:space-between; gap:12px; min-height:56px; flex-wrap:wrap; }
nav .brand { font-weight:700; letter-spacing:.06em; color:var(--fg); }
nav .links { display:flex; flex-wrap:wrap; gap:4px 18px; font-size:14px; }
.hero { padding:48px 0 8px; }
.hero h1 { font-size:36px; line-height:1.2; margin:0 0 12px; }
.hero .lead { font-size:18px; color:var(--muted); max-width:760px; margin:0; }
.actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:22px; }
.button { display:inline-block; background:var(--accent); color:#fff; padding:9px 16px; border-radius:8px; font-weight:600; font-size:15px; }
.button.alt { background:transparent; color:var(--link); border:1px solid var(--line); }
.button:hover { text-decoration:none; opacity:.92; }
.status { margin-top:14px; font-size:14px; color:var(--muted); }
.dot { display:inline-block; width:9px; height:9px; border-radius:50%; margin-right:7px; background:var(--pass); }
.dot.bad { background:var(--fail); }
.strip { display:flex; gap:8px; overflow-x:auto; padding:24px 0 4px; }
.strip img { height:120px; border-radius:6px; border:1px solid var(--line); background:#000; flex:none; }
section { padding-top:8px; scroll-margin-top:64px; }
h2 { font-size:24px; margin:44px 0 12px; } h3 { font-size:16px; margin:22px 0 6px; }
p { margin:8px 0; } .muted { color:var(--muted); font-size:14px; }
.grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:12px; }
.card { border:1px solid var(--line); border-radius:10px; padding:14px 16px; background:var(--card); }
.card h3 { margin:0 0 4px; font-size:15px; } .card p { margin:0; font-size:14px; color:var(--muted); }
pre, code { font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
pre { background:var(--code); border-radius:8px; padding:12px 14px; overflow-x:auto; font-size:13px; line-height:1.5; margin:6px 0 14px; }
code { background:var(--code); border-radius:4px; padding:1px 5px; font-size:13px; }
pre code { background:none; padding:0; }
.cols { display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:16px; }
.scroll { overflow-x:auto; }
table { width:100%; border-collapse:collapse; font-size:14px; }
th, td { text-align:left; padding:8px; border-bottom:1px solid var(--line); vertical-align:top; }
th { font-size:12px; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); }
td.kw { font-family:ui-monospace,Menlo,monospace; font-size:13px; white-space:nowrap; }
.num { text-align:right; font-variant-numeric:tabular-nums; width:72px; } .bad { color:var(--fail); font-weight:600; }
.fname { font-weight:600; } .desc { color:var(--muted); font-size:13px; margin-top:2px; }
.yes { color:var(--pass); font-weight:600; }
.scopes { margin-top:6px; } .scope { display:inline-block; font-size:11px; padding:1px 8px; border-radius:999px; border:1px solid var(--line); background:var(--card); color:var(--muted); margin:2px 2px 0 0; }
details { border:1px solid var(--line); border-radius:8px; padding:6px 12px; margin:8px 0; }
summary { cursor:pointer; font-weight:600; padding:4px 0; }
details.tests { margin:8px 0 0; padding:2px 10px; } details.tests summary { font-size:13px; }
details.tests table { font-size:13px; } details.tests th, details.tests td { padding:5px 6px; }
details.tests td:first-child { width:60%; }
.pill { display:inline-block; font-size:12px; padding:1px 9px; border-radius:999px; white-space:nowrap; color:var(--muted); background:var(--card); }
.pill.pass { color:var(--pass); } .pill.fail { color:var(--fail); } .pill.warn { color:#9a6700; }
.recipe { font-size:14px; color:var(--muted); margin:14px 0 0; }
.results { border:1px solid var(--line); border-radius:10px; padding:16px 20px; background:var(--card); display:flex; flex-wrap:wrap;
  gap:16px; align-items:center; justify-content:space-between; }
.results p { margin:0; }
footer { border-top:1px solid var(--line); margin-top:56px; padding:20px 0 40px; color:var(--muted); font-size:13px; }
@media (max-width:600px) { .hero h1 { font-size:28px; } td.kw { white-space:normal; } }
</style></head>
<body>
<header><div class="wrap"><nav><a class="brand" href="#">VICARIO</a>
<span class="links"><a href="#cli">Command line</a><a href="#library">Java library</a><a href="#formats">Formats</a><a href="#testing">Testing</a><a href="tests/index.html">Test report</a><a href="${repoUrl}">GitHub</a></span></nav></div></header>
<main class="wrap">

<section class="hero">
  <h1>Image format translation for planetary science data</h1>
  <p class="lead">VICARIO is a Java library and command-line tool that converts images between planetary archive formats (VICAR, PDS3, PDS4, ISIS, FITS) and standard formats (TIFF, PNG, JPEG), keeping the label metadata. It is part of NASA's AMMOS Instrument Data Subsystem and is developed by JPL's Multimission Image Processing Laboratory.</p>
  <div class="actions"><a class="button" href="#install">Get started</a><a class="button alt" href="#cli">Command-line help</a><a class="button alt" href="tests/index.html">Test report</a></div>
  <p class="status">${statusLine}</p>
  ${heroImgs.length >= 3 ? `<div class="strip">${heroImgs.slice(0, 8).map((i) => `<img src="${i.src}" alt="${esc(i.alt)}" title="${esc(i.alt)}" loading="lazy">`).join('')}</div>
  <p class="muted">Public mission products (Mars 2020, MSL, MER, Cassini and others) decoded by the latest test run.</p>` : ''}
</section>

<section>
<h2>What it does</h2>
<div class="grid">
  <div class="card"><h3>Reads planetary formats</h3><p>VICAR, PDS3 (attached or detached labels), PDS4 images and tables, ISIS cubes, FITS and Magellan products.</p></div>
  <div class="card"><h3>Writes archive and standard formats</h3><p>VICAR, PDS3, TIFF, PNG, JPEG, JPEG 2000 and raw, with data type conversion, regions, subsampling and band selection.</p></div>
  <div class="card"><h3>Keeps the metadata</h3><p>Labels are carried across conversions. XSL transcoders map VICAR labels to PDS labels; PDS4 labels are generated from Velocity templates.</p></div>
  <div class="card"><h3>Plugs into Java ImageIO</h3><p>The readers and writers register as ImageIO plugins, so <code>ImageIO.read</code> opens VICAR and PDS files directly.</p></div>
</div>
</section>

<section id="install">
<h2>Install</h2>
<p>VICARIO ${esc(version)} is published to <a href="https://central.sonatype.com/artifact/gov.nasa.jpl.ammos.ids/vicario">Maven Central</a>. It is built for Java 8 and tested on Java 17.</p>
<div class="cols">
<div><h3>Maven</h3><pre><code>&lt;dependency&gt;
  &lt;groupId&gt;gov.nasa.jpl.ammos.ids&lt;/groupId&gt;
  &lt;artifactId&gt;vicario&lt;/artifactId&gt;
  &lt;version&gt;${esc(version)}&lt;/version&gt;
&lt;/dependency&gt;</code></pre></div>
<div><h3>Gradle</h3><pre><code>implementation("gov.nasa.jpl.ammos.ids:vicario:${esc(version)}")</code></pre>
<h3>Build from source</h3><pre><code>git clone ${repoUrl}.git
cd vicario
mvn -U -Pshade clean install   # target/${esc(jar)} for the command line</code></pre></div>
</div>
</section>

<section id="cli">
<h2>Command line: jConvertIIO</h2>
<p>The FAT jar runs the converter. Arguments are <code>KEYWORD=value</code> pairs; keyword names are not case-sensitive, and a true/false keyword given alone means true.</p>
<pre><code>java -jar ${esc(jar)} inp=&lt;input&gt; out=&lt;output&gt; format=&lt;format&gt; [KEYWORD=value ...]
java -jar ${esc(jar)} HELP        # every keyword</code></pre>
${recipes.map(([what, cmd]) => `<p class="recipe">${esc(what)}</p><pre><code>java -jar ${esc(jar)} ${esc(cmd)}</code></pre>`).join('\n')}
<p class="muted">On recent JDKs, JAI prints a "Could not find mediaLib accelerator" warning; add <code>-Dcom.sun.media.jai.disableMediaLib=true</code> before <code>-jar</code> to silence it.</p>

<h3>Keywords</h3>
<p class="muted">The most used keywords. <code>HELP</code> prints the full list, including tiling and cache settings.</p>
${keywordGroups.map(([group, kws], i) => `<details${i < 2 ? ' open' : ''}><summary>${esc(group)}</summary><div class="scroll"><table><tbody>
${kws.map(([k, d]) => `<tr><td class="kw">${esc(k)}</td><td>${esc(d)}</td></tr>`).join('\n')}
</tbody></table></div></details>`).join('\n')}

<h3>PDS4 tables</h3>
<pre><code>java -cp ${esc(jar)} jpl.mipl.io.util.ExtractTableJPL -c -o table.csv product.xml   # -w for fixed-width text</code></pre>
</section>

<section id="library">
<h2>Java library</h2>
<p>With VICARIO on the classpath, the VICAR, PDS3, ISIS and FITS readers are found through the standard ImageIO plugin lookup:</p>
<pre><code>import java.awt.image.BufferedImage;
import java.io.File;
import javax.imageio.ImageIO;

BufferedImage img = ImageIO.read(new File("image.vic"));   // VICAR, PDS3, ISIS, FITS
ImageIO.write(img, "png", new File("image.png"));</code></pre>
<p class="muted">The <a href="${repoUrl}">source</a> has the full API, including the label (metadata) classes and the PDS4 readers.</p>
</section>

<section id="formats">
<h2>Formats</h2>
<div class="scroll"><table>
<thead><tr><th>Format</th><th>Read</th><th>Write</th><th>Notes</th></tr></thead>
<tbody>
${formats.map(([f, r, w, n]) => `<tr><td class="fname">${esc(f)}</td><td class="yes">${r ? '✓' : ''}</td><td class="yes">${w === 'yes' ? '✓' : esc(w)}</td><td>${n}</td></tr>`).join('\n')}
</tbody></table></div>
</section>

<section id="testing">
<h2>Testing</h2>
<p>Every change runs a feature test suite: the real <code>jConvertIIO</code> command against synthetic images and public mission products from the PDS, with each output decoded and compared pixel for pixel. The full suite runs on every merge to <code>main</code> and nightly, and publishes the report linked here.</p>
<div class="results"><p>${statusLine}</p><span class="actions" style="margin:0"><a class="button" href="tests/procedures.html">Test procedures</a><a class="button alt" href="tests/index.html">Test report</a></span></div>
<h3>Capabilities</h3>
<p class="muted">Each capability is a feature in the test suite. Click one to read its test procedures: what each test does and what makes it pass. Open its test list for a summary of every test, linked to that test's procedure. The tags count tests by the kind of testing (nominal, off-nominal, malformed input, lossless, mission data, ...). Passed excludes tests that document a known bug.</p>
<div class="scroll"><table>
<thead><tr><th>Capability</th><th class="num">Tests</th><th class="num">Passed</th><th class="num">Failed</th></tr></thead>
<tbody>
${capabilityRows}
</tbody></table></div>
</section>
</main>
<footer><div class="wrap">VICARIO is developed by the Multimission Image Processing Laboratory at JPL for NASA AMMOS.
Source, issues and the <a href="${repoUrl}/blob/main/docs/TESTING.md">testing guide</a> are on <a href="${repoUrl}">GitHub</a>.
This site and its test report are regenerated on every merge to main and nightly.</div></footer>
</body></html>
`;
writeFileSync(join(outDir, 'index.html'), html);
writeFileSync(join(outDir, '.nojekyll'), '');
console.log(`site written to ${outDir}${summary ? '' : ' (no test summary found)'}`);
