#!/usr/bin/env bash
# check-version-code.sh — verify app.json versionCode is higher than the
# latest build in Google Play Internal Testing, and auto-bump if it isn't.
#
# Mirrors check-build-number.sh (iOS) but queries the Google Play Developer
# API instead of App Store Connect. Uses a Google service-account JWT
# (RS256) to mint a short-lived OAuth2 access token.
#
# Requires GOOGLE_APPLICATION_CREDENTIALS to be set (or sourced from
# .env.signing.android, which doesn't set it directly — so you must also run
# fetch-play-credentials.sh first).
#
# Usage:
#   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json \
#     ./scripts/check-version-code.sh
#   ./scripts/check-version-code.sh --check-only  # exit non-zero instead of bumping

set -euo pipefail

CHECK_ONLY=0
[[ "${1:-}" == "--check-only" ]] && CHECK_ONLY=1

: "${GOOGLE_APPLICATION_CREDENTIALS:?GOOGLE_APPLICATION_CREDENTIALS not set — run scripts/fetch-play-credentials.sh first}"
command -v jq   >/dev/null || { echo "jq required" >&2; exit 1; }
command -v node >/dev/null || { echo "node required" >&2; exit 1; }

PACKAGE_NAME=$(jq -r '.expo.android.package' app.json)
LOCAL_CODE=$(jq -r '.expo.android.versionCode' app.json)

[[ -n "$PACKAGE_NAME" && "$PACKAGE_NAME" != "null" ]] || { echo "expo.android.package missing in app.json" >&2; exit 1; }
[[ -n "$LOCAL_CODE"   && "$LOCAL_CODE"   != "null" ]] || { echo "expo.android.versionCode missing in app.json" >&2; exit 1; }

echo "▸ Checking Play versionCode for $PACKAGE_NAME"
echo "  local app.json versionCode: $LOCAL_CODE"

# Mint an OAuth2 access token from the service-account JSON using Node
# (pure stdlib — no googleapis package needed).
_tmp_token=$(mktemp /tmp/check-vc-token.XXXXXX.js)
cat > "$_tmp_token" <<'NODEJS'
const fs     = require('fs');
const crypto = require('crypto');
const https  = require('https');

const sa = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const now = Math.floor(Date.now() / 1000);
const scope = 'https://www.googleapis.com/auth/androidpublisher';

const header  = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
const payload = Buffer.from(JSON.stringify({
  iss: sa.client_email, sub: sa.client_email,
  aud: 'https://oauth2.googleapis.com/token',
  iat: now, exp: now + 3600, scope,
})).toString('base64url');

const unsigned = `${header}.${payload}`;
const sig = crypto.createSign('SHA256').update(unsigned).sign(sa.private_key, 'base64url');
const jwt = `${unsigned}.${sig}`;

const body = new URLSearchParams({
  grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
  assertion: jwt,
}).toString();

const opts = {
  hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
};

let resp = '';
const req = https.request(opts, r => {
  r.on('data', d => resp += d);
  r.on('end', () => {
    const d = JSON.parse(resp);
    if (!d.access_token) { process.stderr.write('OAuth2 error: ' + resp + '\n'); process.exit(1); }
    process.stdout.write(d.access_token);
  });
});
req.on('error', e => {
  const offline = e.code === 'ENOTFOUND' || e.code === 'ECONNREFUSED' || e.code === 'ETIMEDOUT';
  process.stderr.write(e.message + '\n');
  process.exit(offline ? 3 : 1);
});
req.write(body);
req.end();
NODEJS

set +e
ACCESS_TOKEN=$(node "$_tmp_token" "$GOOGLE_APPLICATION_CREDENTIALS")
_token_exit=$?
set -e
rm -f "$_tmp_token"

if (( _token_exit == 3 )); then
  echo "  ⚠ Play API unreachable (OAuth2) — skipping remote versionCode check, proceeding with local ($LOCAL_CODE)" >&2
  exit 0
fi
[[ -n "$ACCESS_TOKEN" ]] || { echo "ERROR: OAuth2 token minting failed — check GOOGLE_APPLICATION_CREDENTIALS and service account permissions" >&2; exit 1; }

# Query the androidpublisher API for the highest versionCode across all
# sources: the edit-less tracks endpoint (live published state) plus a
# throwaway edit's bundles.list (catches versionCodes uploaded in edits
# that were committed but not yet reflected by the tracks endpoint).
_tmp_query=$(mktemp /tmp/check-vc-query.XXXXXX.js)
cat > "$_tmp_query" <<'NODEJS'
const https = require('https');

function request(method, path, token, payload) {
  return new Promise((resolve, reject) => {
    const body = payload ? JSON.stringify(payload) : '';
    const opts = {
      hostname: 'androidpublisher.googleapis.com',
      path, method,
      headers: {
        Authorization: 'Bearer ' + token,
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}),
      },
    };
    let resp = '';
    const req = https.request(opts, r => {
      r.on('data', d => resp += d);
      r.on('end', () => {
        if (r.statusCode === 404) { resolve({ __notFound: true }); return; }
        if (r.statusCode === 204 || !resp) { resolve({}); return; }
        try { resolve(JSON.parse(resp)); }
        catch(e) { reject(new Error('JSON parse failed (HTTP ' + r.statusCode + '): ' + resp.slice(0, 300))); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

(async () => {
  const pkg   = process.argv[2];
  const token = process.argv[3];

  if (!token || token === '-') { process.stderr.write('ERROR: access token is empty — OAuth2 minting failed\n'); process.exit(1); }

  const base = `/androidpublisher/v3/applications/${pkg}`;
  let maxCode = 0;

  // Source 1: edit-less tracks endpoint — live published state.
  const tracks = await request('GET', `${base}/tracks`, token, null);
  if (tracks.error && !tracks.__notFound) {
    process.stderr.write('tracks.list error: ' + JSON.stringify(tracks.error) + '\n');
    process.exit(1);
  }
  for (const track of (tracks.tracks || [])) {
    for (const release of (track.releases || [])) {
      for (const vc of (release.versionCodes || [])) {
        const n = parseInt(vc, 10);
        if (n > maxCode) maxCode = n;
      }
    }
  }

  // Source 2: open a throwaway edit and list bundles — catches versionCodes
  // that were uploaded in a recently-committed edit but haven't propagated
  // to the tracks endpoint yet (eventual consistency window).
  let editId = null;
  try {
    const edit = await request('POST', `${base}/edits`, token, {});
    if (edit.error) throw new Error('edits.insert: ' + JSON.stringify(edit.error));
    editId = edit.id;

    const bundles = await request('GET', `${base}/edits/${editId}/bundles`, token, null);
    if (!bundles.error) {
      for (const b of (bundles.bundles || [])) {
        const n = parseInt(b.versionCode, 10);
        if (n > maxCode) maxCode = n;
      }
    }
  } catch(e) {
    process.stderr.write('  bundles.list via edit skipped: ' + e.message + '\n');
  } finally {
    if (editId) {
      await request('DELETE', `${base}/edits/${editId}`, token, null).catch(() => {});
    }
  }

  process.stdout.write(String(maxCode));
})().catch(e => {
  const offline = e.message.includes('ENOTFOUND') || e.message.includes('ECONNREFUSED') || e.message.includes('ETIMEDOUT');
  process.stderr.write(e.message + '\n');
  process.exit(offline ? 3 : 1);
});
NODEJS

set +e
REMOTE_CODE=$(node "$_tmp_query" "$PACKAGE_NAME" "$ACCESS_TOKEN")
_query_exit=$?
set -e
rm -f "$_tmp_query"

if (( _query_exit == 3 )); then
  echo "  ⚠ Play API unreachable — skipping remote versionCode check, proceeding with local ($LOCAL_CODE)" >&2
  exit 0
fi

echo "  latest Play versionCode (all tracks): $REMOTE_CODE"

if (( LOCAL_CODE > REMOTE_CODE )); then
  GAP=$(( LOCAL_CODE - REMOTE_CODE ))
  if (( GAP == 1 )); then
    echo "  ✓ app.json versionCode ($LOCAL_CODE) is one ahead of Play ($REMOTE_CODE) — no bump needed"
  else
    echo "  ✓ app.json versionCode ($LOCAL_CODE) is $GAP ahead of Play ($REMOTE_CODE) — no bump needed"
    echo "    (gap > 1: prior local bumps that never shipped, or remote query missed builds)"
  fi
  exit 0
fi

NEXT_CODE=$(( REMOTE_CODE + 1 ))
DRIFT=$(( REMOTE_CODE - LOCAL_CODE ))

if (( CHECK_ONLY )); then
  echo "  ✗ app.json versionCode ($LOCAL_CODE) must be > $REMOTE_CODE (latest in Play)" >&2
  echo "    Bump with: jq '.expo.android.versionCode = $NEXT_CODE' app.json > app.json.tmp && mv app.json.tmp app.json" >&2
  exit 1
fi

if (( DRIFT >= 2 )); then
  echo
  echo "  ⚠ Suspicious versionCode drift: Play is at $REMOTE_CODE, local app.json is at $LOCAL_CODE (gap $DRIFT)"
  echo "    Check: did you run \`git pull --ff-only\` recently?"
  echo
fi

echo "  ⚠ app.json versionCode ($LOCAL_CODE) ≤ Play latest ($REMOTE_CODE) — auto-bumping to $NEXT_CODE"
jq ".expo.android.versionCode = $NEXT_CODE" app.json > app.json.tmp && mv app.json.tmp app.json
echo "  ✓ app.json updated to versionCode $NEXT_CODE"

# Sync build.gradle to match so both files are committed together.
GRADLE_BUILD="android/app/build.gradle"
if [[ -f "$GRADLE_BUILD" ]]; then
  GRADLE_VC=$(grep -oE 'versionCode [0-9]+' "$GRADLE_BUILD" | grep -oE '[0-9]+')
  if [[ "$GRADLE_VC" != "$NEXT_CODE" ]]; then
    sed -i '' "s/versionCode $GRADLE_VC/versionCode $NEXT_CODE/" "$GRADLE_BUILD"
    echo "  ✓ build.gradle synced to versionCode $NEXT_CODE"
  fi
fi

echo "  ✓ app.json + build.gradle updated to versionCode $NEXT_CODE (commit deferred until after successful upload)"
# Exit 2 signals to ship-android.sh that files were bumped and need committing.
exit 2
