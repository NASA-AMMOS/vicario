# Agent instructions for vicario

vicario is a Java image I/O library and the `jConvertIIO` command-line converter for planetary formats (VICAR, PDS3, PDS4, ISIS, FITS). These instructions apply to AI coding agents and people alike.

## Build and test

```bash
mvn -B -P shade package test-compile                  # FAT jar, JUnit tests, test support classes
cd tests/e2e && npm ci && npm run data:fast           # once: test dependencies and public test data
npx playwright test --project fast                    # feature tests (the required PR check)
npx playwright test --project full                    # everything, incl. large products (npm run data:full first)
```

The Python script tests need `lxml`; set `VICARIO_PYTHON=/path/to/python` if the default `python3` lacks it. Run a single feature with `--grep @<feature-id>`.

## Every change keeps the tests up to date

Read [docs/TESTING.md](docs/TESTING.md) ("Adding tests") before writing tests. Rules:

- **New code needs tests in the same change.**
  - New behaviour, keywords or formats get a `@nominal` test and an `@off-nominal` test.
  - The spec is the one [.github/project-requirements/criteria.md](.github/project-requirements/criteria.md) lists for the area you changed.
  - New behaviour gets a feature entry in `tests/e2e/features.yml`.
- **Every bug fix gets a regression test.**
  - It fails without the fix and passes with it, tagged `@regression`, with `issue('IDS-NNNN', ...)`.
  - Confirm it fails before the fix. If a `knownFailure` covered the bug, remove the marker.
- **Bugs found but not fixed** get a reproducing test marked `knownFailure('IDS-NNNN' or 'UNFILED-N', why)`. Never delete or skip a failing test to make the suite pass.
- **Every test has `about(description, ...scopes)`.**
  - The description says what it does and what makes it pass ("Does X. Passes when Y.").
  - Scope tags come from `SCOPES` in `tests/e2e/support/features.ts`.
  - The description becomes the test procedure in the published report, so keep it accurate when you change a test.
- **Check content, not just exit codes.** `jConvertIIO` can exit 0 after an error. Compare pixels (`expectSamePixels`, `support/synthetic.ts`, goldens) and labels (`support/labels.ts`).
- **JUnit classes** go under the owning feature's `junit:` list in `features.yml`.
- **Goldens** (`tests/e2e/goldens/goldens.json`) change only with a stated reason.

## Data sensitivity (blocking)

This is a public NASA repository with public CI:
- **No internal paths or hosts:** never add JPL-internal paths (`/project/...`, home directories), hosts, runners, Artifactory URLs or internal data to code, tests, workflows or docs.
- **Test data:** only publicly released data, pinned by URL, SHA-256 and license in `tests/e2e/data/manifest.json`.
- **Legacy `TESTING/` directory:** it is internal; never commit it or copy data from it.

The `data-guard` check enforces the mechanical part.

## Docs parity

User-visible changes update the docs in the same change:
- **New or changed `jConvertIIO` keywords:** the HELP text in `jConvertIIO.java` and `README.md`.
- **Testing changes:** `docs/TESTING.md`.

## Before finishing

- **Run the suites:** `mvn -B test` and `npx playwright test --project fast`. Both must pass, or the only failures are documented known issues.
- **Read your tests:** open `tests/e2e/report/procedures.html` and check they read well.
- **Do not edit** `.github/workflows/*` permissions or the required checks (`junit`, `e2e-fast`, `data-guard`) without being asked.
