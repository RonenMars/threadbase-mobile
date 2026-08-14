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

function runAndroidCheck({ apiLevel = '35' } = {}) {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'check-sim-bin-'));
  tmpDirs.push(bin);
  fs.writeFileSync(
    path.join(bin, 'adb'),
    `#!/bin/sh
case "$*" in
  devices) printf 'List of devices attached\\nemulator-5554\\tdevice\\n' ;;
  '-s emulator-5554 shell getprop sys.boot_completed') printf '1\\n' ;;
  '-s emulator-5554 shell getprop ro.build.version.sdk') printf '${apiLevel}\\n' ;;
esac
`,
    { mode: 0o755 },
  );

  return spawnSync(process.execPath, [SCRIPT], {
    encoding: 'utf8',
    env: {
      ...process.env,
      E2E_PLATFORM: 'android',
      PATH: [bin, process.env.PATH].join(path.delimiter),
    },
  });
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
