#!/usr/bin/env bash
# check-build-number.sh — verify app.json version + buildNumber are ahead of
# the latest build in TestFlight/App Store, and auto-bump if they aren't.
#
# Comparison rules:
#   ciVersion    = app.json expo.version
#   ciBuildNumber = app.json expo.ios.buildNumber
#   appVersion   = highest version string seen across recent ASC builds
#   appBuildNumber = highest numeric buildNumber seen across recent ASC builds
#
#   resolvedVersion   = max(ciVersion, appVersion)            (semver comparison)
#   resolvedBuild     = max(ciBuildNumber, appBuildNumber) + 1
#
#   If ciVersion < appVersion OR ciBuildNumber <= appBuildNumber:
#     update app.json and exit 2.
#   Otherwise exit 0 (no changes needed).
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
CI_VERSION=$(jq -r '.expo.version' app.json)
CI_BUILD=$(jq -r '.expo.ios.buildNumber' app.json)

echo "▸ Checking App Store Connect build for $BUNDLE_ID"
echo "  local app.json version: $CI_VERSION  buildNumber: $CI_BUILD"

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

# Fetch latest 10 builds sorted by upload date descending.
# Extract both the CFBundleShortVersionString (version) and CFBundleVersion (buildNumber).
REMOTE_RAW=$(node -e "
const https = require('https');
const jwt = process.argv[1];
const appId = process.argv[2];

function get(path) {
  return new Promise((res, rej) => {
    let body = '';
    https.get({ hostname: 'api.appstoreconnect.apple.com', path, headers: { Authorization: 'Bearer ' + jwt } }, r => {
      r.on('data', d => body += d);
      r.on('end', () => res(JSON.parse(body)));
    }).on('error', rej);
  });
}

// semver-style numeric comparison: split on '.', compare each segment
function semverGt(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] || 0, nb = pb[i] || 0;
    if (na > nb) return true;
    if (na < nb) return false;
  }
  return false;
}

(async () => {
  try {
    const data = await get(
      '/v1/builds?filter[app]=' + appId +
      '&sort=-uploadedDate&limit=10' +
      '&fields[builds]=version,processingState,uploadedDate' +
      '&include=preReleaseVersion' +
      '&fields[preReleaseVersions]=version'
    );

    if (!data.data || !data.data.length) {
      console.log('0\t0.0.0\tNONE\t');
      return;
    }

    // Build a map from preReleaseVersion id → version string
    const verMap = {};
    (data.included || []).forEach(inc => {
      if (inc.type === 'preReleaseVersions') verMap[inc.id] = inc.attributes.version;
    });

    let maxBuild = 0;
    let maxVersion = '0.0.0';
    let maxState = '';
    let maxDate = '';

    data.data.forEach(b => {
      const bn = parseInt(b.attributes.version, 10);
      const prvRel = b.relationships && b.relationships.preReleaseVersion && b.relationships.preReleaseVersion.data;
      const appVer = prvRel ? (verMap[prvRel.id] || '0.0.0') : '0.0.0';

      if (bn > maxBuild) {
        maxBuild = bn;
        maxState = b.attributes.processingState;
        maxDate  = b.attributes.uploadedDate;
      }
      if (semverGt(appVer, maxVersion)) maxVersion = appVer;
    });

    console.log(maxBuild + '\t' + maxVersion + '\t' + maxState + '\t' + maxDate);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
})();
" "$JWT" "$APP_ID")

APP_BUILD=$(echo "$REMOTE_RAW"   | cut -f1)
APP_VERSION=$(echo "$REMOTE_RAW"  | cut -f2)
REMOTE_STATE=$(echo "$REMOTE_RAW" | cut -f3)
REMOTE_DATE=$(echo "$REMOTE_RAW"  | cut -f4)

echo "  latest ASC version: $APP_VERSION  buildNumber: $APP_BUILD ($REMOTE_STATE, uploaded $REMOTE_DATE)"

# Resolve version: semver-max(ciVersion, appVersion)
RESOLVED_VERSION=$(node -e "
function semverGt(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] || 0, nb = pb[i] || 0;
    if (na > nb) return true;
    if (na < nb) return false;
  }
  return false;
}
const ci = process.argv[1], app = process.argv[2];
console.log(semverGt(app, ci) ? app : ci);
" "$CI_VERSION" "$APP_VERSION")

# Resolve build: max(ciBuildNumber, appBuildNumber) + 1
MAX_BUILD=$(( CI_BUILD > APP_BUILD ? CI_BUILD : APP_BUILD ))
RESOLVED_BUILD=$(( MAX_BUILD + 1 ))

VERSION_CHANGED=0
BUILD_CHANGED=0

[[ "$RESOLVED_VERSION" != "$CI_VERSION" ]] && VERSION_CHANGED=1
# Build always needs to be max+1; if CI is already max+1 exactly, no bump needed
EXPECTED_BUILD=$(( APP_BUILD + 1 ))
if (( CI_BUILD < EXPECTED_BUILD )); then
  BUILD_CHANGED=1
  RESOLVED_BUILD=$EXPECTED_BUILD
else
  RESOLVED_BUILD=$CI_BUILD
fi

if (( VERSION_CHANGED == 0 && BUILD_CHANGED == 0 )); then
  echo "  ✓ app.json version ($CI_VERSION) and buildNumber ($CI_BUILD) are already correct — no bump needed"
  exit 0
fi

if (( CHECK_ONLY )); then
  (( VERSION_CHANGED )) && echo "  ✗ version should be $RESOLVED_VERSION (CI: $CI_VERSION, ASC: $APP_VERSION)" >&2
  (( BUILD_CHANGED ))  && echo "  ✗ buildNumber should be $RESOLVED_BUILD (CI: $CI_BUILD, ASC: $APP_BUILD)" >&2
  exit 1
fi

# Log what's being bumped
(( VERSION_CHANGED )) && echo "  ⚠ version: $CI_VERSION → $RESOLVED_VERSION (ASC is ahead)"
(( BUILD_CHANGED ))  && echo "  ⚠ buildNumber: $CI_BUILD → $RESOLVED_BUILD (ASC latest: $APP_BUILD, next required: $EXPECTED_BUILD)"

# Drift warning for large build gaps
if (( BUILD_CHANGED )); then
  DRIFT=$(( APP_BUILD - CI_BUILD ))
  if (( DRIFT >= 2 )); then
    echo
    echo "  ⚠ Suspicious build-number drift: ASC is at $APP_BUILD, local app.json is at $CI_BUILD (gap $DRIFT)"
    echo "    This usually means another machine shipped without committing the app.json bump."
    echo "    Check: did you run \`git pull --ff-only\` recently?"
    echo
  fi
fi

jq ".expo.version = \"$RESOLVED_VERSION\" | .expo.ios.buildNumber = \"$RESOLVED_BUILD\"" \
  app.json > app.json.tmp && mv app.json.tmp app.json

echo "  ✓ app.json updated to version $RESOLVED_VERSION, buildNumber $RESOLVED_BUILD (commit deferred until after successful upload)"
# Exit 2 signals to deploy.yml that app.json was bumped and needs committing.
exit 2
