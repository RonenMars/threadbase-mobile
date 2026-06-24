#!/usr/bin/env bash
# Bootstrap iOS signing on a fresh machine.
#
# Reads the App Store Connect API key + Team ID from environment variables,
# materializes the .p8 key at the path xcodebuild auto-discovers, renders the
# ExportOptions.plist from a template, and writes .env.signing.
#
# Run:
#   export ASC_KEY_ID=...
#   export ASC_ISSUER_ID=...
#   export ASC_TEAM_ID=...
#   export ASC_AUTH_KEY_B64=...
#   ./scripts/bootstrap-ios-signing.sh
#   source .env.signing

set -euo pipefail

: "${ASC_KEY_ID:?ASC_KEY_ID must be set}"
: "${ASC_ISSUER_ID:?ASC_ISSUER_ID must be set}"
: "${ASC_TEAM_ID:?ASC_TEAM_ID must be set}"
: "${ASC_AUTH_KEY_B64:?ASC_AUTH_KEY_B64 must be set}"

ASC_KEY_PATH="${HOME}/.appstoreconnect/keys/AuthKey_${ASC_KEY_ID}.p8"
mkdir -p "$(dirname "${ASC_KEY_PATH}")"
umask 077
printf '%s' "${ASC_AUTH_KEY_B64}" | base64 -d > "${ASC_KEY_PATH}"
chmod 600 "${ASC_KEY_PATH}"

# Sanity-check the materialized PEM
if ! head -1 "${ASC_KEY_PATH}" | grep -q '^-----BEGIN PRIVATE KEY-----$'; then
  echo "ERROR: ${ASC_KEY_PATH} doesn't look like a valid PEM." >&2
  echo "Make sure ASC_AUTH_KEY_B64 holds the output of" >&2
  echo "  base64 -i AuthKey_<KEYID>.p8" >&2
  exit 1
fi

mkdir -p build
sed "s/TEAM_ID_PLACEHOLDER/${ASC_TEAM_ID}/" scripts/ExportOptions.template.plist > build/ExportOptions.plist

# Import signing certificate into a temporary keychain so xcodebuild reuses it
# instead of creating a new one via the API key on each fresh CI runner.
if [[ -n "${IOS_DEV_CERT_P12_B64:-}" ]]; then
  KEYCHAIN_PATH="$RUNNER_TEMP/signing.keychain-db"
  KEYCHAIN_PASSWORD="$(openssl rand -hex 16)"
  CERT_PATH="$RUNNER_TEMP/dev-cert.p12"

  printf '%s' "${IOS_DEV_CERT_P12_B64}" | base64 -d > "${CERT_PATH}"
  security create-keychain -p "${KEYCHAIN_PASSWORD}" "${KEYCHAIN_PATH}"
  security set-keychain-settings -lut 21600 "${KEYCHAIN_PATH}"
  security unlock-keychain -p "${KEYCHAIN_PASSWORD}" "${KEYCHAIN_PATH}"
  security import "${CERT_PATH}" -k "${KEYCHAIN_PATH}" -P "${IOS_DEV_CERT_PASSWORD}" -A -t cert -f pkcs12
  security list-keychain -d user -s "${KEYCHAIN_PATH}" login.keychain-db
  security set-key-partition-list -S apple-tool:,apple: -s -k "${KEYCHAIN_PASSWORD}" "${KEYCHAIN_PATH}"
  rm -f "${CERT_PATH}"
  echo "  Signing cert imported into keychain: ${KEYCHAIN_PATH}"
fi

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
