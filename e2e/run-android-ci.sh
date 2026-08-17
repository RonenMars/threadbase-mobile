#!/usr/bin/env bash
# run-android-ci.sh — the Android E2E body for .github/workflows/e2e.yml.
#
# This lives in a file rather than inline in the workflow because
# reactivecircus/android-emulator-runner splits its `script:` input on newlines
# and runs each line as a separate `sh -c` invocation. A multi-line body is
# therefore not a script at all: shell state (set -e, functions, traps,
# variables) does not survive from one line to the next, and any line dash
# rejects fails the job on its own. Run 31853259980 died exactly there —
# `bash <<'EOF'` ran as one command reading an empty stdin, then the next line
# reached dash by itself:
#
#   /usr/bin/sh: 1: set: Illegal option -o pipefail
#
# Keeping the workflow's `script:` to the single line that invokes this file is
# what makes the body run under one bash, as written.
#
# Expects: repo root as cwd, a booted emulator, and $FLOWS (possibly empty).

set -euo pipefail

# Before the trap, not alongside the Maestro setup further down: the trap's
# screenshot redirect targets this directory, so creating it late means an early
# failure — a gradle or install failure, the ones most worth a screenshot — loses
# its evidence to `No such file or directory` before the redirect even runs.
mkdir -p e2e/_artifacts/debug e2e/_artifacts/fallback

capture_failure() {
  STATUS=$?
  if [ "$STATUS" -ne 0 ]; then
    adb exec-out screencap -p > e2e/_artifacts/fallback/emulator-at-failure.png || true
    # `|| true` is load-bearing. With `set -euo pipefail`, an unmatched glob makes
    # this pipeline fail, the assignment inherits that status, and `set -e` aborts
    # the trap — so the script exits with `ls`'s status instead of the real one and
    # never copies the session directory. It is also platform-dependent: GNU `ls`
    # exits 2 where BSD `ls` exits 1, so the wrong code differs between CI and a
    # Mac, which is what made it survive local runs.
    LATEST=$(ls -dt ~/.maestro/tests/*/ 2>/dev/null | head -1) || true
    if [ -n "$LATEST" ]; then
      mkdir -p e2e/_artifacts/maestro-session
      cp -R "$LATEST" e2e/_artifacts/maestro-session/ || true
    fi
  fi
  exit "$STATUS"
}
trap capture_failure EXIT

# Bounded, because the obvious form is not: `adb wait-for-device` and a bare
# `until getprop` loop both block forever and print nothing when no device is
# attached. On 2026-08-15 an emulator went away mid-run and this step sat for
# fifteen minutes writing a zero-byte log; on CI that consumes the whole
# 75-minute job and yields no signal. Failing loudly after a bounded wait costs
# a rerun; failing silently costs the runner.
#
# The getprop poll subsumes `wait-for-device`: with nothing attached it just
# keeps failing until the deadline.
wait_for_booted() {
  local seconds="$1"
  local message="$2"
  local deadline=$(( SECONDS + seconds ))
  until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do
    if [ "$SECONDS" -ge "$deadline" ]; then
      echo "::error::${message}" >&2
      adb devices >&2 || true
      exit 1
    fi
    sleep 2
  done
}

E2E_DEVICE_WAIT_SECONDS="${E2E_DEVICE_WAIT_SECONDS:-300}"
wait_for_booted "$E2E_DEVICE_WAIT_SECONDS" "No booted Android device after ${E2E_DEVICE_WAIT_SECONDS}s. Attached devices:"
adb shell input keyevent 82
# The workflow assembles this APK before the emulator boots and restores it
# from Actions cache on a later dispatch of the same commit. Skip gradle when
# that file is already here so the emulator is not held idle for a 20-minute
# compile — that idle window is what made later Maestro flows die with
# `device offline`. A local run without a prebuilt APK still compiles here.
RELEASE_APK="${E2E_RELEASE_APK:-android/app/build/outputs/apk/release/app-release.apk}"
if [ -f "$RELEASE_APK" ]; then
  echo "Using existing Release APK at ${RELEASE_APK}."
else
  # x86_64 is what the CI emulator image is. Overridable so the same script can
  # be run against a local arm64 emulator, which is the only way to exercise
  # this file outside a paid runner.
  (cd android && ./gradlew :app:assembleRelease -PreactNativeArchitectures="${REACT_NATIVE_ARCHITECTURES:-x86_64}")
fi
# Uninstall first: `-r` keeps app data, and `launchApp: clearState: true` does
# not wipe SecureStore, so credentials from a previous successful pairing
# survive into the next run and change the path onboarding takes. The resulting
# failure looks like an app defect rather than stale state — it cost two
# debugging cycles on 2026-08-15. CI is masked from this because every job gets
# a fresh emulator; a local rerun is not.
adb uninstall com.ronenmars.threadbase > /dev/null 2>&1 || true
adb install -r "$RELEASE_APK"
# `adb install` can bounce the emulator's adb transport. The first Maestro flow
# (launch.yaml) then died in ~2s with "device offline" on runs 31937461153,
# 31941055453, and 32004798693, while every later flow paired fine. Re-wait
# before Maestro talks to the device.
wait_for_booted 60 "Emulator went offline after APK install."
# Pixel Launcher ANRs on a cold google_apis Pixel_6 boot. The system dialog
# sits on top of the app, so Maestro's hub/welcome probes both miss — run
# 32036081591 died that way, with Get started visible under the ANR.
# Previously gradle held the emulator idle for ~20 min before Maestro, which
# let the launcher settle. The suite never uses the launcher.
for pkg in com.google.android.apps.nexuslauncher com.android.launcher3 com.google.android.apps.wellbeing; do
  adb shell pm disable-user --user 0 "$pkg" >/dev/null 2>&1 || \
    adb shell am force-stop "$pkg" >/dev/null 2>&1 || true
done
if [ -z "${FLOWS:-}" ]; then
  npm run test:e2e:mock
  exit 0
fi
for f in $FLOWS; do
  case "$f" in
    e2e/*.yaml) ;;
    *) echo "::error::Refusing flow '$f' — expected a path like e2e/<name>.yaml."; exit 1 ;;
  esac
  if [ ! -f "$f" ]; then
    echo "::error::No such flow: $f"
    exit 1
  fi
done
echo "Running flows: $FLOWS" >> "$GITHUB_STEP_SUMMARY"
node e2e/check-sim.js
node e2e/ensure-release-build.js
MOCK_PORTS=7071,7072 node e2e/mock-server.js &
MOCK_PID=$!
node e2e/wait-for-mock.js || { kill "$MOCK_PID" 2>/dev/null; exit 1; }
set +e
node e2e/run-maestro.js test --debug-output e2e/_artifacts/debug --test-output-dir e2e/_artifacts/maestro-output $FLOWS
STATUS=$?
set -e
kill "$MOCK_PID" 2>/dev/null || true
exit $STATUS
