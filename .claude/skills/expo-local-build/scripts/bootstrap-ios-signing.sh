#!/usr/bin/env bash
# bootstrap-ios-signing.sh — pull ASC API key from 1Password, render
# ExportOptions.plist, write .env.signing for downstream scripts.
#
# Prereqs:
#   brew install --cask 1password-cli
#   eval "$(op signin)"            # interactive — or set OP_SERVICE_ACCOUNT_TOKEN
#
# 1Password item shape (item title "AppStoreConnect", any vault):
#   key_id          text   — App Store Connect API Key ID (10 chars)
#   issuer_id       text   — Issuer UUID
#   team_id         text   — Apple Developer Team ID (10 chars)
#   auth_key_b64    text   — base64 of the .p8 file: `base64 -i AuthKey_*.p8`
#
# Override the item path with: OP_ITEM=op://<vault>/<item>

set -euo pipefail

OP_ITEM="${OP_ITEM:-op://Private/AppStoreConnect}"
TEMPLATE="${TEMPLATE:-scripts/ExportOptions.template.plist}"
OUTPUT_PLIST="${OUTPUT_PLIST:-build/ExportOptions.plist}"
ENV_FILE="${ENV_FILE:-.env.signing}"

if ! op whoami >/dev/null 2>&1; then
  echo "1Password CLI is not signed in. Run: eval \"\$(op signin)\"" >&2
  exit 1
fi

[[ -f "$TEMPLATE" ]] || { echo "Missing template: $TEMPLATE" >&2; exit 1; }

ASC_KEY_ID="$(op read "${OP_ITEM}/key_id")"
ASC_ISSUER_ID="$(op read "${OP_ITEM}/issuer_id")"
ASC_KEY_PATH="${HOME}/.appstoreconnect/keys/AuthKey_${ASC_KEY_ID}.p8"

mkdir -p "$(dirname "$ASC_KEY_PATH")" "$(dirname "$OUTPUT_PLIST")"
umask 077
op read "${OP_ITEM}/auth_key_b64" | base64 -d > "$ASC_KEY_PATH"
chmod 600 "$ASC_KEY_PATH"

# Sanity-check the materialized PEM
if ! head -1 "$ASC_KEY_PATH" | grep -q '^-----BEGIN PRIVATE KEY-----$'; then
  echo "ERROR: $ASC_KEY_PATH doesn't look like a valid PEM." >&2
  echo "Check that '${OP_ITEM}/auth_key_b64' contains the output of 'base64 -i AuthKey_<KEYID>.p8'." >&2
  exit 1
fi

op inject -i "$TEMPLATE" -o "$OUTPUT_PLIST" --force

cat > "$ENV_FILE" <<EOF
export ASC_KEY_ID="$ASC_KEY_ID"
export ASC_ISSUER_ID="$ASC_ISSUER_ID"
export ASC_KEY_PATH="$ASC_KEY_PATH"
export EXPORT_OPTIONS_PLIST="$(pwd)/$OUTPUT_PLIST"
EOF

echo "iOS signing bootstrapped:"
echo "  .p8 key:        $ASC_KEY_PATH"
echo "  ExportOptions:  $OUTPUT_PLIST"
echo "  Env file:       $ENV_FILE"
