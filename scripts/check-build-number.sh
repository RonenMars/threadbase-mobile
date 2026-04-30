#!/usr/bin/env bash
# check-build-number.sh — verify app.json buildNumber is higher than the latest
# build in TestFlight/App Store, and auto-bump if it isn't.
#
# Requires ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH to be set (source .env.signing).
#
# Usage:
#   source .env.signing
#   ./scripts/check-build-number.sh              # auto-bump app.json if needed
#   ./scripts/check-build-number.sh --check-only # exit non-zero instead of bumping

set -euo pipefail

CHECK_ONLY=0
[[ "${1:-}" == "--check-only" ]] && CHECK_ONLY=1

: "${ASC_KEY_ID:?ASC_KEY_ID not set — source .env.signing first}"
: "${ASC_ISSUER_ID:?ASC_ISSUER_ID not set — source .env.signing first}"
: "${ASC_KEY_PATH:?ASC_KEY_PATH not set — source .env.signing first}"
command -v jq   >/dev/null || { echo "jq required" >&2; exit 1; }
command -v node >/dev/null || { echo "node required" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

BUNDLE_ID=$(jq -r '.expo.ios.bundleIdentifier' app.json)
LOCAL_BUILD=$(jq -r '.expo.ios.buildNumber' app.json)

echo "▸ Checking TestFlight build numbers for $BUNDLE_ID"
echo "  local app.json buildNumber: $LOCAL_BUILD"

JWT=$("$SCRIPT_DIR/asc-jwt.sh")

# Look up the app ID by bundle identifier
APP_ID=$(node -e "
const https = require('https');
const jwt = process.argv[1];
const bundleId = process.argv[2];
const opts = {
  hostname: 'api.appstoreconnect.apple.com',
  path: '/v1/apps?filter[bundleId]=' + bundleId + '&fields[apps]=name',
  headers: { Authorization: 'Bearer ' + jwt }
};
let body = '';
https.get(opts, r => {
  r.on('data', d => body += d);
  r.on('end', () => {
    const d = JSON.parse(body);
    if (!d.data || !d.data.length) { console.error('App not found for bundle id:', bundleId); process.exit(1); }
    console.log(d.data[0].id);
  });
}).on('error', e => { console.error(e.message); process.exit(1); });
" "$JWT" "$BUNDLE_ID")

# Fetch latest 5 builds sorted by upload date descending
LATEST_REMOTE=$(node -e "
const https = require('https');
const jwt = process.argv[1];
const appId = process.argv[2];
const opts = {
  hostname: 'api.appstoreconnect.apple.com',
  path: '/v1/builds?filter[app]=' + appId + '&sort=-uploadedDate&limit=10&fields[builds]=version,processingState,uploadedDate',
  headers: { Authorization: 'Bearer ' + jwt }
};
let body = '';
https.get(opts, r => {
  r.on('data', d => body += d);
  r.on('end', () => {
    const d = JSON.parse(body);
    if (!d.data || !d.data.length) { console.log(0); return; }
    // Find max numeric build number across all returned builds
    const max = d.data.reduce((m, b) => {
      const n = parseInt(b.attributes.version, 10);
      if (n > m.val) return { val: n, state: b.attributes.processingState, date: b.attributes.uploadedDate };
      return m;
    }, { val: 0, state: '', date: '' });
    console.log(max.val + '\t' + max.state + '\t' + max.date);
  });
}).on('error', e => { console.error(e.message); process.exit(1); });
" "$JWT" "$APP_ID")

REMOTE_BUILD=$(echo "$LATEST_REMOTE" | cut -f1)
REMOTE_STATE=$(echo "$LATEST_REMOTE" | cut -f2)
REMOTE_DATE=$(echo "$LATEST_REMOTE" | cut -f3)

echo "  latest TestFlight buildNumber: $REMOTE_BUILD ($REMOTE_STATE, uploaded $REMOTE_DATE)"

if (( LOCAL_BUILD > REMOTE_BUILD )); then
  echo "  ✓ app.json buildNumber ($LOCAL_BUILD) is ahead of TestFlight ($REMOTE_BUILD) — no bump needed"
  exit 0
fi

NEXT_BUILD=$(( REMOTE_BUILD + 1 ))

if (( CHECK_ONLY )); then
  echo "  ✗ app.json buildNumber ($LOCAL_BUILD) must be > $REMOTE_BUILD (latest in TestFlight)" >&2
  echo "    Bump with: jq '.expo.ios.buildNumber = \"$NEXT_BUILD\"' app.json > app.json.tmp && mv app.json.tmp app.json" >&2
  exit 1
fi

echo "  ⚠ app.json buildNumber ($LOCAL_BUILD) ≤ TestFlight latest ($REMOTE_BUILD) — auto-bumping to $NEXT_BUILD"
jq ".expo.ios.buildNumber = \"$NEXT_BUILD\"" app.json > app.json.tmp && mv app.json.tmp app.json
echo "  ✓ app.json updated to buildNumber $NEXT_BUILD"
