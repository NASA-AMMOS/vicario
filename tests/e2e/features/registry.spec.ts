// Keeps features.yml, the specs and the data manifest consistent.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { manifestAssets } from '../support/data';
import { E2E_ROOT } from '../support/env';
import { features, tagOf } from '../support/features';

const specFiles = readdirSync(path.join(E2E_ROOT, 'features'))
  .filter((f) => f.endsWith('.spec.ts') && !['registry.spec.ts', 'junit.spec.ts'].includes(f))
  .map((f) => `features/${f}`);

test.describe('Feature registry', { tag: ['@registry', '@fast'] }, () => {
  test('feature ids are unique and well formed, with a name and description', () => {
    const fs = features();
    expect(new Set(fs.map((f) => f.id)).size).toBe(fs.length);
    for (const f of fs) {
      expect(f.id).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(['registry', 'junit', 'fast', 'full'], `${f.id} is reserved`).not.toContain(f.id);
      expect(f.name, f.id).toBeTruthy();
      expect(f.description, f.id).toBeTruthy();
      expect(['active', 'planned', 'excluded'], f.id).toContain(f.status);
    }
  });

  test('every active feature has specs that carry its tag', () => {
    for (const f of features().filter((x) => x.status === 'active')) {
      expect(f.specs?.length, `${f.id} has no specs`).toBeGreaterThan(0);
      for (const spec of f.specs!) {
        const file = path.join(E2E_ROOT, spec);
        expect(existsSync(file), `${f.id}: ${spec} exists`).toBe(true);
        expect(readFileSync(file, 'utf8'), `${spec} uses feature('${f.id}') (tag ${tagOf(f)})`).toContain(`feature('${f.id}'`);
      }
    }
  });

  test('planned features name a milestone and excluded features give a reason', () => {
    for (const f of features()) {
      if (f.status === 'planned') expect(f.milestone, `${f.id} milestone`).toBeTruthy();
      if (f.status === 'excluded') expect(f.reason, `${f.id} reason`).toBeTruthy();
    }
  });

  test('every spec belongs to a feature', () => {
    const listed = new Set(features().flatMap((f) => f.specs ?? []));
    for (const spec of specFiles) expect(listed.has(spec), `${spec} is listed in features.yml`).toBe(true);
  });

  test('every manifest asset is pinned, licensed and used by a spec or helper', () => {
    const helpers = readdirSync(path.join(E2E_ROOT, 'support')).map((f) => `support/${f}`);
    const sources = [...specFiles, ...helpers].map((s) => readFileSync(path.join(E2E_ROOT, s), 'utf8')).join('\n');
    for (const a of manifestAssets()) {
      expect(a.sha256, `${a.id} sha256`).toMatch(/^[0-9a-f]{64}$/);
      expect(a.license, `${a.id} license`).toBeTruthy();
      expect(sources, `${a.id} is used by a spec`).toContain(`'${a.id}'`);
    }
  });
});
