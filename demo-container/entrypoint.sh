#!/usr/bin/env bash
# Vicario demo-container entrypoint.
#
# Resolves the vicario artifact under test, then runs the demo suite.
# Exits non-zero on any demo failure.
#
# Artifact resolution (in order of precedence):
#   VICARIO_JAR_URL   -- direct URL to a JAR, downloaded with curl
#   VICARIO_COORDS    -- Maven coords (groupId:artifactId:version[:packaging:classifier])
#                        resolved via mvn dependency:get. Uses mounted
#                        ~/.m2/settings.xml for repository + auth.
#
# Optional:
#   VICARIO_REPO_URL  -- override remote repo URL for dependency:get
#   DEMO_FILTER       -- run only demos matching this glob (e.g. '01-*')
set -euo pipefail

JAR_DEST=/opt/vicario/vicario.jar
DEMOS_DIR=/opt/vicario/demos
OUT_DIR=/opt/vicario/out
mkdir -p "$OUT_DIR"

log()  { printf '\n\033[1;34m[vicario-demo]\033[0m %s\n' "$*"; }
fail() { printf '\n\033[1;31m[vicario-demo] ERROR:\033[0m %s\n' "$*" >&2; exit 2; }

resolve_artifact() {
    if [[ -n "${VICARIO_JAR_URL:-}" ]]; then
        log "Downloading artifact from URL: $VICARIO_JAR_URL"
        curl -fsSL --retry 3 "$VICARIO_JAR_URL" -o "$JAR_DEST" \
            || fail "Failed to download $VICARIO_JAR_URL"
        return
    fi

    if [[ -n "${VICARIO_COORDS:-}" ]]; then
        log "Resolving Maven coords: $VICARIO_COORDS"
        local get_args=(-B -q dependency:get -Dartifact="$VICARIO_COORDS" -Dtransitive=false)
        if [[ -n "${VICARIO_REPO_URL:-}" ]]; then
            get_args+=(-DremoteRepositories="$VICARIO_REPO_URL")
        fi
        mvn "${get_args[@]}" || fail "mvn dependency:get failed for $VICARIO_COORDS"

        # Parse coords: groupId:artifactId:version[:packaging[:classifier]]
        IFS=':' read -r -a parts <<< "$VICARIO_COORDS"
        local g="${parts[0]}" a="${parts[1]}" v="${parts[2]}"
        local pkg="${parts[3]:-jar}"
        local cls="${parts[4]:-}"
        local gpath="${g//.//}"
        local base="${HOME}/.m2/repository/${gpath}/${a}/${v}/${a}-${v}"
        local src
        if [[ -n "$cls" ]]; then
            src="${base}-${cls}.${pkg}"
        else
            src="${base}.${pkg}"
        fi
        [[ -f "$src" ]] || fail "Resolved artifact not found at $src"
        cp "$src" "$JAR_DEST"
        return
    fi

    fail "No artifact source set. Provide VICARIO_JAR_URL or VICARIO_COORDS."
}

verify_jar() {
    [[ -s "$JAR_DEST" ]] || fail "Artifact file is missing or empty: $JAR_DEST"
    log "Artifact in place: $(ls -lh "$JAR_DEST" | awk '{print $5, $9}')"
    # Sanity: can the JVM list the main class?
    java -jar "$JAR_DEST" HELP >/dev/null 2>&1 \
        || fail "java -jar $JAR_DEST HELP did not succeed (is this a valid shaded vicario JAR?)"
}

run_demos() {
    local filter="${DEMO_FILTER:-*.sh}"
    local pattern="$DEMOS_DIR/$filter"
    # shellcheck disable=SC2206
    local demos=( $pattern )
    [[ ${#demos[@]} -gt 0 && -f "${demos[0]}" ]] \
        || fail "No demos matched filter '$filter' in $DEMOS_DIR"

    local pass=0 fail_count=0
    local results=()
    for demo in "${demos[@]}"; do
        local name
        name="$(basename "$demo" .sh)"
        log "Running demo: $name"
        if VICARIO_JAR="$JAR_DEST" OUT_DIR="$OUT_DIR" bash "$demo"; then
            results+=("PASS  $name")
            pass=$((pass + 1))
        else
            results+=("FAIL  $name")
            fail_count=$((fail_count + 1))
        fi
    done

    echo
    echo "=================== Demo Summary ==================="
    printf '%s\n' "${results[@]}"
    echo "----------------------------------------------------"
    echo "Passed: $pass   Failed: $fail_count   Total: ${#demos[@]}"
    echo "Outputs in: $OUT_DIR"
    echo "===================================================="

    [[ $fail_count -eq 0 ]]
}

resolve_artifact
verify_jar
run_demos
