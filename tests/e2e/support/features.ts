// Feature registry (features.yml) and helpers for known failures.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from '@playwright/test';
import { parse } from 'yaml';
import { E2E_ROOT } from './env';

export interface Feature {
  id: string;
  name: string;
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

/** A feature's report tag: @<id>. */
export const tagOf = (f: Pick<Feature, 'id'>) => `@${f.id}`;

/** Details for test.describe(): the feature tag and the tier tag. */
export function feature(id: string, tier: 'fast' | 'full' = 'fast') {
  const f = features().find((x) => x.id === id);
  if (!f) throw new Error(`feature ${id} is not in features.yml`);
  return { tag: [tagOf(f), `@${tier}`] };
}

/**
 * Scope tags: the kind of testing a test does. Every test carries at least one
 * (enforced by registry.spec.ts); the report and the site count tests by scope.
 */
export const SCOPES = {
  '@nominal': 'Nominal: expected use with valid input.',
  '@off-nominal': 'Off-nominal: unsupported options, edge cases or invalid arguments; the tool must handle them or fail cleanly.',
  '@malformed-input': 'Malformed input: truncated, corrupt or hostile files.',
  '@lossless': 'Lossless: the output must decode to exactly the same pixels (pixel hash) as the input.',
  '@mission-data': 'Mission data: uses public products from the PDS archive.',
  '@regression': 'Regression: guards a bug that was fixed (see its issue).',
  '@security': 'Security: XML external entities and path traversal.',
  '@legacy': 'Legacy: a case from the old tstjConvertIIO.csh / ST2-4.1 procedure.',
  '@suite': 'Suite integrity: checks the test suite itself (registry, data manifest).',
  '@unit': 'Unit test: a JUnit result imported from the Maven build.',
} as const;
export type Scope = keyof typeof SCOPES;

/** The annotation type that holds a test's description. */
export const ABOUT = 'what it checks';

/** The annotation type of needsReview notes. */
export const NEEDS_REVIEW = 'needs review';

/**
 * Details for test(): what the test does and what makes it pass, plus its
 * scope tags. Write the description as plain text; `backticks` mark code and
 * are rendered as code on the procedures page.
 */
export function about(description: string, ...scopes: Scope[]) {
  return { tag: scopes, annotation: { type: ABOUT, description } };
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

/**
 * Mark behaviour the suite found that looks wrong but has no ticket or other
 * record yet. The test is not expected to fail: it fails as normal and the
 * report flags it "needs review" until someone decides whether the behaviour is
 * a bug (ticket it, then fix it or use knownFailure) or intended (correct the
 * test and say why).
 */
export function needsReview(id: string, why: string) {
  test.info().annotations.push({ type: NEEDS_REVIEW, description: `${id}: ${why}` });
}

export function issue(id: string, what: string) {
  test.info().annotations.push({ type: 'issue', description: `${id}: ${what}` });
}
