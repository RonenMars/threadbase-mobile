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

WORKSPACE="${WORKSPACE:-ios/Threadbase.xcworkspace}"
SCHEME="${SCHEME:-Threadbase}"
ARCHIVE_PATH="${ARCHIVE_PATH:-build/Threadbase.xcarchive}"

mkdir -p build

xcodebuild \
  -workspace "${WORKSPACE}" \
  -scheme "${SCHEME}" \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "${ARCHIVE_PATH}" \
  -allowProvisioningUpdates \
  -authenticationKeyPath "${ASC_KEY_PATH}" \
  -authenticationKeyID "${ASC_KEY_ID}" \
  -authenticationKeyIssuerID "${ASC_ISSUER_ID}" \
  DEVELOPMENT_TEAM="${ASC_TEAM_ID}" \
  CODE_SIGN_STYLE=Automatic \
  archive | tee build/archive.log

xcodebuild -exportArchive \
  -archivePath "${ARCHIVE_PATH}" \
  -exportOptionsPlist "${EXPORT_OPTIONS_PLIST}" \
  -exportPath build/export \
  -allowProvisioningUpdates \
  -authenticationKeyPath "${ASC_KEY_PATH}" \
  -authenticationKeyID "${ASC_KEY_ID}" \
  -authenticationKeyIssuerID "${ASC_ISSUER_ID}" | tee build/upload.log

echo
echo "Uploaded. Poll processing state with the App Store Connect API"
echo "(see Step 6 of the expo-local-build skill)."
