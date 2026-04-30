#!/usr/bin/env bash
# ship.sh — single-command end-to-end ship pipeline.
#
#   preflight → install deps → prebuild (if missing) → bootstrap signing →
#   check/bump build number → archive → upload → poll until VALID → optionally submit for App Store review.
#
# No simulator, no UI. Default target is TestFlight.
#
# Usage:
#   ./scripts/ship.sh                                       # → TestFlight
#   ./scripts/ship.sh --target testflight                   # → TestFlight (explicit)
#   ./scripts/ship.sh --target production --release-notes "Fixes..." \
#                     --release-type AFTER_APPROVAL         # → App Store review
#
# Flags:
#   --target testflight|production           default: testflight
#   --release-notes "..."                    en-US whatsNew (production only)
#   --release-type MANUAL|AFTER_APPROVAL|SCHEDULED  default: MANUAL
#   --release-date 2026-04-26T08:00:00-07:00 required for SCHEDULED
#   --skip-preflight                         skip ./scripts/preflight.sh
#   --skip-prebuild                          skip `npx expo prebuild` even if ios/ missing
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
BUNDLE_ID_OVERRIDE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)         TARGET="$2"; shift 2 ;;
    --release-notes)  RELEASE_NOTES="$2"; shift 2 ;;
    --release-type)   RELEASE_TYPE="$2"; shift 2 ;;
    --release-date)   RELEASE_DATE="$2"; shift 2 ;;
    --skip-preflight) SKIP_PREFLIGHT=1; shift ;;
    --skip-prebuild)  SKIP_PREBUILD=1; shift ;;
    --bundle-id)      BUNDLE_ID_OVERRIDE="$2"; shift 2 ;;
    -h|--help) sed -n '1,30p' "$0"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

case "$TARGET" in testflight|production) ;;
  *) echo "--target must be testflight or production" >&2; exit 2 ;;
esac

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(pwd)"

# 1. Preflight
if (( SKIP_PREFLIGHT == 0 )); then
  echo "▸ [1/6] Preflight"
  "$SCRIPT_DIR/preflight.sh"
fi

# 2. Install deps (detect package manager)
echo "▸ [2/6] Install dependencies"
if   [[ -f bun.lockb || -f bun.lock ]]; then bun install
elif [[ -f pnpm-lock.yaml ]];          then pnpm install
elif [[ -f yarn.lock ]];               then yarn install
else                                        npm ci || npm install
fi
npx expo install --check >/dev/null || true

# 3. Prebuild if ios/ missing
if (( SKIP_PREBUILD == 0 )) && [[ ! -d ios ]]; then
  echo "▸ [3/6] Prebuild (no ios/ directory)"
  npx expo prebuild --platform ios --non-interactive
fi

# 4. Bootstrap iOS signing from 1Password
# Skip if .env.signing already exists and the .p8 key is materialized on disk.
# On a fresh machine (or after rotating the key) the bootstrap will re-run and
# repopulate both files from 1Password (requires OP_SERVICE_ACCOUNT_TOKEN or
# an active `op signin` session).
# shellcheck disable=SC1091
if [[ -f .env.signing ]] && source .env.signing 2>/dev/null && [[ -f "${ASC_KEY_PATH:-}" ]]; then
  echo "▸ [4/6] iOS signing already bootstrapped — skipping"
else
  echo "▸ [4/6] Bootstrap iOS signing"
  "$SCRIPT_DIR/bootstrap-ios-signing.sh"
  source .env.signing
fi

# 5. Verify (and auto-bump) build number against TestFlight
echo "▸ [5/7] Check build number against TestFlight"
"$SCRIPT_DIR/check-build-number.sh"

# 6. Archive + upload
echo "▸ [6/7] Archive and upload"
"$SCRIPT_DIR/archive-and-upload.sh"

# Resolve bundle id for polling
BUNDLE_ID="${BUNDLE_ID_OVERRIDE:-$(jq -r '.expo.ios.bundleIdentifier' app.json)}"
[[ -n "$BUNDLE_ID" && "$BUNDLE_ID" != "null" ]] || { echo "Could not resolve bundleId" >&2; exit 1; }

# 7. Wait until VALID (or timeout — bounded by poll-build.sh kill switches)
echo "▸ [7/7] Wait for App Store Connect processing"
"$SCRIPT_DIR/poll-build.sh" "$BUNDLE_ID" --watch --timeout 1800 --interval 30

if [[ "$TARGET" == "testflight" ]]; then
  echo
  echo "✅ Build is live on TestFlight."
  exit 0
fi

# 8. Production: submit for App Store review
echo "▸ [8/8] Submit for App Store review"
VERSION=$(jq -r '.expo.version' app.json)
[[ -n "$VERSION" && "$VERSION" != "null" ]] || { echo "expo.version missing in app.json" >&2; exit 1; }

ARGS=("$BUNDLE_ID" "$VERSION" --release-type "$RELEASE_TYPE")
[[ -n "$RELEASE_NOTES" ]] && ARGS+=(--release-notes "$RELEASE_NOTES")
[[ -n "$RELEASE_DATE"  ]] && ARGS+=(--release-date  "$RELEASE_DATE")
"$SCRIPT_DIR/submit-for-review.sh" "${ARGS[@]}"

echo
echo "✅ Submitted $VERSION for App Store review (releaseType=$RELEASE_TYPE)."
