#!/usr/bin/env bash
# Build and launch the Vicario testing container (Java 17, linux/amd64)
# Packages the locally-built FAT JAR into a lightweight runtime container.
#
# Usage:
#   ./testing-container/run.sh              # Launch with X11 forwarding
#   ./testing-container/run.sh --no-x11     # Launch without X11
#   ./testing-container/run.sh -- [args]    # Pass extra args to docker run
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
IMAGE_NAME="vicario-test:java17"

# Parse arguments
USE_X11=true
EXTRA_ARGS=()
while [[ $# -gt 0 ]]; do
    case "$1" in
        --no-x11)
            USE_X11=false
            shift
            ;;
        --)
            shift
            EXTRA_ARGS=("$@")
            break
            ;;
        *)
            EXTRA_ARGS+=("$1")
            shift
            ;;
    esac
done

# Check that the FAT JAR exists
FAT_JAR=$(find "$PROJECT_ROOT/target" -name "vicario-*-FAT.jar" 2>/dev/null | head -1)
if [[ -z "$FAT_JAR" ]]; then
    echo "ERROR: No FAT JAR found in target/"
    echo ""
    echo "Build it first in the devcontainer:"
    echo "  mvn clean package -Pshade"
    exit 1
fi

echo "Found FAT JAR: $(basename "$FAT_JAR")"

# Build the Docker image
echo "Building testing container..."
docker build --platform linux/amd64 \
    -t "$IMAGE_NAME" \
    -f "$SCRIPT_DIR/Dockerfile" \
    "$PROJECT_ROOT"

# Construct docker run command
DOCKER_ARGS=(
    --rm -it
    --platform linux/amd64
    -v "$PROJECT_ROOT:/workspace"
    -w /workspace
)

if [[ "$USE_X11" == true ]]; then
    echo ""
    echo "X11 forwarding enabled. Make sure XQuartz is running and you've run:"
    echo "  xhost +localhost"
    echo ""
    DOCKER_ARGS+=(-e "DISPLAY=host.docker.internal:0")
fi

# Add any extra args
if [[ ${#EXTRA_ARGS[@]} -gt 0 ]]; then
    DOCKER_ARGS+=("${EXTRA_ARGS[@]}")
fi

echo "Launching vicario-test:java17..."
echo "  Project mounted at /workspace"
echo ""
echo "  java -jar /opt/vicario/vicario.jar HELP           # CLI help"
echo "  java -jar /opt/vicario/vicario.jar INP=input.img   # Run conversion"
echo "  java -cp /opt/vicario/vicario.jar jpl.mipl.io.JFrameJade  # GUI (needs X11)"
echo ""

docker run "${DOCKER_ARGS[@]}" "$IMAGE_NAME"
