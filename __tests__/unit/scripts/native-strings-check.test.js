/**
 * @jest-environment node
 *
 * Tests for scripts/check-native-strings.js against throwaway fixture
 * directories — never the real ios/, app.json or plugins/ — so this stays
 * green regardless of the real repo's current permission-string state.
 */

'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const SCRIPT = path.join(ROOT, 'scripts/check-native-strings.js');
const LOCALES = ['en', 'he', 'ar', 'ru'];

let dir;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'native-strings-check-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

// Two keys are enough to exercise every check: NSFaceIDUsageDescription is
// sourced from ios.infoPlist directly, NSCameraUsageDescription from the
// expo-camera plugin option — the two app.json shapes the script has to read.
const FACE_ID = 'Uses Face ID to protect access.';
const CAMERA = 'Used for QR code scanning.';

function writeInfoPlist(pairs) {
  const body = Object.entries(pairs)
    .map(([key, value]) => `  <key>${key}</key>\n  <string>${value}</string>`)
    .join('\n');
  fs.writeFileSync(
    path.join(dir, 'ios/Threadbase/Info.plist'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<plist><dict>\n${body}\n</dict></plist>\n`,
  );
}

function writeLocaleStrings(locale, pairs) {
  const body = Object.entries(pairs)
    .map(([key, value]) => `"${key}" = "${value}";`)
    .join('\n');
  fs.writeFileSync(path.join(dir, `ios/Threadbase/${locale}.lproj/InfoPlist.strings`), `${body}\n`);
}

function writeAppJson({ faceId = FACE_ID, camera = CAMERA } = {}) {
  fs.writeFileSync(
    path.join(dir, 'app.json'),
    JSON.stringify(
      {
        expo: {
          ios: { infoPlist: { NSFaceIDUsageDescription: faceId } },
          plugins: [['expo-camera', { cameraPermission: camera }]],
        },
      },
      null,
      2,
    ),
  );
}

function writePluginFixture(stringsByLocale) {
  fs.writeFileSync(
    path.join(dir, 'plugins/withLocalizedPermissionStrings.js'),
    `'use strict';\nmodule.exports.LOCALIZED_INFO_PLIST_STRINGS = ${JSON.stringify(stringsByLocale)};\n`,
  );
}

/** A fully-agreeing fixture: app.json, Info.plist, all four locale files and the plugin literal all match. */
function writeConsistentFixture() {
  for (const sub of ['ios/Threadbase', 'plugins', ...LOCALES.map((l) => `ios/Threadbase/${l}.lproj`)]) {
    fs.mkdirSync(path.join(dir, sub), { recursive: true });
  }
  writeAppJson();
  writeInfoPlist({ NSFaceIDUsageDescription: FACE_ID, NSCameraUsageDescription: CAMERA });
  const pairs = { NSFaceIDUsageDescription: FACE_ID, NSCameraUsageDescription: CAMERA };
  const byLocale = {};
  for (const locale of LOCALES) {
    writeLocaleStrings(locale, pairs);
    byLocale[locale] = Object.entries(pairs);
  }
  writePluginFixture(byLocale);
  return { pairs, byLocale };
}

function run() {
  return spawnSync('node', [SCRIPT], { encoding: 'utf8', env: { ...process.env, NATIVE_STRINGS_CHECK_ROOT: dir } });
}

describe('check-native-strings', () => {
  it('passes when app.json, Info.plist, every locale and the plugin literal all agree', () => {
    writeConsistentFixture();
    const result = run();
    expect(result.status).toBe(0);
  });

  it('fails when a key in Info.plist is missing from a locale InfoPlist.strings', () => {
    const { pairs } = writeConsistentFixture();
    writeLocaleStrings('he', { NSCameraUsageDescription: pairs.NSCameraUsageDescription }); // drop FaceID
    const result = run();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('NSFaceIDUsageDescription is in Info.plist but missing from he.lproj/InfoPlist.strings');
  });

  it('fails when a key in en.lproj is missing from another locale', () => {
    const { pairs, byLocale } = writeConsistentFixture();
    // Add a key only en.lproj carries, absent from Info.plist and the other locales.
    writeLocaleStrings('en', { ...pairs, NSExtraUsageDescription: 'Extra.' });
    writePluginFixture({ ...byLocale, en: [...byLocale.en, ['NSExtraUsageDescription', 'Extra.']] });
    const result = run();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('NSExtraUsageDescription is in en.lproj but missing from he.lproj/InfoPlist.strings');
  });

  it('fails when app.json disagrees with Info.plist', () => {
    writeConsistentFixture();
    writeAppJson({ camera: 'A different camera permission string.' });
    const result = run();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('NSCameraUsageDescription: app.json says "A different camera permission string."');
  });

  it('fails when the plugin literal drifts from the committed .lproj file', () => {
    const { byLocale } = writeConsistentFixture();
    writePluginFixture({
      ...byLocale,
      en: byLocale.en.map(([key, value]) => (key === 'NSCameraUsageDescription' ? [key, 'Stale plugin copy.'] : [key, value])),
    });
    const result = run();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('NSCameraUsageDescription (en): plugin literal "Stale plugin copy."');
  });
});
