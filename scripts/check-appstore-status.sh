#!/usr/bin/env bash
# check-appstore-status.sh — report the build + App Store review status of the
# iOS app on App Store Connect.
#
# Prints two things:
#   1. TestFlight: the latest builds and their processingState
#      (PROCESSING | VALID | INVALID | FAILED) — VALID means available to testers.
#   2. App Store: the current App Store version and its appStoreState
#      (e.g. PREPARE_FOR_SUBMISSION, WAITING_FOR_REVIEW, IN_REVIEW,
#       PENDING_DEVELOPER_RELEASE, READY_FOR_SALE, REJECTED). READY_FOR_SALE
#      means approved + live; IN_REVIEW / WAITING_FOR_REVIEW means Apple is
#      still reviewing.
#
# Auth: App Store Connect API key. Requires ASC_KEY_ID, ASC_ISSUER_ID and the
# .p8 at ASC_KEY_PATH — source .env.signing first (same as the ship scripts).
#
# Usage:
#   source .env.signing
#   ./scripts/check-appstore-status.sh            # human-readable
#   ./scripts/check-appstore-status.sh --json     # raw JSON for scripting

set -euo pipefail

command -v node >/dev/null || { echo "node required" >&2; exit 1; }
command -v jq   >/dev/null || { echo "jq required" >&2; exit 1; }

AS_JSON=0
[[ "${1:-}" == "--json" ]] && AS_JSON=1
[[ "${1:-}" == "-h" || "${1:-}" == "--help" ]] && { sed -n '2,24p' "$0" | sed 's/^# \{0,1\}//'; exit 0; }

: "${ASC_KEY_ID:?ASC_KEY_ID not set — source .env.signing first}"
: "${ASC_ISSUER_ID:?ASC_ISSUER_ID not set — source .env.signing first}"
: "${ASC_KEY_PATH:?ASC_KEY_PATH not set — source .env.signing first}"
[[ -r "$ASC_KEY_PATH" ]] || { echo "Cannot read .p8 at $ASC_KEY_PATH" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUNDLE_ID=$(jq -r '.expo.ios.bundleIdentifier' app.json)
[[ -n "$BUNDLE_ID" && "$BUNDLE_ID" != "null" ]] || { echo "expo.ios.bundleIdentifier missing in app.json" >&2; exit 1; }

# Mint the ES256 JWT via the shared helper.
JWT=$("$SCRIPT_DIR/asc-jwt.sh")

node - "$JWT" "$BUNDLE_ID" "$AS_JSON" <<'EOF'
const https = require('https');
const [jwt, bundleId, asJson] = process.argv.slice(2);

function get(path) {
  return new Promise((resolve, reject) => {
    https.get({ hostname: 'api.appstoreconnect.apple.com', path, headers: { Authorization: 'Bearer ' + jwt } },
      r => { let d = ''; r.on('data', c => d += c); r.on('end', () => resolve({ status: r.statusCode, body: d ? JSON.parse(d) : {} })); })
      .on('error', reject);
  });
}

(async () => {
  // Resolve the app id from the bundle id.
  const app = await get(`/v1/apps?filter[bundleId]=${encodeURIComponent(bundleId)}&fields[apps]=name`);
  if (app.status >= 400) throw new Error(`apps lookup failed (HTTP ${app.status}): ${JSON.stringify(app.body)}`);
  if (!app.body.data || !app.body.data.length) throw new Error('App not found for bundle id: ' + bundleId);
  const appId = app.body.data[0].id;
  const appName = app.body.data[0].attributes.name;

  // Latest builds (TestFlight processing state).
  const builds = await get(`/v1/builds?filter[app]=${appId}&sort=-uploadedDate&limit=5&fields[builds]=version,processingState,uploadedDate`);
  const buildList = (builds.body.data || []).map(b => ({
    buildNumber: b.attributes.version,
    processingState: b.attributes.processingState,
    uploadedDate: b.attributes.uploadedDate,
  }));

  // App Store version review state.
  const versions = await get(`/v1/apps/${appId}/appStoreVersions?limit=5&fields[appStoreVersions]=versionString,appStoreState,createdDate`);
  const versionList = (versions.body.data || []).map(v => ({
    version: v.attributes.versionString,
    appStoreState: v.attributes.appStoreState,
    createdDate: v.attributes.createdDate,
  }));

  if (asJson === '1') {
    console.log(JSON.stringify({ app: appName, bundleId, builds: buildList, appStoreVersions: versionList }, null, 2));
    return;
  }

  console.log(`▸ App Store Connect — ${appName} (${bundleId})`);

  console.log('\n  TestFlight builds (latest first):');
  if (!buildList.length) console.log('    (no builds)');
  for (const b of buildList) {
    console.log(`    • build ${b.buildNumber} — ${b.processingState} — ${b.uploadedDate}`);
  }

  console.log('\n  App Store versions:');
  if (!versionList.length) console.log('    (no App Store versions)');
  for (const v of versionList) {
    console.log(`    • ${v.version} — ${v.appStoreState}`);
  }
  console.log('\n  Review states: WAITING_FOR_REVIEW / IN_REVIEW = under Apple review;');
  console.log('  PENDING_DEVELOPER_RELEASE = approved, awaiting your release; READY_FOR_SALE = live.');
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
EOF
