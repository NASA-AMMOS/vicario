# Testing vicario

vicario has two test layers:

| Layer | Where | Runs |
|---|---|---|
| Unit tests (JUnit 4) | `src/test/java` | `mvn test` |
| Feature tests (Playwright Test driving `jConvertIIO`) | `tests/e2e` | fast tier on every PR; full tier nightly and on release |

Both run in GitHub Actions. The fast tier and the unit tests are **required checks**: a pull request into `main` or `develop` cannot merge until they pass.

## Running locally

Prerequisites: JDK 17, Maven 3.9+, Node 20+, and Python 3 with `lxml` (for the label-script tests).

```bash
mvn -B -P shade package test-compile               # FAT jar, unit tests, ImageProbe / SyntheticGen
cd tests/e2e
npm ci
npm run data:fast                                  # or data:full
npx playwright test --project fast                 # or --project full
npx playwright show-report
```

- **Python:** set `VICARIO_PYTHON=/path/to/python` if the default `python3` has no `lxml`.
- **JDK:** `JAVA_HOME` selects the JDK used for `jConvertIIO`.
- **Single feature:** `npx playwright test --grep @F03-pds3`.

## How the feature tests work

- **Feature registry.** [`tests/e2e/features.yml`](../tests/e2e/features.yml) lists every capability (F01 VICAR I/O, F03 PDS3, F05 PDS4, F10 output formats, ...) with its code paths, keywords, tickets and status (`active`, `planned` with a milestone, or `excluded` with a reason). `features/registry.spec.ts` fails if a spec has no feature, an active feature has no spec, or a manifest asset is unpinned or unused.
- **Specs.** One spec per feature in `tests/e2e/features/`. Each `test.describe` carries the feature tag and a tier tag (`@fast` or `@full`), so the HTML report groups results by feature.
- **Running the product.** Specs run the real CLI (`java -cp vicario-*-FAT.jar jpl.mipl.io.jConvertIIO ...`). Command lines and logs are attached to the report. `jConvertIIO` can exit 0 after an error, so `expectConverted()` also requires a non-empty output and a log free of exceptions.
- **Oracle.** `jpl.mipl.io.testsupport.ImageProbe` (in `src/test/java`) decodes any readable image and reports its dimensions, data type, statistics and a format-independent `pixelSha256`. Lossless conversions must keep the hash; lossy ones are compared by statistics. A contrast-stretched PNG preview of every image is attached to the report.
- **Unit tests in the report.** `features/junit.spec.ts` imports `target/surefire-reports`, one report entry per JUnit test, grouped under the feature whose `junit:` list names the class (an unlisted class fails).
- **Synthetic data.** `jpl.mipl.io.testsupport.SyntheticGen` replaces VICAR `gen`: every data type × organization, plus the legacy 1×1024 / 1024×1 / REAL 100×100 cases.
- **Public data.** [`tests/e2e/data/manifest.json`](../tests/e2e/data/manifest.json) pins every downloaded file by URL, SHA-256 and license. `scripts/fetch-test-data.mjs` refuses any of the following:
  - unpinned files
  - non-HTTPS URLs
  - hosts outside the public allowlist: the PDS Imaging Node archive, pds.nasa.gov, the PDS Small Bodies Node, and GitHub raw content pinned to a commit of GDAL or astropy-data

  Missing or altered data fails the run; it is never skipped.
- **Goldens.** `tests/e2e/goldens/goldens.json` records the pixel hash of each public product. Regenerate with `npm run goldens:update` and say why in the PR.
- **Known failures.** `knownFailure('UNFILED-3' | 'IDS-8497', why)` marks a test as expected to fail. It shows in the report and the job summary, and turns red once the bug is fixed, so the marker gets removed with the fix.

## Data sensitivity

The public workflow may only use publicly released data and generic paths. `tests/e2e/scripts/check-data-sensitivity.sh` (the `data-guard` check) fails on any of these:
- `/project/`, `/home/` or `/Users/` paths
- internal runners
- Artifactory
- `*.jpl.nasa.gov` hosts other than the public `planetarydata.jpl.nasa.gov`
- a tracked `TESTING/` directory
- a manifest URL outside the allowlist

The legacy `TESTING/` area (internal paths and data) is git-ignored and must never be committed. Its `tstjConvertIIO.csh` cases are ported in F01/F03/F04/F10, using public stand-ins for the internal inputs.

## Adding tests

- **New capability or keyword:** add or extend a feature in `features.yml`, then add tests to its spec (nominal and off-nominal).
- **Bug fix:** add a test that fails without the fix, with `issue('IDS-NNNN', ...)`. If the test documents a bug that is not fixed yet, use `knownFailure`.
- **New public data:**
  1. Add a manifest entry with `"sha256": null` and the license.
  2. Run `npm run data:pin`.
  3. Review the diff and commit `manifest.json` and `manifest.sha256`.

See [.github/project-requirements/criteria.md](../.github/project-requirements/criteria.md) for which tests a change is expected to touch.

## CI and reports

| Workflow | Trigger | Jobs |
|---|---|---|
| `ci.yml` | pull requests to `main`/`develop`; called by `release.yml` on push | `junit`, `e2e-fast`, `data-guard` |
| `nightly.yml` | 07:00 UTC daily, release published, manual | `e2e-full` |
| `release.yml` | push to `main`/`develop` | `ci`, then build, release, publish |

Each run uploads `playwright-report-<tier>` (HTML report including the JUnit results, plus JUnit/JSON result files), kept for **5 days**. GitHub serves artifacts as zip downloads: unzip and open `playwright-report/index.html`, or run `npx playwright show-report <folder>`. The job summary shows a pass/fail/known-failure table per feature.

## Branch protection

A repository admin enables the gate once. Under Settings → Branches (or rulesets), protect `main` and `develop` with:
- "Require status checks to pass": `junit`, `e2e-fast`, `data-guard`
- "Require branches to be up to date"

The equivalent API call:

```bash
for b in main develop; do
  gh api -X PUT "repos/NASA-AMMOS/vicario/branches/$b/protection" --input - <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["junit", "e2e-fast", "data-guard"] },
  "enforce_admins": false,
  "required_pull_request_reviews": { "required_approving_review_count": 1 },
  "restrictions": null
}
JSON
done
```

The nightly full tier is deliberately not required.
