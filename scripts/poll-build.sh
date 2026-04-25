#!/usr/bin/env bash
# Poll App Store Connect for the latest build's processing state.
#
# Usage:
#   ./scripts/poll-build.sh <bundle-id> [--watch] [--timeout SECS] [--interval SECS]
#
# Defaults:
#   --watch off (single-shot)   --timeout 1800   --interval 30
#
# The --timeout cap *always* applies, including in --watch mode. There is
# no "loop forever" option by design. --timeout is hard-capped at 1800
# seconds (30 min); a larger value is rejected with exit 2.
#
# Hard kill switches (any one will end the script — no ghost processes):
#   1. Per-curl    : --connect-timeout 5 --max-time 15
#   2. Wall clock  : SECONDS-based check inside the loop
#   3. Iterations  : defensive cap independent of time
#   4. Failure cap : 5 consecutive curl errors = give up
#   5. Watchdog    : background process that SIGTERM/SIGKILLs us at $TIMEOUT
#   6. Orphan check: bail if PPID becomes 1 (parent shell died)
#   7. Trap chain  : INT/TERM/HUP/EXIT all reach cleanup
#
# Exit codes:
#   0  build VALID
#   1  build INVALID / EXPIRED / app not found
#   2  bad usage
#   3  too many consecutive API failures
#   4  timeout / iteration cap (state still PROCESSING)
#  130  interrupted (Ctrl-C / orphaned)

set -euo pipefail

# ───── usage ─────
usage() {
  cat >&2 <<EOF
Usage: $0 <bundle-id> [--watch] [--timeout SECS] [--interval SECS]
  --watch          loop until VALID/INVALID/EXPIRED (default: single-shot)
  --timeout SECS   wall-clock timeout (default 1800)
  --interval SECS  poll interval (default 30)
EOF
  exit 2
}

BUNDLE_ID="${1:-}"
[[ -z "$BUNDLE_ID" || "$BUNDLE_ID" == --* ]] && usage
shift

WATCH=false
TIMEOUT=1800
INTERVAL=30
MAX_FAIL=5

while [[ $# -gt 0 ]]; do
  case "$1" in
    --watch)    WATCH=true; shift ;;
    --timeout)  TIMEOUT="${2:?--timeout needs a value}"; shift 2 ;;
    --interval) INTERVAL="${2:?--interval needs a value}"; shift 2 ;;
    -h|--help)  usage ;;
    *) echo "Unknown arg: $1" >&2; usage ;;
  esac
done

# Sanity-check numeric args
TIMEOUT_HARD_MAX=1800   # 30 min — enforced; the script will refuse longer values
[[ "$TIMEOUT"  =~ ^[0-9]+$ ]] || { echo "--timeout must be an integer"  >&2; exit 2; }
[[ "$INTERVAL" =~ ^[0-9]+$ ]] || { echo "--interval must be an integer" >&2; exit 2; }
(( TIMEOUT  > 0 )) || { echo "--timeout must be > 0"  >&2; exit 2; }
(( INTERVAL > 0 )) || { echo "--interval must be > 0" >&2; exit 2; }
if (( TIMEOUT > TIMEOUT_HARD_MAX )); then
  echo "--timeout=${TIMEOUT} exceeds the hard cap of ${TIMEOUT_HARD_MAX}s (30 min)." >&2
  echo "If processing legitimately takes longer, run the script again." >&2
  exit 2
fi
(( INTERVAL <= TIMEOUT )) || { echo "--interval ($INTERVAL) cannot exceed --timeout ($TIMEOUT)" >&2; exit 2; }

# ───── env ─────
: "${ASC_KEY_ID:?source .env.signing first}"
: "${ASC_ISSUER_ID:?source .env.signing first}"
: "${ASC_KEY_PATH:?source .env.signing first}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
JWT_SCRIPT="$SCRIPT_DIR/asc-jwt.sh"
[[ -x "$JWT_SCRIPT" ]] || { echo "Missing or not executable: $JWT_SCRIPT" >&2; exit 1; }
command -v jq >/dev/null   || { echo "jq not installed (brew install jq)" >&2; exit 1; }
command -v curl >/dev/null || { echo "curl not installed" >&2; exit 1; }

MAIN_PID=$$

# ───── watchdog (kill switch #5) ─────
# Background process that survives even if the main loop hangs in a syscall.
# SIGTERM grace then SIGKILL. Verifies the target PID is still us before firing.
(
  sleep "$TIMEOUT"
  if kill -0 "$MAIN_PID" 2>/dev/null; then
    echo "[poll-build] watchdog: ${TIMEOUT}s elapsed, terminating $MAIN_PID" >&2
    kill -TERM "$MAIN_PID" 2>/dev/null || true
    sleep 5
    kill -0 "$MAIN_PID" 2>/dev/null && kill -KILL "$MAIN_PID" 2>/dev/null || true
  fi
) &
WATCHDOG_PID=$!
disown "$WATCHDOG_PID" 2>/dev/null || true

cleanup() {
  local rc=$?
  [[ -n "${WATCHDOG_PID:-}" ]] && kill "$WATCHDOG_PID" 2>/dev/null || true
  exit $rc
}
trap cleanup EXIT
trap 'echo "[poll-build] interrupted" >&2; exit 130' INT TERM HUP

# ───── JWT management (refresh every 10 min, well under 19m token life) ─────
JWT=""
JWT_ISSUED=0

refresh_jwt() {
  local now
  now=$(date +%s)
  if [[ -z "$JWT" || $((now - JWT_ISSUED)) -gt 600 ]]; then
    JWT="$("$JWT_SCRIPT")" || { echo "Failed to mint JWT" >&2; exit 1; }
    JWT_ISSUED=$now
  fi
}

# ───── API helpers (kill switch #1: per-call timeout) ─────
API="https://api.appstoreconnect.apple.com/v1"

api_get() {
  curl -sS -G \
    --connect-timeout 5 \
    --max-time 15 \
    --retry 0 \
    --fail-with-body \
    -H "Authorization: Bearer $JWT" \
    "$@"
}

resolve_app_id() {
  api_get "$API/apps" --data-urlencode "filter[bundleId]=$BUNDLE_ID" --data-urlencode "limit=1" \
    | jq -r '.data[0].id // empty'
}

latest_build_json() {
  local app_id="$1"
  api_get "$API/builds" \
    --data-urlencode "filter[app]=$app_id" \
    --data-urlencode "sort=-uploadedDate" \
    --data-urlencode "limit=1"
}

# ───── main ─────
refresh_jwt

APP_ID=""
if ! APP_ID=$(resolve_app_id); then
  echo "Failed to resolve app for bundleId=$BUNDLE_ID" >&2
  exit 1
fi
[[ -z "$APP_ID" ]] && { echo "No app found with bundleId=$BUNDLE_ID" >&2; exit 1; }

START=$SECONDS
ITER=0
FAIL=0
MAX_ITER=$(( TIMEOUT / INTERVAL + 10 ))

while :; do
  # Kill switch #6: orphaned (parent shell died)
  if [[ "$(ps -o ppid= -p $$ | tr -d ' ')" == "1" ]]; then
    echo "[poll-build] parent process gone, exiting" >&2
    exit 130
  fi

  refresh_jwt

  if json=$(latest_build_json "$APP_ID" 2>/dev/null); then
    FAIL=0
    line=$(echo "$json" | jq -r '
      .data[0]
      | "\(.id)|\(.attributes.version)|\(.attributes.processingState)|\(.attributes.uploadedDate)|\(.attributes.expired)"
    ')
    if [[ -z "$line" || "$line" == "null|null|null|null|null" ]]; then
      echo "[$(date +%H:%M)] no build visible yet"
    else
      IFS='|' read -r BUILD_ID VER STATE UPLOADED EXPIRED <<<"$line"
      printf '[%s] build %s  %-12s uploaded %s\n' \
        "$(date +%H:%M)" "$VER" "$STATE" "$UPLOADED"

      case "$STATE" in
        VALID)
          echo "✓ ready in TestFlight (build id: $BUILD_ID)"
          exit 0
          ;;
        INVALID)
          echo "✗ build INVALID. Inspect: $API/builds/$BUILD_ID"
          exit 1
          ;;
      esac
      [[ "$EXPIRED" == "true" ]] && { echo "✗ build EXPIRED"; exit 1; }
    fi
  else
    FAIL=$((FAIL + 1))
    echo "[$(date +%H:%M)] API call failed (#$FAIL/$MAX_FAIL)" >&2
    # Kill switch #4: too many consecutive failures
    if (( FAIL >= MAX_FAIL )); then
      echo "[poll-build] $MAX_FAIL consecutive failures — giving up" >&2
      exit 3
    fi
  fi

  $WATCH || exit 0   # single-shot mode

  # Kill switch #3: iteration cap
  ITER=$((ITER + 1))
  if (( ITER >= MAX_ITER )); then
    echo "[poll-build] iteration cap ($MAX_ITER) hit — giving up" >&2
    exit 4
  fi
  # Kill switch #2: wall-clock check (independent of watchdog)
  if (( SECONDS - START >= TIMEOUT )); then
    echo "[poll-build] wall-clock timeout (${TIMEOUT}s) — giving up" >&2
    exit 4
  fi

  sleep "$INTERVAL"
done
