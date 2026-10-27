# Testing vicario

vicario has two test layers:

| Layer | Where | Runs |
|---|---|---|
| Unit tests (JUnit 4) | `src/test/java` | `mvn test` |
| Feature tests (Playwright Test driving `jConvertIIO`) | `tests/e2e` | fast tier on every PR; full tier on every push to `main`, nightly and on release (published to GitHub Pages) |

Both run in GitHub Actions. The fast tier and the unit tests are **required checks**: a pull request into `main` or `develop` cannot merge until they pass.

## Running locally

Prerequisites: JDK 17, Maven 3.9+, Node 20+, and Python 3 with `lxml` (for the label-script tests).

```bash
mvn -B -P shade package test-compile               # FAT jar, unit tests, ImageProbe / SyntheticGen
cd tests/e2e
npm ci
npm run data:fast                                  # or data:full
npx playwright test --project fast                 # or --project full
open report/index.html                             # feature overview; full Playwright report in report/playwright/
```

- **Python:** set `VICARIO_PYTHON=/path/to/python` if the default `python3` has no `lxml`.
- **JDK:** `JAVA_HOME` selects the JDK used for `jConvertIIO`.
- **Single feature:** `npx playwright test --grep @pds3` (each feature's id is its tag).
- **Deferred tests:** `VICARIO_RUN_DEFERRED=1 npx playwright test --project fast` also runs the tests marked `deferred(...)`, which are expected to fail.

## How the feature tests work

- **Feature registry.** [`tests/e2e/features.yml`](../tests/e2e/features.yml) lists every capability (`vicar-io`, `pds3`, `pds4-images`, `output-formats`, ...) with a name and description, its code paths, keywords, tickets and status (`active`, `planned` with a milestone, or `excluded` with a reason). `features/registry.spec.ts` fails if a spec has no feature, an active feature has no spec, or a manifest asset is unpinned or unused.
- **Specs.** One spec per feature in `tests/e2e/features/`. Each `test.describe` carries the feature tag and a tier tag (`@fast` or `@full`), so the HTML report groups results by feature. Specs import `test` and `expect` from `support/test.ts`, which adds a `source` annotation linking each test to its line on GitHub.
- **Describing tests.** Every test passes `about(description, ...scopes)` as its details:

  ```ts
  test('SOURCE_REGION running past the image edge is clipped, not an error', about(
    'Asks for a 20 x 20 region at (40,60) of the 48 x 64 image ... Passes when the output is clipped to 8 x 4 ...',
    '@off-nominal', '@regression',
  ), async ({}, testInfo) => { ... });
  ```

  - **The description** says what the test does and what makes it pass. It is plain text; `` `backticks` `` mark code. It appears as the "what it checks" annotation in the Playwright report and on the procedures page.
  - **The scope tags** say what kind of testing it is. They are defined in `SCOPES` in `support/features.ts`: `@nominal`, `@off-nominal`, `@malformed-input`, `@lossless`, `@mission-data`, `@regression`, `@security`, `@legacy`, `@suite` and `@unit`. Filter by one with `--grep @off-nominal`.
  - **Enforcement:** `registry.spec.ts` fails if any test lacks a description or a scope tag.
- **Running the product.** Specs run the real CLI (`java -cp vicario-*-FAT.jar jpl.mipl.io.jConvertIIO ...`). Command lines and logs are attached to the report. `jConvertIIO` can exit 0 after an error, so `expectConverted()` also requires a non-empty output and a log free of exceptions.
- **Oracle.** `jpl.mipl.io.testsupport.ImageProbe` (in `src/test/java`) decodes any readable image and reports its dimensions, data type, statistics and a format-independent `pixelSha256`. Lossless conversions must keep the hash; lossy ones are compared by statistics. A contrast-stretched PNG preview of every image is attached to the report.
- **Unit tests in the report.** `features/junit.spec.ts` imports `target/surefire-reports`, one report entry per JUnit test, grouped under the feature whose `junit:` list names the class (an unlisted class fails).
- **Synthetic data.** `jpl.mipl.io.testsupport.SyntheticGen` replaces VICAR `gen`: every data type × organization, plus the legacy 1×1024 / 1024×1 / REAL 100×100 cases.
- **Public data.** [`tests/e2e/data/manifest.json`](../tests/e2e/data/manifest.json) pins every downloaded file by URL, SHA-256 and license. `scripts/fetch-test-data.mjs` refuses any of the following:
  - unpinned files
  - non-HTTPS URLs
  - hosts outside the public allowlist: the PDS Imaging Node archive, pds.nasa.gov, the PDS Small Bodies and Geosciences Nodes, and GitHub raw content pinned to a commit of GDAL or astropy-data

  Missing or altered data fails the run; it is never skipped.
- **Goldens.** `tests/e2e/goldens/goldens.json` records the pixel hash of each public product. Regenerate with `npm run goldens:update` and say why in the PR.
- **Known failures.** `knownFailure('IDS-8497', why)` marks a test as expected to fail. Use it only for a bug that has a ticket or other record. It shows in the report and the job summary, and turns red once the bug is fixed, so the marker gets removed with the fix.
- **Deferred.** `deferred('REVIEW-16', why)` marks a reviewed bug or missing capability that we decided not to fix yet. The test still reproduces it, but is skipped by default and the report shows the reason. Run deferred tests with `VICARIO_RUN_DEFERRED=1`: they fail until the behaviour is fixed, and then the marker is removed.
- **Needs review.** `needsReview('REVIEW-3', why)` flags behaviour a test found that looks wrong but has no ticket or other record yet. The test fails as normal and the report marks it "needs review" until someone decides: a bug (ticket it, then fix it, or use `knownFailure` until it is fixed) or intended (correct the test and say why).

## Data sensitivity

The public workflow may only use publicly released data and generic paths. `tests/e2e/scripts/check-data-sensitivity.sh` (the `data-guard` check) fails on any of these:
- `/project/`, `/home/` or `/Users/` paths
- internal runners
- Artifactory
- `*.jpl.nasa.gov` hosts other than the public `planetarydata.jpl.nasa.gov`
- a tracked `TESTING/` directory
- a manifest URL outside the allowlist

The legacy `TESTING/` area (internal paths and data) is git-ignored and must never be committed. Its `tstjConvertIIO.csh` cases are ported in the `vicar-io`, `pds3`, `xsl-labels` and `output-formats` specs, using public stand-ins for the internal inputs.

## Adding tests

Every code change comes with tests, written in the same pull request. Which spec a change belongs in is listed in [criteria.md](../.github/project-requirements/criteria.md) ("Area changed → expected test location").

### What to write

| Change | Tests to add |
|---|---|
| New capability, keyword or format | A `@nominal` test that it works, and an `@off-nominal` test for bad or edge-case input. If it is new behaviour, add or extend a feature in `features.yml`. |
| Bug fix | A test that fails without the fix and passes with it, tagged `@regression`, with `issue('IDS-NNNN', 'what was wrong')`. If the bug had a `knownFailure` test, delete the marker: the test now passes and documents the fix. |
| Bug found but not fixed | A test that reproduces it. Without a ticket, mark it `needsReview('REVIEW-N', 'what fails')`: it fails visibly until reviewed. Once ticketed, `knownFailure('IDS-NNNN', 'what fails')`: it reports "expected to fail" until someone fixes the bug, then turns red so the marker gets removed. |
| Bug reviewed and deliberately left unfixed | A test that reproduces it, marked `deferred('REVIEW-N' or 'IDS-NNNN', 'why it is not fixed')`. It is skipped by default; `VICARIO_RUN_DEFERRED=1` runs it. |
| Java-level logic | A JUnit test in `src/test/java`. Add its class to the owning feature's `junit:` list in `features.yml`. |

### Anatomy of a test

```ts
import { expect, test } from '../support/test';          // not '@playwright/test': adds the source link
import { about, feature, issue } from '../support/features';
import { convert, expectConverted, probe } from '../support/run';

test.describe('Regions, subsampling and bands', feature('regions-bands'), () => {   // feature tag + @fast
  test('SOURCE_REGION running past the image edge is clipped, not an error', about(
    'Asks for a 20 x 20 region at (40,60) of the 48 x 64 image, which runs past both edges. '
      + 'Passes when the output is clipped to 8 x 4 with exactly those pixels, rather than an error.',
    '@off-nominal', '@regression',
  ), async ({}, testInfo) => {
    issue('IDS-7560', 'EOF exception when the region is not fully inside the image');
    const r = await convert(testInfo, SRC, 'region_edge.png', { format: 'png', SOURCE_REGION: '(40,60,20,20)' });
    expectConverted(r);                                   // exit 0, non-empty output, no exceptions in the log
    const p = await probe(testInfo, r.out);               // decode the output; preview attached to the report
    expect([p.width, p.height]).toEqual([8, 4]);
  });
});
```

- **`feature('<id>')`** on the `describe` tags the tests with their feature, so they are grouped and counted under it. Use `feature('<id>', 'full')` for tests that need the large downloads.
- **`about(description, ...scopes)`** is required (`registry.spec.ts` fails without it):
  - **Description:** one or two sentences, in the form "Does X. Passes when Y." It is plain text in the spec; `` `backticks` `` mark code.
  - **Scope tags:** one or more of the tags defined in `SCOPES` in `support/features.ts`.

  | Tag | Use for |
  |---|---|
  | `@nominal` | expected use with valid input |
  | `@off-nominal` | unsupported options, edge cases, invalid arguments |
  | `@malformed-input` | truncated, corrupt or hostile files |
  | `@lossless` | the output must have exactly the input pixels |
  | `@mission-data` | uses public PDS products |
  | `@regression` | guards a fixed bug |
  | `@security` | XXE, path traversal |
  | `@legacy` | ports a case from the old `tstjConvertIIO.csh` procedure |
  | `@suite` | checks the test suite itself |
  | `@unit` | imported JUnit results |
- **`issue(...)` / `knownFailure(...)`** attach the ticket.
- **Check content, not exit codes:** `jConvertIIO` can exit 0 after an error, so check the content. Compare pixels with `expectSamePixels` or the generator formula in `support/synthetic.ts`; check labels with `support/labels.ts`; for public products, compare against goldens with `expectGolden`.

### Where the description ends up

The description is plain text in the spec; nothing else feeds it. At the end of a run the reporter (`support/overview-reporter.ts`) reads each test's annotations and tags and writes them out in three places:
- **Playwright report:** shown as the "what it checks" and "source" annotations (plain text, with links).
- **`report/procedures.html`:** rendered as HTML, with code formatting, scope chips, the result and links.
- **Report overview and website:** counted for its feature, and listed in the feature's drop-down test table, which links to the test's procedure.

Changing the description in the spec changes all three on the next run.

### New public data

1. Add a manifest entry with `"sha256": null` and the license.
2. Run `npm run data:pin`.
3. Review the diff and commit `manifest.json` and `manifest.sha256`.

Only publicly released data from the allowlisted archives (see [Data sensitivity](#data-sensitivity)).

### Before opening the pull request

```bash
mvn -B -P shade package test-compile
cd tests/e2e && npx playwright test --project fast   # and --project full if you touched full-tier features
open report/procedures.html                           # check your tests read well
```

## CI and reports

| Workflow | Trigger | Jobs |
|---|---|---|
| `ci.yml` | pull requests to `main`/`develop`; called by `release.yml` on push | `junit`, `e2e-fast`, `data-guard` |
| `publish.yml` | push to `main`, 07:00 UTC daily, release published, manual | `e2e-full`, then `deploy` to GitHub Pages |
| `release.yml` | push to `main`/`develop` | `ci`, then build, release, publish |
| `security-scan.yml` | pull requests to `main`/`develop`, push to `main`, manual | CodeQL (Java, Python, workflows) and SonarQube Cloud analysis; see [Security scanning](#security-scanning) |

The report has three parts:
- **`report/index.html`**, the feature overview: each feature's description, status and pass/fail counts, a gallery of image previews from its tests, the failures (with any "needs review" note), ticketed known failures grouped by ticket when there are any, and the features not yet automated. Each feature and image links into the full report.
- **`report/procedures.html`**, the test procedures: every test grouped by feature, with its description, scope tags, issue notes and latest result, plus links to its run details and its source on GitHub. A scope legend at the top filters the list.
- **`report/playwright/`**, the Playwright HTML report: every test with its command line, logs, label text and image previews, including the JUnit results.

Where to find it:
- **Pull requests:** `ci.yml` uploads it as the `feature-report-fast` artifact, kept for **5 days**. GitHub serves artifacts as zip downloads, so unzip it and open `report/index.html`. The job summary also shows the feature table inline.
- **`main`:** `publish.yml` runs the full tier on every push (and nightly), then publishes a project home page with the latest report to GitHub Pages at <https://nasa-ammos.github.io/vicario/>. The site is published even when tests fail, so it always shows the current state. Pages must be set to "GitHub Actions" as its source (Settings → Pages).

## Security scanning

`.github/workflows/security-scan.yml` follows the AMMOS scanning guide, the same pipeline as tig:
1. **CodeQL** (`security-extended` queries, configured in `.github/codeql/codeql-config.yml`) analyzes the Java code from a traced Maven build, the Python scripts and the workflows.
2. **nasa-scrub** reformats the reports.
3. **`.github/scripts/fix_sarif_paths.py`** repairs the file paths and rule severities that scrub degrades.
4. **The SonarQube Cloud scanner** imports the repaired reports along with its own Java and Python analysis (`sonar-project.properties`).

### Coverage

SonarQube's coverage figure counts both suites, measured by JaCoCo (the `coverage` Maven profile):
- **JUnit tests** run with the JaCoCo agent through Maven, writing `target/jacoco.exec`.
- **Feature tests** run with the agent attached to every vicario process they start (jConvertIIO, ExtractTableJPL, TreeInfo). When `VICARIO_JACOCO_AGENT` is set, `support/env.ts` adds the agent to `PRODUCT_JAVA` and each run appends to `target/jacoco-e2e.exec`. The test oracles (ImageProbe, SyntheticGen) run without it, so only code the product itself executes counts.

Both are merged into `target/site/jacoco/` (`jacoco.xml` for SonarQube, `index.html` to browse). To produce the same report locally:

```bash
mvn -B -P coverage,shade -Dmaven.test.failure.ignore=true package test-compile
cd tests/e2e && VICARIO_JACOCO_AGENT=../../target/jacoco-agent/jacocoagent.jar npx playwright test --project full
cd ../.. && mvn -B -P coverage jacoco:merge@merge-all jacoco:report@report-all
open target/site/jacoco/index.html
```

A new spec that starts vicario directly, rather than through `convert()`, should use `PRODUCT_JAVA` instead of `JAVA` so its coverage counts. `run()` decodes stdout as UTF-8; pass `binary: true` when a command writes binary data to stdout (such as `OUT=-`) and read the bytes from `stdoutBytes`.

Results appear on the [SonarQube Cloud project](https://sonarcloud.io/project/overview?id=NASA-AMMOS_vicario). The raw and repaired reports are kept as the `codeql-artifacts` artifact for 14 days.

Setup, once, by an admin:
- Add the `SONAR_TOKEN` repository secret.
- In SonarQube Cloud, set the project's Analysis Method to CI-based, turning off Automatic Analysis. A CI scan is rejected while Automatic Analysis is on.

The `SonarQube` job is not a required check yet.

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

The full tier (`publish.yml`) is deliberately not a required check.
