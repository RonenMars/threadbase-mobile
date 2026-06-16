#!/usr/bin/env bash
# check-play-status.sh — report the release/approval status of the app on Google
# Play across all tracks (internal, alpha, beta, production).
#
# For each track it prints the release name, the versionCodes, the rollout
# status (draft | inProgress | halted | completed), and the rollout fraction
# (staged rollouts). "completed" means the release is fully live to that track's
# audience. Play does not expose content-review state via this API — a release
# can be "completed" yet still be under Google review for first-time/closed
# tracks; that review state is only visible in the Play Console UI.
#
# Auth: a Google Play service-account JSON. Resolved from (first wins):
#   1. $GOOGLE_APPLICATION_CREDENTIALS
#   2. ~/.config/threadbase/play-console-sa.json  (deploy cache path)
#
# Usage:
#   ./scripts/check-play-status.sh                 # all tracks, human-readable
#   ./scripts/check-play-status.sh --track alpha   # one track
#   ./scripts/check-play-status.sh --json          # raw JSON for scripting

set -euo pipefail

command -v jq   >/dev/null || { echo "jq required" >&2; exit 1; }
command -v node >/dev/null || { echo "node required" >&2; exit 1; }

ONLY_TRACK=""
AS_JSON=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --track) ONLY_TRACK="$2"; shift 2 ;;
    --json)  AS_JSON=1; shift ;;
    -h|--help) sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

# Resolve the service-account JSON.
SA_PATH="${GOOGLE_APPLICATION_CREDENTIALS:-}"
if [[ -z "$SA_PATH" || ! -f "$SA_PATH" ]]; then
  SA_PATH="${HOME}/.config/threadbase/play-console-sa.json"
fi
[[ -f "$SA_PATH" ]] || {
  echo "No Play service-account JSON found." >&2
  echo "  Set GOOGLE_APPLICATION_CREDENTIALS, or place it at ~/.config/threadbase/play-console-sa.json" >&2
  exit 1
}

PACKAGE_NAME=$(jq -r '.expo.android.package' app.json)
[[ -n "$PACKAGE_NAME" && "$PACKAGE_NAME" != "null" ]] || { echo "expo.android.package missing in app.json" >&2; exit 1; }

node - "$SA_PATH" "$PACKAGE_NAME" "$ONLY_TRACK" "$AS_JSON" <<'EOF'
const fs = require('fs'), crypto = require('crypto'), https = require('https');
const [saPath, pkg, onlyTrack, asJson] = process.argv.slice(2);
const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));

function mintToken() {
  return new Promise((resolve, reject) => {
    const now = Math.floor(Date.now() / 1000);
    const scope = 'https://www.googleapis.com/auth/androidpublisher';
    const header  = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      iss: sa.client_email, sub: sa.client_email,
      aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600, scope,
    })).toString('base64url');
    const unsigned = `${header}.${payload}`;
    const sig = crypto.createSign('SHA256').update(unsigned).sign(sa.private_key, 'base64url');
    const body = `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${unsigned}.${sig}`;
    const req = https.request({ hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } },
      r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { const j = JSON.parse(d); j.access_token ? resolve(j.access_token) : reject(new Error('OAuth2: ' + d)); }); });
    req.on('error', reject); req.write(body); req.end();
  });
}

function api(method, path, token, payload) {
  return new Promise((resolve, reject) => {
    const body = payload ? JSON.stringify(payload) : '';
    const req = https.request({ hostname: 'androidpublisher.googleapis.com', path, method,
      headers: { Authorization: 'Bearer ' + token, ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}) } },
      r => { let d = ''; r.on('data', c => d += c); r.on('end', () => resolve({ status: r.statusCode, body: d ? JSON.parse(d) : {} })); });
    req.on('error', reject); if (body) req.write(body); req.end();
  });
}

(async () => {
  const token = await mintToken();
  const base = `/androidpublisher/v3/applications/${pkg}`;

  const edit = await api('POST', `${base}/edits`, token, {});
  if (edit.status >= 400) throw new Error(`edits.insert failed (HTTP ${edit.status}): ${JSON.stringify(edit.body)}`);
  const editId = edit.body.id;

  let tracks;
  try {
    if (onlyTrack) {
      const r = await api('GET', `${base}/edits/${editId}/tracks/${onlyTrack}`, token, null);
      tracks = r.status === 404 ? [] : [r.body];
    } else {
      const r = await api('GET', `${base}/edits/${editId}/tracks`, token, null);
      tracks = r.body.tracks || [];
    }
  } finally {
    await api('DELETE', `${base}/edits/${editId}`, token, null).catch(() => {});
  }

  if (asJson === '1') { console.log(JSON.stringify({ package: pkg, tracks }, null, 2)); return; }

  console.log(`▸ Google Play — ${pkg}`);
  if (!tracks.length) { console.log('  (no releases found' + (onlyTrack ? ` on track "${onlyTrack}"` : '') + ')'); return; }
  for (const t of tracks) {
    console.log(`\n  track: ${t.track}`);
    for (const rel of (t.releases || [])) {
      const codes = (rel.versionCodes || []).join(', ');
      const frac = rel.userFraction != null ? ` @ ${Math.round(rel.userFraction * 100)}%` : '';
      console.log(`    • ${rel.name || '(unnamed)'} — versionCode ${codes} — status: ${rel.status}${frac}`);
    }
    if (!(t.releases || []).length) console.log('    (no releases)');
  }
  console.log('\n  note: "completed" = live to this track\'s testers.');
  console.log('  Google content-review state is not exposed by the API — check Play Console for review banners.');
  console.log('  Play Console: https://play.google.com/console');
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
EOF
