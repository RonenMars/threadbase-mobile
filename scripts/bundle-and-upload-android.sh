#!/usr/bin/env bash
# bundle-and-upload-android.sh — build a signed Android App Bundle (.aab)
# with Gradle and upload it to Google Play Internal Testing via the
# Play Developer API.
#
# Mirrors archive-and-upload.sh (iOS).
#
# Prereqs:
#   source .env.signing.android   (sets TB_MOBILE_UPLOAD_KEYSTORE* vars)
#   GOOGLE_APPLICATION_CREDENTIALS set to service-account JSON path
#   ANDROID_HOME + JAVA_HOME set (Java 17)
#
# Usage:
#   source .env.signing.android
#   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json \
#     ./scripts/bundle-and-upload-android.sh
#
# Flags (env vars):
#   ANDROID_TRACK   — Play track to upload to (default: internal)
#   AAB_PATH        — override default build output path
#   SKIP_BUNDLE     — set to 1 to skip Gradle and reuse existing AAB

set -euo pipefail

: "${TB_MOBILE_UPLOAD_KEYSTORE:?source .env.signing.android first}"
: "${TB_MOBILE_UPLOAD_KEYSTORE_PASSWORD:?source .env.signing.android first}"
: "${TB_MOBILE_UPLOAD_KEY_ALIAS:?source .env.signing.android first}"
: "${TB_MOBILE_UPLOAD_KEY_PASSWORD:?source .env.signing.android first}"
: "${GOOGLE_APPLICATION_CREDENTIALS:?GOOGLE_APPLICATION_CREDENTIALS not set}"
command -v jq   >/dev/null || { echo "jq required" >&2; exit 1; }
command -v node >/dev/null || { echo "node required" >&2; exit 1; }

ANDROID_TRACK="${ANDROID_TRACK:-internal}"
AAB_PATH="${AAB_PATH:-android/app/build/outputs/bundle/release/app-release.aab}"
SKIP_BUNDLE="${SKIP_BUNDLE:-0}"

PACKAGE_NAME=$(jq -r '.expo.android.package' app.json)
VERSION_CODE=$(jq -r '.expo.android.versionCode' app.json)
VERSION_NAME=$(jq -r '.expo.version' app.json)

[[ -n "$PACKAGE_NAME" && "$PACKAGE_NAME" != "null" ]] || { echo "expo.android.package missing in app.json" >&2; exit 1; }
[[ -n "$VERSION_CODE" && "$VERSION_CODE" != "null" ]] || { echo "expo.android.versionCode missing in app.json" >&2; exit 1; }

mkdir -p build

# Sync versionCode into android/app/build.gradle from app.json.
# Expo prebuild hard-codes the value at generation time; subsequent app.json
# bumps (e.g. from check-version-code.sh) are not automatically reflected.
# Without this sync, Gradle sees no change and returns an UP-TO-DATE AAB
# that still carries the old versionCode.
GRADLE_BUILD="android/app/build.gradle"
GRADLE_VC=$(grep -oE 'versionCode [0-9]+' "$GRADLE_BUILD" | grep -oE '[0-9]+')
if [[ "$GRADLE_VC" != "$VERSION_CODE" ]]; then
  echo "  syncing build.gradle versionCode $GRADLE_VC → $VERSION_CODE"
  sed -i '' "s/versionCode $GRADLE_VC/versionCode $VERSION_CODE/" "$GRADLE_BUILD"
  # Remove the stale AAB so Gradle can't serve it from cache with the old versionCode.
  rm -f "$AAB_PATH"
fi

echo "▸ Building Android App Bundle (versionCode=$VERSION_CODE, versionName=$VERSION_NAME)"
echo "  package:  $PACKAGE_NAME"
echo "  track:    $ANDROID_TRACK"
echo "  aab:      $AAB_PATH"
echo

if (( SKIP_BUNDLE )); then
  echo "  skipping Gradle build — reusing existing AAB"
  [[ -f "$AAB_PATH" ]] || { echo "ERROR: no AAB at $AAB_PATH — build first or omit --skip-bundle" >&2; exit 1; }
  echo "  ✓ AAB found: $AAB_PATH ($(du -sh "$AAB_PATH" | cut -f1))"
else
  # Export signing vars so Gradle reads them (build.gradle uses System.getenv)
  export TB_MOBILE_UPLOAD_KEYSTORE
  export TB_MOBILE_UPLOAD_KEYSTORE_PASSWORD
  export TB_MOBILE_UPLOAD_KEY_ALIAS
  export TB_MOBILE_UPLOAD_KEY_PASSWORD

  (cd android && ./gradlew :app:bundleRelease --no-daemon 2>&1 | tee ../build/gradle-bundle.log)

  if [[ ! -f "$AAB_PATH" ]]; then
    echo "ERROR: Expected AAB not found at $AAB_PATH" >&2
    echo "Check build/gradle-bundle.log for details." >&2
    exit 1
  fi
  echo "  ✓ AAB built: $AAB_PATH ($(du -sh "$AAB_PATH" | cut -f1))"
fi
echo

echo "▸ Uploading to Play ($ANDROID_TRACK track)"

node - "$PACKAGE_NAME" "$VERSION_CODE" "$AAB_PATH" "$ANDROID_TRACK" "$GOOGLE_APPLICATION_CREDENTIALS" <<'EOF'
const fs     = require('fs');
const crypto = require('crypto');
const https  = require('https');
const path   = require('path');

const [pkg, versionCode, aabPath, track, saPath] = process.argv.slice(2);
const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));

// --- Mint OAuth2 access token ---
function mintToken(sa) {
  return new Promise((resolve, reject) => {
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

    const body = `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`;
    const opts = {
      hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
    };
    let resp = '';
    const req = https.request(opts, r => { r.on('data', d => resp += d); r.on('end', () => { const d = JSON.parse(resp); d.access_token ? resolve(d.access_token) : reject(new Error('OAuth2: ' + resp)); }); });
    req.on('error', reject); req.write(body); req.end();
  });
}

function apiPost(path, token, payload) {
  return new Promise((resolve, reject) => {
    const body = payload ? JSON.stringify(payload) : '';
    const opts = {
      hostname: 'androidpublisher.googleapis.com', path, method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    };
    let resp = '';
    const req = https.request(opts, r => { r.on('data', d => resp += d); r.on('end', () => resolve(JSON.parse(resp))); });
    req.on('error', reject); req.write(body); req.end();
  });
}

function apiGet(path, token) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: 'androidpublisher.googleapis.com', path, headers: { Authorization: 'Bearer ' + token } };
    let body = '';
    https.get(opts, r => { r.on('data', d => body += d); r.on('end', () => resolve(JSON.parse(body))); }).on('error', reject);
  });
}

// Upload the AAB binary using resumable upload.
function uploadAAB(editId, token, aabPath) {
  return new Promise((resolve, reject) => {
    const aabData = fs.readFileSync(aabPath);
    const size = aabData.length;

    // Step 1: initiate resumable upload session
    const initPath = `/upload/androidpublisher/v3/applications/${pkg}/edits/${editId}/bundles?uploadType=resumable`;
    const initOpts = {
      hostname: 'androidpublisher.googleapis.com', path: initPath, method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'X-Upload-Content-Type': 'application/octet-stream',
        'X-Upload-Content-Length': size,
        'Content-Type': 'application/json',
        'Content-Length': 2,
      },
    };
    let uploadUrl = '';
    const initReq = https.request(initOpts, r => {
      uploadUrl = r.headers.location;
      if (!uploadUrl) { reject(new Error('No upload URL in initiate response headers')); return; }
      // Step 2: upload binary to the session URL
      const urlObj = new URL(uploadUrl);
      const uploadOpts = {
        hostname: urlObj.hostname, path: urlObj.pathname + urlObj.search, method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': size },
      };
      let resp = '';
      const uploadReq = https.request(uploadOpts, r2 => {
        r2.on('data', d => resp += d);
        r2.on('end', () => { try { resolve(JSON.parse(resp)); } catch(e) { reject(new Error('Upload response: ' + resp)); } });
      });
      uploadReq.on('error', reject);
      uploadReq.write(aabData);
      uploadReq.end();
    });
    initReq.on('error', reject);
    initReq.write('{}');
    initReq.end();
  });
}

(async () => {
  const token = await mintToken(sa);
  const base  = `/androidpublisher/v3/applications/${pkg}`;

  // 1. Open a new edit
  const edit = await apiPost(`${base}/edits`, token, {});
  if (edit.error) throw new Error('edits.insert: ' + JSON.stringify(edit.error));
  const editId = edit.id;
  console.error(`  edit opened: ${editId}`);

  try {
    // 2. Upload the AAB
    console.error(`  uploading AAB (${Math.round(fs.statSync(aabPath).size / 1024 / 1024)}MB)...`);
    const bundle = await uploadAAB(editId, token, aabPath);
    if (bundle.error) throw new Error('bundles.upload: ' + JSON.stringify(bundle.error));
    console.error(`  AAB uploaded: versionCode=${bundle.versionCode}`);

    // 3. Assign to track
    const trackBody = {
      track,
      releases: [{ versionCodes: [String(versionCode)], status: 'completed' }],
    };
    const trackPath = `/androidpublisher/v3/applications/${pkg}/edits/${editId}/tracks/${track}`;
    const trackResult = await new Promise((resolve, reject) => {
      const body = JSON.stringify(trackBody);
      const opts = {
        hostname: 'androidpublisher.googleapis.com', path: trackPath, method: 'PUT',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      };
      let resp = '';
      const req = https.request(opts, r => { r.on('data', d => resp += d); r.on('end', () => resolve(JSON.parse(resp))); });
      req.on('error', reject); req.write(body); req.end();
    });
    if (trackResult.error) throw new Error('tracks.update: ' + JSON.stringify(trackResult.error));
    console.error(`  track '${track}' updated`);

    // 4. Commit the edit
    const commit = await apiPost(`${base}/edits/${editId}:commit`, token, null);
    if (commit.error) throw new Error('edits.commit: ' + JSON.stringify(commit.error));
    console.error(`  edit committed: ${commit.id}`);

  } catch (err) {
    // Delete the edit on failure so it doesn't block future uploads
    try {
      await new Promise((res, rej) => {
        const opts = { hostname: 'androidpublisher.googleapis.com', path: `${base}/edits/${editId}`, method: 'DELETE', headers: { Authorization: 'Bearer ' + token } };
        https.request(opts, r => r.resume().on('end', res)).on('error', rej).end();
      });
    } catch(_) {}
    throw err;
  }
})().catch(e => { process.stderr.write('ERROR: ' + e.message + '\n'); process.exit(1); });
EOF

echo "  ✓ AAB uploaded to Play ($ANDROID_TRACK track, versionCode=$VERSION_CODE)"
echo
echo "The build is now in review by Google. Internal track builds are"
echo "typically available to testers within a few minutes."
