#!/usr/bin/env bash
# Pre-start for promo screenshot capture: reuse a booted device, or start one.
#
# Usage:
#   ./e2e/ensure-promo-device.sh android
#   ./e2e/ensure-promo-device.sh ios
#   source e2e/ensure-promo-device.sh && ensure_promo_emulator
#
# Android: if an emulator is already booted, export ANDROID_SERIAL and return.
# Otherwise start E2E_ANDROID_AVD, or the first AVD matching E2E_ANDROID_API_LEVEL
# (default 35), and wait until sys.boot_completed=1.
# iOS: if a simulator is already booted, export MAESTRO_UDID and return.
# Otherwise boot MAESTRO_UDID / E2E_IOS_DEVICE / an iPhone on iOS 26 or older.
PROMO_DEVICE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

ensure_android_sdk_path() {
  local sdk="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
  export PATH="${sdk}/platform-tools:${sdk}/emulator:${PATH}"
  if ! command -v adb >/dev/null 2>&1; then
    echo "Error: adb not found. Set ANDROID_HOME (currently ${sdk})." >&2
    return 1
  fi
  if ! command -v emulator >/dev/null 2>&1; then
    echo "Error: emulator not found under ${sdk}/emulator." >&2
    return 1
  fi
}

ready_emulator_serial() {
  local serial state
  while IFS=$'\t' read -r serial state; do
    [[ "$serial" == emulator-* ]] || continue
    [[ "$state" == device ]] || continue
    if [[ "$(adb -s "$serial" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]]; then
      printf '%s' "$serial"
      return 0
    fi
  done < <(adb devices | awk 'NR > 1 && $1 != "" { print $1 "\t" $2 }')
  return 1
}

wait_for_emulator() {
  local deadline=$((SECONDS + ${E2E_DEVICE_WAIT_SECONDS:-300}))
  local poll="${E2E_DEVICE_POLL_SECONDS:-2}"
  local serial=""
  while (( SECONDS < deadline )); do
    if serial="$(ready_emulator_serial)"; then
      printf '%s' "$serial"
      return 0
    fi
    sleep "$poll"
  done
  echo "Error: no booted Android emulator after ${E2E_DEVICE_WAIT_SECONDS:-300}s." >&2
  adb devices >&2 || true
  return 1
}

list_avds() {
  emulator -list-avds 2>/dev/null | sed '/^$/d'
}

avd_api_level() {
  local name="$1"
  local avd_home="${ANDROID_AVD_HOME:-$HOME/.android/avd}"
  local ini="${avd_home}/${name}.ini"
  local config=""
  local path_line=""
  if [[ -f "$ini" ]]; then
    path_line="$(awk -F= '/^path=/ { print substr($0, index($0, "=") + 1); exit }' "$ini")"
    if [[ -n "$path_line" && -f "${path_line}/config.ini" ]]; then
      config="${path_line}/config.ini"
    fi
  fi
  if [[ -z "$config" && -f "${avd_home}/${name}.avd/config.ini" ]]; then
    config="${avd_home}/${name}.avd/config.ini"
  fi
  [[ -f "$config" ]] || return 0
  grep -E -o 'android-[0-9]+' "$config" | head -1 | grep -E -o '[0-9]+' || true
}

pick_avd() {
  local wanted="${E2E_ANDROID_AVD:-}"
  local api="${E2E_ANDROID_API_LEVEL:-35}"
  local avd_list first="" level=""
  avd_list="$(list_avds)"
  if [[ -z "$avd_list" ]]; then
    echo "Error: no Android Virtual Devices found. Create one, e.g." >&2
    echo "  avdmanager create avd -n Pixel_API_35 -k 'system-images;android-35;google_apis;arm64-v8a' -d pixel_6" >&2
    return 1
  fi
  if [[ -n "$wanted" ]]; then
    if printf '%s\n' "$avd_list" | grep -Fxq "$wanted"; then
      printf '%s' "$wanted"
      return 0
    fi
    echo "Error: E2E_ANDROID_AVD=${wanted} is not in \`emulator -list-avds\`." >&2
    printf '%s\n' "$avd_list" >&2
    return 1
  fi
  while IFS= read -r avd; do
    [[ -z "$avd" ]] && continue
    if [[ -z "$first" ]]; then
      first="$avd"
    fi
    level="$(avd_api_level "$avd" || true)"
    if [[ "$level" == "$api" ]]; then
      printf '%s' "$avd"
      return 0
    fi
  done <<< "$avd_list"
  echo "Warning: no API ${api} AVD found; starting ${first}." >&2
  printf '%s' "$first"
}

ensure_promo_emulator() {
  ensure_android_sdk_path
  local serial avd log
  if serial="$(ready_emulator_serial)"; then
    echo "Using already-running Android emulator ${serial}."
    export ANDROID_SERIAL="$serial"
    return 0
  fi
  avd="$(pick_avd)"
  log="${PROMO_DEVICE_ROOT}/e2e/_artifacts/promo-emulator.log"
  mkdir -p "$(dirname "$log")"
  echo "Starting Android emulator AVD ${avd}..."
  emulator -avd "$avd" -netdelay none -netspeed full >"$log" 2>&1 &
  serial="$(wait_for_emulator)"
  echo "Android emulator is running: ${serial}."
  export ANDROID_SERIAL="$serial"
}

booted_ios_udid() {
  if [[ -n "${MAESTRO_UDID:-}" ]]; then
    local state
    state="$(xcrun simctl list devices booted | awk -F '[()]' -v id="$MAESTRO_UDID" '$0 ~ id && /Booted/ { print "booted"; exit }')"
    if [[ "$state" == "booted" ]]; then
      printf '%s' "$MAESTRO_UDID"
      return 0
    fi
    return 1
  fi
  xcrun simctl list devices booted | awk -F '[()]' '/Booted/ { print $2; exit }'
}

pick_ios_udid_to_boot() {
  python3 - <<'PY'
import json, os, re, subprocess, sys

def load():
    return json.loads(subprocess.check_output(["xcrun", "simctl", "list", "devices", "-j"], text=True))

data = load()
max_major = 26
wanted = os.environ.get("MAESTRO_UDID") or ""
named = os.environ.get("E2E_IOS_DEVICE") or ""
available = []
for runtime, devices in data.get("devices", {}).items():
    match = re.search(r"iOS-(\d+)", runtime)
    major = int(match.group(1)) if match else None
    for device in devices:
        if not device.get("isAvailable", True):
            continue
        if device.get("state") not in ("Shutdown", "Booted"):
            continue
        available.append({**device, "major": major})

if wanted:
    for device in available:
        if device.get("udid") == wanted:
            print(device["udid"])
            raise SystemExit(0)
    sys.stderr.write(f"Error: MAESTRO_UDID={wanted} is not an available simulator.\n")
    raise SystemExit(1)

candidates = [d for d in available if d.get("major") is not None and d["major"] <= max_major and d.get("state") == "Shutdown"]
if named:
    for device in candidates:
        if device.get("name") == named:
            print(device["udid"])
            raise SystemExit(0)
    sys.stderr.write(
        f"Error: E2E_IOS_DEVICE={named!r} is not an available iOS {max_major} or older simulator.\n"
    )
    raise SystemExit(1)

iphones = [d for d in candidates if "iPhone" in (d.get("name") or "")]
pick = iphones[0] if iphones else (candidates[0] if candidates else None)
if pick is None:
    sys.stderr.write("Error: no available iOS simulator on iOS 26 or older to boot.\n")
    raise SystemExit(1)
print(pick["udid"])
PY
}

ensure_promo_simulator() {
  local udid
  if udid="$(booted_ios_udid)" && [[ -n "$udid" ]]; then
    echo "Using already-running iOS simulator ${udid}."
  else
    udid="$(pick_ios_udid_to_boot)"
    echo "Starting iOS simulator ${udid}..."
    xcrun simctl boot "$udid" >/dev/null
    xcrun simctl bootstatus "$udid" -b >/dev/null
    open -a Simulator --args -CurrentDeviceUDID "$udid" >/dev/null 2>&1 || true
    echo "iOS simulator is running: ${udid}."
  fi
  shutdown_extra_ios_simulators "$udid"
  export MAESTRO_UDID="$udid"
}

# Maestro's XCUITest driver times out when two sims are booted.
shutdown_extra_ios_simulators() {
  local keep="$1"
  local udid
  while IFS= read -r udid; do
    [[ -z "$udid" || "$udid" == "$keep" ]] && continue
    echo "Shutting down extra simulator ${udid} (Maestro needs exactly one)."
    xcrun simctl shutdown "$udid" >/dev/null 2>&1 || true
  done < <(xcrun simctl list devices booted | awk -F '[()]' '/Booted/ { print $2 }')
}

# Leftover mock-server (or anything else) on 7071/7072 makes wait-for-mock
# succeed against the wrong process, or the new server die with EADDRINUSE.
ensure_promo_mock_ports() {
  local port pids
  for port in 7071 7072; do
    pids="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)"
    if [[ -n "$pids" ]]; then
      echo "Freeing port ${port} (PID ${pids//$'\n'/ }) for the mock server."
      # shellcheck disable=SC2086
      kill $pids 2>/dev/null || true
    fi
  done
  sleep 0.3
}

# expo-secure-store lives in the Keychain and survives launchApp clearState.
# Uninstalling is what forces setup.yaml through onboarding onto the mock.
reset_promo_ios_app() {
  local udid="${MAESTRO_UDID:-booted}"
  echo "Uninstalling Threadbase so pairing does not reuse a leftover server."
  if [[ "$udid" == "booted" ]]; then
    xcrun simctl uninstall booted com.ronenmars.threadbase >/dev/null 2>&1 || true
  else
    xcrun simctl uninstall "$udid" com.ronenmars.threadbase >/dev/null 2>&1 || true
  fi
}

ensure_promo_device() {
  local platform="${1:-${E2E_PLATFORM:-android}}"
  case "$platform" in
    android) ensure_promo_emulator ;;
    ios) ensure_promo_simulator ;;
    *)
      echo "Usage: $0 <android|ios>" >&2
      return 2
      ;;
  esac
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  set -euo pipefail
  ensure_promo_device "${1:-}"
fi
