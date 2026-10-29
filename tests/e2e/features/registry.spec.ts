// Keeps features.yml, the specs and the data manifest consistent.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '../support/test';
import { manifestAssets } from '../support/data';
import { E2E_ROOT } from '../support/env';
import { ABOUT, ADDED, MODIFIED, SCOPES, about, features, tagOf } from '../support/features';

const specFiles = readdirSync(path.join(E2E_ROOT, 'features'))
  .filter((f) => f.endsWith('.spec.ts') && !['registry.spec.ts', 'junit.spec.ts', 'report-pages.spec.ts'].includes(f))
  .map((f) => `features/${f}`);

type Listed = { title: string; file: string; line: number; tags: string[]; tests: { annotations: { type: string; description?: string }[] }[] };

/** Every test in the suite, from `playwright test --list` (the full project includes the fast tests). */
function listedTests(): Listed[] {
  const cli = path.join(E2E_ROOT, 'node_modules', '@playwright', 'test', 'cli.js');
  const json = JSON.parse(execFileSync(process.execPath, [cli, 'test', '--list', '--project', 'full', '--reporter=json'],
    { cwd: E2E_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
  type Suite = { specs?: Listed[]; suites?: Suite[] };
  const specs: Listed[] = [];
  const walk = (s: Suite) => { specs.push(...(s.specs ?? [])); (s.suites ?? []).forEach(walk); };
  json.suites.forEach(walk);
  return specs;
}

test.describe('Feature registry', { tag: ['@registry', '@fast'] }, () => {
  test('feature ids are unique and well formed, with a name and description', about(
    `Checks features.yml: feature ids are unique, lowercase and not reserved, and every feature has a name, a description and a valid status.`,
    '@suite', { added: '2026-10-22', modified: '2026-10-23' },
  ), () => {
    const fs = features();
    expect(new Set(fs.map((f) => f.id)).size).toBe(fs.length);
    for (const f of fs) {
      expect(f.id).toMatch(/^[a-z][a-z0-9-]*$/);
      const reserved = ['registry', 'junit', 'fast', 'full', ...Object.keys(SCOPES).map((t) => t.slice(1))];
      expect(reserved, `${f.id} is reserved`).not.toContain(f.id);
      expect(f.name, f.id).toBeTruthy();
      expect(f.description, f.id).toBeTruthy();
      expect(['active', 'planned', 'excluded'], f.id).toContain(f.status);
    }
  });

  test('every active feature has specs that carry its tag', about(
    `Checks that every active feature lists spec files that exist and call \`feature()\` with its id, so their tests carry the feature's tag.`,
    '@suite', { added: '2026-10-22', modified: '2026-10-23' },
  ), () => {
    for (const f of features().filter((x) => x.status === 'active')) {
      expect(f.specs?.length, `${f.id} has no specs`).toBeGreaterThan(0);
      for (const spec of f.specs!) {
        const file = path.join(E2E_ROOT, spec);
        expect(existsSync(file), `${f.id}: ${spec} exists`).toBe(true);
        expect(readFileSync(file, 'utf8'), `${spec} uses feature('${f.id}') (tag ${tagOf(f)})`).toContain(`feature('${f.id}'`);
      }
    }
  });

  test('planned features name a milestone and excluded features give a reason', about(
    `Checks that planned features name a milestone and excluded features give a reason.`,
    '@suite', { added: '2026-10-22', modified: '2026-10-23' },
  ), () => {
    for (const f of features()) {
      if (f.status === 'planned') expect(f.milestone, `${f.id} milestone`).toBeTruthy();
      if (f.status === 'excluded') expect(f.reason, `${f.id} reason`).toBeTruthy();
    }
  });

  test('every spec belongs to a feature', about(
    `Checks that every spec file in features/ is listed under a feature in features.yml.`,
    '@suite', { added: '2026-10-22', modified: '2026-10-23' },
  ), () => {
    const listed = new Set(features().flatMap((f) => f.specs ?? []));
    for (const spec of specFiles) expect(listed.has(spec), `${spec} is listed in features.yml`).toBe(true);
  });

  test('every manifest asset is pinned, licensed and used by a spec or helper', about(
    `Checks the test data manifest: every downloaded file is pinned by SHA-256, has a license and is used by a spec or helper.`,
    '@suite', { added: '2026-10-22', modified: '2026-10-23' },
  ), () => {
    const helpers = readdirSync(path.join(E2E_ROOT, 'support')).map((f) => `support/${f}`);
    const sources = [...specFiles, ...helpers].map((s) => readFileSync(path.join(E2E_ROOT, s), 'utf8')).join('\n');
    for (const a of manifestAssets()) {
      expect(a.sha256, `${a.id} sha256`).toMatch(/^[0-9a-f]{64}$/);
      expect(a.license, `${a.id} license`).toBeTruthy();
      expect(sources, `${a.id} is used by a spec`).toContain(`'${a.id}'`);
    }
  });

  test('every test has a description and a scope tag', about(
    `Lists the whole suite (\`playwright test --list\`) and checks that every test has a "${ABOUT}" description and at least one scope tag (${Object.keys(SCOPES).map((t) => `\`${t}\``).join(', ')}), so the procedures report describes every test.`,
    '@suite', { added: '2026-10-23', modified: '2026-10-28' },
  ), () => {
    const specs = listedTests();
    expect(specs.length, 'tests listed').toBeGreaterThan(0);
    const scopes = Object.keys(SCOPES).map((t) => t.slice(1));
    const problems = specs.flatMap((s) => [
      ...(s.tests.some((t) => t.annotations.some((a) => a.type === ABOUT)) ? [] : [`${s.file}:${s.line} "${s.title}" has no about() description`]),
      ...(s.tags.some((t) => scopes.includes(t)) ? [] : [`${s.file}:${s.line} "${s.title}" has no scope tag`]),
    ]);
    expect(problems).toEqual([]);
  });

  test('every test has valid added and modified dates', about(
    `Lists the whole suite and checks that every test has an \`added\` date (\`about(..., { added, modified })\`), that the dates are YYYY-MM-DD and not in the future, and that \`modified\` is after \`added\`. Imported JUnit results are exempt: their dates come from git. The report counts new and modified tests per release from these dates.`,
    '@suite', { added: '2026-10-28' },
  ), () => {
    const today = new Date().toISOString().slice(0, 10);
    const problems = listedTests().flatMap((s) => {
      const notes = s.tests[0]?.annotations ?? [];
      if (notes.some((a) => a.type === 'junit source')) return [];
      const at = `${s.file}:${s.line} "${s.title}"`;
      const added = notes.find((a) => a.type === ADDED)?.description;
      const modified = notes.find((a) => a.type === MODIFIED)?.description;
      if (!added) return [`${at} has no added date: end its about() with { added: '${today}' }`];
      return [
        ...[added, modified].filter((d) => d !== undefined && (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d > today)).map((d) => `${at}: ${d} is not a past YYYY-MM-DD date`),
        ...(modified && modified <= added ? [`${at}: modified ${modified} is not after added ${added}`] : []),
      ];
    });
    expect(problems).toEqual([]);
  });
});
