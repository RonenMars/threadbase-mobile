#!/usr/bin/env bash
# Archive the iOS app and upload to TestFlight in two non-interactive steps.
# Expects scripts/bootstrap-ios-signing.sh to have been run and `.env.signing`
# sourced (for ASC_* and EXPORT_OPTIONS_PLIST).

set -euo pipefail

: "${ASC_KEY_ID:?source .env.signing first}"
: "${ASC_ISSUER_ID:?source .env.signing first}"
: "${ASC_TEAM_ID:?source .env.signing first}"
: "${ASC_KEY_PATH:?source .env.signing first}"
: "${EXPORT_OPTIONS_PLIST:?source .env.signing first}"
: "${IOS_PROVISION_PROFILE_UUID:?source .env.signing first}"
: "${IOS_WIDGET_PROVISION_PROFILE_UUID:?source .env.signing first}"

WORKSPACE="${WORKSPACE:-ios/Threadbase.xcworkspace}"
SCHEME="${SCHEME:-Threadbase}"
ARCHIVE_PATH="${ARCHIVE_PATH:-build/Threadbase.xcarchive}"

mkdir -p build

# Read build number from app.json so the native Xcode project picks it up.
# expo prebuild is skipped on CI (ios/ is checked in), so we inject it manually.
BUILD_NUMBER="$(jq -r '.expo.ios.buildNumber' app.json)"
: "${BUILD_NUMBER:?Could not read buildNumber from app.json}"

xcodebuild \
  -workspace "${WORKSPACE}" \
  -scheme "${SCHEME}" \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "${ARCHIVE_PATH}" \
  DEVELOPMENT_TEAM="${ASC_TEAM_ID}" \
  CODE_SIGN_STYLE=Manual \
  CODE_SIGN_IDENTITY="Apple Distribution" \
  IOS_PROVISION_PROFILE_UUID="${IOS_PROVISION_PROFILE_UUID}" \
  IOS_WIDGET_PROVISION_PROFILE_UUID="${IOS_WIDGET_PROVISION_PROFILE_UUID}" \
  CURRENT_PROJECT_VERSION="${BUILD_NUMBER}" \
  archive | tee build/archive.log

# Export archive with retry logic: network timeouts during export validation
# can cause "Error Downloading App Information". Retry up to 3 times.
MAX_RETRIES=3
EXPORT_OK=0
for (( attempt=1; attempt<=MAX_RETRIES; attempt++ )); do
  echo "exportArchive attempt $attempt/$MAX_RETRIES..."
  if xcodebuild -exportArchive \
    -archivePath "${ARCHIVE_PATH}" \
    -exportOptionsPlist "${EXPORT_OPTIONS_PLIST}" \
    -exportPath build/export | tee build/upload.log; then
    EXPORT_OK=1
    break
  fi
  if (( attempt < MAX_RETRIES )); then
    echo "exportArchive failed. Retrying in 10s..."
    sleep 10
  fi
done

if (( EXPORT_OK == 0 )); then
  echo "exportArchive failed after $MAX_RETRIES attempts" >&2
  exit 70
fi

# Gate the upload on dyld symbol resolution. A pod version skew archives and
# exports cleanly but aborts at launch ("DYLD 4 Symbol missing"), which no
# compile-time check catches — build 173 shipped that way.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$SCRIPT_DIR/verify-dyld-symbols.sh"

# Upload IPA explicitly via altool so we get a real success/failure response.
# (method: app-store exports only; xcodebuild's built-in upload with
# method: app-store-connect silently drops builds on Apple's ingestion side.)
IPA_PATH="$(find build/export -name '*.ipa' | head -1)"
: "${IPA_PATH:?No IPA found in build/export}"
echo "Uploading ${IPA_PATH} via altool..."
xcrun altool --upload-app \
  --type ios \
  --file "${IPA_PATH}" \
  --apiKey "${ASC_KEY_ID}" \
  --apiIssuer "${ASC_ISSUER_ID}" \
  --show-progress 2>&1 | tee build/upload.log

echo
echo "Uploaded. Poll processing state with the App Store Connect API"
echo "(see Step 6 of the expo-local-build skill)."
