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

/** The annotation types of a test's history dates. */
export const ADDED = 'added';
export const MODIFIED = 'modified';

/**
 * When a test was written and when it last changed, as YYYY-MM-DD. The report
 * compares them with the latest GitHub release to count new and modified tests
 * per feature. Set `modified` whenever you change what a test does or checks
 * (scripts/check-test-dates.mjs enforces it on pull requests).
 */
export interface History { added: string; modified?: string }

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A test's history as annotations; throws on a malformed date. */
export function historyAnnotations(h: History) {
  for (const d of [h.added, h.modified]) if (d !== undefined && !DATE.test(d)) throw new Error(`date ${d} is not YYYY-MM-DD`);
  return [{ type: ADDED, description: h.added }, ...(h.modified ? [{ type: MODIFIED, description: h.modified }] : [])];
}

/**
 * Details for test(): what the test does and what makes it pass, its scope
 * tags, and its history ({ added, modified }), last. Write the description as
 * plain text; `backticks` mark code and are rendered as code on the procedures page.
 */
export function about(description: string, ...args: (Scope | History)[]) {
  const scopes = args.filter((a): a is Scope => typeof a === 'string');
  const history = args.find((a): a is History => typeof a === 'object');
  return { tag: scopes, annotation: [{ type: ABOUT, description }, ...(history ? historyAnnotations(history) : [])] };
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

/** The annotation type of deferred notes. */
export const DEFERRED = 'deferred';

/**
 * Mark a reviewed bug or missing capability that we decided not to fix yet.
 * The test still reproduces it, but is skipped by default so the suite stays
 * green; set VICARIO_RUN_DEFERRED=1 to run it (it fails until someone fixes the
 * behaviour, then the marker gets removed). The reason shows in the report.
 */
export function deferred(id: string, why: string) {
  test.info().annotations.push({ type: DEFERRED, description: `${id}: ${why}` });
  test.skip(!process.env.VICARIO_RUN_DEFERRED, `${id}: ${why}`);
}

export function issue(id: string, what: string) {
  test.info().annotations.push({ type: 'issue', description: `${id}: ${what}` });
}
