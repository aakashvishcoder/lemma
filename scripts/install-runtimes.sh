#!/usr/bin/env bash
# Installs the language runtimes the Run button supports into the Piston
# container. Safe to re-run; already-installed ones are skipped.
set -u
RUNNER="${RUNNER_URL:-http://localhost:2000}"
for lang in python node typescript gcc java go rust mono ruby php; do
  echo "installing $lang..."
  curl -s -X POST "$RUNNER/api/v2/packages" -H 'Content-Type: application/json' \
    -d "{\"language\":\"$lang\",\"version\":\"*\"}"
  echo
done
