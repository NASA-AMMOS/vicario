# Vicario Development Container - Java 21 (targets Java 8 bytecode)
# Base: Maven 3.9+ with Eclipse Temurin JDK 21 (LTS)
# Java 21 provides full VS Code Java extension support (JDT Language Server,
# debugging, hot code replace). Maven compiler plugin targets Java 8 bytecode.
FROM --platform=linux/amd64 maven:3.9-eclipse-temurin-21

# Install essential development tools
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    git \
    wget \
    curl \
    vim \
    procps \
    netcat-openbsd \
    sudo \
    openssh-client \
    ca-certificates \
    unzip \
    jq \
    # X11 libraries for Swing/AWT GUI components (JFrameJade, etc.)
    x11-apps \
    libxext6 \
    libxrender1 \
    libxtst6 \
    libxi6 \
    libxrandr2 \
    xauth \
    && apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI
RUN curl -fsSL https://claude.ai/install.sh | bash

# Configure sudo for passwordless access (dev environment only)
RUN echo "root ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/root && \
    chmod 0440 /etc/sudoers.d/root

# Set up environment
ENV JAVA_HOME=/opt/java/openjdk
ENV MAVEN_HOME=/usr/share/maven
ENV PATH="${MAVEN_HOME}/bin:${JAVA_HOME}/bin:${PATH}"

# Create workspace and Maven directories
RUN mkdir -p /workspace /root/.m2

# Set working directory
WORKDIR /workspace

# Expose debug ports
# 5005: Java Debug (Primary)
# 5006: Java Debug (Alternate)
EXPOSE 5005 5006

CMD ["/bin/bash"]
