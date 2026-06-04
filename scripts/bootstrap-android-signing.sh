#!/usr/bin/env bash
# Bootstrap Android signing on a fresh machine.
#
# Reads the Play upload keystore + passwords from 1Password, materializes
# the .keystore file under ~/.android-signing/, and writes .env.signing.android
# with the variables the withAndroidReleaseSigning config plugin (and gradle)
# expect at release-build time.
#
# Mirrors scripts/bootstrap-ios-signing.sh.
#
# Prereqs (one-time per machine):
#   brew install --cask 1password-cli
#   eval "$(op signin)"               # interactive — or set OP_SERVICE_ACCOUNT_TOKEN
#
# 1Password item shape (vault MyDevSecrets, item title "AndroidSigning"):
#   field   keystore_b64        — base64-encoded .keystore binary
#                                 (encode with: `base64 -i tb-mobile-upload.keystore`)
#   field   store_password      — keystore password
#   field   key_alias           — key alias inside the keystore (default: "upload")
#   field   key_password        — key password
#   field   sha256_fingerprint  — informational; not consumed by this script
#
# A base64 blob avoids any chance that 1Password's UI mangles the binary
# .keystore on paste.
#
# Override location with: OP_ITEM=op://<vault>/<item> ./scripts/bootstrap-android-signing.sh
#
# Run:
#   ./scripts/bootstrap-android-signing.sh
#   source .env.signing.android

set -euo pipefail

OP_ITEM="${OP_ITEM:-op://MyDevSecrets/AndroidSigning}"

if ! op whoami >/dev/null 2>&1; then
  echo "1Password CLI is not signed in. Run: eval \"\$(op signin)\"" >&2
  exit 1
fi

KEYSTORE_DIR="${HOME}/.android-signing"
KEYSTORE_PATH="${KEYSTORE_DIR}/tb-mobile-upload.keystore"

mkdir -p "${KEYSTORE_DIR}"
umask 077

op read "${OP_ITEM}/keystore_b64" | base64 -d > "${KEYSTORE_PATH}"
chmod 600 "${KEYSTORE_PATH}"

STORE_PASSWORD="$(op read "${OP_ITEM}/store_password")"
KEY_ALIAS="$(op read "${OP_ITEM}/key_alias" 2>/dev/null || echo "upload")"
KEY_PASSWORD="$(op read "${OP_ITEM}/key_password")"

# Sanity-check the materialized keystore — keytool exits non-zero if the
# binary is corrupt or the password is wrong.
if ! keytool -list -keystore "${KEYSTORE_PATH}" -storepass "${STORE_PASSWORD}" >/dev/null 2>&1; then
  echo "ERROR: ${KEYSTORE_PATH} failed keytool validation." >&2
  echo "Possible causes:" >&2
  echo "  1. 1Password 'keystore_b64' field is not valid base64-encoded keystore" >&2
  echo "     Re-encode with: base64 -i tb-mobile-upload.keystore" >&2
  echo "  2. 'store_password' field doesn't match the keystore's actual store password" >&2
  exit 1
fi

cat > .env.signing.android <<EOF
export TB_MOBILE_UPLOAD_KEYSTORE="${KEYSTORE_PATH}"
export TB_MOBILE_UPLOAD_KEYSTORE_PASSWORD="${STORE_PASSWORD}"
export TB_MOBILE_UPLOAD_KEY_ALIAS="${KEY_ALIAS}"
export TB_MOBILE_UPLOAD_KEY_PASSWORD="${KEY_PASSWORD}"
EOF
chmod 600 .env.signing.android

echo "Android signing bootstrapped:"
echo "  Keystore:          ${KEYSTORE_PATH}"
echo "  Env file:          .env.signing.android"
echo
echo "Next: source .env.signing.android && (cd android && ./gradlew :app:bundleRelease)"
