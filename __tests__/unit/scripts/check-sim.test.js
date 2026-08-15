/**
 * @jest-environment node
 */

'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SCRIPT = path.resolve(__dirname, '../../../e2e/check-sim.js');
const tmpDirs = [];

function runAndroidCheck({ apiLevel = '35', devices = [['emulator-5554', 'device']], androidSerial } = {}) {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'check-sim-bin-'));
  tmpDirs.push(bin);
  const listing = devices.map(([serial, state]) => `${serial}\\t${state}\\n`).join('');
  fs.writeFileSync(
    path.join(bin, 'adb'),
    `#!/bin/sh
case "$1" in
  devices) printf 'List of devices attached\\n${listing}' ;;
  -s)
    shift 2
    case "$*" in
      'shell getprop sys.boot_completed') printf '1\\n' ;;
      'shell getprop ro.build.version.sdk') printf '${apiLevel}\\n' ;;
    esac
    ;;
esac
`,
    { mode: 0o755 },
  );

  const env = {
    ...process.env,
    E2E_PLATFORM: 'android',
    PATH: [bin, process.env.PATH].join(path.delimiter),
  };
  if (androidSerial) env.ANDROID_SERIAL = androidSerial;
  else delete env.ANDROID_SERIAL;

  return spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8', env });
}

afterEach(() => {
  while (tmpDirs.length) fs.rmSync(tmpDirs.pop(), { recursive: true, force: true });
});

test('accepts one fully booted Android API 35 emulator', () => {
  const result = runAndroidCheck();

  expect(result.status).toBe(0);
  expect(result.stdout).toContain('emulator-5554 (API 35)');
});

test('rejects an Android emulator on a different API level', () => {
  const result = runAndroidCheck({ apiLevel: '34' });

  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('runs API 34, expected API 35');
});

test('rejects two ready Android devices when ANDROID_SERIAL is unset', () => {
  const result = runAndroidCheck({
    devices: [
      ['eb57e2b6', 'device'],
      ['emulator-5554', 'device'],
    ],
  });

  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('expected exactly one ready Android emulator, found 2');
});

test('picks the ANDROID_SERIAL device out of several attached', () => {
  const result = runAndroidCheck({
    devices: [
      ['eb57e2b6', 'device'],
      ['emulator-5554', 'device'],
    ],
    androidSerial: 'emulator-5554',
  });

  expect(result.status).toBe(0);
  expect(result.stdout).toContain('emulator-5554 (API 35)');
});

test('rejects an ANDROID_SERIAL that adb does not list', () => {
  const result = runAndroidCheck({ androidSerial: 'emulator-9999' });

  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('ANDROID_SERIAL is set to emulator-9999');
});

test('rejects an ANDROID_SERIAL device that is not in device state', () => {
  const result = runAndroidCheck({
    devices: [
      ['emulator-5554', 'device'],
      ['eb57e2b6', 'unauthorized'],
    ],
    androidSerial: 'eb57e2b6',
  });

  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("Android device eb57e2b6 is in state 'unauthorized'");
});
