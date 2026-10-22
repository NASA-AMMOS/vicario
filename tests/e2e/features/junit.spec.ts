// JUnit results (target/surefire-reports) imported into this report, one
// Playwright test per JUnit test case, grouped under the feature that lists the
// class in features.yml (`junit:`). Run `mvn package` (or `mvn test`) first.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { REPO_ROOT } from '../support/env';
import { features } from '../support/features';

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

if (!existsSync(SUREFIRE)) {
  test('JUnit results are available', { tag: ['@junit', '@fast'] }, () => {
    throw new Error("target/surefire-reports is missing; build with `mvn -B -P shade package test-compile`");
  });
} else {
  const cases = readCases();
  const owners = new Map(features().flatMap((f) => (f.junit ?? []).map((cls) => [cls, f] as const)));
  for (const cls of [...new Set(cases.map((c) => c.cls))].sort()) {
    const owner = owners.get(cls);
    const tag = owner ? [owner.tag, '@fast'] : ['@junit', '@fast'];
    test.describe(`JUnit ${cls.split('.').pop()}`, { tag }, () => {
      test('class is listed under a feature in features.yml', () => {
        expect(owner, `add ${cls} to a feature's junit: list`).toBeTruthy();
      });
      for (const c of cases.filter((x) => x.cls === cls)) {
        test(c.name, async ({}, testInfo) => {
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
