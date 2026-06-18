#!/usr/bin/env bash
# Demo 01: VICAR -> detached PDS label.
# Uses the bundled LabelocityDummyImage.VIC so this demo works fully offline.
# The writer emits an ODL-syntax detached label (.lbl) that self-identifies as
# PDS4; native PDS4 XML output is not implemented in the published jar.
set -euo pipefail

: "${VICARIO_JAR:?VICARIO_JAR not set}"
: "${OUT_DIR:?OUT_DIR not set}"

INPUT=/opt/vicario/samples/LabelocityDummyImage.VIC
OUTPUT="$OUT_DIR/01-LabelocityDummyImage.lbl"

echo "  input : $INPUT"
echo "  output: $OUTPUT"

[[ -f "$INPUT" ]] || { echo "FAIL: missing input $INPUT"; exit 1; }

java -Djava.awt.headless=true -Dcom.sun.media.jai.disableMediaLib=true -jar "$VICARIO_JAR" \
    INP="$INPUT" \
    OUT="$OUTPUT" \
    FORMAT=pds \
    PDS_LABEL_TYPE=PDS4 \
    PDS_DETACHED_LABEL=true \
    PDS_DETACHED_ONLY=true

# Structural assertions: output exists, non-empty, is a PDS label pointing at
# an IMAGE object.
[[ -s "$OUTPUT" ]] || { echo "FAIL: output not produced or empty"; exit 1; }
if ! grep -q 'PDS_VERSION_ID' "$OUTPUT"; then
    echo "FAIL: output missing PDS_VERSION_ID (not a PDS label)"
    exit 1
fi
if ! grep -q 'OBJECT.*=.*IMAGE' "$OUTPUT"; then
    echo "FAIL: output missing IMAGE object"
    exit 1
fi

echo "PASS: VICAR -> PDS label produced ($(wc -c < "$OUTPUT") bytes)"
