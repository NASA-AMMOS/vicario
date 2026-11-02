// The release the report counts new and modified tests against. On the build
// for a release (the workflow's `release` event) it is the release before that
// one, so the counts show what the new release added; on every other build it
// is the latest published release, so they show the work since.
import { readFileSync } from 'node:fs';

export interface Baseline {
  /** The release tag, or '' when no release precedes the commit (every test is new). */
  tag: string;
  /** Publication date, YYYY-MM-DD ('' with no release). */
  date: string;
  url: string;
}

const REPO = process.env.GITHUB_REPOSITORY ?? 'NASA-AMMOS/vicario';

/** The tag of the release this run was triggered by, if any. */
function releaseEventTag(): string | undefined {
  if (process.env.GITHUB_EVENT_NAME !== 'release' || !process.env.GITHUB_EVENT_PATH) return undefined;
  try {
    return JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')).release?.tag_name;
  } catch { return undefined; }
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
    const releases = ((await res.json()) as Release[])
      .filter((r) => !r.draft && !r.prerelease && r.published_at)
      .sort((a, b) => b.published_at!.localeCompare(a.published_at!));
    const event = releaseEventTag();
    const current = event ? releases.find((r) => r.tag_name === event) : undefined;
    const latest = current ? releases.find((r) => r.published_at! < current.published_at!) : releases[0];
    return latest ? { tag: latest.tag_name, date: latest.published_at!.slice(0, 10), url: latest.html_url } : { tag: '', date: '', url: '' };
  } catch { return null; }
}

/** 'new' when added after the baseline, 'modified' when only changed after it. */
export function changeSince(base: Baseline | null, added?: string, modified?: string): '' | 'new' | 'modified' {
  if (!base || !added) return '';
  if (added > base.date) return 'new';
  return modified && modified > base.date ? 'modified' : '';
}
