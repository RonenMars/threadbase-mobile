/**
 * @jest-environment node
 *
 * The shipped Info.plist must actually match app.json's camera permission string.
 *
 * `ios/` is committed and tracked, so Info.plist — not app.json — is what ships.
 * A config-plugin permission mod (expo-camera's `cameraPermission`) always
 * overwrites the Info.plist key it targets once app.json's `ios.infoPlist`
 * seed has been read, so it silently wins over any `NSCameraUsageDescription`
 * also declared under `ios.infoPlist`. Between 2026-04-26 and 2026-08-15,
 * app.json's `ios.infoPlist.NSCameraUsageDescription` described QR pairing and
 * photo attachment, while the committed Info.plist — and the `expo-camera`
 * plugin string that actually produced it — described QR pairing only. Nobody
 * noticed: the string is App Store Connect / iOS Settings copy, not app
 * behavior, so nothing broke and no test read it.
 *
 * `expo-camera`'s `cameraPermission` is the only value that reaches the
 * shipped Info.plist, so it is asserted directly against the committed file.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const INFO_PLIST = path.join(ROOT, 'ios/Threadbase/Info.plist');
const APP_JSON = path.join(ROOT, 'app.json');

describe('iOS CAMERA usage description', () => {
  const appJson = JSON.parse(fs.readFileSync(APP_JSON, 'utf8'));
  const infoPlist = fs.readFileSync(INFO_PLIST, 'utf8');

  const cameraPluginEntry = appJson.expo.plugins.find(
    (entry) => Array.isArray(entry) && entry[0] === 'expo-camera'
  );
  const cameraPermission = cameraPluginEntry?.[1]?.cameraPermission;

  const plistMatch = infoPlist.match(
    /<key>NSCameraUsageDescription<\/key>\s*<string>([^<]*)<\/string>/
  );
  const plistDescription = plistMatch?.[1];

  it('matches the expo-camera plugin string that generates it', () => {
    expect(plistDescription).toBe(cameraPermission);
  });

  // The plugin string always overwrites this key, so a duplicate declaration
  // here is dead configuration that misleads whoever edits it expecting it
  // to reach the shipped app — this is the exact shape of the original bug.
  it('is not also declared under ios.infoPlist', () => {
    expect(appJson.expo.ios.infoPlist).not.toHaveProperty('NSCameraUsageDescription');
  });
});
