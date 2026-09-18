#!/usr/bin/env bash
# Capture the six store-ready promo screenshots on a booted iOS simulator.
#
# Requires: Maestro. Boots a simulator if needed, rebuilds a stale Release
# .app with xcodebuild, and frees mock ports 7071/7072 before capture.
# Usage: npm run test:e2e:promo:screenshots:ios
#
# Override dest with PROMO_SCREENSHOT_DIR. E2E_SKIP_SIM_REBOOT defaults to 1
# so a marketing capture does not bounce the sim that already has the app.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FLOWS=(
  e2e/promo_screenshots_start.yaml
  e2e/promo_screenshots_take_over.yaml
  e2e/promo_screenshots_search.yaml
  e2e/promo_screenshots_multi_machine.yaml
  e2e/promo_screenshots_approval.yaml
)
if [[ -n "${PROMO_SCREENSHOT_FLOWS:-}" ]]; then
  # shellcheck disable=SC2206
  FLOWS=(${PROMO_SCREENSHOT_FLOWS})
fi

DEST="${PROMO_SCREENSHOT_DIR:-e2e/_artifacts/promo-screenshots/ios}"
export E2E_SKIP_SIM_REBOOT="${E2E_SKIP_SIM_REBOOT:-1}"
export E2E_MOCK_SERVER_URL="${E2E_MOCK_SERVER_URL:-http://localhost:7071}"
# Rebuild a stale Release .app with xcodebuild (does not hang holding Metro).
export E2E_REBUILD_STALE=1

# shellcheck source=e2e/ensure-promo-device.sh
source "$ROOT/e2e/ensure-promo-device.sh"
ensure_promo_simulator

MOCK_PID=""
cleanup() {
  if [[ -n "$MOCK_PID" ]]; then
    kill "$MOCK_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

node e2e/check-sim.js
# clearState does not wipe SecureStore. A leftover pairing (this run: localhost:7081)
# skips onboarding, never hits the mock on 7071, and every flow fails as "not visible".
reset_promo_ios_app
node e2e/ensure-release-build.js

UDID="${MAESTRO_UDID:-}"
if [[ -z "$UDID" ]]; then
  UDID="$(xcrun simctl list devices booted | awk -F '[()]' '/Booted/ { print $2; exit }')"
fi
if [[ -n "$UDID" ]]; then
  printf 'mock-key-123' | xcrun simctl pbcopy "$UDID"
fi

ensure_promo_mock_ports
MOCK_PORTS=7071,7072 node e2e/mock-server.js &
MOCK_PID=$!
node e2e/wait-for-mock.js || { kill "$MOCK_PID" 2>/dev/null || true; exit 1; }
node e2e/wait-for-mock.js 7072 || { kill "$MOCK_PID" 2>/dev/null || true; exit 1; }

set +e
node e2e/run-maestro.js test \
  --debug-output e2e/_artifacts/debug \
  --test-output-dir e2e/_artifacts/maestro-output \
  "${FLOWS[@]}"
STATUS=$?
set -e

kill "$MOCK_PID" 2>/dev/null || true
MOCK_PID=""

set +e
bash e2e/collect-promo-screenshots.sh ios "$DEST"
COLLECT=$?
set -e
if [[ "$STATUS" -ne 0 ]]; then
  exit "$STATUS"
fi
exit "$COLLECT"
