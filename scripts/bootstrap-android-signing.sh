#!/usr/bin/env bash
# Bootstrap Android signing on a fresh machine.
#
# Reads the Play upload keystore + passwords from environment variables,
# materializes the .keystore file under ~/.android-signing/, and writes
# .env.signing.android with the variables the withAndroidReleaseSigning config
# plugin (and gradle) expect at release-build time.
#
# Mirrors scripts/bootstrap-ios-signing.sh.
#
# Run:
#   export ANDROID_KEYSTORE_B64=...
#   export ANDROID_STORE_PASSWORD=...
#   export ANDROID_KEY_ALIAS=upload
#   export ANDROID_KEY_PASSWORD=...
#   ./scripts/bootstrap-android-signing.sh
#   source .env.signing.android

set -euo pipefail

KEYSTORE_DIR="${HOME}/.android-signing"
KEYSTORE_PATH="${KEYSTORE_DIR}/tb-mobile-upload.keystore"

mkdir -p "${KEYSTORE_DIR}"
umask 077

: "${ANDROID_KEYSTORE_B64:?ANDROID_KEYSTORE_B64 must be set}"
: "${ANDROID_STORE_PASSWORD:?ANDROID_STORE_PASSWORD must be set}"
: "${ANDROID_KEY_PASSWORD:?ANDROID_KEY_PASSWORD must be set}"

printf '%s' "${ANDROID_KEYSTORE_B64}" | base64 -d > "${KEYSTORE_PATH}"
chmod 600 "${KEYSTORE_PATH}"
STORE_PASSWORD="${ANDROID_STORE_PASSWORD}"
KEY_ALIAS="${ANDROID_KEY_ALIAS:-upload}"
KEY_PASSWORD="${ANDROID_KEY_PASSWORD}"

# Sanity-check the materialized keystore — keytool exits non-zero if the
# binary is corrupt or the password is wrong.
if ! keytool -list -keystore "${KEYSTORE_PATH}" -storepass "${STORE_PASSWORD}" >/dev/null 2>&1; then
  echo "ERROR: ${KEYSTORE_PATH} failed keytool validation." >&2
  echo "Possible causes:" >&2
  echo "  1. ANDROID_KEYSTORE_B64 is not a valid base64-encoded keystore" >&2
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
