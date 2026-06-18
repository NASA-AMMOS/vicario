# Vicario Demo + Smoke-Test Container

A standalone container that pulls a **published** vicario artifact (from
Artifactory via Maven coordinates, or a direct URL) and runs it against a set
of real sample files in VICAR, PDS4, and FITS formats. Both the `jConvertIIO`
CLI and the `JFrameJade` Swing GUI are exercised — the GUI path runs under
Xvfb inside the container so you don't need XQuartz or any X11 setup on your
host.

Use this to validate that what's deployed to Artifactory actually works for
downstream users, or as runnable documentation ("here's vicario converting
real data, today, against the latest release").

This is a **local developer tool**, not a CI gate. It is not part of the
Maven build.

## What's in the image

All sample files are baked into the image at build time. `docker run` is
offline-safe (the only network traffic at run time is the one-shot artifact
fetch, if any).

| Demo | Format path | Sample |
|---|---|---|
| `01-vicar-to-pds4` | VICAR → PDS4 label | Bundled `LabelocityDummyImage.VIC` from `src/main/scripts/` |
| `02-pds4-read` | PDS4 → VICAR | NASA PDS `DPH_Examples_V12400.zip` (PDS4 Build 15.1, June 2025) |
| `03-fits-to-vicar` | FITS → VICAR | astropy's `HorseHead.fits` (Horsehead Nebula tutorial sample) |
| `04-gui-jframejade` | Swing GUI smoke | `JFrameJade` under Xvfb, proves-of-life screenshot + 5s liveness check |

Each demo uses **structural assertions** (output exists, parses as XML,
starts with `LBLSIZE=`, etc.) rather than byte-compare goldens — so the
container works across multiple artifact versions without per-version fixture
maintenance.

## Sample attribution

| Sample | Source | License |
|---|---|---|
| `LabelocityDummyImage.VIC` | `src/main/scripts/LabelocityDummyImage.VIC` (vicario repo) | Part of vicario — Caltech/NASA JPL, see `pom.xml` header |
| `DPH_Examples_V12400.zip` | <https://pds.nasa.gov/data/pds4/examples/v1/DPH_Examples_V12400.zip> | NASA public domain (17 U.S.C. 105) |
| `HorseHead.fits` | <https://raw.githubusercontent.com/astropy/astropy-data/gh-pages/tutorials/FITS-images/HorseHead.fits> | Public, astropy tutorial sample |

Canonical manifest lives at `samples/manifest.json`.

## Build

```bash
# From the project root:
docker build --platform linux/amd64 -t vicario-demo -f demo-container/Dockerfile .
```

The build downloads the PDS4 and FITS samples once and caches them in the
image — subsequent builds are offline unless you bust the cache layer.

## Run

You **must** tell the container which artifact to exercise. Two options,
configurable per `docker run` invocation:

### Option A: Maven coordinates (Artifactory)

Mount your `~/.m2/settings.xml` so the container reuses your existing
Artifactory credentials — no env vars with secrets needed.

```bash
docker run --rm --platform linux/amd64 \
    -e VICARIO_COORDS=gov.nasa.jpl.ammos.ids:vicario:1.2.3:jar:FAT \
    -v ~/.m2/settings.xml:/root/.m2/settings.xml:ro \
    -v vicario-demo-out:/opt/vicario/out \
    vicario-demo
```

The coordinate form is `groupId:artifactId:version[:packaging[:classifier]]`.
For the shaded / fat JAR you want `:jar:FAT` (this matches
`maven-shade-plugin`'s `<shadedClassifierName>FAT</shadedClassifierName>` in
`pom.xml`).

If your `settings.xml` doesn't already declare the Artifactory repo as a
mirror, pass it explicitly:

```bash
    -e VICARIO_REPO_URL=https://artifactory.example.com/artifactory/libs-snapshot-local
```

### Option B: Direct JAR URL

Skip Maven resolution entirely and point at any JAR — useful for
ad-hoc testing of a specific PR build or a file hosted anywhere:

```bash
docker run --rm --platform linux/amd64 \
    -e VICARIO_JAR_URL=https://artifactory.example.com/artifactory/.../vicario-1.2.4-SNAPSHOT-FAT.jar \
    -v vicario-demo-out:/opt/vicario/out \
    vicario-demo
```

If both `VICARIO_JAR_URL` and `VICARIO_COORDS` are set, the URL wins.

### Running a subset of demos

```bash
# CLI demos only (skip the Swing GUI)
docker run --rm -e VICARIO_JAR_URL=... -e DEMO_FILTER='0[1-3]-*.sh' vicario-demo

# Only the GUI demo
docker run --rm -e VICARIO_JAR_URL=... -e DEMO_FILTER='04-*.sh' vicario-demo
```

### Collecting demo outputs

Mount a host directory or named volume at `/opt/vicario/out` to keep the
converted files and the JFrameJade screenshot after the container exits:

```bash
docker run --rm -v "$PWD/demo-out:/opt/vicario/out" ... vicario-demo
ls demo-out/
# 01-LabelocityDummyImage.xml
# 02-<pds4-sample>.vic
# 03-HorseHead.vic
# 04-jframejade.png
# 04-jframejade.log
```

## What each demo does

### 01 — VICAR → PDS4 detached label

Runs:

```
java -Djava.awt.headless=true -jar vicario.jar \
    INP=LabelocityDummyImage.VIC OUT=01-LabelocityDummyImage.xml \
    FORMAT=pds PDS_LABEL_TYPE=PDS4 \
    PDS_DETACHED_LABEL=true PDS_DETACHED_ONLY=true
```

Asserts the output exists, begins with `<?xml`, and contains a PDS4
`Product_*` root element. Mirrors the conversion pattern used by the existing
`src/main/scripts/reg_test/` regression test, so we know it's a supported
code path.

### 02 — PDS4 → VICAR

Walks `/opt/vicario/samples/pds4/` (extracted from `DPH_Examples_V12400.zip`),
picks the first `.xml` label that has an adjacent image data file, and runs:

```
java -jar vicario.jar INP=<label.xml> OUT=<out>.vic FORMAT=vicar
```

Asserts the output starts with the VICAR `LBLSIZE=` header. Skips cleanly if
the example bundle didn't contain a label with an adjacent data file (rather
than failing the suite).

### 03 — FITS → VICAR

Runs the same conversion against `HorseHead.fits`. Same `LBLSIZE=` assertion.

### 04 — Swing GUI (JFrameJade) under Xvfb

```
xvfb-run java -cp vicario.jar jpl.mipl.io.JFrameJade LabelocityDummyImage.VIC
```

Launches the Swing frame on a virtual X display inside the container, waits
5 seconds, and checks the process is still alive (Swing init didn't throw).
Grabs a screenshot of the virtual root window via ImageMagick `import` and
saves it to `04-jframejade.png` as proof-of-life. Kills the process on the
way out.

No host X11 setup is needed. Contrast with `testing-container/README.md`
which requires XQuartz + `xhost +localhost` on the host.

## Reproducing a demo outside the container

Each demo is a plain shell script under `demos/`. To run one by hand:

```bash
URL="https://raw.githubusercontent.com/astropy/astropy-data/gh-pages"
curl -LO "$URL/tutorials/FITS-images/HorseHead.fits"
java -jar vicario-FAT.jar INP=HorseHead.fits OUT=HorseHead.vic FORMAT=vicar
head -c 32 HorseHead.vic   # should show LBLSIZE=...
```

The idea is that the container is runnable documentation: read a demo
script, copy the command, run it yourself.

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `ERROR: No artifact source set` | Set `VICARIO_JAR_URL` or `VICARIO_COORDS`. |
| `mvn dependency:get failed` | `settings.xml` isn't mounted, or the repo in it doesn't serve the requested coords. Try `VICARIO_REPO_URL=<explicit URL>` or use `VICARIO_JAR_URL` as a fallback. |
| `java -jar ... HELP did not succeed` | The resolved file isn't a valid shaded vicario JAR — double-check you asked for the `:FAT` classifier. |
| `02-pds4-read` reports SKIP | The PDS4 example bundle was downloaded but didn't contain a label with an adjacent data file. Not a failure; other demos still run. |
| `04-gui-jframejade` FAILs fast | Read `out/04-jframejade.log` — typically a `NoClassDefFoundError` or a missing native library means the published JAR is broken for GUI use. |
| Apple Silicon slow | Expected — the image is `linux/amd64` via Rosetta, same as `testing-container/`. |
