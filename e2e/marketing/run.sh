#!/usr/bin/env bash
# Capture the marketing demo screenshots on an iOS simulator or an Android
# emulator.
#
# Starts the three-machine demo streamer, runs the e2e/marketing flows and
# copies their screenshots to artifacts/marketing/threadbase-maestro/. A failed
# flow leaves Maestro's failure screenshot under diagnostics/ there.
#
# Usage: npm run test:e2e:marketing
#        MARKETING_FLOWS="e2e/marketing/02-agent-memory.yaml" npm run test:e2e:marketing
#
# Other devices write to their own folder so the iPhone set stays in place:
#   MAESTRO_UDID=<booted iPad udid> MARKETING_SCREENSHOT_DIR=artifacts/marketing/threadbase-maestro/ipad npm run test:e2e:marketing
#   E2E_PLATFORM=android E2E_ANDROID_AVD=<avd> MARKETING_SCREENSHOT_DIR=artifacts/marketing/threadbase-maestro/android-phone npm run test:e2e:marketing
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
PAIR_HOST=localhost

# shellcheck source=e2e/ensure-promo-device.sh
source "$ROOT/e2e/ensure-promo-device.sh"
if [[ "${E2E_PLATFORM:-}" == "android" ]]; then
  ensure_promo_emulator
  export MAESTRO_UDID="$ANDROID_SERIAL"
  # Emulator localhost is the emulator itself. 10.0.2.2 rather than
  # `adb reverse`: a reverse dies with the adb transport, which bounces.
  PAIR_HOST=10.0.2.2
  # Same clock in every shot, as `simctl status_bar` gives the iOS set.
  adb shell settings put global sysui_demo_allowed 1 >/dev/null
  demo() { adb shell am broadcast -a com.android.systemui.demo "$@" >/dev/null; }
  demo -e command clock -e hhmm 0941
  demo -e command network -e wifi show -e level 4
  demo -e command network -e mobile show -e datatype none -e level 4
  demo -e command battery -e level 100 -e plugged false
  demo -e command notifications -e visible false
  RELEASE_APK="${E2E_RELEASE_APK:-android/app/build/outputs/apk/release/app-release.apk}"
  if [[ ! -f "$RELEASE_APK" ]]; then
    # Local Release APK uses the debug keystore unless a real upload store is set.
    export TB_MOBILE_UPLOAD_KEYSTORE="${TB_MOBILE_UPLOAD_KEYSTORE:-$ROOT/android/app/debug.keystore}"
    export TB_MOBILE_UPLOAD_KEYSTORE_PASSWORD="${TB_MOBILE_UPLOAD_KEYSTORE_PASSWORD:-android}"
    export TB_MOBILE_UPLOAD_KEY_ALIAS="${TB_MOBILE_UPLOAD_KEY_ALIAS:-androiddebugkey}"
    export TB_MOBILE_UPLOAD_KEY_PASSWORD="${TB_MOBILE_UPLOAD_KEY_PASSWORD:-android}"
    export SENTRY_DISABLE_AUTO_UPLOAD="${SENTRY_DISABLE_AUTO_UPLOAD:-true}"
    abi="$(adb shell getprop ro.product.cpu.abi | tr -d '\r')"
    (cd android && ./gradlew :app:assembleRelease -PreactNativeArchitectures="${REACT_NATIVE_ARCHITECTURES:-$abi}")
  fi
  # clearState does not wipe SecureStore; a reinstall does.
  adb uninstall com.ronenmars.threadbase >/dev/null 2>&1 || true
  adb install -r "$RELEASE_APK"
  # `adb install` can bounce the emulator's adb transport (see
  # e2e/run-android-ci.sh); Maestro then dies with "device offline". On a
  # freshly booted emulator the bounce came 13s after the install.
  sleep 20
  wait_for_emulator >/dev/null
else
  ensure_promo_simulator
fi
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
node e2e/run-maestro.js test -e "PAIR_HOST=${PAIR_HOST}" --debug-output e2e/_artifacts/debug --test-output-dir "$OUT" "${FLOWS[@]}"
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
