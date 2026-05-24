#!/usr/bin/env bash
# Pagination e2e runner — boots the pagination mock-server, runs the two
# maestro flows (classic + hub views), asserts the visual progression
# completed, then asserts the mock's request log shows pagination actually
# fired (multiple /api/conversations requests with monotonically increasing
# offsets).
#
# Usage:
#   ./scripts/run-pagination-e2e.sh                 # run both flows
#   ./scripts/run-pagination-e2e.sh classic         # classic only
#   ./scripts/run-pagination-e2e.sh hub             # hub only
#
# Exit codes:
#   0 — both visual and network assertions passed
#   1 — visual flow failed (maestro non-zero)
#   2 — network assertion failed (no multi-page pagination observed)
#   3 — mock failed to start

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

WHICH="${1:-both}"
MOCK_PORT="${MOCK_PORT:-7072}"
MOCK_LOG="/tmp/pagination-mock-$$.log"
MOCK_PID=""

cleanup() {
  if [[ -n "$MOCK_PID" ]] && kill -0 "$MOCK_PID" 2>/dev/null; then
    echo ""
    echo "→ stopping mock (PID=$MOCK_PID)"
    kill "$MOCK_PID" 2>/dev/null || true
    wait "$MOCK_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# ── Start mock ───────────────────────────────────────────────────────────
echo "▶ starting pagination mock on :$MOCK_PORT (346 conversations)"
MOCK_PORT="$MOCK_PORT" MOCK_TOTAL_CONVERSATIONS=346 MOCK_TOTAL_SESSIONS=5 \
  node e2e/pagination-mock-server.js > "$MOCK_LOG" 2>&1 &
MOCK_PID=$!

# Block until the mock prints its ready line — without this, maestro can race
# the mock and hit a connection-refused.
for i in $(seq 1 25); do
  if grep -q "pagination mock listening" "$MOCK_LOG"; then
    break
  fi
  sleep 0.2
done

if ! grep -q "pagination mock listening" "$MOCK_LOG"; then
  echo "✗ mock failed to start within 5s. Output:"
  cat "$MOCK_LOG"
  exit 3
fi
echo "  mock ready (PID=$MOCK_PID, log=$MOCK_LOG)"
echo ""

# ── Run flows ────────────────────────────────────────────────────────────
# Resolve the booted iOS simulator's UDID so maestro doesn't pick a stray
# Android emulator that happens to be running. We always target iOS because
# the testID/accessibilityLabel selectors and the screenshot path conventions
# here are iOS-built-app oriented.
IOS_UDID="$(xcrun simctl list devices booted 2>/dev/null | awk -F '[()]' '/Booted/ { print $2; exit }' || true)"
if [[ -z "$IOS_UDID" ]]; then
  echo "✗ no booted iOS simulator found. Boot one with: open -a Simulator"
  exit 3
fi
echo "  targeting iOS simulator: $IOS_UDID"
echo ""

run_flow() {
  local flow="$1"
  local label="$2"
  echo "▶ running $label flow: $flow"
  if ! maestro --platform ios --device "$IOS_UDID" test "$flow"; then
    echo "✗ $label maestro flow FAILED"
    return 1
  fi
  echo "✓ $label flow passed"
  return 0
}

FLOWS_OK=1
case "$WHICH" in
  classic) run_flow "e2e/pagination-classic.yaml" "classic" || FLOWS_OK=0 ;;
  hub)     run_flow "e2e/pagination-hub.yaml" "hub"         || FLOWS_OK=0 ;;
  both)
    run_flow "e2e/pagination-classic.yaml" "classic" || FLOWS_OK=0
    run_flow "e2e/pagination-hub.yaml" "hub"          || FLOWS_OK=0
    ;;
  *) echo "usage: $0 [classic|hub|both]"; exit 2 ;;
esac

if [[ $FLOWS_OK -eq 0 ]]; then
  echo ""
  echo "Visual flows failed. See maestro output above."
  exit 1
fi

# ── Network-pagination assertion ─────────────────────────────────────────
echo ""
echo "▶ asserting pagination network contract"
REQUESTS_JSON="$(curl -fsS "http://localhost:$MOCK_PORT/__mock/requests" || echo '{}')"

node -e "
  const log = JSON.parse(process.argv[1] || '{}').requests || [];
  // All requests to /api/conversations across the test run.
  const convReqs = log.filter(r => r.method === 'GET' && r.path === '/api/conversations');
  console.log(\`  /api/conversations requests: \${convReqs.length}\`);

  const offsets = convReqs
    .map(r => parseInt(r.query.offset || '0', 10))
    .filter(o => !isNaN(o));

  const distinctOffsets = [...new Set(offsets)].sort((a,b)=>a-b);
  console.log(\`  distinct offsets seen: \${JSON.stringify(distinctOffsets)}\`);

  // Pass criteria:
  //   ≥ 2 distinct offsets → pagination actually fetched multiple pages
  //   At least one offset > 0 → not all calls were the first page
  if (distinctOffsets.length < 2) {
    console.error('✗ FAIL: fewer than 2 distinct offsets — pagination did not run');
    process.exit(2);
  }
  if (!distinctOffsets.some(o => o > 0)) {
    console.error('✗ FAIL: no offset > 0 observed — only first page was fetched');
    process.exit(2);
  }
  console.log('✓ pagination network contract verified');
" "$REQUESTS_JSON"

echo ""
echo "✅ pagination e2e PASSED"
