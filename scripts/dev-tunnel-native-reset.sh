#!/usr/bin/env bash
# Full clean rebuild + native tunnel run.
#
# Usage:
#   npm run dev:tunnel:native:reset -- <DEVICE_UDID>

set -euo pipefail

DEVICE_UDID="${1:-}"
if [[ -z "$DEVICE_UDID" ]]; then
  echo "Usage: $0 <DEVICE_UDID>"
  echo "  Find a UDID with: npm run dev:list-devices"
  exit 1
fi

echo "▸ Clearing Metro cache"
rm -rf "${TMPDIR:-/tmp}/metro-"* "${TMPDIR:-/tmp}/haste-map-"*

echo "▸ Reinstalling node_modules"
rm -rf node_modules
npm install

echo "▸ Reinstalling Pods"
cd ios
rm -rf Pods
bundle exec pod install
cd ..
./scripts/reset-podfile-lock-path-noise.sh

echo "▸ Running native tunnel build for device: $DEVICE_UDID"
DEVICE_UDID="$DEVICE_UDID" ./scripts/start-cloudflared.sh --native
