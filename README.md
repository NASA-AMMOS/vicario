# vicario

Image Format Translation Tool is a software application and libraries to transform from one image data format to another, while preserving meta-data content.

## Building and Installing

### Installing Artifacts Locally:
- mvn -U clean install 

### Generating and Installing Uber JAR (aka Fat JAR):
- mvn -U -Pshade clean install  # installs both a "fat" and "skinny" jar using the shade profile

### Generating and Installing Source JARs:
- mvn -U -Dmaven.source.skip=false clean install

### Running Unit Tests
- mvn -U clean test

## Releasing Development and Production Builds

### Release 'SNAPSHOT' build for development testing
- Create a [Pull Request](https://github.com/NASA-AMMOS/vicario/compare) to the develop branch
- Increment the `semver` variable in the POM immediately to the next version, e.g. 2.0.1 -> 2.0.2 (or otherwise appropriate for expected major/minor revisions).

### Publish software to the artifact repository
(**NOTE:** For publication, the [Semantic Version](https://semver.org/) must be revved by updating the `semver` property in the POM, if it has not been incremented already. If the Semantic Version is not incremented a release will fail.) 
- Create a [Pull Request](https://github.com/NASA-AMMOS/vicario/compare) to the main branch
