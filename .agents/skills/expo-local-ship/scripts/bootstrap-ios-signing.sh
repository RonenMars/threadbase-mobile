#!/usr/bin/env bash
# bootstrap-ios-signing.sh — read ASC API key from environment, render
# ExportOptions.plist, write .env.signing for downstream scripts.
#
# Required env vars:
#   ASC_KEY_ID
#   ASC_ISSUER_ID
#   ASC_TEAM_ID
#   ASC_AUTH_KEY_B64

set -euo pipefail

TEMPLATE="${TEMPLATE:-scripts/ExportOptions.template.plist}"
OUTPUT_PLIST="${OUTPUT_PLIST:-build/ExportOptions.plist}"
ENV_FILE="${ENV_FILE:-.env.signing}"

[[ -f "$TEMPLATE" ]] || { echo "Missing template: $TEMPLATE" >&2; exit 1; }

: "${ASC_KEY_ID:?ASC_KEY_ID must be set}"
: "${ASC_ISSUER_ID:?ASC_ISSUER_ID must be set}"
: "${ASC_TEAM_ID:?ASC_TEAM_ID must be set}"
: "${ASC_AUTH_KEY_B64:?ASC_AUTH_KEY_B64 must be set}"

ASC_KEY_PATH="${HOME}/.appstoreconnect/keys/AuthKey_${ASC_KEY_ID}.p8"

mkdir -p "$(dirname "$ASC_KEY_PATH")" "$(dirname "$OUTPUT_PLIST")"
umask 077
printf '%s' "$ASC_AUTH_KEY_B64" | base64 -d > "$ASC_KEY_PATH"
chmod 600 "$ASC_KEY_PATH"

# Sanity-check the materialized PEM
if ! head -1 "$ASC_KEY_PATH" | grep -q '^-----BEGIN PRIVATE KEY-----$'; then
  echo "ERROR: $ASC_KEY_PATH doesn't look like a valid PEM." >&2
  echo "Check that ASC_AUTH_KEY_B64 contains the output of 'base64 -i AuthKey_<KEYID>.p8'." >&2
  exit 1
fi

sed "s/TEAM_ID_PLACEHOLDER/${ASC_TEAM_ID}/" "$TEMPLATE" > "$OUTPUT_PLIST"

cat > "$ENV_FILE" <<EOF
export ASC_KEY_ID="$ASC_KEY_ID"
export ASC_ISSUER_ID="$ASC_ISSUER_ID"
export ASC_TEAM_ID="$ASC_TEAM_ID"
export ASC_KEY_PATH="$ASC_KEY_PATH"
export EXPORT_OPTIONS_PLIST="$(pwd)/$OUTPUT_PLIST"
EOF

echo "iOS signing bootstrapped:"
echo "  .p8 key:        $ASC_KEY_PATH"
echo "  ExportOptions:  $OUTPUT_PLIST"
echo "  Env file:       $ENV_FILE"
