// Feature registry (features.yml) and helpers for known failures.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from '@playwright/test';
import { parse } from 'yaml';
import { E2E_ROOT } from './env';

export interface Feature {
  id: string;
  name: string;
  tag: string;
  description: string;
  status: 'active' | 'planned' | 'excluded';
  reason?: string;
  milestone?: string;
  code?: string[];
  keywords?: string[];
  specs?: string[];
  junit?: string[];
  tickets?: string[];
}

export function features(): Feature[] {
  return parse(readFileSync(path.join(E2E_ROOT, 'features.yml'), 'utf8')).features;
}

/** Tags for test.describe(): the feature tag plus the tier. */
export function feature(id: string, tier: 'fast' | 'full' = 'fast'): { tag: string[] } {
  const f = features().find((x) => x.id === id);
  if (!f) throw new Error(`feature ${id} is not in features.yml`);
  return { tag: [f.tag, `@${tier}`] };
}

/**
 * Mark the running test as a known failure tied to an issue. The report shows
 * it as "expected to fail"; once the bug is fixed the test turns red so the
 * marker gets removed.
 */
export function knownFailure(issue: string, why: string) {
  test.info().annotations.push({ type: 'issue', description: `${issue}: ${why}` });
  test.fail(true, `${issue}: ${why}`);
}

export function issue(id: string, what: string) {
  test.info().annotations.push({ type: 'issue', description: `${id}: ${what}` });
}
