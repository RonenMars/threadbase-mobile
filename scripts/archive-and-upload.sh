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

# Workaround for React Compiler + Metro graph-optimization crash during the
# expo-updates archive bundle step. babel-plugin-react-compiler 1.0.0 writes
# Symbol() into Babel Node.loc, which fails v8.structuredClone when Metro
# ships the AST across worker IPC under tree shaking — surfaces as
# "Unexpected end of MessagePack data" in expo-updates' createManifestForBuildAsync.
# Tracked: expo/expo#39431, facebook/react#36327. Remove this export when
# either babel-plugin-react-compiler ships a fix or @expo/metro-config lands
# the AST sanitizer (expo/expo#42258).
#
# 2026-05-25: TEMPORARILY DISABLED to test whether upstream fix has landed.
# If archive succeeds → remove this block + the comment entirely.
# If archive fails with "Unexpected end of MessagePack data" → restore the export.
# export EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH=false

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
