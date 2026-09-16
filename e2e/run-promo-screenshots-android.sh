#!/usr/bin/env bash
# Capture the six store-ready promo screenshots on a booted Android emulator.
#
# Requires: Maestro, adb, an API 35 AVD (started automatically if none is running).
# Usage: npm run test:e2e:promo:screenshots:android
#
# Reverse-forwards 7071/7072 so the hardcoded localhost:7072 second-server
# pair in promo_screenshots_multi_machine.yaml reaches the host mock.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=e2e/ensure-promo-device.sh
source "$ROOT/e2e/ensure-promo-device.sh"

export E2E_PLATFORM=android
export E2E_MOCK_SERVER_URL="${E2E_MOCK_SERVER_URL:-http://10.0.2.2:7071}"

DEST="${PROMO_SCREENSHOT_DIR:-e2e/_artifacts/promo-screenshots/android}"
FLOWS="e2e/promo_screenshots_start.yaml e2e/promo_screenshots_take_over.yaml e2e/promo_screenshots_search.yaml e2e/promo_screenshots_multi_machine.yaml e2e/promo_screenshots_approval.yaml"

ensure_promo_emulator

ensure_promo_mock_ports
adb reverse tcp:7071 tcp:7071 >/dev/null
adb reverse tcp:7072 tcp:7072 >/dev/null
adb shell cmd clipboard set-text mock-key-123 >/dev/null 2>&1 || \
  adb shell cmd clipboard set mock-key-123 >/dev/null 2>&1 || \
  true

set +e
FLOWS="$FLOWS" bash e2e/run-android-ci.sh
STATUS=$?
set -e

set +e
bash e2e/collect-promo-screenshots.sh android "$DEST"
COLLECT=$?
set -e
if [[ "$STATUS" -ne 0 ]]; then
  exit "$STATUS"
fi
exit "$COLLECT"
