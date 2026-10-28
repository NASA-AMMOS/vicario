# vicario

[![Maven Central](https://img.shields.io/maven-central/v/gov.nasa.jpl.ammos.ids/vicario)](https://central.sonatype.com/artifact/gov.nasa.jpl.ammos.ids/vicario)

Image Format Translation Tool is a software application and libraries to transform from one image data format to another, while preserving meta-data content.

## Using vicario

vicario is published to [Maven Central](https://central.sonatype.com/artifact/gov.nasa.jpl.ammos.ids/vicario). Replace the version below with the latest shown in the badge above.

Maven:
```xml
<dependency>
  <groupId>gov.nasa.jpl.ammos.ids</groupId>
  <artifactId>vicario</artifactId>
  <version>2.7.2</version>
</dependency>
```

Gradle:
```kotlin
implementation("gov.nasa.jpl.ammos.ids:vicario:2.7.2")
```

## Command line: jConvertIIO

The FAT jar (see below) runs the converter. Arguments are `KEYWORD=value` pairs; keyword names are not case-sensitive, and a true/false keyword given alone means true. `HELP` prints every keyword.

```bash
java -jar vicario-<version>-FAT.jar inp=<input> out=<output> format=<format> [KEYWORD=value ...]
java -jar vicario-<version>-FAT.jar inp=image.vic out=image.png format=png
java -jar vicario-<version>-FAT.jar inp=image.vic out=- format=png SILENT | convert - image.jpg
```

Output and messages:

| Keyword | Meaning |
|---|---|
| `OUT=-` | Write the image to stdout, for piping to another program. `FORMAT` is required, messages go to stderr, and formats that need a second file (detached labels) are not supported. Not allowed on an `ARGFILE` batch line. |
| `SILENT` | Print nothing to stdout (errors still go to stderr). Useful with `OUT=-`. |
| `FORMAT` | Must name a registered image writer; any other name fails with an error. `jfif` uses the JPEG writer. `raw` writes a headerless file of exactly width x height x bands samples, band sequential, big-endian. `pnm` writes binary PGM (1 band) or PPM (3 bands), 8 or 16 bit. |
| `ARGFILE=f`, `PARALLEL_BATCH=N` | Run one conversion per line of `f`, optionally `N` at a time (`AVAILABLE_CORES` for one per core). |

Image processing:

| Keyword | Meaning |
|---|---|
| `CROP=(x,y,width,height)` | Crop after the image is read. `CROP=(x,y)` crops from `x,y` to the image edge; an area past the edge is clipped. |
| `OFORM` | Output data type (`BYTE`, `HALF`, `FULL`, `REAL`, `DOUB`, ...). The automatic stretch to the output range applies only when the type narrows (e.g. `HALF` or `REAL` to `BYTE`); the same or a wider type keeps the values unless `VALID_MINIMUM`/`VALID_MAXIMUM` or `RESCALE_CONSTANT`/`RESCALE_OFFSET` are given. |
| `BANDS=(2,1,0)`, `READ_BANDS=0,1,2` | Select or reorder bands after or while reading (bands start at 0). |

Labels and binary data:

| Keyword | Meaning |
|---|---|
| `PDS_FILENAME_IN_LABEL` | With `FORMAT=pds`, the data pointers name the output file: `^IMAGE = ("out.pds",n)` instead of `^IMAGE = n`. Default false. `PDS_FILENAME` is the older spelling. |
| `KEEP_LINE_PREFIX` | Write the input's binary line prefixes (`NBB`) to VICAR or PDS output. Default true. The prefixes are dropped, with a warning, when the output has a different number of lines or bands, or when `BANDS`/`READ_BANDS` moves a band to a new position. |
| `ADD_BINARY_HEADER` | Write the input's binary header (`NLB` records) to VICAR or PDS output. Default false. If the record size changes, each record is zero-padded, cut if only zero bytes are cut, or re-blocked. |

PDS4 tables (exported as text to `OUT`):

| Keyword | Meaning |
|---|---|
| `PDS4_TABLE_OUTPUT_FORMAT=csv\|fixed-width` | Output layout; default fixed-width. `PDS4_TABLE_OUPUT_FORMAT` is the older spelling. |
| `PDS4_TABLE_INDEX=n` | Which table to export, from 1 (default 1). |
| `TABLE_FIELD_SEPARATOR=c` | Field separator; default a comma for csv, a space for fixed-width. |

## Building and Installing

### Installing Artifacts Locally:
- mvn -U clean install 

### Generating and Installing Uber JAR (aka Fat JAR):
- mvn -U -Pshade clean install  # installs both a "fat" and "skinny" jar using the shade profile

### Generating and Installing Source JARs:
- mvn -U -Dmaven.source.skip=false clean install

### Running Tests
- Unit tests: `mvn -U clean test`
- Feature tests (Playwright report, public test data): see [docs/TESTING.md](docs/TESTING.md)
- Adding or changing code? Add tests with it: see "Adding tests" in [docs/TESTING.md](docs/TESTING.md). Instructions for AI coding agents are in [AGENTS.md](AGENTS.md).

## Releasing Development and Production Builds

### Release 'SNAPSHOT' build for development testing
- Create a [Pull Request](https://github.com/NASA-AMMOS/vicario/compare) to the develop branch
- Increment the `semver` variable in the POM immediately to the next version, e.g. 2.0.1 -> 2.0.2 (or otherwise appropriate for expected major/minor revisions).

### Publish software to the artifact repository
(**NOTE:** For publication, the [Semantic Version](https://semver.org/) must be revved by updating the `semver` property in the POM, if it has not been incremented already. If the Semantic Version is not incremented a release will fail.) 
- Create a [Pull Request](https://github.com/NASA-AMMOS/vicario/compare) to the main branch
