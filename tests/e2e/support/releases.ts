// The release the report counts new and modified tests against: the newest
// published GitHub release older than the commit under test. On a release build
// that is the previous release, so the counts show what the new release added;
// on later builds of main it is the new release, so they show the work since.
import { execSync } from 'node:child_process';
import { E2E_ROOT } from './env';

export interface Baseline {
  /** The release tag, or '' when no release precedes the commit (every test is new). */
  tag: string;
  /** Publication date, YYYY-MM-DD ('' with no release). */
  date: string;
  url: string;
}

const REPO = process.env.GITHUB_REPOSITORY ?? 'NASA-AMMOS/vicario';

function commitDate(): string {
  try {
    return execSync('git log -1 --format=%cI HEAD', { cwd: E2E_ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch { return new Date().toISOString(); }
}

/**
 * The baseline release, or null when the release list cannot be read (offline,
 * rate limited). VICARIO_BASELINE_RELEASE=<tag>@<YYYY-MM-DD> sets it directly,
 * and VICARIO_BASELINE_RELEASE=none means no earlier release.
 */
export async function baselineRelease(): Promise<Baseline | null> {
  const fixed = process.env.VICARIO_BASELINE_RELEASE;
  if (fixed === 'none') return { tag: '', date: '', url: '' };
  if (fixed) {
    const [tag, date] = fixed.split('@');
    return { tag, date, url: `https://github.com/${REPO}/releases/tag/${tag}` };
  }
  try {
    const api = process.env.GITHUB_API_URL ?? 'https://api.github.com';
    const token = process.env.GITHUB_TOKEN;
    const res = await fetch(`${api}/repos/${REPO}/releases?per_page=100`, {
      headers: { Accept: 'application/vnd.github+json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    type Release = { tag_name: string; html_url: string; published_at: string | null; draft: boolean; prerelease: boolean };
    const before = commitDate();
    const latest = ((await res.json()) as Release[])
      .filter((r) => !r.draft && !r.prerelease && r.published_at && new Date(r.published_at) < new Date(before))
      .sort((a, b) => b.published_at!.localeCompare(a.published_at!))[0];
    return latest ? { tag: latest.tag_name, date: latest.published_at!.slice(0, 10), url: latest.html_url } : { tag: '', date: '', url: '' };
  } catch { return null; }
}

/** 'new' when added after the baseline, 'modified' when only changed after it. */
export function changeSince(base: Baseline | null, added?: string, modified?: string): '' | 'new' | 'modified' {
  if (!base || !added) return '';
  if (added > base.date) return 'new';
  return modified && modified > base.date ? 'modified' : '';
}
