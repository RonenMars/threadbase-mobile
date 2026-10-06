#!/usr/bin/env bash
# Copy Maestro takeScreenshot PNGs into the store-ready deliverable names.
#
# Usage: e2e/collect-promo-screenshots.sh <ios|android> [dest-dir]
#
# Searches the newest e2e/_artifacts/maestro-output/<run> (override with
# PROMO_SCREENSHOT_SEARCH_ROOT) for the six stems the promo_screenshots_*.yaml
# flows write, then copies the newest of each into dest-dir as 01-*.png … 06-*.png.
# Also copies any Maestro startRecording MP4s from that same run.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PLATFORM="${1:-}"
case "$PLATFORM" in
  ios|android) ;;
  *)
    echo "Usage: $0 <ios|android> [dest-dir]" >&2
    exit 2
    ;;
esac

DEST="${2:-e2e/_artifacts/promo-screenshots/${PLATFORM}}"

if [[ -n "${PROMO_SCREENSHOT_SEARCH_ROOT:-}" ]]; then
  SEARCH_ROOT="${PROMO_SCREENSHOT_SEARCH_ROOT}"
else
  SEARCH_ROOT=""
  if [[ -d "${ROOT}/e2e/_artifacts/maestro-output" ]]; then
    SEARCH_ROOT="$(ls -dt "${ROOT}/e2e/_artifacts/maestro-output"/*/ 2>/dev/null | head -1 || true)"
  fi
  if [[ -z "$SEARCH_ROOT" ]]; then
    SEARCH_ROOT="${ROOT}/e2e/_artifacts"
  fi
fi

mkdir -p "$DEST"

latest_file() {
  local pattern="$1"
  local newest=""
  local newest_mtime=0
  local f mtime
  while IFS= read -r -d '' f; do
    if mtime=$(stat -f %m "$f" 2>/dev/null); then
      :
    elif mtime=$(stat -c %Y "$f" 2>/dev/null); then
      :
    else
      continue
    fi
    if (( mtime >= newest_mtime )); then
      newest="$f"
      newest_mtime=$mtime
    fi
  done < <(find "$SEARCH_ROOT" -name "$pattern" -type f -print0 2>/dev/null)
  printf '%s' "$newest"
}

copy_shot() {
  local stem="$1"
  local dest_name="$2"
  local src
  src="$(latest_file "${stem}.png")"
  if [[ -z "$src" ]]; then
    if [[ "${PROMO_SCREENSHOT_PARTIAL:-}" == "1" ]]; then
      echo "  (skip ${dest_name} — no ${stem}.png in this run)"
      return 0
    fi
    echo "Error: no ${stem}.png under ${SEARCH_ROOT}" >&2
    echo "Maestro writes these under e2e/_artifacts/maestro-output/<run>/…/takeScreenshot/." >&2
    exit 1
  fi
  cp "$src" "${DEST}/${dest_name}"
  echo "  ${dest_name}  <-  ${src#"$ROOT"/}"
}

copied_video=0
while IFS= read -r -d '' f; do
  flow="$(basename "$(dirname "$(dirname "$f")")")"
  base="$(basename "$f")"
  dest_name="$base"
  if [[ "$flow" != "." && "$flow" != "$(basename "$SEARCH_ROOT")" ]]; then
    dest_name="${flow}-${base}"
  fi
  cp "$f" "${DEST}/${dest_name}"
  echo "  ${dest_name}  <-  ${f#"$ROOT"/}"
  copied_video=1
done < <(find "$SEARCH_ROOT" -name '*.mp4' -type f -print0 2>/dev/null)
if [[ "$copied_video" -eq 0 ]]; then
  echo "  (no Maestro recordings under ${SEARCH_ROOT#"$ROOT"/})"
fi

echo "Collecting ${PLATFORM} promo screenshots into ${DEST}"
copy_shot "card-start-or-take-over" "01-start-session.png"
copy_shot "_raw-take-over-banner" "02-take-over-session.png"
copy_shot "card-search" "03-search-results.png"
copy_shot "hero-approval-card" "04-approval-request.png"
copy_shot "card-approve" "05-approval-response.png"
copy_shot "card-multi-machine" "06-multi-machine-projects.png"
echo "Deliverables: ${DEST}"
