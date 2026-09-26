#!/usr/bin/env bash
# ship-qa.sh — build an enforced-tracking QA binary and hand it to Firebase App
# Distribution. This is the only channel that carries
# EXPO_PUBLIC_ENFORCE_SENTRY_TRACKING: every store path (ship-ios.sh,
# ship-android.sh) refuses the flag through check-sentry-env.sh.
#
# It deliberately never touches App Store Connect or Google Play. The flag is
# inlined into the JS bundle, so the binary itself is enforced — a build that
# could be promoted between tracks or assigned to a TestFlight group could reach
# the public by one wrong click. Firebase has no path to a store.
#
# Builds report to Sentry as `testing` (services/sentry.ts).
#
# Usage:
#   ./scripts/ship-qa.sh --platform ios     [--groups qa] [--release-notes "..."]
#   ./scripts/ship-qa.sh --platform android [--groups qa] [--release-notes "..."]
#
# Requires:
#   FIREBASE_APP_ID_IOS / FIREBASE_APP_ID_ANDROID   Firebase console → Project settings
#   GOOGLE_APPLICATION_CREDENTIALS                 service account with the Firebase
#                                                  App Distribution Admin role, or a
#                                                  prior `npx firebase-tools login`
#   EXPO_PUBLIC_SENTRY_DSN, SENTRY_AUTH_TOKEN/ORG/PROJECT (shell, .env, or .env.signing*)
#   iOS:     an installed Ad Hoc profile per target (app + widgets) granting App Groups
#   Android: .env.signing.android (the Play upload key)
#
# Build numbers are used as-is (app.json on iOS, build.gradle on Android); nothing is bumped or committed.

set -euo pipefail

PLATFORM=""
TESTER_GROUPS="qa"
RELEASE_NOTES=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --platform)      PLATFORM="$2"; shift 2 ;;
    --groups)        TESTER_GROUPS="$2"; shift 2 ;;
    --release-notes) RELEASE_NOTES="$2"; shift 2 ;;
    -h|--help) sed -n '1,27p' "$0"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

case "$PLATFORM" in ios|android) ;;
  *) echo "--platform must be ios or android" >&2; exit 2 ;;
esac

# Under CI, `expo export:embed` skips the Metro cache reset the release build
# phases ask for, and Metro's transform cache is not keyed on EXPO_PUBLIC_*
# values — an enforced sentry.ts could then be reused by a later store build on
# the same runner. Local runs always reset, so this channel is local-only.
if [[ -n "${CI:-}" ]]; then
  echo "ship-qa.sh does not run under CI: the Metro cache would carry the enforced flag into later builds" >&2
  exit 1
fi

# Loaded before any check reads them, so a value kept in one of these files counts.
# .env is exported because expo-updates' native build step evaluates app.config.js
# without loading it, and the enforced-tracking check there then misses the DSN.
# It goes first so .env.signing still wins, as it does for the Expo CLI.
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi
# shellcheck disable=SC1091
[[ -f .env.signing ]] && source .env.signing
if [[ "$PLATFORM" == android ]]; then
  [[ -f .env.signing.android ]] || { echo ".env.signing.android missing — see docs/deployment.md" >&2; exit 1; }
  # shellcheck disable=SC1091
  source .env.signing.android
fi

if [[ "$PLATFORM" == ios ]]; then
  FIREBASE_APP_ID="${FIREBASE_APP_ID_IOS:-}"
  APP_ID_VAR=FIREBASE_APP_ID_IOS
else
  FIREBASE_APP_ID="${FIREBASE_APP_ID_ANDROID:-}"
  APP_ID_VAR=FIREBASE_APP_ID_ANDROID
fi
[[ -n "$FIREBASE_APP_ID" ]] || { echo "$APP_ID_VAR is not set (Firebase console → Project settings → Your apps)" >&2; exit 1; }

export EXPO_PUBLIC_ENFORCE_SENTRY_TRACKING=1

# app.config.js refuses an enforced build without the DSN and the sentry-cli
# credentials, reading .env the way the bundler will. Evaluate it now rather
# than minutes into a native build.
echo "▸ Checking Sentry configuration"
npx expo config --type public >/dev/null

mkdir -p build
APP_VERSION="$(jq -r '.expo.version' app.json)"

if [[ "$PLATFORM" == ios ]]; then
  TEAM_ID="${ASC_TEAM_ID:-${APPLE_TEAM_ID:-}}"
  [[ -n "$TEAM_ID" ]] || { echo "ASC_TEAM_ID is not set (source .env.signing, or export it)" >&2; exit 1; }

  # Same per-target signing problem dev-device.sh solves: both targets declare
  # the App Group, so each needs its own profile. An Ad Hoc profile lists devices
  # but, unlike a development one, has get-task-allow false. Newest wins, so a
  # profile regenerated after registering a device is picked up. Xcode's
  # "Download Manual Profiles" saves to UserData, not MobileDevice, so scan both.
  read -r ADHOC_APP_UUID ADHOC_WIDGET_UUID <<<"$(
    python3 - "$HOME/Library/MobileDevice/Provisioning Profiles" \
              "$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles" <<'PY'
import datetime, glob, os, plistlib, subprocess, sys

def profiles(directories):
    for path in (p for d in directories for p in glob.glob(os.path.join(d, "*.mobileprovision"))):
        try:
            raw = subprocess.run(["security", "cms", "-D", "-i", path],
                                 capture_output=True, check=True).stdout
            yield plistlib.loads(raw)
        except Exception:
            continue

def pick(plists, suffix):
    now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
    matches = [
        p for p in plists
        if p.get("Entitlements", {}).get("application-identifier", "").endswith("." + suffix)
        and p.get("ProvisionedDevices")
        and not p["Entitlements"].get("get-task-allow")
        and p["Entitlements"].get("com.apple.security.application-groups")
        and p.get("ExpirationDate", now) > now
    ]
    matches.sort(key=lambda p: p.get("CreationDate"), reverse=True)
    return matches[0]["UUID"] if matches else "-"

found = list(profiles(sys.argv[1:]))
print(pick(found, "com.ronenmars.threadbase"),
      pick(found, "com.ronenmars.threadbase.widgets"))
PY
  )"
  if [[ "$ADHOC_APP_UUID" == - || "$ADHOC_WIDGET_UUID" == - ]]; then
    echo "No Ad Hoc profile with App Groups installed for the app and/or the widget target." >&2
    echo "Create both in the Developer portal (Distribution → Ad Hoc), register the QA devices, and install them." >&2
    exit 1
  fi
  echo "  signing: ad hoc (app $ADHOC_APP_UUID, widget $ADHOC_WIDGET_UUID)"

  echo "▸ Pod install"
  (cd ios && bundle exec pod install --silent)
  ./scripts/reset-podfile-lock-path-noise.sh

  BUILD_NUMBER="$(jq -r '.expo.ios.buildNumber' app.json)"
  # Match the release the SDK tags events with — see archive-and-upload.sh.
  export SENTRY_RELEASE="threadbase-mobile-ios@${APP_VERSION}+${BUILD_NUMBER}"
  export SENTRY_DIST="${BUILD_NUMBER}"
  ARCHIVE_PATH=build/Threadbase-qa.xcarchive

  echo "▸ Archive (build $BUILD_NUMBER)"
  xcodebuild \
    -workspace ios/Threadbase.xcworkspace \
    -scheme Threadbase \
    -configuration Release \
    -destination 'generic/platform=iOS' \
    -archivePath "$ARCHIVE_PATH" \
    DEVELOPMENT_TEAM="$TEAM_ID" \
    CODE_SIGN_STYLE=Manual \
    CODE_SIGN_IDENTITY="Apple Distribution" \
    IOS_PROVISION_PROFILE_UUID="$ADHOC_APP_UUID" \
    IOS_WIDGET_PROVISION_PROFILE_UUID="$ADHOC_WIDGET_UUID" \
    CURRENT_PROJECT_VERSION="$BUILD_NUMBER" \
    archive | tee build/archive-qa.log

  cat > build/ExportOptions-qa.plist <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>release-testing</string>
  <key>teamID</key><string>$TEAM_ID</string>
  <key>signingStyle</key><string>manual</string>
  <key>provisioningProfiles</key>
  <dict>
    <key>com.ronenmars.threadbase</key><string>$ADHOC_APP_UUID</string>
    <key>com.ronenmars.threadbase.widgets</key><string>$ADHOC_WIDGET_UUID</string>
  </dict>
</dict>
</plist>
EOF
  rm -rf build/export-qa
  xcodebuild -exportArchive \
    -archivePath "$ARCHIVE_PATH" \
    -exportOptionsPlist build/ExportOptions-qa.plist \
    -exportPath build/export-qa | tee build/export-qa.log
  ARTIFACT="$(find build/export-qa -name '*.ipa' | head -1)"
else
  # The APK carries build.gradle's versionCode (ship-android.sh syncs it from
  # app.json only on a store ship), and that is what the SDK tags events with.
  VERSION_CODE="$(grep -oE 'versionCode [0-9]+' android/app/build.gradle | grep -oE '[0-9]+')"
  export SENTRY_RELEASE="threadbase-mobile-android@${APP_VERSION}+${VERSION_CODE}"
  export SENTRY_DIST="${VERSION_CODE}"
  export TB_MOBILE_UPLOAD_KEYSTORE TB_MOBILE_UPLOAD_KEYSTORE_PASSWORD TB_MOBILE_UPLOAD_KEY_ALIAS TB_MOBILE_UPLOAD_KEY_PASSWORD

  # An APK, not an AAB: Firebase installs APKs directly, while an AAB would
  # need the Firebase project linked to the Play app.
  echo "▸ Assemble release APK (versionCode $VERSION_CODE)"
  (cd android && ./gradlew :app:assembleRelease --no-daemon 2>&1 | tee ../build/gradle-qa.log)
  ARTIFACT=android/app/build/outputs/apk/release/app-release.apk
fi

[[ -f "${ARTIFACT:-}" ]] || { echo "Build produced no artifact" >&2; exit 1; }

echo "▸ Uploading $ARTIFACT to Firebase App Distribution (groups: $TESTER_GROUPS)"
NOTES="${RELEASE_NOTES:-QA build $(git rev-parse --short HEAD) — enforced diagnostics}"
npx --yes firebase-tools@15 appdistribution:distribute "$ARTIFACT" \
  --app "$FIREBASE_APP_ID" \
  --groups "$TESTER_GROUPS" \
  --release-notes "$NOTES"

echo
echo "✅ QA build distributed. Testers see the enforced launch notice (\"I agree\" only); events land in Sentry as \`testing\`."
