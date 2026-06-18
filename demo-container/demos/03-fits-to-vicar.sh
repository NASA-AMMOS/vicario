#!/usr/bin/env bash
# Demo 03: FITS -> VICAR conversion using astropy's HorseHead.fits sample.
set -euo pipefail

: "${VICARIO_JAR:?VICARIO_JAR not set}"
: "${OUT_DIR:?OUT_DIR not set}"

INPUT=/opt/vicario/samples/fits/HorseHead.fits
OUTPUT="$OUT_DIR/03-HorseHead.vic"

if [[ ! -f "$INPUT" ]]; then
    echo "SKIP: FITS sample not present at $INPUT"
    exit 0
fi

echo "  input : $INPUT"
echo "  output: $OUTPUT"

java -Djava.awt.headless=true -Dcom.sun.media.jai.disableMediaLib=true -jar "$VICARIO_JAR" \
    INP="$INPUT" \
    OUT="$OUTPUT" \
    FORMAT=vicar

[[ -s "$OUTPUT" ]] || { echo "FAIL: output not produced or empty"; exit 1; }

if ! head -c 32 "$OUTPUT" | grep -q 'LBLSIZE='; then
    echo "FAIL: output does not look like a VICAR file (missing LBLSIZE= header)"
    exit 1
fi

echo "PASS: FITS -> VICAR produced ($(wc -c < "$OUTPUT") bytes)"
