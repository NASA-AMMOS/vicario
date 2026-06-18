#!/usr/bin/env bash
# Wrapper script to run vicario with the full Maven classpath.
# Installed to /usr/local/bin/vicario by devcontainer postCreateCommand.
set -euo pipefail

PROJECT_DIR="/workspace"
CP="${PROJECT_DIR}/target/classes:${PROJECT_DIR}/target/dependency/*"

exec java -cp "$CP" jpl.mipl.io.jConvertIIO "${@:-HELP}"
