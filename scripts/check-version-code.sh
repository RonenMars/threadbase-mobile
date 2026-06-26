#!/usr/bin/env bash
# check-version-code.sh — verify app.json versionCode + versionName are ahead
# of the latest build in Google Play, and auto-bump if they aren't.
#
# Comparison rules (mirrors check-build-number.sh for iOS):
#   ciVersionCode    = app.json expo.android.versionCode
#   ciVersionName    = app.json expo.version  (and build.gradle versionName)
#   appVersionCode   = highest versionCode seen across all Play tracks + bundles
#   appVersionName   = versionName of the bundle with the highest versionCode
#
#   resolvedCode     = max(ciVersionCode, appVersionCode) + 1
#   resolvedName     = semver-max(ciVersionName, appVersionName)
#
#   Updates app.json + build.gradle in the working tree; exits 2 if changed.
#
# Requires GOOGLE_APPLICATION_CREDENTIALS to be set.
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
LOCAL_NAME=$(jq -r '.expo.version' app.json)

[[ -n "$PACKAGE_NAME" && "$PACKAGE_NAME" != "null" ]] || { echo "expo.android.package missing in app.json" >&2; exit 1; }
[[ -n "$LOCAL_CODE"   && "$LOCAL_CODE"   != "null" ]] || { echo "expo.android.versionCode missing in app.json" >&2; exit 1; }
[[ -n "$LOCAL_NAME"   && "$LOCAL_NAME"   != "null" ]] || { echo "expo.version missing in app.json" >&2; exit 1; }

echo "▸ Checking Play versionCode + versionName for $PACKAGE_NAME"
echo "  local app.json versionCode: $LOCAL_CODE  versionName: $LOCAL_NAME"

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

function semverGt(a, b) {
  const pa = (a || '0.0.0').split('.').map(Number);
  const pb = (b || '0.0.0').split('.').map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] || 0, nb = pb[i] || 0;
    if (na > nb) return true;
    if (na < nb) return false;
  }
  return false;
}

(async () => {
  const pkg   = process.argv[2];
  const token = process.argv[3];

  if (!token || token === '-') { process.stderr.write('ERROR: access token is empty — OAuth2 minting failed\n'); process.exit(1); }

  const base = `/androidpublisher/v3/applications/${pkg}`;
  let maxCode = 0;
  // Track versionName of the bundle with the highest versionCode.
  let maxCodeName = '';

  // Source 1: edit-less tracks endpoint — live published state (gives versionCodes only).
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
        // versionName not available from tracks endpoint; resolved via bundles below.
      }
    }
  }

  // Source 2: open a throwaway edit and list bundles — catches versionCodes
  // uploaded in recently-committed edits (eventual consistency) AND gives us
  // versionName per bundle.
  let editId = null;
  try {
    const edit = await request('POST', `${base}/edits`, token, {});
    if (edit.error) throw new Error('edits.insert: ' + JSON.stringify(edit.error));
    editId = edit.id;

    const bundles = await request('GET', `${base}/edits/${editId}/bundles`, token, null);
    if (!bundles.error) {
      for (const b of (bundles.bundles || [])) {
        const n = parseInt(b.versionCode, 10);
        if (n > maxCode) {
          maxCode = n;
          maxCodeName = b.versionName || '';
        } else if (n === maxCode && !maxCodeName && b.versionName) {
          maxCodeName = b.versionName;
        }
      }
    }
  } catch(e) {
    process.stderr.write('  bundles.list via edit skipped: ' + e.message + '\n');
  } finally {
    if (editId) {
      await request('DELETE', `${base}/edits/${editId}`, token, null).catch(() => {});
    }
  }

  // Output: "<maxCode>\t<maxCodeName>" — name may be empty if no bundles found.
  process.stdout.write(String(maxCode) + '\t' + maxCodeName);
})().catch(e => {
  const offline = e.message.includes('ENOTFOUND') || e.message.includes('ECONNREFUSED') || e.message.includes('ETIMEDOUT');
  process.stderr.write(e.message + '\n');
  process.exit(offline ? 3 : 1);
});
NODEJS

set +e
REMOTE_RAW=$(node "$_tmp_query" "$PACKAGE_NAME" "$ACCESS_TOKEN")
_query_exit=$?
set -e
rm -f "$_tmp_query"

if (( _query_exit == 3 )); then
  echo "  ⚠ Play API unreachable — skipping remote version check, proceeding with local (versionCode $LOCAL_CODE, versionName $LOCAL_NAME)" >&2
  exit 0
fi

REMOTE_CODE=$(echo "$REMOTE_RAW" | cut -f1)
REMOTE_NAME=$(echo "$REMOTE_RAW" | cut -f2)

echo "  latest Play versionCode (all tracks): $REMOTE_CODE  versionName: ${REMOTE_NAME:-<unknown>}"

# ── Resolve versionName: semver-max(ciVersionName, appVersionName) ──────────
RESOLVED_NAME=$(node -e "
function semverGt(a, b) {
  const pa = (a || '0.0.0').split('.').map(Number);
  const pb = (b || '0.0.0').split('.').map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] || 0, nb = pb[i] || 0;
    if (na > nb) return true;
    if (na < nb) return false;
  }
  return false;
}
const ci = process.argv[1], app = process.argv[2] || '0.0.0';
console.log(semverGt(app, ci) ? app : ci);
" "$LOCAL_NAME" "$REMOTE_NAME")

# ── Resolve versionCode: max(ci, remote) + 1 ────────────────────────────────
if (( LOCAL_CODE > REMOTE_CODE )); then
  GAP=$(( LOCAL_CODE - REMOTE_CODE ))
  if (( GAP == 1 )); then
    echo "  ✓ app.json versionCode ($LOCAL_CODE) is one ahead of Play ($REMOTE_CODE) — versionCode OK"
  else
    echo "  ✓ app.json versionCode ($LOCAL_CODE) is $GAP ahead of Play ($REMOTE_CODE) — versionCode OK"
  fi
  NEXT_CODE=$LOCAL_CODE
  CODE_CHANGED=0
else
  NEXT_CODE=$(( REMOTE_CODE + 1 ))
  CODE_CHANGED=1
  DRIFT=$(( REMOTE_CODE - LOCAL_CODE ))
  if (( DRIFT >= 2 )); then
    echo
    echo "  ⚠ Suspicious versionCode drift: Play is at $REMOTE_CODE, local is at $LOCAL_CODE (gap $DRIFT)"
    echo "    Check: did you run \`git pull --ff-only\` recently?"
    echo
  fi
fi

NAME_CHANGED=0
[[ "$RESOLVED_NAME" != "$LOCAL_NAME" ]] && NAME_CHANGED=1

if (( CODE_CHANGED == 0 && NAME_CHANGED == 0 )); then
  echo "  ✓ app.json versionCode ($LOCAL_CODE) and versionName ($LOCAL_NAME) are already correct — no bump needed"
  exit 0
fi

if (( CHECK_ONLY )); then
  (( CODE_CHANGED )) && echo "  ✗ versionCode should be $NEXT_CODE (CI: $LOCAL_CODE, Play: $REMOTE_CODE)" >&2
  (( NAME_CHANGED )) && echo "  ✗ versionName should be $RESOLVED_NAME (CI: $LOCAL_NAME, Play: $REMOTE_NAME)" >&2
  exit 1
fi

(( CODE_CHANGED )) && echo "  ⚠ versionCode: $LOCAL_CODE → $NEXT_CODE (Play latest: $REMOTE_CODE)"
(( NAME_CHANGED )) && echo "  ⚠ versionName: $LOCAL_NAME → $RESOLVED_NAME (Play: ${REMOTE_NAME:-<unknown>})"

# ── Update app.json ──────────────────────────────────────────────────────────
jq ".expo.version = \"$RESOLVED_NAME\" | .expo.android.versionCode = $NEXT_CODE" \
  app.json > app.json.tmp && mv app.json.tmp app.json
echo "  ✓ app.json updated to versionCode $NEXT_CODE, versionName $RESOLVED_NAME"

# ── Sync build.gradle to match ───────────────────────────────────────────────
GRADLE_BUILD="android/app/build.gradle"
if [[ -f "$GRADLE_BUILD" ]]; then
  GRADLE_VC=$(grep -oE 'versionCode [0-9]+' "$GRADLE_BUILD" | grep -oE '[0-9]+')
  GRADLE_VN=$(grep -oE 'versionName "[^"]+"' "$GRADLE_BUILD" | grep -oE '"[^"]+"' | tr -d '"')
  UPDATED_GRADLE=0
  TMP_GRADLE="$GRADLE_BUILD.tmp"
  cp "$GRADLE_BUILD" "$TMP_GRADLE"

  if [[ "$GRADLE_VC" != "$NEXT_CODE" ]]; then
    sed "s/versionCode $GRADLE_VC/versionCode $NEXT_CODE/" "$TMP_GRADLE" > "$TMP_GRADLE.2" && mv "$TMP_GRADLE.2" "$TMP_GRADLE"
    UPDATED_GRADLE=1
  fi
  if [[ -n "$GRADLE_VN" && "$GRADLE_VN" != "$RESOLVED_NAME" ]]; then
    sed "s/versionName \"$GRADLE_VN\"/versionName \"$RESOLVED_NAME\"/" "$TMP_GRADLE" > "$TMP_GRADLE.2" && mv "$TMP_GRADLE.2" "$TMP_GRADLE"
    UPDATED_GRADLE=1
  fi

  if (( UPDATED_GRADLE )); then
    mv "$TMP_GRADLE" "$GRADLE_BUILD"
    echo "  ✓ build.gradle synced to versionCode $NEXT_CODE, versionName $RESOLVED_NAME"
  else
    rm -f "$TMP_GRADLE"
  fi
fi

echo "  ✓ app.json + build.gradle updated (commit deferred until after successful upload)"
# Exit 2 signals to deploy.yml that files were bumped and need committing.
exit 2
