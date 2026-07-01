#!/usr/bin/env bash
# Start Metro (or a full native build) advertising a cloudflared tunnel URL via
# EXPO_PACKAGER_PROXY_URL, so a device off the LAN can reach the bundler.
#
# Preferred path: a *named* tunnel (stable hostname, e.g. metro.rbv1000.win)
# already routed to localhost:8081 in ~/.cloudflared/config.yml and run as a
# long-lived service. The script reuses that URL — it does not start cloudflared.
#
# Fallback (no named tunnel configured): a *quick* tunnel (*.trycloudflare.com).
# cloudflared exits if nothing listens on 8081, so a dummy HTTP listener keeps it
# alive while the URL is extracted, then it's swapped for Metro.
#
# Usage:
#   npm run dev:tunnel                       # JS-only (dev client already installed)
#   npm run dev:tunnel -- -c                 # same + clear Metro cache
#   DEVICE_UDID=... npm run dev:tunnel:native # full native rebuild over USB

set -euo pipefail

NATIVE=0
CLEAR_CACHE=0
DEVICE_UDID="${DEVICE_UDID:-}"

usage() {
  cat <<EOF
Usage: $0 [options]

Options:
  --native        Full native rebuild + install (requires DEVICE_UDID env var)
  -c, --clear     Clear Metro transform cache
  -h, --help      Show this help

Environment:
  DEVICE_UDID     Legacy device UDID for --native. Find with: npm run dev:list-devices

Tunnel selection:
  Uses the named tunnel URL from EXPO_PACKAGER_PROXY_URL (env or .env), or the
  metro hostname routed to :8081 in ~/.cloudflared/config.yml. The named tunnel
  is assumed already running. If none is configured, falls back to a quick
  *.trycloudflare.com tunnel. See docs/remote-dev-tunnel.md for setup.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --native)   NATIVE=1;      shift ;;
    -c|--clear) CLEAR_CACHE=1; shift ;;
    -h|--help)  usage; exit 0         ;;
    *) echo "Unknown option: $1"; echo; usage; exit 1 ;;
  esac
done

if [[ "$NATIVE" == "1" && -z "$DEVICE_UDID" ]]; then
  echo "Error: DEVICE_UDID is required for --native."
  echo "  Run: npm run dev:list-devices"
  exit 1
fi

if ! command -v cloudflared &>/dev/null; then
  echo "cloudflared not found. Install with:"
  echo "  brew install cloudflare/cloudflare/cloudflared"
  exit 1
fi

# --- Determine tunnel mode ---

TUNNEL_LOG=$(mktemp)
TUNNEL_PID=""
DUMMY_PID=""

cleanup() {
  [[ -n "$DUMMY_PID" ]] && kill "$DUMMY_PID" 2>/dev/null || true
  [[ -n "$TUNNEL_PID" ]] && kill "$TUNNEL_PID" 2>/dev/null || true
  rm -f "$TUNNEL_LOG"
}
trap cleanup EXIT

# Prefer the named tunnel: a stable hostname (e.g. metro.rbv1000.win) that's
# already routed to localhost:8081 in ~/.cloudflared/config.yml and run as a
# long-lived service. We don't start cloudflared here — we just reuse the URL.
# Source order: EXPO_PACKAGER_PROXY_URL (env), then .env, then config.yml ingress.
NAMED_URL="${EXPO_PACKAGER_PROXY_URL:-}"
if [[ -z "$NAMED_URL" && -f .env ]]; then
  NAMED_URL=$(grep -E '^EXPO_PACKAGER_PROXY_URL=' .env | head -1 | cut -d= -f2- | tr -d '"' || true)
fi
if [[ -z "$NAMED_URL" && -f "$HOME/.cloudflared/config.yml" ]]; then
  METRO_HOST=$(grep -B1 'service: *http://127.0.0.1:8081' "$HOME/.cloudflared/config.yml" \
    | grep -o 'hostname: *[^ ]*' | awk '{print $2}' | head -1 || true)
  [[ -n "$METRO_HOST" ]] && NAMED_URL="https://$METRO_HOST"
fi

if [[ -n "$NAMED_URL" ]]; then
  echo "▸ Using named tunnel: $NAMED_URL"
  echo "  (assumed already running via ~/.cloudflared/config.yml — not started here)"
  TUNNEL_URL="$NAMED_URL"
else
  # Quick tunnel — temporary *.trycloudflare.com URL, no account needed.
  # cloudflared exits immediately if port 8081 has no listener, so spin up a
  # minimal Node HTTP server as a placeholder until we have the URL.
  node -e "require('http').createServer().listen(8081)" &
  DUMMY_PID=$!

  echo "▸ Starting cloudflared quick tunnel..."
  cloudflared tunnel --url http://localhost:8081 >"$TUNNEL_LOG" 2>&1 &
  TUNNEL_PID=$!

  TUNNEL_URL=""
  for _ in $(seq 1 60); do
    TUNNEL_URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$TUNNEL_LOG" \
      | head -1 || true)
    [[ -n "$TUNNEL_URL" ]] && break
    sleep 0.5
  done

  kill "$DUMMY_PID" 2>/dev/null || true
  wait "$DUMMY_PID" 2>/dev/null || true
  DUMMY_PID=""

  if [[ -z "$TUNNEL_URL" ]]; then
    echo "Failed to get tunnel URL after 30s. cloudflared output:"
    cat "$TUNNEL_LOG"
    exit 1
  fi
fi

echo "  Tunnel: $TUNNEL_URL"
echo

# --- Launch Metro / native build ---

if [[ "$NATIVE" == "1" ]]; then
  echo "▸ Building and installing on device: $DEVICE_UDID"
  EXPO_PACKAGER_PROXY_URL="$TUNNEL_URL" npx expo run:ios --device "$DEVICE_UDID"
else
  # No --lan: with EXPO_PACKAGER_PROXY_URL set, Metro advertises the tunnel URL
  # as the manifest/bundle authority (matches the working scripts/dev-metro.js
  # path). --lan overrides that with the LAN IP and breaks off-network loads.
  ARGS="--dev-client"
  [[ "$CLEAR_CACHE" == "1" ]] && ARGS="$ARGS -c"
  echo "▸ Starting Metro"
  # Expo CLI occasionally crashes with `Error: read EIO` on its stdin TTY
  # stream (Node/Expo CLI bug, unrelated to this script) — retry instead of
  # killing the whole tunnel session.
  RESTARTS=0
  while true; do
    EXPO_PACKAGER_PROXY_URL="$TUNNEL_URL" npx expo start $ARGS && break
    RESTARTS=$((RESTARTS + 1))
    if [[ "$RESTARTS" -ge 5 ]]; then
      echo "Metro exited 5 times in a row — giving up."
      exit 1
    fi
    echo "▸ Metro exited unexpectedly (restart $RESTARTS/5), restarting..."
  done
fi
