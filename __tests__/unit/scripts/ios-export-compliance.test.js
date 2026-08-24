/**
 * @jest-environment node
 *
 * Threadbase uses published standard encryption and is not distributed in
 * France, so Apple does not require export-compliance documentation. Both
 * Expo's source config and the committed native plist must declare that the
 * shipped app is exempt; otherwise App Store Connect rejects the upload before
 * creating a TestFlight build.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
const infoPlist = fs.readFileSync(path.join(ROOT, 'ios/Threadbase/Info.plist'), 'utf8');

function plistBoolean(key) {
  const match = infoPlist.match(new RegExp(`<key>${key}</key>\\s*<(true|false)\\s*/>`));
  if (!match) return undefined;
  return match[1] === 'true';
}

describe('iOS export-compliance declaration', () => {
  it('declares documentation-exempt encryption in both configuration sources', () => {
    expect(appJson.expo.ios.infoPlist.ITSAppUsesNonExemptEncryption).toBe(false);
    expect(plistBoolean('ITSAppUsesNonExemptEncryption')).toBe(false);
  });
});
