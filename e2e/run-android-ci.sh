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
    LATEST=$(ls -dt ~/.maestro/tests/*/ 2>/dev/null | head -1)
    if [ -n "$LATEST" ]; then
      mkdir -p e2e/_artifacts/maestro-session
      cp -R "$LATEST" e2e/_artifacts/maestro-session/ || true
    fi
  fi
  exit "$STATUS"
}
trap capture_failure EXIT

adb wait-for-device
until [ "$(adb shell getprop sys.boot_completed | tr -d '\r')" = "1" ]; do sleep 1; done
adb shell input keyevent 82
# x86_64 is what the CI emulator image is. Overridable so the same script can be
# run against a local arm64 emulator, which is the only way to exercise this file
# outside a paid runner.
(cd android && ./gradlew :app:assembleRelease -PreactNativeArchitectures="${REACT_NATIVE_ARCHITECTURES:-x86_64}")
adb install -r android/app/build/outputs/apk/release/app-release.apk
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
node e2e/run-maestro.js test --debug-output e2e/_artifacts/debug $FLOWS
STATUS=$?
set -e
kill "$MOCK_PID" 2>/dev/null || true
exit $STATUS
