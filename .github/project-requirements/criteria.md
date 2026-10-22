# Project requirements for vicario changes

Reviewers check every pull request against these three requirements. The automated part is enforced by the required checks `junit`, `e2e-fast` and `data-guard` (see [docs/TESTING.md](../../docs/TESTING.md)).

## 1. Documentation parity (blocking)

User-visible behaviour changes update the docs in the same PR:
- a new or changed `jConvertIIO` keyword updates the usage text in `jConvertIIO.java` and `README.md`;
- a new format, label type or stylesheet updates the feature description in `tests/e2e/features.yml`;
- a testing change updates `docs/TESTING.md`.

## 2. Public deployability (blocking)

The public repository and its workflows build and test anywhere:
- no JPL-internal paths (`/project/...`, home directories), hosts, runners or repositories in code, tests, workflows or docs;
- test data is publicly released, pinned in `tests/e2e/data/manifest.json` by URL, SHA-256 and license, and fetched only from the allowlisted public archives;
- nothing from the legacy `TESTING/` area is committed.

`data-guard` enforces the mechanical part; reviewers check the rest.

## 3. Test coverage (blocking)

- **Bug fix:** a test that fails without the fix, annotated with the ticket (`issue('IDS-NNNN', ...)`). If the fix removes a `knownFailure`, delete the marker.
- **New capability or keyword:** a nominal and an off-nominal test in the owning feature's spec.
- **Golden changes:** `tests/e2e/goldens/goldens.json` changes only with a stated reason in the PR description.

### Area changed → expected test location

| Area changed | Feature | Expected tests |
|---|---|---|
| `src/main/java/jpl/mipl/io/vicar/**` (VICAR I/O, labels) | F01, F02 | `tests/e2e/features/F01-vicar-io.spec.ts`; JUnit in `src/test/java/jpl/mipl/io/vicar/` |
| `plugins/PDS*`, `vicar/PDS*` (PDS3) | F03 | `F03-pds3.spec.ts`; `PDS3ObjectNameTest` |
| `src/main/resources/jpl/mipl/io/xsl/*.xsl`, `*Transcoder*` | F04 | `F04-xsl.spec.ts` (a new VicarToPDS stylesheet is picked up automatically) |
| `plugins/PDS4*`, `vicar/PDS4*` | F05, F06 | `F05-pds4.spec.ts` (tables: F06, planned) |
| `plugins/ISIS*`, `plugins/FITS*`, `plugins/Magellan*` (Mgn) | F07, F08, F09 | `F08-fits.spec.ts` (ISIS / Magellan: planned) |
| `jConvertIIO.java` FORMAT handling, writer selection | F10 | `F10-formats.spec.ts` |
| `OFORM` / `RESCALE` / `CLAMP` | F11 | `F11-data-types.spec.ts` |
| `SOURCE_REGION`, `SUBSAMPLING`, `BANDS`, `2RGB`, transparency | F12 | planned (M3): add `F12-*.spec.ts` with the change |
| `util/DOMutils*`, `util/TreeInfo*`, any XML parsing | F13 | `F13-xml-dom.spec.ts`; `DOMutilsXXETest` |
| `ARGFILE`, `PARALLEL_BATCH`, remote input | F14 | planned (M3) |
| `src/main/scripts/*.py` | F16 | `F16-python.spec.ts` |
| Velocity PDS4 label generation | X01 | excluded from public CI (non-public jar); use the internal reg_test scripts |
| `.github/workflows/**`, `tests/e2e/data/**` | — | `data-guard` passes; manifest entries pinned and licensed |
