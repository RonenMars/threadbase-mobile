#!/usr/bin/env bash
# Regenerate a functional .env.signing on a local Mac (the file bootstrap-ios-signing.sh
# writes was stale — missing IOS_PROVISION_PROFILE_UUID — so `npm run ship:ios` aborted
# at step 7). Do NOT hand-edit .env.signing; run this instead.
#
# One-time setup:
#   1. cp scripts/.signing-secrets.example scripts/.signing-secrets   (gitignored)
#   2. fill in scripts/.signing-secrets with the values from your GitHub Actions
#      secrets / Apple Developer account / password manager
#   3. ./scripts/bootstrap-local-signing.sh
#
# After it runs:  source .env.signing && npm run ship:ios

set -euo pipefail
cd "$(dirname "$0")/.."   # repo root

SECRETS="scripts/.signing-secrets"
[[ -f "$SECRETS" ]] || { echo "Missing $SECRETS — copy scripts/.signing-secrets.example to it and fill it in." >&2; exit 1; }

# shellcheck disable=SC1090
source "$SECRETS"

# ASC_AUTH_KEY_B64 / IOS_PROVISION_PROFILE_B64 / IOS_DIST_CERT_P12_B64 may be given
# either as raw base64 (B64) or as a path to the file (…_FILE). Materialize B64 from FILE.
[[ -n "${ASC_AUTH_KEY_FILE:-}"          ]] && export ASC_AUTH_KEY_B64="$(base64 -i "$ASC_AUTH_KEY_FILE")"
[[ -n "${IOS_PROVISION_PROFILE_FILE:-}" ]] && export IOS_PROVISION_PROFILE_B64="$(base64 -i "$IOS_PROVISION_PROFILE_FILE")"
[[ -n "${IOS_DIST_CERT_FILE:-}"         ]] && export IOS_DIST_CERT_P12_B64="$(base64 -i "$IOS_DIST_CERT_FILE")"

# bootstrap-ios-signing.sh imports the Distribution cert into $RUNNER_TEMP (a CI var).
# On a local Mac set it to a temp dir so that block works; skip cert import entirely if
# you already have the Distribution cert in your login keychain (leave IOS_DIST_CERT_* unset).
export RUNNER_TEMP="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"

./scripts/bootstrap-ios-signing.sh
echo
echo "✓ .env.signing regenerated. Next: source .env.signing && npm run ship:ios"
