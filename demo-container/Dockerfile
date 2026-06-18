# Vicario Demo + Smoke-Test Container
#
# Pulls a published vicario artifact from Artifactory (or a direct URL) and
# runs a suite of demos against real sample files (VICAR, PDS4, FITS) — both
# CLI and Swing GUI (under xvfb). Intended for local developer use to validate
# what would actually be deployed to other users.
#
# Build:
#   docker build -t vicario-demo -f demo-container/Dockerfile .
#
# Run (see demo-container/README.md for full usage):
#   docker run --rm \
#     -e VICARIO_COORDS=gov.nasa.jpl.ammos.ids:vicario:1.2.3:jar:FAT \
#     -v ~/.m2/settings.xml:/root/.m2/settings.xml:ro \
#     vicario-demo
FROM --platform=linux/amd64 eclipse-temurin:17-jre

RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        maven \
        curl \
        unzip \
        ca-certificates \
        xvfb \
        imagemagick \
        x11-apps \
        libxext6 \
        libxrender1 \
        libxtst6 \
        libxi6 \
        libxrandr2 \
        xauth \
    && apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /opt/vicario/samples/pds4 \
             /opt/vicario/samples/fits \
             /opt/vicario/demos \
             /opt/vicario/out

# Bundled VICAR sample — offline fallback. Always works with no network.
COPY src/main/scripts/LabelocityDummyImage.VIC /opt/vicario/samples/LabelocityDummyImage.VIC

# Public PDS4 example bundle (NASA PDS, PDS4 Build 15.1 / v1.24.0.0, June 2025).
# Source: https://pds.nasa.gov/datastandards/documents/examples/
RUN curl -fsSL --retry 3 \
        "https://pds.nasa.gov/data/pds4/examples/v1/DPH_Examples_V12400.zip" \
        -o /tmp/pds4-examples.zip && \
    unzip -q /tmp/pds4-examples.zip -d /opt/vicario/samples/pds4/ && \
    rm -f /tmp/pds4-examples.zip

# Public FITS sample — astropy's Horsehead Nebula tutorial image.
# Fetched from the astropy-data GitHub mirror because data.astropy.org is
# frequently unreachable; same file, served from the gh-pages branch.
# Upstream: https://github.com/astropy/astropy-data/tree/gh-pages/tutorials/FITS-images
RUN curl -fsSL --retry 3 \
        "https://raw.githubusercontent.com/astropy/astropy-data/gh-pages/tutorials/FITS-images/HorseHead.fits" \
        -o /opt/vicario/samples/fits/HorseHead.fits

COPY demo-container/entrypoint.sh /opt/vicario/entrypoint.sh
COPY demo-container/demos/ /opt/vicario/demos/
COPY demo-container/samples/manifest.json /opt/vicario/samples/manifest.json

RUN chmod +x /opt/vicario/entrypoint.sh /opt/vicario/demos/*.sh

WORKDIR /opt/vicario
ENTRYPOINT ["/opt/vicario/entrypoint.sh"]
