#!/usr/bin/env node
// Promote an existing versionCode from one track to another via Play API.
// Usage: node promote-android.js <pkg> <versionCode> <toTrack> <saPath>
'use strict';
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');

const [pkg, versionCodeStr, toTrack, saPath] = process.argv.slice(2);
if (!pkg || !versionCodeStr || !toTrack || !saPath) {
  console.error('Usage: node promote-android.js <pkg> <versionCode> <toTrack> <saPath>');
  process.exit(1);
}
const versionCode = String(versionCodeStr);
const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));

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
    req.setTimeout(30_000, () => req.destroy(new Error('OAuth2 token request timed out after 30s')));
    req.on('error', reject); req.write(body); req.end();
  });
}

function apiCall(method, path, token, payload) {
  return new Promise((resolve, reject) => {
    const body = payload ? JSON.stringify(payload) : '';
    const opts = {
      hostname: 'androidpublisher.googleapis.com', path, method,
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    };
    let resp = '';
    const req = https.request(opts, r => { r.on('data', d => resp += d); r.on('end', () => resolve(JSON.parse(resp))); });
    req.setTimeout(30_000, () => req.destroy(new Error(`Play API ${method} ${path} timed out after 30s`)));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  console.error(`Promoting versionCode=${versionCode} to track '${toTrack}'`);
  const token = await mintToken(sa);

  // Open edit
  const edit = await apiCall('POST', `/androidpublisher/v3/applications/${pkg}/edits`, token, {});
  if (edit.error) throw new Error('edits.insert: ' + JSON.stringify(edit.error));
  const editId = edit.id;
  console.error(`  edit opened: ${editId}`);

  // Update target track to include this versionCode
  const trackBody = {
    track: toTrack,
    releases: [{ versionCodes: [versionCode], status: 'completed' }],
  };
  const trackResult = await apiCall('PUT', `/androidpublisher/v3/applications/${pkg}/edits/${editId}/tracks/${toTrack}`, token, trackBody);
  if (trackResult.error) throw new Error('tracks.update: ' + JSON.stringify(trackResult.error));
  console.error(`  track '${toTrack}' updated`);

  // Commit edit
  const commit = await apiCall('POST', `/androidpublisher/v3/applications/${pkg}/edits/${editId}:commit`, token, {});
  if (commit.error) throw new Error('edits.commit: ' + JSON.stringify(commit.error));
  console.error(`  edit committed: ${commit.id}`);
  console.error(`  ✓ versionCode=${versionCode} promoted to '${toTrack}' track`);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
