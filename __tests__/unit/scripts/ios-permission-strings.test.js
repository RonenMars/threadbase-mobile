/**
 * @jest-environment node
 *
 * The shipped Info.plist must actually match app.json's permission strings.
 *
 * `ios/` is committed and tracked, so Info.plist — not app.json — is what
 * ships. A config-plugin permission mod (expo-camera's `cameraPermission`,
 * expo-image-picker's `photosPermission`, ...) always overwrites the
 * Info.plist key it targets once app.json's `ios.infoPlist` seed has been
 * read, so it silently wins over the same key also declared under
 * `ios.infoPlist`. Between 2026-04-26 and 2026-08-15 this was a live bug for
 * two keys and a dormant one for two more:
 *
 *   - NSCameraUsageDescription: `ios.infoPlist` described QR pairing and
 *     photo attachment; the plugin string — and the shipped Info.plist —
 *     described QR pairing only.
 *   - NSPhotoLibraryUsageDescription: `ios.infoPlist` and the plugin string
 *     were two different, never-reconciled phrasings of the same
 *     permission; the shipped Info.plist only ever carried the plugin's.
 *   - NSMicrophoneUsageDescription and NSSpeechRecognitionUsageDescription
 *     had the identical duplicate-declaration shape, but the plugin and
 *     `ios.infoPlist` strings already happened to agree, so there was
 *     nothing to notice.
 *
 * Nobody caught any of this: the strings are App Store Connect / iOS
 * Settings copy, not app behavior, so nothing broke and no test read them.
 *
 * Only the plugin option reaches the shipped Info.plist, so it is asserted
 * directly against the committed file. `NSFaceIDUsageDescription` has no
 * competing plugin and is included as a control case: it proves
 * `ios.infoPlist` is still a real, working source when nothing overrides it.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const INFO_PLIST = path.join(ROOT, 'ios/Threadbase/Info.plist');
const APP_JSON = path.join(ROOT, 'app.json');

const appJson = JSON.parse(fs.readFileSync(APP_JSON, 'utf8'));
const infoPlist = fs.readFileSync(INFO_PLIST, 'utf8');

function pluginOption(pluginName, optionName) {
  const entry = appJson.expo.plugins.find((candidate) => Array.isArray(candidate) && candidate[0] === pluginName);
  return entry?.[1]?.[optionName];
}

function plistString(key) {
  const match = infoPlist.match(new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`));
  return match?.[1];
}

// Every key here is set by a config-plugin permission option that always
// wins over the same key under ios.infoPlist — see the file header.
const PLUGIN_OWNED_PERMISSIONS = [
  { plistKey: 'NSCameraUsageDescription', pluginName: 'expo-camera', optionName: 'cameraPermission' },
  { plistKey: 'NSPhotoLibraryUsageDescription', pluginName: 'expo-image-picker', optionName: 'photosPermission' },
  { plistKey: 'NSMicrophoneUsageDescription', pluginName: 'expo-speech-recognition', optionName: 'microphonePermission' },
  {
    plistKey: 'NSSpeechRecognitionUsageDescription',
    pluginName: 'expo-speech-recognition',
    optionName: 'speechRecognitionPermission',
  },
];

describe('iOS permission usage descriptions', () => {
  describe.each(PLUGIN_OWNED_PERMISSIONS)('$plistKey', ({ plistKey, pluginName, optionName }) => {
    // On its own this assertion would have passed throughout the bug: the
    // plist always reflected the plugin string, because the plugin always
    // wins. It only proves the two files that already agree still agree —
    // it does not catch a drift against ios.infoPlist by itself.
    it('matches the plugin string that generates it', () => {
      expect(plistString(plistKey)).toBe(pluginOption(pluginName, optionName));
    });

    // This is the assertion that actually catches the drift: a duplicate
    // declaration under ios.infoPlist is dead configuration for any key a
    // plugin also sets, and misleads whoever edits it expecting it to reach
    // the shipped app.
    it('is not also declared under ios.infoPlist', () => {
      expect(appJson.expo.ios.infoPlist).not.toHaveProperty(plistKey);
    });
  });

  it('NSFaceIDUsageDescription (no competing plugin) is still sourced from ios.infoPlist', () => {
    expect(plistString('NSFaceIDUsageDescription')).toBe(appJson.expo.ios.infoPlist.NSFaceIDUsageDescription);
  });
});
