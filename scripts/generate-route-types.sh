#!/usr/bin/env bash
# Generates .expo/types/router.d.ts, the expo-router typed-routes declarations.
#
# `app.json` sets `experiments.typedRoutes: true` and `tsconfig.json` includes
# `.expo/types/**/*.d.ts`, so route strings are meant to be compiler-checked.
# But `.expo/` is gitignored, so a fresh checkout — every CI run — has no such
# file, and without it `Href` degrades to a loose type. Every bad route then
# typechecks and the Type check job passes on code that does not compile under
# the project's own configuration. That is how fourteen broken call sites
# (#738) and twelve `as any` casts (#740) stayed green.
#
# There is no standalone generator: `startTypescriptTypeGenerationAsync` lives
# inside @expo/cli's Metro dev server, so the only way to produce the file is to
# boot Metro and let it write one. `CI=1` keeps that non-interactive.
#
# The script polls for the file rather than sleeping a fixed interval, so it
# takes about as long as generation actually needs, and — the part that matters
# — it EXITS NON-ZERO if the file never appears. A silent failure here would
# leave `tsc` passing vacuously, which is the exact bug this exists to prevent.
set -uo pipefail

TIMEOUT_SECONDS="${ROUTE_TYPES_TIMEOUT:-120}"
PORT="${ROUTE_TYPES_PORT:-8099}"
TARGET=".expo/types/router.d.ts"

cd "$(dirname "$0")/.."

rm -f "$TARGET"

CI=1 npx expo start --port "$PORT" >/tmp/expo-route-types.log 2>&1 &
EXPO_PID=$!

cleanup() {
  kill "$EXPO_PID" 2>/dev/null || true
  wait "$EXPO_PID" 2>/dev/null || true
}
trap cleanup EXIT

for _ in $(seq 1 "$TIMEOUT_SECONDS"); do
  if [[ -s "$TARGET" ]]; then
    echo "Generated $TARGET ($(wc -c <"$TARGET" | tr -d ' ') bytes)"
    exit 0
  fi
  # Metro died before writing anything — no point waiting out the timeout.
  if ! kill -0 "$EXPO_PID" 2>/dev/null; then
    echo "expo start exited before writing $TARGET" >&2
    tail -20 /tmp/expo-route-types.log >&2
    exit 1
  fi
  sleep 1
done

echo "Timed out after ${TIMEOUT_SECONDS}s waiting for $TARGET" >&2
tail -20 /tmp/expo-route-types.log >&2
exit 1
