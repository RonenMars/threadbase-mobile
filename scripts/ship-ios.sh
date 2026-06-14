#!/usr/bin/env bash
# ship-ios.sh — single-command end-to-end iOS ship pipeline.
#
#   preflight → install deps → prebuild (if missing) → bootstrap signing →
#   check/bump build number → archive → upload → poll until VALID → optionally submit for App Store review.
#
# No simulator, no UI. Default target is TestFlight.
#
# Usage:
#   ./scripts/ship-ios.sh                                       # → TestFlight
#   ./scripts/ship-ios.sh --target testflight                   # → TestFlight (explicit)
#   ./scripts/ship-ios.sh --target production --release-notes "Fixes..." \
#                         --release-type AFTER_APPROVAL         # → App Store review
#
# Flags:
#   --target testflight|production           default: testflight
#   --release-notes "..."                    en-US whatsNew (production only)
#   --release-type MANUAL|AFTER_APPROVAL|SCHEDULED  default: MANUAL
#   --release-date 2026-04-26T08:00:00-07:00 required for SCHEDULED
#   --skip-preflight                         skip ./scripts/preflight.sh
#   --skip-prebuild                          skip `npx expo prebuild` even if ios/ missing
#   --skip-git-sync                          skip git sync check (used by CI)
#   --skip-version-check                     skip build number reconciliation (used by CI)
#   --bundle-id <id>                         override expo.ios.bundleIdentifier
#
# Exits non-zero on any failure. Re-running is safe.

set -euo pipefail

TARGET="testflight"
RELEASE_NOTES=""
RELEASE_TYPE="MANUAL"
RELEASE_DATE=""
SKIP_PREFLIGHT=0
SKIP_PREBUILD=0
SKIP_GIT_SYNC=0
SKIP_VERSION_CHECK=0
BUNDLE_ID_OVERRIDE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)              TARGET="$2"; shift 2 ;;
    --release-notes)       RELEASE_NOTES="$2"; shift 2 ;;
    --release-type)        RELEASE_TYPE="$2"; shift 2 ;;
    --release-date)        RELEASE_DATE="$2"; shift 2 ;;
    --skip-preflight)      SKIP_PREFLIGHT=1; shift ;;
    --skip-prebuild)       SKIP_PREBUILD=1; shift ;;
    --skip-git-sync)       SKIP_GIT_SYNC=1; shift ;;
    --skip-version-check)  SKIP_VERSION_CHECK=1; shift ;;
    --bundle-id)           BUNDLE_ID_OVERRIDE="$2"; shift 2 ;;
    -h|--help) sed -n '1,30p' "$0"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

case "$TARGET" in testflight|production) ;;
  *) echo "--target must be testflight or production" >&2; exit 2 ;;
esac

case "$RELEASE_TYPE" in MANUAL|AFTER_APPROVAL|SCHEDULED) ;;
  *) echo "--release-type must be MANUAL, AFTER_APPROVAL, or SCHEDULED" >&2; exit 2 ;;
esac

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(pwd)"

TOTAL_STEPS=8
[[ "$TARGET" == "production" ]] && TOTAL_STEPS=9

# 1. Preflight
if (( SKIP_PREFLIGHT == 0 )); then
  echo "▸ [1/$TOTAL_STEPS] Preflight"
  "$SCRIPT_DIR/preflight.sh"
fi

# 2. Install deps (detect package manager)
echo "▸ [2/$TOTAL_STEPS] Install dependencies"
if   [[ -f bun.lockb || -f bun.lock ]]; then bun install
elif [[ -f pnpm-lock.yaml ]];          then pnpm install
elif [[ -f yarn.lock ]];               then yarn install
else                                        npm ci --legacy-peer-deps || npm install --legacy-peer-deps
fi
npx expo install --check >/dev/null || true

# 3. Prebuild if ios/ missing
if (( SKIP_PREBUILD == 0 )) && [[ ! -d ios ]]; then
  echo "▸ [3/$TOTAL_STEPS] Prebuild (no ios/ directory)"
  npx expo prebuild --platform ios --non-interactive
fi

# 4. Bootstrap iOS signing from 1Password
# Skip if .env.signing already exists and the .p8 key is materialized on disk.
# On a fresh machine (or after rotating the key) the bootstrap will re-run and
# repopulate both files from 1Password (requires OP_SERVICE_ACCOUNT_TOKEN or
# an active `op signin` session).
# shellcheck disable=SC1091
if [[ -f .env.signing ]] && source .env.signing 2>/dev/null && [[ -f "${ASC_KEY_PATH:-}" ]]; then
  echo "▸ [4/$TOTAL_STEPS] iOS signing already bootstrapped — skipping"
else
  echo "▸ [4/$TOTAL_STEPS] Bootstrap iOS signing"
  "$SCRIPT_DIR/bootstrap-ios-signing.sh"
  source .env.signing
fi

# 5. Git sync — refuse to ship if local main is behind origin/main, or if
# app.json has uncommitted changes. Catches the multi-machine "someone else
# already shipped a higher build number on another laptop" footgun.
# Skipped in CI: the workflow checks out main fresh and owns the bump commit.
if (( SKIP_GIT_SYNC == 0 )); then
  echo "▸ [5/$TOTAL_STEPS] Git sync check"
  "$SCRIPT_DIR/git-sync-check.sh"
else
  echo "▸ [5/$TOTAL_STEPS] Git sync check — skipped (CI)"
fi

# 6. Verify (and auto-bump) build number against TestFlight
# Skipped in CI: the workflow runs check-build-number.sh as a separate step
# before invoking ship-ios.sh, commits the bump to main, and pushes.
if (( SKIP_VERSION_CHECK == 0 )); then
  echo "▸ [6/$TOTAL_STEPS] Check build number against TestFlight"
  "$SCRIPT_DIR/check-build-number.sh"
else
  echo "▸ [6/$TOTAL_STEPS] Build number check — skipped (CI)"
fi

# 7. Archive + upload
echo "▸ [7/$TOTAL_STEPS] Archive and upload"
"$SCRIPT_DIR/archive-and-upload.sh"

# Resolve bundle id + build number for polling. The buildNumber pin prevents
# the script from latching onto the previous VALID build during the 30–120s
# Apple-side indexing window after a fresh upload.
BUNDLE_ID="${BUNDLE_ID_OVERRIDE:-$(jq -r '.expo.ios.bundleIdentifier' app.json)}"
[[ -n "$BUNDLE_ID" && "$BUNDLE_ID" != "null" ]] || { echo "Could not resolve bundleId" >&2; exit 1; }
BUILD_NUMBER=$(jq -r '.expo.ios.buildNumber' app.json)
[[ -n "$BUILD_NUMBER" && "$BUILD_NUMBER" != "null" ]] || { echo "Could not resolve buildNumber" >&2; exit 1; }

# 8. Wait until VALID (or timeout — bounded by poll-build.sh kill switches)
echo "▸ [8/$TOTAL_STEPS] Wait for App Store Connect processing (build $BUILD_NUMBER)"
"$SCRIPT_DIR/poll-build.sh" "$BUNDLE_ID" --build-version "$BUILD_NUMBER" --watch --timeout 1800 --interval 30

if [[ "$TARGET" == "testflight" ]]; then
  echo
  echo "✅ Build is live on TestFlight."
  exit 0
fi

# 9. Production: submit for App Store review
echo "▸ [9/$TOTAL_STEPS] Submit for App Store review"
VERSION=$(jq -r '.expo.version' app.json)
[[ -n "$VERSION" && "$VERSION" != "null" ]] || { echo "expo.version missing in app.json" >&2; exit 1; }

ARGS=("$BUNDLE_ID" "$VERSION" --release-type "$RELEASE_TYPE")
[[ -n "$RELEASE_NOTES" ]] && ARGS+=(--release-notes "$RELEASE_NOTES")
[[ -n "$RELEASE_DATE"  ]] && ARGS+=(--release-date  "$RELEASE_DATE")
"$SCRIPT_DIR/submit-for-review.sh" "${ARGS[@]}"

echo
echo "✅ Submitted $VERSION for App Store review (releaseType=$RELEASE_TYPE)."
