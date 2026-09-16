#!/usr/bin/env bash
# Copy Maestro takeScreenshot PNGs into the store-ready deliverable names.
#
# Usage: e2e/collect-promo-screenshots.sh <ios|android> [dest-dir]
#
# Searches e2e/_artifacts (Maestro --test-output-dir plus cwd-relative shots)
# for the six stems the promo_screenshots_*.yaml flows write, then copies the
# newest of each into dest-dir as 01-*.png … 06-*.png.
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
SEARCH_ROOT="${PROMO_SCREENSHOT_SEARCH_ROOT:-${ROOT}/e2e/_artifacts}"

mkdir -p "$DEST"

latest_png() {
  local stem="$1"
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
  done < <(find "$SEARCH_ROOT" -name "${stem}.png" -type f -print0 2>/dev/null)
  printf '%s' "$newest"
}

copy_shot() {
  local stem="$1"
  local dest_name="$2"
  local src
  src="$(latest_png "$stem")"
  if [[ -z "$src" ]]; then
    echo "Error: no ${stem}.png under ${SEARCH_ROOT}" >&2
    echo "Maestro writes these under e2e/_artifacts/maestro-output/<run>/…/takeScreenshot/." >&2
    exit 1
  fi
  cp "$src" "${DEST}/${dest_name}"
  echo "  ${dest_name}  <-  ${src#"$ROOT"/}"
}

echo "Collecting ${PLATFORM} promo screenshots into ${DEST}"
copy_shot "card-start-or-take-over" "01-start-session.png"
copy_shot "_raw-take-over-banner" "02-take-over-session.png"
copy_shot "card-search" "03-search-results.png"
copy_shot "hero-approval-card" "04-approval-request.png"
copy_shot "card-approve" "05-approval-response.png"
copy_shot "card-multi-machine" "06-multi-machine-projects.png"
echo "Deliverables: ${DEST}"
