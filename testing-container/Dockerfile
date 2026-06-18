# Vicario Testing Container - Java 17 JRE (linux/amd64)
# Packages pre-built artifacts from the devcontainer build into a lightweight
# Java 17 runtime for testing. No Maven or compiler needed.
#
# Prerequisites: Build the FAT JAR first in the devcontainer:
#   mvn clean package -Pshade
#
# Usage: ./testing-container/run.sh
FROM --platform=linux/amd64 eclipse-temurin:17-jre

# Install X11 libraries for Swing/AWT GUI components (JFrameJade, etc.)
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    x11-apps \
    libxext6 \
    libxrender1 \
    libxtst6 \
    libxi6 \
    libxrandr2 \
    xauth \
    && apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create application directory
RUN mkdir -p /opt/vicario/scripts /opt/vicario/xsl

# Copy pre-built FAT JAR (includes all dependencies)
# Main-Class is jpl.mipl.io.jConvertIIO (set by maven-shade-plugin)
COPY target/vicario-*-FAT.jar /opt/vicario/vicario.jar

# Copy and unpack scripts and XSL stylesheets
COPY target/vicario-*-scripts.tar.gz /tmp/scripts.tar.gz
COPY target/vicario-*-xsl.tar.gz /tmp/xsl.tar.gz
RUN tar xzf /tmp/scripts.tar.gz -C /opt/vicario/ && \
    tar xzf /tmp/xsl.tar.gz -C /opt/vicario/ && \
    rm -f /tmp/*.tar.gz

WORKDIR /opt/vicario

CMD ["/bin/bash"]
