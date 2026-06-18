# Vicario Testing Container (Java 17)

A lightweight Java 17 runtime container that packages pre-built vicario artifacts
from your local devcontainer build. No Artifactory access needed — everything
comes from your local `target/` directory.

This lets you test a fully packaged version of vicario under Java 17 without
pushing to Artifactory first.

## Prerequisites

1. Build the FAT JAR in the devcontainer (or any environment with Maven):

   ```bash
   mvn clean package -Pshade
   ```

   This produces `target/vicario-*-FAT.jar` (standalone JAR with all dependencies),
   along with the scripts and XSL archives.

2. Docker Desktop or Colima running on your host.

3. For GUI testing: XQuartz installed and configured (see below).

## Usage

### Quick Start

```bash
# From the project root:
./testing-container/run.sh
```

This builds the Docker image and drops you into a bash shell inside the container.

### Inside the Container

```bash
# Check Java version
java -version                    # Should show Java 17

# Run CLI
java -jar vicario.jar --help
java -jar vicario.jar -format VICAR input.img output.vic
java -jar vicario.jar -format PDS4 input.vic output.xml

# Run GUI image viewer (requires X11 forwarding)
java -cp vicario.jar jpl.mipl.io.JFrameJade

# Scripts and XSL are in /opt/vicario/scripts/ and /opt/vicario/xsl/
ls scripts/
ls xsl/
```

### Without X11

If you don't need GUI support:

```bash
./testing-container/run.sh --no-x11
```

### Pass Extra Docker Args

```bash
# Mount a local data directory into the container
./testing-container/run.sh -- -v /path/to/images:/data

# Inside container:
java -jar vicario.jar -format VICAR /data/input.img /data/output.vic
```

### Manual Docker Commands

If you prefer not to use the script:

```bash
# Build
docker build --platform linux/amd64 \
    -t vicario-test:java17 \
    -f testing-container/Dockerfile .

# Run with X11
docker run --rm -it --platform linux/amd64 \
    -e DISPLAY=host.docker.internal:0 \
    vicario-test:java17

# Run with a data volume
docker run --rm -it --platform linux/amd64 \
    -e DISPLAY=host.docker.internal:0 \
    -v /path/to/images:/data \
    vicario-test:java17
```

## X11 Forwarding (GUI Support)

Vicario includes Swing/AWT GUI components (JFrameJade image viewer). To display
GUI windows on your Mac:

### One-Time Setup

1. Install XQuartz: `brew install --cask xquartz`
2. Log out and log back in
3. Open XQuartz > Preferences > Security > Enable "Allow connections from network clients"
4. Restart XQuartz

### Before Each Session

```bash
# On your Mac (not inside the container):
xhost +localhost
```

### Verify

Inside the container:

```bash
xeyes    # Should display a window on your Mac
```

### Troubleshooting

| Problem | Solution |
|---------|----------|
| "Cannot open display" | Run `xhost +localhost` on host. Check `echo $DISPLAY` shows `host.docker.internal:0` |
| XQuartz not responding | Quit XQuartz, restart, re-run `xhost +localhost` |
| No FAT JAR found | Run `mvn clean package -Pshade` in the devcontainer first |
| Slow on Apple Silicon | Expected — container runs as linux/amd64 via Rosetta translation |
