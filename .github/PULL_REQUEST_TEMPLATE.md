## Purpose
- Clear, easy-to-understand sentences outlining the purpose of the PR
## Proposed Changes
- [ADD] ...
- [CHANGE] ...
- [FIX] ...
## Issues
- Links to relevant issues
- Example: issue-XYZ
## Testing
See [docs/TESTING.md](../docs/TESTING.md) and [criteria.md](project-requirements/criteria.md).
- [ ] Features touched (from `tests/e2e/features.yml`): F..
- [ ] Tests added or updated (bug fixes: a test that fails without the fix, tagged with the ticket)
- [ ] Goldens unchanged, or changed with the reason given here
- [ ] New test data is public, pinned (sha256) and licensed in `tests/e2e/data/manifest.json`
- [ ] No internal paths, hosts or data (`data-guard` passes)
- Playwright report: download `playwright-report-fast` from this PR's CI run
