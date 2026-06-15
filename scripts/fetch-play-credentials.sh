#!/usr/bin/env bash
# Fetch the Google Play Console service-account JSON from 1Password and
# write it to a stable local cache path. The path is the value you set as
# GOOGLE_APPLICATION_CREDENTIALS in your real (gitignored) .mcp.json.
#
# Usage:
#   export OP_PLAY_VAULT="Engineering"           # required
#   export OP_PLAY_ITEM="Play Console SA"        # required
#   export OP_PLAY_FIELD="credential"            # optional, default: "credential"
#   ./scripts/fetch-play-credentials.sh
#
# Then, in your gitignored .mcp.json, set:
#   "env": { "GOOGLE_APPLICATION_CREDENTIALS": "/Users/you/.config/threadbase/play-console-sa.json" }
# (use an absolute path — Google auth libs don't expand ~).
#
# The script is idempotent: run it any time the key rotates, the cache is
# overwritten in place. Exit non-zero on any failure so callers can chain.

set -euo pipefail

if [ -z "${PLAY_SA_JSON_B64:-}" ]; then
  : "${OP_PLAY_VAULT:?OP_PLAY_VAULT must be set (1Password vault name)}"
  : "${OP_PLAY_ITEM:?OP_PLAY_ITEM must be set (1Password item name)}"
  OP_PLAY_FIELD="${OP_PLAY_FIELD:-password}"

  if ! command -v op >/dev/null 2>&1; then
    echo "error: 1Password CLI (op) not found — install with 'brew install --cask 1password-cli'" >&2
    exit 1
  fi

  if ! op account list >/dev/null 2>&1; then
    echo "error: 1Password CLI not signed in — run: eval \$(op signin)" >&2
    exit 1
  fi
fi

CACHE_DIR="$HOME/.config/threadbase"
CACHE_FILE="$CACHE_DIR/play-console-sa.json"

mkdir -p "$CACHE_DIR"
chmod 700 "$CACHE_DIR"

# CI fast-path: if PLAY_SA_JSON_B64 is provided, decode it directly and skip
# 1Password entirely.
if [ -n "${PLAY_SA_JSON_B64:-}" ]; then
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
  exit 0
fi

TMP_FILE="$(mktemp)"
trap 'rm -f "$TMP_FILE"' EXIT

OP_REF="op://${OP_PLAY_VAULT}/${OP_PLAY_ITEM}/${OP_PLAY_FIELD}"
echo "fetching ${OP_REF}..." >&2

RAW_FILE="$(mktemp)"
trap 'rm -f "$TMP_FILE" "$RAW_FILE"' EXIT

if ! op read "$OP_REF" > "$RAW_FILE" 2>/dev/null; then
  echo "error: failed to read $OP_REF — check vault/item names and that the field exists" >&2
  exit 1
fi

# The 1Password field stores the SA JSON base64-encoded so newlines in the
# private_key are preserved across copy-paste. Decode to TMP_FILE; if decode
# fails, fall back to treating the field as raw JSON.
if base64 -d -i "$RAW_FILE" > "$TMP_FILE" 2>/dev/null && \
   jq -e 'has("type") and has("project_id") and has("private_key")' "$TMP_FILE" >/dev/null 2>&1; then
  : # decoded JSON validated
elif jq -e 'has("type") and has("project_id") and has("private_key")' "$RAW_FILE" >/dev/null 2>&1; then
  cp "$RAW_FILE" "$TMP_FILE"
else
  echo "error: fetched value is neither valid base64-encoded nor raw Google service-account JSON" >&2
  exit 1
fi

mv "$TMP_FILE" "$CACHE_FILE"
chmod 600 "$CACHE_FILE"

echo "wrote $CACHE_FILE (mode 600)" >&2
echo "$CACHE_FILE"
