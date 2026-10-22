#!/usr/bin/env node
// Markdown summary of results/results.json grouped by feature, for
// $GITHUB_STEP_SUMMARY:  node scripts/summary.mjs >> "$GITHUB_STEP_SUMMARY"
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const resultsFile = join(root, 'results', 'results.json');
if (!existsSync(resultsFile)) {
  console.log('### Feature tests\n\nNo results.json: the test run did not start (see the job log).');
  process.exit(0);
}
const results = JSON.parse(readFileSync(resultsFile, 'utf8'));
const features = parse(readFileSync(join(root, 'features.yml'), 'utf8')).features;

const rows = new Map(); // tag -> counts
const known = [];
const failed = [];
function walk(suite) {
  for (const s of suite.suites ?? []) walk(s);
  for (const spec of suite.specs ?? []) {
    for (const t of spec.tests) {
      const tag = (spec.tags ?? []).map((x) => `@${x.replace(/^@/, '')}`).find((x) => /^@[FX]\d\d-|^@registry/.test(x)) ?? '@other';
      const row = rows.get(tag) ?? { passed: 0, failed: 0, known: 0, skipped: 0 };
      const status = t.results.at(-1)?.status;
      if (t.status === 'skipped') row.skipped++;
      else if (t.status === 'unexpected' || t.status === 'flaky') { row.failed++; failed.push(`${tag} ${spec.title}`); }
      else if (status === 'failed' || status === 'timedOut') {
        row.known++;
        const note = t.annotations.find((a) => a.type === 'issue')?.description ?? '';
        known.push(`${tag} ${spec.title}: ${note}`);
      } else row.passed++;
      rows.set(tag, row);
    }
  }
}
for (const s of results.suites ?? []) walk(s);

const name = (tag) => features.find((f) => f.tag === tag)?.name ?? (tag === '@registry' ? 'Feature registry' : tag);
const out = ['### Feature tests', '', '| Feature | Passed | Failed | Known failures |', '|---|---:|---:|---:|'];
for (const [tag, r] of [...rows].sort(([a], [b]) => a.localeCompare(b))) {
  out.push(`| ${tag.slice(1)} ${name(tag)} | ${r.passed} | ${r.failed ? `**${r.failed}**` : 0} | ${r.known} |`);
}
const planned = features.filter((f) => f.status !== 'active');
if (planned.length) {
  out.push('', `Not yet automated: ${planned.map((f) => `${f.id} ${f.name} (${f.status === 'planned' ? f.milestone : 'excluded'})`).join(', ')}.`);
}
if (failed.length) out.push('', '**Failures**', '', ...failed.map((f) => `- ${f}`));
if (known.length) out.push('', '<details><summary>Known failures (expected to fail, tracked by issue)</summary>', '',
  ...known.map((k) => `- ${k}`), '', '</details>');
out.push('', 'Download the `playwright-report` artifact (kept 5 days) and open `index.html` for logs and image previews.');
console.log(out.join('\n'));
