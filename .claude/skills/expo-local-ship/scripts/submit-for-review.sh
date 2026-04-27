#!/usr/bin/env bash
# submit-for-review.sh — promote the latest VALID TestFlight build to App
# Store review via the App Store Connect REST API. No website clicks.
#
# Usage:
#   ./scripts/submit-for-review.sh <bundle-id> <version> [--release-notes "…"]
#                                                        [--release-type MANUAL|AFTER_APPROVAL|SCHEDULED]
#                                                        [--release-date 2026-04-26T08:00:00-07:00]

set -euo pipefail

BUNDLE_ID="${1:?bundle id required}"
VERSION="${2:?version string required}"
shift 2

RELEASE_NOTES=""
RELEASE_TYPE="MANUAL"
RELEASE_DATE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --release-notes) RELEASE_NOTES="$2"; shift 2 ;;
    --release-type)  RELEASE_TYPE="$2";  shift 2 ;;
    --release-date)  RELEASE_DATE="$2";  shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

case "$RELEASE_TYPE" in MANUAL|AFTER_APPROVAL|SCHEDULED) ;;
  *) echo "--release-type must be MANUAL|AFTER_APPROVAL|SCHEDULED" >&2; exit 2 ;;
esac
[[ "$RELEASE_TYPE" == "SCHEDULED" && -z "$RELEASE_DATE" ]] && {
  echo "SCHEDULED release type requires --release-date <ISO 8601>" >&2; exit 2; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
JWT="$("$SCRIPT_DIR/asc-jwt.sh")"
API="https://api.appstoreconnect.apple.com/v1"
auth=(-sS --connect-timeout 5 --max-time 30 \
      -H "Authorization: Bearer $JWT" -H "Content-Type: application/json")

# 1. Resolve app + latest VALID build
APP_ID=$(curl "${auth[@]}" -G "$API/apps" \
  --data-urlencode "filter[bundleId]=$BUNDLE_ID" --data-urlencode "limit=1" \
  | jq -er '.data[0].id') || { echo "App not found: $BUNDLE_ID" >&2; exit 1; }

BUILD_ID=$(curl "${auth[@]}" -G "$API/builds" \
  --data-urlencode "filter[app]=$APP_ID" \
  --data-urlencode "filter[processingState]=VALID" \
  --data-urlencode "sort=-uploadedDate" --data-urlencode "limit=1" \
  | jq -er '.data[0].id') || { echo "No VALID build for $BUNDLE_ID" >&2; exit 1; }

echo "▸ App $APP_ID, build $BUILD_ID"

# 2. Create or fetch the App Store version
ATTRS=$(jq -n --arg v "$VERSION" --arg rt "$RELEASE_TYPE" \
  --arg rd "$RELEASE_DATE" \
  '{platform:"IOS", versionString:$v, releaseType:$rt}
   + ( if $rd != "" then {earliestReleaseDate:$rd} else {} end )')

PAYLOAD=$(jq -n --arg app "$APP_ID" --argjson a "$ATTRS" \
  '{data:{type:"appStoreVersions", attributes:$a,
          relationships:{app:{data:{type:"apps", id:$app}}}}}')

VERSION_ID=$(curl "${auth[@]}" -X POST "$API/appStoreVersions" -d "$PAYLOAD" \
  | jq -r '.data.id // empty')

if [[ -z "$VERSION_ID" ]]; then
  VERSION_ID=$(curl "${auth[@]}" -G "$API/apps/$APP_ID/appStoreVersions" \
    --data-urlencode "filter[versionString]=$VERSION" \
    | jq -er '.data[0].id')
fi
echo "▸ Version $VERSION ($VERSION_ID)"

# 3. Attach the build
curl "${auth[@]}" -X PATCH \
  "$API/appStoreVersions/$VERSION_ID/relationships/build" \
  -d "{\"data\":{\"type\":\"builds\",\"id\":\"$BUILD_ID\"}}" >/dev/null

# 4. Set release notes (en-US)
if [[ -n "$RELEASE_NOTES" ]]; then
  LOC_ID=$(curl "${auth[@]}" \
    "$API/appStoreVersions/$VERSION_ID/appStoreVersionLocalizations" \
    | jq -er '.data[] | select(.attributes.locale=="en-US") | .id')
  curl "${auth[@]}" -X PATCH "$API/appStoreVersionLocalizations/$LOC_ID" \
    -d "$(jq -n --arg n "$RELEASE_NOTES" --arg id "$LOC_ID" \
      '{data:{type:"appStoreVersionLocalizations",id:$id,
              attributes:{whatsNew:$n}}}')" >/dev/null
  echo "▸ Release notes set (en-US)"
fi

# 5. Submit
curl "${auth[@]}" -X POST "$API/appStoreVersionSubmissions" \
  -d "$(jq -n --arg v "$VERSION_ID" \
    '{data:{type:"appStoreVersionSubmissions",
            relationships:{appStoreVersion:{data:{type:"appStoreVersions",id:$v}}}}}')" >/dev/null

echo "✓ Submitted $VERSION for App Store review (releaseType=$RELEASE_TYPE)"
