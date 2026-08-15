/**
 * @jest-environment node
 *
 * The Android cleartext policy has two halves that have to stay in step, and
 * nothing at build time notices when they do not — see
 * docs/adr/0002-android-cleartext-policy.md.
 *
 * `app.json` declares the intent; `expo prebuild` writes it into
 * android/app/src/main/AndroidManifest.xml, which is committed and is what the
 * release build actually reads. A prebuild that was never run, or a manifest
 * edited by hand and then regenerated, leaves the two disagreeing — and the
 * failure mode is the one #727 was filed about: a release build that silently
 * refuses every plain-HTTP request while every developer build works.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const APP_JSON = path.join(ROOT, 'app.json');
const MAIN_MANIFEST = path.join(ROOT, 'android/app/src/main/AndroidManifest.xml');
const ANDROID_DIR = path.join(ROOT, 'android');

function buildPropertiesAndroid() {
  const appJson = JSON.parse(fs.readFileSync(APP_JSON, 'utf8'));
  const entry = appJson.expo.plugins.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-build-properties',
  );
  return entry?.[1]?.android ?? {};
}

describe('Android cleartext policy', () => {
  it('declares cleartext in app.json, so prebuild regenerates it', () => {
    expect(buildPropertiesAndroid().usesCleartextTraffic).toBe(true);
  });

  it('carries the attribute into the committed main manifest', () => {
    const manifest = fs.readFileSync(MAIN_MANIFEST, 'utf8');
    expect(manifest).toContain('android:usesCleartextTraffic="true"');
  });

  // A network security config takes precedence over usesCleartextTraffic
  // entirely, so one appearing anywhere under android/ would silently override
  // both assertions above — and, in src/main/, would also revoke the blanket
  // cleartext that src/debug/ and src/debugOptimized/ rely on for local dev.
  it('has no network security config to override it', () => {
    const found = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'build' || entry.name === '.gradle') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name === 'network_security_config.xml') found.push(full);
      }
    };
    walk(ANDROID_DIR);
    expect(found).toEqual([]);
  });
});
