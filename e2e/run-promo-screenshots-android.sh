#!/usr/bin/env bash
# Capture the six store-ready promo screenshots on a booted Android emulator.
#
# Requires: Maestro, adb, an API 35 AVD (started automatically if none is running).
# Usage: npm run test:e2e:promo:screenshots:android
#
# Reverse-forwards 7071/7072 so the hardcoded localhost:7072 second-server
# pair in promo_screenshots_multi_machine.yaml reaches the host mock.
# Set MAESTRO_RECORD=0 to skip the whole-suite adb screenrecord.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=e2e/ensure-promo-device.sh
source "$ROOT/e2e/ensure-promo-device.sh"

export E2E_PLATFORM=android
export E2E_MOCK_SERVER_URL="${E2E_MOCK_SERVER_URL:-http://10.0.2.2:7071}"
# Emulator localhost is the emulator itself; 10.0.2.2 is the host mock.
export E2E_SECOND_SERVER_HOST="${E2E_SECOND_SERVER_HOST:-10.0.2.2:7072}"
# Local Release APK uses the debug keystore unless a real upload store is set.
export TB_MOBILE_UPLOAD_KEYSTORE="${TB_MOBILE_UPLOAD_KEYSTORE:-$ROOT/android/app/debug.keystore}"
export TB_MOBILE_UPLOAD_KEYSTORE_PASSWORD="${TB_MOBILE_UPLOAD_KEYSTORE_PASSWORD:-android}"
export TB_MOBILE_UPLOAD_KEY_ALIAS="${TB_MOBILE_UPLOAD_KEY_ALIAS:-androiddebugkey}"
export TB_MOBILE_UPLOAD_KEY_PASSWORD="${TB_MOBILE_UPLOAD_KEY_PASSWORD:-android}"
export SENTRY_DISABLE_AUTO_UPLOAD="${SENTRY_DISABLE_AUTO_UPLOAD:-true}"

DEST="${PROMO_SCREENSHOT_DIR:-e2e/_artifacts/promo-screenshots/android}"
FLOWS="e2e/promo_screenshots_start.yaml e2e/promo_screenshots_take_over.yaml e2e/promo_screenshots_search.yaml e2e/promo_screenshots_multi_machine.yaml e2e/promo_screenshots_approval.yaml"
if [[ -n "${PROMO_SCREENSHOT_FLOWS:-}" ]]; then
  FLOWS="${PROMO_SCREENSHOT_FLOWS}"
  export PROMO_SCREENSHOT_PARTIAL=1
fi
MAESTRO_RECORD="${MAESTRO_RECORD:-1}"

ensure_promo_emulator
# Pin Maestro to this emulator. A leftover MAESTRO_UDID from an iOS promo
# run (same shell) makes Maestro drive the simulator with 10.0.2.2, and
# pairing never leaves the PAIR step.
export MAESTRO_UDID="${ANDROID_SERIAL}"

if [[ -z "${REACT_NATIVE_ARCHITECTURES:-}" ]]; then
  abi="$(adb shell getprop ro.product.cpu.abi | tr -d '\r')"
  case "$abi" in
    arm64-v8a) export REACT_NATIVE_ARCHITECTURES=arm64-v8a ;;
    x86_64) export REACT_NATIVE_ARCHITECTURES=x86_64 ;;
    *) export REACT_NATIVE_ARCHITECTURES="${abi:-x86_64}" ;;
  esac
  echo "Building APK for ${REACT_NATIVE_ARCHITECTURES} (${abi})."
fi

ensure_promo_mock_ports
adb reverse tcp:7071 tcp:7071 >/dev/null
adb reverse tcp:7072 tcp:7072 >/dev/null
adb shell cmd clipboard set-text mock-key-123 >/dev/null 2>&1 || \
  adb shell cmd clipboard set mock-key-123 >/dev/null 2>&1 || \
  true

RECORD_PID=""
cleanup_record() {
  if [[ -n "$RECORD_PID" ]]; then
    kill -INT "$RECORD_PID" 2>/dev/null || true
    adb shell pkill -INT screenrecord >/dev/null 2>&1 || true
    wait "$RECORD_PID" 2>/dev/null || true
    RECORD_PID=""
    mkdir -p "$DEST"
    adb pull /sdcard/promo-suite.mp4 "${DEST}/promo-suite.mp4" >/dev/null 2>&1 || true
    if [[ -f "${DEST}/promo-suite.mp4" ]]; then
      echo "Suite video: ${DEST}/promo-suite.mp4"
    fi
  fi
}
trap cleanup_record EXIT

# Assemble before screenrecord so the video is the Maestro run, not gradle.
RELEASE_APK="${E2E_RELEASE_APK:-android/app/build/outputs/apk/release/app-release.apk}"
if [[ ! -f "$RELEASE_APK" ]]; then
  echo "Assembling Release APK for ${REACT_NATIVE_ARCHITECTURES}..."
  (cd android && ./gradlew :app:assembleRelease -PreactNativeArchitectures="${REACT_NATIVE_ARCHITECTURES}")
fi

if [[ "$MAESTRO_RECORD" != "0" ]]; then
  mkdir -p "$DEST"
  adb shell rm -f /sdcard/promo-suite.mp4 >/dev/null 2>&1 || true
  # --time-limit 0 drops the 180s cap. Maestro startRecording still writes
  # per-flow mp4s; this is the whole-suite artifact if a flow fails.
  adb shell screenrecord --time-limit 0 /sdcard/promo-suite.mp4 >/tmp/promo-android-record.err 2>&1 &
  RECORD_PID=$!
  sleep 1
fi

set +e
FLOWS="$FLOWS" bash e2e/run-android-ci.sh
STATUS=$?
set -e

cleanup_record
trap - EXIT

set +e
bash e2e/collect-promo-screenshots.sh android "$DEST"
COLLECT=$?
set -e
if [[ "$STATUS" -ne 0 ]]; then
  exit "$STATUS"
fi
exit "$COLLECT"
