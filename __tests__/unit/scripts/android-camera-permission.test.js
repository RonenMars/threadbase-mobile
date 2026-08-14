/**
 * @jest-environment node
 *
 * The shipped Android manifest must actually declare CAMERA.
 *
 * This is the one check CI can make about a bug CI could not otherwise see.
 * Between 2026-04-26 and 2026-08-15 the manifest carried
 * `<uses-permission android:name="android.permission.CAMERA" tools:node="remove"/>`,
 * which declares the permission and strips it again during manifest merging.
 * Nothing in the suite noticed: no jest test, lint rule or type check reads a
 * merged manifest, and the app compiled, installed and ran.
 *
 * The user-visible result was silent and misdirecting. Android lists only
 * declared permissions, so Settings showed no Camera row; a runtime request for
 * an undeclared permission is denied instantly with no dialog, so the app told
 * the user to enable it in Settings, where there was nothing to enable. QR
 * pairing — the primary pairing path — was unreachable on Android for four
 * months, and so was photo capture in the composer.
 *
 * Two files have to agree for that to stay fixed, and only one of them is
 * generated: removing `cameraPermission: false` from app.json stops a future
 * prebuild re-adding the block, but `expo prebuild --no-clean` does NOT remove
 * a block already written into the manifest. Both are asserted here, because
 * either one alone leaves a build that looks fixed and is not.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const MANIFEST = path.join(ROOT, 'android/app/src/main/AndroidManifest.xml');
const APP_JSON = path.join(ROOT, 'app.json');

describe('Android CAMERA permission', () => {
  const manifest = fs.readFileSync(MANIFEST, 'utf8');

  it('declares CAMERA in the manifest', () => {
    expect(manifest).toMatch(/<uses-permission android:name="android\.permission\.CAMERA"/);
  });

  // The bug: declared and removed on the same line. Asserting the permission is
  // merely "present" passes on exactly the broken manifest this guards against.
  it('does not strip CAMERA during manifest merging', () => {
    const cameraLine = manifest
      .split('\n')
      .find((line) => line.includes('android.permission.CAMERA'));
    expect(cameraLine).toBeDefined();
    expect(cameraLine).not.toContain('tools:node="remove"');
  });

  // In Expo config plugins a `false` permission blocks rather than skips, and
  // expo-image-picker runs after expo-camera, so this one value overrode both
  // the expo-camera plugin and the explicit android.permissions array.
  it('does not let any plugin block CAMERA from app.json', () => {
    const appJson = JSON.parse(fs.readFileSync(APP_JSON, 'utf8'));
    const blockers = appJson.expo.plugins
      .filter((entry) => Array.isArray(entry) && entry[1]?.cameraPermission === false)
      .map((entry) => entry[0]);
    expect(blockers).toEqual([]);
  });
});
