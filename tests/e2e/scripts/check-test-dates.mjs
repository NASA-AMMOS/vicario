#!/usr/bin/env node
// Checks that tests changed since a base commit carry a current date in their
// about(..., { added, modified }), so the report's New and Modified counts per
// release stay right. A test whose source (from `test(` to its closing paren,
// ignoring the dates) differs from the base must have `modified` on or after
// the base commit's date; a test that is not in the base (new or renamed) must
// have `added` or `modified` on or after it, and `added` of an existing test
// must not change. registry.spec.ts checks that every test has dates at all.
//
//   node scripts/check-test-dates.mjs [--base <ref>]   (default: merge-base with origin/main)
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const args = process.argv.slice(2);
const base = args.includes('--base') ? args[args.indexOf('--base') + 1] : git('merge-base', 'HEAD', 'origin/main');
const baseDate = git('log', '-1', '--format=%cs', base);
const DATES = /,?\s*\{\s*added:\s*'([\d-]+)'(?:,\s*modified:\s*'([\d-]+)')?\s*\}/;

/** Index of the ')' closing the '(' at `open`, skipping strings and template literals. */
function closeParen(src, open) {
  let depth = 0;
  const stack = []; // open template literals ('`') and their ${ } ('{')
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    const top = stack.at(-1);
    if (top === '`') {
      if (c === '\\') i++;
      else if (c === '`') stack.pop();
      else if (c === '$' && src[i + 1] === '{') { stack.push('{'); i++; }
      continue;
    }
    if (c === '/' && src[i + 1] !== '/' && src[i + 1] !== '*' && /[(,=:[!&|?{};]/.test(src.slice(0, i).trimEnd().at(-1) ?? '')) {
      // a regex literal: skip to its closing slash (outside any [...] class)
      for (let cls = false, j = i + 1; j < src.length; j++) {
        if (src[j] === '\\') j++;
        else if (src[j] === '[') cls = true;
        else if (src[j] === ']') cls = false;
        else if (src[j] === '/' && !cls) { i = j; break; }
      }
      continue;
    }
    if (c === "'" || c === '"') {
      for (i++; i < src.length && src[i] !== c; i++) if (src[i] === '\\') i++;
      continue;
    }
    if (c === '`') stack.push('`');
    else if (top === '{' && c === '}') stack.pop();
    else if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return i;
  }
  return src.length;
}

/** The tests in a spec's source: title line, source without its dates, and the dates. */
function tests(src) {
  const out = new Map();
  for (const m of src.matchAll(/^[ \t]*test\(/gm)) {
    const open = m.index + m[0].length - 1;
    const text = src.slice(m.index, closeParen(src, open) + 1);
    const dates = text.match(DATES);
    const key = text.split('\n')[0].trim().replace(/, about\($/, '');
    out.set(key, { line: src.slice(0, m.index).split('\n').length, dates: dates && { added: dates[1], modified: dates[2] },
      body: text.replace(DATES, '').replace(/\s+/g, ' ') });
  }
  return out;
}

const problems = [];
let checked = 0;
const dir = join(root, 'features');
for (const f of readdirSync(dir).filter((x) => x.endsWith('.spec.ts'))) {
  const file = join(dir, f);
  const rel = relative(git('rev-parse', '--show-toplevel'), file);
  let old = '';
  try { old = git('show', `${base}:${rel}`); } catch { /* a new spec file */ }
  const before = tests(old);
  for (const [key, t] of tests(readFileSync(file, 'utf8'))) {
    if (!t.dates) continue; // no dates at all: registry.spec.ts reports it (JUnit imports get theirs from git)
    checked++;
    const at = `${relative(root, file)}:${t.line} ${key}`;
    const { added, modified = '' } = t.dates;
    const was = before.get(key);
    if (!was) {
      if (added < baseDate && modified < baseDate) problems.push(`${at}\n    new or renamed: set added (new) or modified (renamed) to today; both are before ${baseDate}`);
    } else if (was.body !== t.body) {
      // a test added on or after the base date may change again without a modified date
      if (added < baseDate && modified < baseDate) problems.push(`${at}\n    changed: set modified to today (it is ${modified || 'not set'}, before ${baseDate})`);
      if (was.dates && was.dates.added !== added) problems.push(`${at}\n    added changed from ${was.dates.added} to ${added}; keep the original date`);
    }
  }
}
console.log(`check-test-dates: ${checked} tests against ${base.slice(0, 12)} (${baseDate})`);
if (problems.length) {
  console.error(`\n${problems.length} test(s) need their dates updated (see docs/TESTING.md, "Test history"):\n\n${problems.join('\n')}`);
  process.exit(1);
}
