#!/usr/bin/env bash
# archive-and-upload.sh — archive the iOS app and upload to TestFlight in
# two non-interactive xcodebuild calls. Apple processes the build (~5–15 min)
# and it appears in TestFlight once `processingState` flips to VALID.
#
# Reads workspace/scheme from env or auto-detects from ios/ directory.
# Requires `.env.signing` (from bootstrap-ios-signing.sh) sourced first.

set -euo pipefail

: "${ASC_KEY_ID:?source .env.signing first}"
: "${ASC_ISSUER_ID:?source .env.signing first}"
: "${ASC_KEY_PATH:?source .env.signing first}"
: "${EXPORT_OPTIONS_PLIST:?source .env.signing first}"

# Auto-detect workspace + scheme if not supplied
if [[ -z "${WORKSPACE:-}" ]]; then
  WORKSPACE=$(ls ios/*.xcworkspace 2>/dev/null | head -1)
  [[ -n "$WORKSPACE" ]] || { echo "No ios/*.xcworkspace found. Run 'npx expo prebuild' first." >&2; exit 1; }
fi
if [[ -z "${SCHEME:-}" ]]; then
  SCHEME=$(xcodebuild -workspace "$WORKSPACE" -list -json 2>/dev/null \
    | jq -r '.workspace.schemes[0] // empty')
  [[ -n "$SCHEME" ]] || { echo "Could not detect scheme. Set SCHEME=<name>." >&2; exit 1; }
fi

ARCHIVE_PATH="${ARCHIVE_PATH:-build/$(basename "$WORKSPACE" .xcworkspace).xcarchive}"
mkdir -p "$(dirname "$ARCHIVE_PATH")" build/export

echo "▸ Archive  $WORKSPACE → $ARCHIVE_PATH"
xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE_PATH" \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$ASC_KEY_PATH" \
  -authenticationKeyID "$ASC_KEY_ID" \
  -authenticationKeyIssuerID "$ASC_ISSUER_ID" \
  archive | tee build/archive.log

echo
echo "▸ Upload to App Store Connect (destination=upload)"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportOptionsPlist "$EXPORT_OPTIONS_PLIST" \
  -exportPath build/export \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$ASC_KEY_PATH" \
  -authenticationKeyID "$ASC_KEY_ID" \
  -authenticationKeyIssuerID "$ASC_ISSUER_ID" | tee build/upload.log

echo
echo "✓ Uploaded. Apple is processing — poll with:"
echo "  ./scripts/poll-build.sh \$(jq -r .expo.ios.bundleIdentifier app.json) --watch"
