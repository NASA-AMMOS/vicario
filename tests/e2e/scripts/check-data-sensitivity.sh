#!/usr/bin/env bash
# Fails if test code, workflows or docs reference JPL-internal locations, or if
# test data comes from anywhere but the public allowlist in fetch-test-data.mjs.
# Run from anywhere: bash tests/e2e/scripts/check-data-sensitivity.sh
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

fail=0
report() { echo "data-guard: $*" >&2; fail=1; }

# Public, version-controlled areas that drive the public workflow.
# build.yml is the internal, dispatch-only Artifactory build and is reviewed separately.
paths=(tests/e2e .github/workflows .github/project-requirements docs/TESTING.md src/test)
# the policy docs name the forbidden patterns, so they are exempt
excludes=(':!tests/e2e/package-lock.json' ':!tests/e2e/scripts/check-data-sensitivity.sh' ':!.github/workflows/build.yml'
  ':!docs/TESTING.md' ':!.github/project-requirements/criteria.md')

# Internal file systems, runners, hosts and repositories
patterns=(
  '/project/'
  '/home/'
  '/Users/'
  'jpl-linux-x64'
  'artifactory'
  '[A-Za-z0-9.-]*\.jpl\.nasa\.gov'
)
for p in "${patterns[@]}"; do
  hits=$(git grep -nIE "$p" -- "${paths[@]}" "${excludes[@]}" 2>/dev/null \
    | grep -vE 'planetarydata\.jpl\.nasa\.gov' || true)
  if [ -n "$hits" ]; then
    report "internal reference matching '$p':"
    echo "$hits" >&2
  fi
done

# The legacy TESTING/ area holds internal paths and data and must never be committed
if [ -n "$(git ls-files TESTING)" ]; then
  report "files under TESTING/ are tracked"
fi

# Every data URL must pass the fetch script's allowlist (and be pinned)
node --input-type=module -e "
  import { readFileSync } from 'node:fs';
  import { checkUrl } from './tests/e2e/scripts/fetch-test-data.mjs';
  const m = JSON.parse(readFileSync('tests/e2e/data/manifest.json', 'utf8'));
  let bad = 0;
  for (const a of m.assets) {
    const why = checkUrl(a.url) || (/^[0-9a-f]{64}$/.test(a.sha256 ?? '') ? null : 'sha256 not pinned');
    if (why) { console.error('data-guard: ' + a.id + ': ' + why); bad = 1; }
  }
  process.exit(bad);
" || fail=1

if [ "$fail" -ne 0 ]; then
  echo "data-guard: FAILED (public tests may use only publicly released data and generic paths)" >&2
  exit 1
fi
echo "data-guard: OK"
