#!/usr/bin/env bash
# Materialize the Google Play Console service-account JSON from
# PLAY_SA_JSON_B64 and write it to a stable local cache path. The path is the
# value you set as GOOGLE_APPLICATION_CREDENTIALS in your real (gitignored)
# .mcp.json.
#
# Usage:
#   export PLAY_SA_JSON_B64=...
#   ./scripts/fetch-play-credentials.sh
#
# Then, in your gitignored .mcp.json, set:
#   "env": { "GOOGLE_APPLICATION_CREDENTIALS": "/Users/you/.config/threadbase/play-console-sa.json" }
# (use an absolute path — Google auth libs don't expand ~).
#
# The script is idempotent: run it any time the key rotates, the cache is
# overwritten in place. Exit non-zero on any failure so callers can chain.

set -euo pipefail

: "${PLAY_SA_JSON_B64:?PLAY_SA_JSON_B64 must be set}"

CACHE_DIR="$HOME/.config/threadbase"
CACHE_FILE="$CACHE_DIR/play-console-sa.json"

mkdir -p "$CACHE_DIR"
chmod 700 "$CACHE_DIR"

TMP_FILE="$(mktemp)"
trap 'rm -f "$TMP_FILE"' EXIT

if ! printf '%s' "$PLAY_SA_JSON_B64" | base64 -d > "$TMP_FILE" 2>/dev/null || \
   ! jq -e 'has("type") and has("project_id") and has("private_key")' "$TMP_FILE" >/dev/null 2>&1; then
  echo "error: PLAY_SA_JSON_B64 is not valid base64-encoded Google service-account JSON" >&2
  exit 1
fi

mv "$TMP_FILE" "$CACHE_FILE"
chmod 600 "$CACHE_FILE"

echo "wrote $CACHE_FILE (mode 600)" >&2
echo "$CACHE_FILE"
