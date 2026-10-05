#!/usr/bin/env bash
# Capture the marketing demo screenshots on an iOS simulator.
#
# Starts the three-machine demo streamer, runs the e2e/marketing flows and
# copies their screenshots to artifacts/marketing/threadbase-maestro/. A failed
# flow leaves Maestro's failure screenshot under diagnostics/ there.
#
# Usage: npm run test:e2e:marketing
#        MARKETING_FLOWS="e2e/marketing/02-agent-memory.yaml" npm run test:e2e:marketing
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

FLOWS=(
  e2e/marketing/01-start-anywhere.yaml
  e2e/marketing/02-agent-memory.yaml
  e2e/marketing/03-control-plane.yaml
)
if [[ -n "${MARKETING_FLOWS:-}" ]]; then
  # shellcheck disable=SC2206
  FLOWS=(${MARKETING_FLOWS})
fi

DEST="${MARKETING_SCREENSHOT_DIR:-artifacts/marketing/threadbase-maestro}"
OUT="e2e/_artifacts/marketing-output"
export E2E_SKIP_SIM_REBOOT="${E2E_SKIP_SIM_REBOOT:-1}"
export E2E_REBUILD_STALE="${E2E_REBUILD_STALE:-1}"

# shellcheck source=e2e/ensure-promo-device.sh
source "$ROOT/e2e/ensure-promo-device.sh"
ensure_promo_simulator
node e2e/check-sim.js
node e2e/ensure-release-build.js

STREAMER_PID=""
trap '[[ -n "$STREAMER_PID" ]] && kill "$STREAMER_PID" 2>/dev/null || true' EXIT

for port in 7071 7072 7073; do
  if lsof -ti ":${port}" -sTCP:LISTEN >/dev/null; then
    echo "Error: port ${port} is in use; stop whatever is listening there first." >&2
    exit 1
  fi
done
node e2e/marketing/demo-streamer.js > e2e/_artifacts/marketing-streamer.log 2>&1 &
STREAMER_PID=$!
node e2e/wait-for-mock.js
node e2e/wait-for-mock.js 7073

rm -rf "$OUT"
set +e
node e2e/run-maestro.js test --debug-output e2e/_artifacts/debug --test-output-dir "$OUT" "${FLOWS[@]}"
STATUS=$?
set -e

mkdir -p "$DEST"
# takeScreenshot writes <run>/<flow>/takeScreenshot/<section>/<name>.png.
find "$OUT" -path '*/takeScreenshot/*' -name '*.png' | while IFS= read -r shot; do
  rel="${shot#*/takeScreenshot/}"
  mkdir -p "$DEST/$(dirname "$rel")"
  cp "$shot" "$DEST/$rel"
  echo "  $rel"
done

if [[ "$STATUS" -ne 0 ]]; then
  mkdir -p "$DEST/diagnostics"
  find "$OUT" e2e/_artifacts/debug -name 'screenshot-❌-*.png' -newer e2e/_artifacts/marketing-streamer.log \
    -exec cp {} "$DEST/diagnostics/" \;
  echo "A flow failed; see ${DEST}/diagnostics and e2e/_artifacts/marketing-streamer.log" >&2
fi
exit "$STATUS"
