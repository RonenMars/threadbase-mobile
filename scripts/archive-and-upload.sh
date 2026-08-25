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

# sentry-cli auto-detects release/dist from the Xcode project's bundle id and
# marketing version (e.g. "com.ronenmars.threadbase@1.0+183"), which never
# matches what the SDK tags events with (services/sentry.ts ->
# "threadbase-mobile-ios@1.0.0+183" via services/safe-metadata.ts). That mismatch
# leaves uploaded source maps bound to a release object Sentry never
# associates with the app's actual events. Force the same release/dist the
# SDK computes so sentry-cli's upload lands on the right release.
APP_VERSION="$(jq -r '.expo.version' app.json)"
export SENTRY_RELEASE="threadbase-mobile-ios@${APP_VERSION}+${BUILD_NUMBER}"
export SENTRY_DIST="${BUILD_NUMBER}"

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

"$SCRIPT_DIR/validate-altool-upload.sh" build/upload.log

echo
echo "Uploaded. Poll processing state with the App Store Connect API"
echo "(see Step 6 of the expo-local-build skill)."

# A Sentry problem here must never fail a ship whose binary is already uploaded,
# but a warning buried in a 20-minute log is the same as no warning. In CI emit a
# workflow command so it surfaces as an annotation on the run and the checks UI;
# locally fall back to stderr. Workflow commands are read from stdout, so this
# deliberately does not redirect when GITHUB_ACTIONS is set.
sentry_warn() {
  if [[ -n "${GITHUB_ACTIONS:-}" ]]; then
    echo "::warning::$*"
  else
    echo "  ! $*" >&2
  fi
}

# sentry-cli's sourcemap and dSYM uploads are keyed by debug ID, so neither one
# creates the Release object — a build only appears under Releases once a crash
# arrives from it. Create it explicitly so every shipped build is there from the
# start. Non-fatal: the app is already on App Store Connect by this point.
if [[ -n "${SENTRY_AUTH_TOKEN:-}" && -n "${SENTRY_ORG:-}" && -n "${SENTRY_PROJECT:-}" ]]; then
  SENTRY_CLI="node_modules/@sentry/cli/bin/sentry-cli"
  DEPLOY_ENV="${SENTRY_DEPLOY_ENV:-testflight}"
  if "$SENTRY_CLI" releases new "$SENTRY_RELEASE" &&
     "$SENTRY_CLI" releases finalize "$SENTRY_RELEASE" &&
     "$SENTRY_CLI" deploys new -r "$SENTRY_RELEASE" -e "$DEPLOY_ENV"; then
    echo "  ✓ Sentry release ${SENTRY_RELEASE} created → ${DEPLOY_ENV}"
    # Suspect commits, pinned to the exact commit this build came from rather
    # than `--auto`. --auto derives a range from local git lineage, which is
    # wrong whenever the deploy ref diverged from the previous release: release
    # 187 picked up ten commits spanning a rebase that way. Naming one commit
    # lets Sentry compute the range server-side from the previous release, which
    # is both correct and immune to how this checkout was cloned.
    HEAD_SHA="$(git rev-parse HEAD 2>/dev/null || true)"
    if [[ -z "$HEAD_SHA" ]]; then
      sentry_warn "Sentry commit association skipped for ${SENTRY_RELEASE} — not a git checkout"
    elif "$SENTRY_CLI" releases set-commits \
           --commit "${SENTRY_REPO:-RonenMars/threadbase-mobile}@${HEAD_SHA}" \
           "$SENTRY_RELEASE"; then
      echo "  ✓ Sentry commits associated at ${HEAD_SHA}"
    else
      sentry_warn "Sentry commit association failed for ${SENTRY_RELEASE} — is the repo connected in Sentry?"
    fi
  else
    sentry_warn "Sentry release ${SENTRY_RELEASE} not created — check SENTRY_* credentials"
  fi
else
  sentry_warn "SENTRY_AUTH_TOKEN/ORG/PROJECT unset — skipping Sentry release creation"
fi
