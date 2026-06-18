#!/usr/bin/env bash
# Demo 04: Swing GUI smoke test.
# Launches JFrameJade under Xvfb, waits for it to stay alive, grabs a screenshot.
# Success = JFrameJade's process is still running after a short settle period
# (i.e. the Swing init path did not throw an exception on the published JAR).
set -euo pipefail

: "${VICARIO_JAR:?VICARIO_JAR not set}"
: "${OUT_DIR:?OUT_DIR not set}"

INPUT=/opt/vicario/samples/LabelocityDummyImage.VIC
SCREENSHOT="$OUT_DIR/04-jframejade.png"
JFRAME_LOG="$OUT_DIR/04-jframejade.log"

echo "  input     : $INPUT"
echo "  screenshot: $SCREENSHOT"

[[ -f "$INPUT" ]] || { echo "FAIL: missing input $INPUT"; exit 1; }

export VICARIO_JAR INPUT JFRAME_LOG SCREENSHOT

# Start an Xvfb display. xvfb-run wraps the whole test in its own :99.
xvfb-run --auto-servernum --server-args='-screen 0 1024x768x24' \
    bash -c '
        set -u
        : "${VICARIO_JAR}"
        : "${INPUT}"
        : "${JFRAME_LOG}"
        : "${SCREENSHOT}"

        java -Dcom.sun.media.jai.disableMediaLib=true -cp "$VICARIO_JAR" jpl.mipl.io.JFrameJade "$INPUT" \
            > "$JFRAME_LOG" 2>&1 &
        pid=$!

        # Give Swing time to initialize.
        sleep 5

        if ! kill -0 "$pid" 2>/dev/null; then
            echo "FAIL: JFrameJade exited within 5s"
            echo "--- log ---"
            cat "$JFRAME_LOG" || true
            exit 1
        fi

        # Capture a screenshot of the virtual root window as proof-of-life.
        if command -v import >/dev/null 2>&1; then
            import -window root "$SCREENSHOT" 2>/dev/null || \
                echo "WARN: screenshot capture failed (ImageMagick import)"
        fi

        kill "$pid" 2>/dev/null || true
        wait "$pid" 2>/dev/null || true
        echo "PASS: JFrameJade stayed alive for 5s under Xvfb"
    '
