#!/usr/bin/env bash
# Bootstrap iOS signing on a fresh machine.
#
# Reads the App Store Connect API key + Team ID from 1Password, materializes
# the .p8 key at the path xcodebuild auto-discovers, renders the
# ExportOptions.plist from a template, and writes .env.signing with the
# variables Step 6 of the expo-local-build skill expects.
#
# Prereqs (one-time per machine):
#   brew install --cask 1password-cli
#   op vault list                     # first-time only — triggers interactive account setup
#                                     # (prompts for sign-in address, email, Secret Key, and
#                                     # master password in one flow; easier than op account add
#                                     # with flags).
#                                     # Non-interactive alternative:
#                                     #   OP_SECRET_KEY=<key> op account add \
#                                     #     --address my.1password.com \
#                                     #     --email you@example.com
#   eval "$(op signin)"               # interactive — or set OP_SERVICE_ACCOUNT_TOKEN
#
# If `op whoami` says "No accounts configured", the CLI has never been linked
# to a 1Password account on this machine. Running `op vault list` triggers the
# interactive setup flow. This is separate from the desktop app's "Integrate
# with 1Password CLI" toggle — that toggle only works after an account is
# already registered with the CLI.
#
# 1Password item shape (vault + item set via OP_IOS_VAULT / OP_IOS_ITEM in .env.op):
#   field   key_id          — App Store Connect API Key ID      (e.g. ABC123XYZ4)
#   field   issuer_id       — Issuer UUID                       (8-4-4-4-12)
#   field   team_id         — Apple Developer Team ID           (10-char)
#   field   auth_key_b64    — base64-encoded .p8 file contents  (single-line;
#                             encode with: `base64 -i AuthKey_<KEYID>.p8`)
#
# A base64 blob avoids any chance that 1Password's UI strips the PEM's
# newlines on paste — which would break Apple's ASN.1 parser.
#
# Override location with: OP_ITEM=op://<vault>/<item> ./scripts/bootstrap-ios-signing.sh
#
# Run:
#   ./scripts/bootstrap-ios-signing.sh
#   source .env.signing

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../.env.op
[ -f "${SCRIPT_DIR}/../.env.op" ] && source "${SCRIPT_DIR}/../.env.op"

OP_IOS_VAULT="${OP_IOS_VAULT:-<your-vault>}"
OP_IOS_ITEM="${OP_IOS_ITEM:-AppStoreConnect}"
OP_ITEM="${OP_ITEM:-op://${OP_IOS_VAULT}/${OP_IOS_ITEM}}"

# CI fast path: if the signing values are already in the environment (e.g.
# injected from GitHub secrets), use them directly and skip 1Password entirely.
# Local dev leaves these unset and falls through to the `op read` path below.
if [ -n "${ASC_KEY_ID:-}" ] && [ -n "${ASC_ISSUER_ID:-}" ] && \
   [ -n "${ASC_TEAM_ID:-}" ] && [ -n "${ASC_AUTH_KEY_B64:-}" ]; then
  ASC_KEY_PATH="${HOME}/.appstoreconnect/keys/AuthKey_${ASC_KEY_ID}.p8"
  mkdir -p "$(dirname "${ASC_KEY_PATH}")"
  umask 077
  printf '%s' "${ASC_AUTH_KEY_B64}" | base64 -d > "${ASC_KEY_PATH}"
  chmod 600 "${ASC_KEY_PATH}"
else
  if ! op whoami >/dev/null 2>&1; then
    echo "1Password CLI is not signed in. Run: eval \"\$(op signin)\"" >&2
    exit 1
  fi

  ASC_KEY_ID="$(op read "${OP_ITEM}/key_id")"
  ASC_ISSUER_ID="$(op read "${OP_ITEM}/issuer_id")"
  ASC_TEAM_ID="$(op read "${OP_ITEM}/team_id")"
  ASC_KEY_PATH="${HOME}/.appstoreconnect/keys/AuthKey_${ASC_KEY_ID}.p8"

  mkdir -p "$(dirname "${ASC_KEY_PATH}")"
  umask 077
  op read "${OP_ITEM}/auth_key_b64" | base64 -d > "${ASC_KEY_PATH}"
  chmod 600 "${ASC_KEY_PATH}"
fi

# Sanity-check the materialized PEM
if ! head -1 "${ASC_KEY_PATH}" | grep -q '^-----BEGIN PRIVATE KEY-----$'; then
  echo "ERROR: ${ASC_KEY_PATH} doesn't look like a valid PEM." >&2
  echo "Make sure the 1Password 'auth_key_b64' field holds the output of" >&2
  echo "  base64 -i AuthKey_<KEYID>.p8" >&2
  exit 1
fi

mkdir -p build
sed "s/TEAM_ID_PLACEHOLDER/${ASC_TEAM_ID}/" scripts/ExportOptions.template.plist > build/ExportOptions.plist

cat > .env.signing <<EOF
export ASC_KEY_ID="${ASC_KEY_ID}"
export ASC_ISSUER_ID="${ASC_ISSUER_ID}"
export ASC_TEAM_ID="${ASC_TEAM_ID}"
export ASC_KEY_PATH="${ASC_KEY_PATH}"
export EXPORT_OPTIONS_PLIST="$(pwd)/build/ExportOptions.plist"
EOF

echo "iOS signing bootstrapped:"
echo "  .p8 key:           ${ASC_KEY_PATH}"
echo "  ExportOptions:     build/ExportOptions.plist"
echo "  Env file:          .env.signing"
echo
echo "Next: source .env.signing && ./scripts/archive-and-upload.sh"
