#!/usr/bin/env bash
# Run the app on a physical iOS device, optionally over a tunnel.
#
# Modes
#   (default)   Build and install via USB — use after native changes, npm install, or first install.
#   --js-only   Start Metro only — dev client must already be on device, both on same Wi-Fi or tunnel.
#
# Required env / flags
#   DEVICE_UDID or --udid <udid>   Legacy UDID (8+16 hex format). Find with: npm run dev:list-devices
#   TUNNEL_URL  or --tunnel <url>  HTTPS tunnel URL (cloudflared or ngrok).
#                                  Omit when device is on the same Wi-Fi as this machine.
#
# Examples
#   DEVICE_UDID=AABBCCDD-0123456789ABCDEF npm run dev:device
#   TUNNEL_URL=https://abc.trycloudflare.com DEVICE_UDID=... npm run dev:device
#   TUNNEL_URL=https://abc.trycloudflare.com npm run dev:js
#   TUNNEL_URL=https://abc.trycloudflare.com npm run dev:js -- -c   (clear Metro cache)

set -euo pipefail

UDID="${DEVICE_UDID:-}"
TUNNEL_URL="${TUNNEL_URL:-${EXPO_PACKAGER_PROXY_URL:-}}"
JS_ONLY=0
CLEAR_CACHE=0
NO_WATCHMAN="${EXPO_NO_WATCHMAN:-0}"

usage() {
  cat <<EOF
Usage: $0 [options]

Options:
  --udid <udid>    Device UDID (or set DEVICE_UDID env var)
  --js-only        Start Metro only (dev client already installed)
  --tunnel <url>   Tunnel URL (or set TUNNEL_URL / EXPO_PACKAGER_PROXY_URL)
  -c, --clear      Clear Metro transform cache
  --no-watchman    Set EXPO_NO_WATCHMAN=1 (Watchman TCC workaround)
  -h, --help       Show this help

Find your device UDID:
  npm run dev:list-devices

Set up a tunnel (run before this script):
  cloudflared tunnel --url http://localhost:8081
  ngrok http 8081
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --udid)       UDID="$2";       shift 2 ;;
    --js-only)    JS_ONLY=1;       shift   ;;
    --tunnel)     TUNNEL_URL="$2"; shift 2 ;;
    -c|--clear)   CLEAR_CACHE=1;   shift   ;;
    --no-watchman) NO_WATCHMAN=1;  shift   ;;
    -h|--help)    usage; exit 0             ;;
    *) echo "Unknown option: $1"; echo; usage; exit 1 ;;
  esac
done

# Build env exports for subshell
declare -a ENV_VARS=()
[[ -n "$TUNNEL_URL" ]]    && ENV_VARS+=("EXPO_PACKAGER_PROXY_URL=$TUNNEL_URL")
[[ "$NO_WATCHMAN" == "1" ]] && ENV_VARS+=("EXPO_NO_WATCHMAN=1")
ENV_PREFIX="${ENV_VARS[*]+${ENV_VARS[*]} }"

if [[ "$JS_ONLY" == "1" ]]; then
  ARGS="--dev-client"
  [[ "$CLEAR_CACHE" == "1" ]] && ARGS="$ARGS -c"
  [[ -n "$TUNNEL_URL" ]]      && ARGS="$ARGS --lan"

  echo "▸ Starting Metro (JS-only)"
  [[ -n "$TUNNEL_URL" ]] && echo "  Tunnel: $TUNNEL_URL"
  eval "${ENV_PREFIX}npx expo start $ARGS"
else
  if [[ -z "$UDID" ]]; then
    echo "Error: device UDID required."
    echo "  Set DEVICE_UDID env var, pass --udid <udid>, or run: npm run dev:list-devices"
    exit 1
  fi

  echo "▸ Building and installing on device: $UDID"
  [[ -n "$TUNNEL_URL" ]] && echo "  Tunnel: $TUNNEL_URL"

  # Xcode's automatic signing generates an "iOS Team Provisioning Profile" that
  # does not carry App Groups, so an on-device Debug build of this app fails to
  # sign: both Threadbase and ExpoWidgetsTarget declare
  # group.com.ronenmars.threadbase. Automatic signing also ignores hand-made
  # profiles, so the only way through is manual signing with an explicit profile
  # per target.
  #
  # xcodebuild applies command-line build settings to every target at once, which
  # cannot express "different profile per target" — hence the indirection through
  # IOS_PROVISION_PROFILE_UUID / IOS_WIDGET_PROVISION_PROFILE_UUID, which the
  # project maps per target (see plugins/withLiveActivityTarget.js). XCODE_XCCONFIG_FILE
  # is how those reach a build that `expo run:ios` invokes on our behalf.
  #
  # The profiles are discovered from the ones already installed rather than
  # configured, so this needs no per-machine setup: pick a development profile
  # (one with ProvisionedDevices) whose app-id matches and which grants App Groups.
  read -r DEV_APP_UUID DEV_WIDGET_UUID <<<"$(
    python3 - "$HOME/Library/MobileDevice/Provisioning Profiles" <<'PY'
import glob, os, plistlib, subprocess, sys

def profiles(directory):
    for path in glob.glob(os.path.join(directory, "*.mobileprovision")):
        try:
            raw = subprocess.run(["security", "cms", "-D", "-i", path],
                                 capture_output=True, check=True).stdout
            yield plistlib.loads(raw)
        except Exception:
            continue

def pick(plists, suffix):
    for p in plists:
        ent = p.get("Entitlements", {})
        app_id = ent.get("application-identifier", "")
        # ProvisionedDevices is what distinguishes a development/ad-hoc profile
        # from an App Store one, which cannot install to a device.
        if (app_id.endswith("." + suffix)
                and p.get("ProvisionedDevices")
                and ent.get("com.apple.security.application-groups")):
            return p["UUID"]
    return ""

found = list(profiles(sys.argv[1]))
print(pick(found, "com.ronenmars.threadbase"),
      pick(found, "com.ronenmars.threadbase.widgets"))
PY
  )"

  if [[ -n "$DEV_APP_UUID" && -n "$DEV_WIDGET_UUID" ]]; then
    XCCONFIG="$(mktemp -t tb-dev-signing).xcconfig"
    cat > "$XCCONFIG" <<EOF
CODE_SIGN_STYLE = Manual
CODE_SIGN_IDENTITY = Apple Development
IOS_PROVISION_PROFILE_UUID = $DEV_APP_UUID
IOS_WIDGET_PROVISION_PROFILE_UUID = $DEV_WIDGET_UUID
EOF
    trap 'rm -f "$XCCONFIG"' EXIT
    echo "  signing: manual (app $DEV_APP_UUID, widget $DEV_WIDGET_UUID)"
    ENV_PREFIX="${ENV_PREFIX}XCODE_XCCONFIG_FILE=$XCCONFIG "
  else
    echo "  signing: automatic — no development profile with App Groups found."
    echo "           The build will fail to sign; see docs/troubleshooting.md."
  fi

  eval "${ENV_PREFIX}npx expo run:ios --device \"$UDID\""
fi
