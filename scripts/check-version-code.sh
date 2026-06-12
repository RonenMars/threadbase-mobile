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
ACCESS_TOKEN=$(node - "$GOOGLE_APPLICATION_CREDENTIALS" <<'EOF'
const fs   = require('fs');
const crypto = require('crypto');
const https  = require('https');

const sa = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const now = Math.floor(Date.now() / 1000);
const scope = 'https://www.googleapis.com/auth/androidpublisher';

const header  = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
const payload = Buffer.from(JSON.stringify({
  iss: sa.client_email,
  sub: sa.client_email,
  aud: 'https://oauth2.googleapis.com/token',
  iat: now,
  exp: now + 3600,
  scope,
})).toString('base64url');

const unsigned = `${header}.${payload}`;
const sig = crypto.createSign('SHA256')
  .update(unsigned)
  .sign(sa.private_key, 'base64url');

const jwt = `${unsigned}.${sig}`;

const body = new URLSearchParams({
  grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
  assertion: jwt,
}).toString();

const opts = {
  hostname: 'oauth2.googleapis.com',
  path: '/token',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(body),
  },
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
req.on('error', e => { process.stderr.write(e.message + '\n'); process.exit(1); });
req.write(body);
req.end();
EOF
)

# Query the androidpublisher API for the highest versionCode across all
# active tracks (internal → alpha → beta → production). We use the
# edits.tracks.list method with a temporary edit.
REMOTE_CODE=$(node - "$PACKAGE_NAME" "$ACCESS_TOKEN" <<'EOF'
const https = require('https');

function get(path, token) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'androidpublisher.googleapis.com',
      path,
      headers: { Authorization: 'Bearer ' + token },
    };
    let body = '';
    https.get(opts, r => {
      r.on('data', d => body += d);
      r.on('end', () => resolve(JSON.parse(body)));
    }).on('error', reject);
  });
}

function post(path, token, payload) {
  return new Promise((resolve, reject) => {
    const body = payload ? JSON.stringify(payload) : '';
    const opts = {
      hostname: 'androidpublisher.googleapis.com',
      path,
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    let resp = '';
    const req = https.request(opts, r => {
      r.on('data', d => resp += d);
      r.on('end', () => resolve(JSON.parse(resp)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function del(path, token) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'androidpublisher.googleapis.com',
      path,
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + token },
    };
    let resp = '';
    const req = https.request(opts, r => {
      r.on('data', d => resp += d);
      r.on('end', () => resolve(resp));
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  const pkg   = process.argv[2];
  const token = process.argv[3];
  const base  = `/androidpublisher/v3/applications/${pkg}`;

  // Open a temporary edit to read track state; delete it immediately after.
  const edit = await post(`${base}/edits`, token, {});
  if (edit.error) {
    process.stderr.write('edits.insert error: ' + JSON.stringify(edit.error) + '\n');
    process.exit(1);
  }
  const editId = edit.id;

  let maxCode = 0;
  try {
    const tracks = await get(`${base}/edits/${editId}/tracks`, token);
    if (tracks.tracks) {
      for (const track of tracks.tracks) {
        for (const release of (track.releases || [])) {
          for (const vc of (release.versionCodes || [])) {
            const n = parseInt(vc, 10);
            if (n > maxCode) maxCode = n;
          }
        }
      }
    }
  } finally {
    await del(`${base}/edits/${editId}`, token);
  }

  process.stdout.write(String(maxCode));
})().catch(e => { process.stderr.write(e.message + '\n'); process.exit(1); });
EOF
)

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

git add app.json
git commit -m "chore(android): bump version code to $NEXT_CODE"
echo "  ✓ committed bump (push with: git push)"
