#!/usr/bin/env bash
# ship-android.sh — single-command end-to-end Android ship pipeline.
#
#   preflight → install deps → prebuild (if missing) → bootstrap signing →
#   fetch Play credentials → git sync check → check/bump versionCode →
#   bundle + upload → done.
#
# No emulator, no UI. Default track is internal.
#
# Usage:
#   ./scripts/ship-android.sh                           # → Internal testing
#   ./scripts/ship-android.sh --track alpha             # → Closed testing (Alpha)
#   ./scripts/ship-android.sh --track beta              # → Open testing
#   ./scripts/ship-android.sh --track production        # → Production
#
# Play Console UI → API track name mapping:
#   Internal testing  = internal
#   Closed testing    = alpha
#   Open testing      = beta
#   Production        = production
#
# Flags:
#   --track internal|alpha|beta|production  default: internal
#   --skip-preflight                        skip ./scripts/preflight.sh
#   --skip-prebuild                         skip `npx expo prebuild` even if android/ missing
#   --package <id>                          override expo.android.package
#
# Exits non-zero on any failure. Re-running is safe.

set -euo pipefail

TRACK="internal"
SKIP_PREFLIGHT=0
SKIP_PREBUILD=0
PACKAGE_OVERRIDE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --track)          TRACK="$2"; shift 2 ;;
    --skip-preflight) SKIP_PREFLIGHT=1; shift ;;
    --skip-prebuild)  SKIP_PREBUILD=1; shift ;;
    --package)        PACKAGE_OVERRIDE="$2"; shift 2 ;;
    -h|--help) sed -n '1,30p' "$0"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

case "$TRACK" in internal|alpha|beta|production) ;;
  *) echo "--track must be one of: internal alpha beta production" >&2; exit 2 ;;
esac

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TOTAL_STEPS=8

# 1. Preflight
if (( SKIP_PREFLIGHT == 0 )); then
  echo "▸ [1/$TOTAL_STEPS] Preflight (Android)"
  PLATFORM=android "$SCRIPT_DIR/preflight.sh"
else
  echo "▸ [1/$TOTAL_STEPS] Preflight — skipped"
fi

# 2. Install deps (detect package manager)
echo "▸ [2/$TOTAL_STEPS] Install dependencies"
if   [[ -f bun.lockb || -f bun.lock ]]; then bun install
elif [[ -f pnpm-lock.yaml ]];           then pnpm install
elif [[ -f yarn.lock ]];               then yarn install
else                                        npm ci --legacy-peer-deps || npm install --legacy-peer-deps
fi
npx expo install --check >/dev/null || true

# 3. Prebuild if android/ missing
if (( SKIP_PREBUILD == 0 )) && [[ ! -d android ]]; then
  echo "▸ [3/$TOTAL_STEPS] Prebuild (no android/ directory)"
  npx expo prebuild --platform android --non-interactive
else
  echo "▸ [3/$TOTAL_STEPS] Prebuild — android/ exists, skipping"
fi

# 4. Bootstrap Android signing from 1Password
# Skip if .env.signing.android already exists and keystore is on disk.
if [[ -f .env.signing.android ]]; then
  _ks_path=$(bash -c 'source .env.signing.android 2>/dev/null && echo "${TB_MOBILE_UPLOAD_KEYSTORE:-}"')
  if [[ -n "$_ks_path" && -f "$_ks_path" ]]; then
    echo "▸ [4/$TOTAL_STEPS] Android signing already bootstrapped — skipping"
    source .env.signing.android
  else
    echo "▸ [4/$TOTAL_STEPS] Bootstrap Android signing"
    "$SCRIPT_DIR/bootstrap-android-signing.sh"
    source .env.signing.android
  fi
else
  echo "▸ [4/$TOTAL_STEPS] Bootstrap Android signing"
  "$SCRIPT_DIR/bootstrap-android-signing.sh"
  source .env.signing.android
fi

# 5. Fetch Google Play service-account credentials from 1Password.
# Always fetch — the canonical credential lives in 1Password (written to
# ~/.config/threadbase/play-console-sa.json). Never trust an ambient
# GOOGLE_APPLICATION_CREDENTIALS from the shell environment; it may point
# at a different service account (e.g. a gcloud ADC credential).
echo "▸ [5/$TOTAL_STEPS] Fetch Google Play credentials"
CREDS_PATH=$("$SCRIPT_DIR/fetch-play-credentials.sh")
export GOOGLE_APPLICATION_CREDENTIALS="$CREDS_PATH"

# 6. Git sync — refuse to ship if local main is behind origin/main, or if
# app.json has uncommitted changes.
echo "▸ [6/$TOTAL_STEPS] Git sync check"
"$SCRIPT_DIR/git-sync-check.sh"

# 7. Verify (and auto-bump) versionCode against Play
echo "▸ [7/$TOTAL_STEPS] Check versionCode against Play"
"$SCRIPT_DIR/check-version-code.sh"

# 8. Build AAB + upload to Play
PACKAGE="${PACKAGE_OVERRIDE:-$(jq -r '.expo.android.package' app.json)}"
[[ -n "$PACKAGE" && "$PACKAGE" != "null" ]] || { echo "Could not resolve android package name" >&2; exit 1; }

echo "▸ [8/$TOTAL_STEPS] Bundle and upload"
ANDROID_TRACK="$TRACK" "$SCRIPT_DIR/bundle-and-upload-android.sh"

echo
echo "✅  Build is live on Play ($TRACK track)."
echo "    Open Play Console to promote to a wider track when ready."
