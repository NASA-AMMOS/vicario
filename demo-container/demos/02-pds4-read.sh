#!/usr/bin/env bash
# Demo 02: read a PDS4 example product from the NASA PDS example bundle.
# Picks the first label with an adjacent image data file (.img/.dat/.fits)
# inside /opt/vicario/samples/pds4 and tries to convert it to VICAR.
set -euo pipefail

: "${VICARIO_JAR:?VICARIO_JAR not set}"
: "${OUT_DIR:?OUT_DIR not set}"

PDS4_DIR=/opt/vicario/samples/pds4

if [[ ! -d "$PDS4_DIR" ]]; then
    echo "SKIP: PDS4 example bundle not present at $PDS4_DIR"
    exit 0
fi

# Find a candidate PDS4 label: .xml file that has an adjacent data file
# with one of the common PDS4 data suffixes. Skip data files >2 GiB: the
# PDS4 reader parses byte offsets with Integer.parseInt and overflows on
# such products (e.g. the 4.8 GB virs_cube_64ppd example).
MAX_BYTES=2147483647
INPUT=""
while IFS= read -r -d '' xml; do
    dir="$(dirname "$xml")"
    stem="$(basename "$xml" .xml)"
    for ext in img dat IMG DAT fits FITS; do
        data="$dir/$stem.$ext"
        if [[ -f "$data" ]]; then
            size="$(stat -c%s "$data" 2>/dev/null || echo 0)"
            if (( size > 0 && size <= MAX_BYTES )); then
                INPUT="$xml"
                break 2
            fi
        fi
    done
done < <(find "$PDS4_DIR" -type f -name '*.xml' -print0)

if [[ -z "$INPUT" ]]; then
    echo "SKIP: no PDS4 label with adjacent data file found in example bundle"
    exit 0
fi

OUTPUT="$OUT_DIR/02-$(basename "$INPUT" .xml).vic"
echo "  input : $INPUT"
echo "  output: $OUTPUT"

java -Djava.awt.headless=true -Dcom.sun.media.jai.disableMediaLib=true -jar "$VICARIO_JAR" \
    INP="$INPUT" \
    OUT="$OUTPUT" \
    FORMAT=vicar

[[ -s "$OUTPUT" ]] || { echo "FAIL: output not produced or empty"; exit 1; }

# VICAR files start with 'LBLSIZE=' in their ASCII label.
if ! head -c 32 "$OUTPUT" | grep -q 'LBLSIZE='; then
    echo "FAIL: output does not look like a VICAR file (missing LBLSIZE= header)"
    exit 1
fi

echo "PASS: PDS4 -> VICAR produced ($(wc -c < "$OUTPUT") bytes)"
