#!/usr/bin/env bash
# verify-dyld-symbols.sh — catch "Symbol not found" launch crashes before upload.
#
# A Swift ABI mismatch between two pods (e.g. ExpoCamera built against one
# expo-modules-core protocol signature, a different ExpoModulesCore bundled)
# compiles and archives cleanly, then aborts at launch in dyld with
# EXC_CRASH / "DYLD 4 Symbol missing". TestFlight build 173 shipped that way.
#
# Scope: only symbols that should come from a framework *inside the bundle*.
# Each binary's `otool -L` @rpath entries name its embedded dependencies; a
# Swift symbol mangled with one of those framework's module names must be
# exported by that framework. OS dylib symbols are ignored by construction —
# no denylist to maintain.
#
# Usage: ./scripts/verify-dyld-symbols.sh [path/to/Foo.app]
#   Defaults to the .app inside build/Threadbase.xcarchive.
# Exit: 0 all resolved · 1 unresolved symbols found · 2 bad invocation

set -euo pipefail

APP_PATH="${1:-}"
if [[ -z "$APP_PATH" ]]; then
  ARCHIVE_PATH="${ARCHIVE_PATH:-build/Threadbase.xcarchive}"
  APP_PATH="$(find "$ARCHIVE_PATH/Products/Applications" -maxdepth 1 -name '*.app' 2>/dev/null | head -1 || true)"
fi

if [[ -z "$APP_PATH" || ! -d "$APP_PATH" ]]; then
  echo "verify-dyld-symbols: no .app found (looked for '${APP_PATH:-<archive>}')" >&2
  exit 2
fi

echo "▸ Verifying dynamic symbols in $(basename "$APP_PATH")"

APP_NAME="$(basename "$APP_PATH" .app)"
BINARIES=()
[[ -f "$APP_PATH/$APP_NAME" ]] && BINARIES+=("$APP_PATH/$APP_NAME")
while IFS= read -r fw; do
  fw_name="$(basename "$fw" .framework)"
  [[ -f "$fw/$fw_name" ]] && BINARIES+=("$fw/$fw_name")
done < <(find "$APP_PATH/Frameworks" -maxdepth 1 -name '*.framework' 2>/dev/null | sort)

if (( ${#BINARIES[@]} == 0 )); then
  echo "verify-dyld-symbols: no Mach-O binaries found under $APP_PATH" >&2
  exit 2
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Module names of frameworks actually embedded in the bundle. Swift mangles a
# symbol's defining module into the name as <len><ModuleName>, so these are the
# only prefixes we can attribute to in-bundle code.
MODULES=()
for bin in "${BINARIES[@]}"; do
  MODULES+=("$(basename "$bin")")
done

# Every symbol exported anywhere in the bundle.
for bin in "${BINARIES[@]}"; do
  nm -arch arm64 -gU "$bin" 2>/dev/null | awk 'NF>=3 {print $3}'
done | sort -u > "$WORK/defined.txt"

# Undefined symbols, tagged with the binary that references them.
for bin in "${BINARIES[@]}"; do
  nm -arch arm64 -gu "$bin" 2>/dev/null | awk -v b="$(basename "$bin")" 'NF>=1 {print $NF"\t"b}'
done | sort -u > "$WORK/undefined.txt"

# Keep only undefined symbols whose Swift-mangled module component names a
# framework bundled in this app. `_$s` is the Swift 5+ mangling prefix; the
# module follows as a length-prefixed identifier, so ExpoModulesCore appears
# literally as "15ExpoModulesCore".
: > "$WORK/patterns.txt"
for mod in "${MODULES[@]}"; do
  printf '_\$s[0-9]*%s%s\n' "${#mod}" "$mod" >> "$WORK/patterns.txt"
done

cut -f1 "$WORK/undefined.txt" | sort -u \
  | grep -E "$(paste -sd'|' "$WORK/patterns.txt")" > "$WORK/inbundle.txt" || true

comm -23 "$WORK/inbundle.txt" "$WORK/defined.txt" > "$WORK/unresolved.txt" || true

CHECKED=$(wc -l < "$WORK/inbundle.txt" | tr -d ' ')
echo "  ${#BINARIES[@]} binaries · $CHECKED in-bundle symbol references checked"

if [[ ! -s "$WORK/unresolved.txt" ]]; then
  echo "  ✓ all inter-framework symbols resolve"
  exit 0
fi

COUNT=$(wc -l < "$WORK/unresolved.txt" | tr -d ' ')
echo >&2
echo "✗ $COUNT unresolved symbol(s) — this build would crash at launch in dyld:" >&2
echo >&2
while IFS= read -r sym; do
  needed_by="$(grep -F "$sym"$'\t' "$WORK/undefined.txt" | cut -f2 | sort -u | tr '\n' ' ')"
  echo "  $sym" >&2
  echo "      referenced from: ${needed_by:-<unknown>}" >&2
  demangled="$(xcrun swift-demangle --compact <<<"$sym" 2>/dev/null || true)"
  [[ -n "$demangled" && "$demangled" != "$sym" ]] && echo "      demangled:       $demangled" >&2
done < "$WORK/unresolved.txt"
echo >&2
echo "Usually a pod version skew: two pods built against different versions of a" >&2
echo "shared dependency. Check that the Expo module set in package.json is a" >&2
echo "coherent SDK release (npx expo install --fix) and regenerate ios/Podfile.lock." >&2
exit 1
