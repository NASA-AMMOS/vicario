// JUnit results (target/surefire-reports) imported into this report, one
// Playwright test per JUnit test case, grouped under the feature that lists the
// class in features.yml (`junit:`). Run `mvn package` (or `mvn test`) first.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '../support/test';
import { REPO_ROOT, sourceUrl } from '../support/env';
import { about, features, historyAnnotations, tagOf } from '../support/features';

const SUREFIRE = path.join(REPO_ROOT, 'target', 'surefire-reports');

interface Case { cls: string; name: string; time: string; outcome: 'passed' | 'failed' | 'skipped'; detail: string }

const unescape = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'").replace(/&amp;/g, '&');

function readCases(): Case[] {
  const cases: Case[] = [];
  for (const f of readdirSync(SUREFIRE).filter((x) => /^TEST-.*\.xml$/.test(x))) {
    const xml = readFileSync(path.join(SUREFIRE, f), 'utf8');
    for (const m of xml.matchAll(/<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g)) {
      const attrs = Object.fromEntries([...m[1].matchAll(/(\w+)="([^"]*)"/g)].map((a) => [a[1], unescape(a[2])]));
      const body = m[2] ?? '';
      const problem = body.match(/<(failure|error)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/);
      cases.push({
        cls: attrs.classname, name: attrs.name, time: attrs.time ?? '',
        outcome: problem ? 'failed' : /<skipped\b/.test(body) ? 'skipped' : 'passed',
        detail: problem
          ? unescape(`${problem[2].match(/message="([^"]*)"/)?.[1] ?? problem[1]}\n${problem[3] ?? ''}`).trim()
          : '',
      });
    }
  }
  return cases;
}

const shallow = (() => {
  try {
    return execFileSync('git', ['rev-parse', '--is-shallow-repository'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim() !== 'false';
  } catch { return true; }
})();

/**
 * History of lines from..to (1-based) of a Java file from git blame: added is
 * the oldest line's date, modified the newest. Null when git history is not
 * available (not a checkout, a shallow clone, or the file is not committed).
 */
function javaHistory(file: string, from: number, to: number) {
  if (shallow) return null;
  try {
    const out = execFileSync('git', ['blame', '--line-porcelain', '-L', `${from},${to}`, '--', file],
      { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const days = [...out.matchAll(/^author-time (\d+)$/gm)].map((m) => new Date(+m[1] * 1000).toISOString().slice(0, 10)).sort();
    if (!days.length) return null;
    const [added, modified] = [days[0], days.at(-1)!];
    return historyAnnotations(modified > added ? { added, modified } : { added });
  } catch { return null; }
}

/**
 * Index of the line holding the '}' that closes the method declared at line
 * `decl` (0-based), skipping comments and string and char literals, so its
 * history covers the method alone and not the helpers or javadoc after it.
 */
function methodEnd(lines: string[], decl: number) {
  let depth = 0;
  let block = false;
  for (let i = decl; i < lines.length; i++) {
    const l = lines[i];
    for (let j = 0; j < l.length; j++) {
      if (block) { if (l.startsWith('*/', j)) { block = false; j++; } continue; }
      if (l.startsWith('//', j)) break;
      if (l.startsWith('/*', j)) { block = true; j++; continue; }
      const c = l[j];
      if (c === '"' || c === "'") { for (j++; j < l.length && l[j] !== c; j++) if (l[j] === '\\') j++; continue; }
      if (c === '{') depth++;
      else if (c === '}' && --depth === 0) return i;
    }
  }
  return lines.length - 1;
}

/**
 * Adds a "junit source" annotation linking to the Java test class (at the
 * method, when given), which the procedures page uses as the test's source,
 * and the method's (or class's) added and modified dates from git.
 */
function withJavaSource(cls: string, details: ReturnType<typeof about>, method?: string) {
  const file = path.join(REPO_ROOT, 'src', 'test', 'java', ...cls.split('.')) + '.java';
  const lines = existsSync(file) ? readFileSync(file, 'utf8').split('\n') : [];
  const line = method ? lines.findIndex((l) => new RegExp(`void\\s+${method}\\s*\\(`).test(l)) + 1 : 0;
  const end = line ? methodEnd(lines, line - 1) + 1 : lines.length;
  const history = lines.length ? javaHistory(file, line || 1, end) : null;
  return { ...details, annotation: [...details.annotation, { type: 'junit source', description: sourceUrl(file, line || undefined) }, ...(history ?? [])] };
}

if (!existsSync(SUREFIRE)) {
  test.describe('JUnit results', { tag: ['@junit', '@fast'] }, () => test('JUnit results are available', about(
    `Imports the JUnit results of the Maven build. Fails when target/surefire-reports is missing (build with Maven first).`,
    '@unit', { added: '2026-10-22' },
  ), () => {
    throw new Error("target/surefire-reports is missing; build with `mvn -B -P shade package test-compile`");
  }));
} else {
  const cases = readCases();
  const owners = new Map(features().flatMap((f) => (f.junit ?? []).map((cls) => [cls, f] as const)));
  for (const cls of [...new Set(cases.map((c) => c.cls))].sort()) {
    const owner = owners.get(cls);
    const tag = owner ? [tagOf(owner), '@fast'] : ['@junit', '@fast'];
    test.describe(`Unit tests (JUnit): ${cls.split('.').pop()}`, { tag }, () => {
      test('class is listed under a feature in features.yml', withJavaSource(cls, about(
        `Bookkeeping, not a product test: checks that the JUnit class \`${cls}\` is listed in a feature's \`junit:\` list in features.yml, so its results are grouped under that feature.`,
        '@suite',
      )), () => {
        expect(owner, `add ${cls} to a feature's junit: list`).toBeTruthy();
      });
      for (const c of cases.filter((x) => x.cls === cls)) {
        test(c.name, withJavaSource(cls, about(
          `Imports the result of the JUnit test \`${cls.split('.').pop()}.${c.name}\` from the Maven build (target/surefire-reports). Passes when it passed in JUnit; a JUnit failure is shown with its message.`,
          '@unit',
        ), c.name), async ({}, testInfo) => {
          testInfo.annotations.push({ type: 'junit', description: `${cls}#${c.name} (${c.time}s, from surefire)` });
          test.skip(c.outcome === 'skipped', 'skipped in JUnit');
          if (c.outcome === 'failed') {
            await testInfo.attach('junit-failure.txt', { body: c.detail, contentType: 'text/plain' });
            throw new Error(`JUnit failure: ${c.detail.split('\n')[0]}`);
          }
        });
      }
    });
  }
}
