#!/usr/bin/env bash
# Start a cloudflared quick tunnel pointing at Metro (port 8081), then launch
# Metro (or a full native build) with EXPO_PACKAGER_PROXY_URL set automatically.
#
# The chicken-and-egg problem: cloudflared exits if nothing listens on 8081,
# but Metro needs EXPO_PACKAGER_PROXY_URL at startup (so the URL must be known
# first). This script solves it by briefly running a dummy HTTP listener to keep
# cloudflared alive while the tunnel URL is extracted, then switching to Metro.
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

Named tunnel (stable URL):
  If CLOUDFLARED_TUNNEL_NAME is set, runs a named tunnel instead of a quick tunnel.
  Requires one-time setup — see docs/remote-dev-tunnel.md for steps.
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

TUNNEL_NAME="${CLOUDFLARED_TUNNEL_NAME:-}"
TUNNEL_LOG=$(mktemp)
TUNNEL_PID=""
DUMMY_PID=""

cleanup() {
  [[ -n "$DUMMY_PID" ]] && kill "$DUMMY_PID" 2>/dev/null || true
  [[ -n "$TUNNEL_PID" ]] && kill "$TUNNEL_PID" 2>/dev/null || true
  rm -f "$TUNNEL_LOG"
}
trap cleanup EXIT

if [[ -n "$TUNNEL_NAME" ]]; then
  # Named tunnel — stable URL, no dummy listener needed.
  # The named tunnel keeps running regardless of whether Metro is up yet.
  echo "▸ Starting named tunnel: $TUNNEL_NAME"
  cloudflared tunnel run "$TUNNEL_NAME" >"$TUNNEL_LOG" 2>&1 &
  TUNNEL_PID=$!

  # Named tunnels don't print a trycloudflare.com URL — read the hostname
  # from the config file or the DNS route set up during one-time setup.
  TUNNEL_URL=$(cloudflared tunnel info "$TUNNEL_NAME" 2>/dev/null \
    | grep -o 'https://[^ ]*' | head -1 || true)

  if [[ -z "$TUNNEL_URL" ]]; then
    echo "Could not resolve tunnel URL for '$TUNNEL_NAME'."
    echo "Run the one-time DNS setup described in docs/remote-dev-tunnel.md."
    exit 1
  fi
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
  ARGS="--dev-client --lan"
  [[ "$CLEAR_CACHE" == "1" ]] && ARGS="$ARGS -c"
  echo "▸ Starting Metro"
  EXPO_PACKAGER_PROXY_URL="$TUNNEL_URL" npx expo start $ARGS
fi
