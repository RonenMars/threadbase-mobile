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

const PINNED = require('../../../e2e/maestro-version.json').version;

function runAndroidCheck({
  apiLevel = '35',
  devices = [['emulator-5554', 'device']],
  androidSerial,
  maestroVersion = PINNED,
} = {}) {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'check-sim-bin-'));
  tmpDirs.push(bin);
  const listing = devices.map(([serial, state]) => `${serial}\\t${state}\\n`).join('');
  if (maestroVersion !== null) {
    fs.writeFileSync(
      path.join(bin, 'maestro'),
      `#!/bin/sh\nprintf '${maestroVersion}\\n'\n`,
      { mode: 0o755 },
    );
  }
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

// CI installs the pinned version; nothing pins the local CLI. A dev on an older
// Maestro drives the same flows with a different tool, which is how 2.0.10's
// broken `clearState` produced failures that read as app bugs.
test('rejects a Maestro older than the pinned version', () => {
  const result = runAndroidCheck({ maestroVersion: '2.6.1' });

  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain(`older than the pinned ${PINNED}`);
});

test('accepts a Maestro newer than the pinned version', () => {
  const result = runAndroidCheck({ maestroVersion: '2.9.1' });

  expect(result.status).toBe(0);
  expect(result.stdout).toContain(`newer than the pinned ${PINNED}`);
});

/**
 * iOS harness. Stubs `xcrun` so the script sees one booted simulator and every
 * simctl invocation is recorded to a file, which is how the reboot is asserted
 * without a real simulator.
 */
function runIosCheck({ env: extraEnv = {}, maestroVersion = PINNED } = {}) {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'check-sim-ios-bin-'));
  tmpDirs.push(bin);
  const calls = path.join(bin, 'simctl-calls.txt');
  const devices = JSON.stringify({
    devices: {
      'com.apple.CoreSimulator.SimRuntime.iOS-26-4': [
        { name: 'Threadbase-Clean', udid: 'UDID-1', state: 'Booted' },
      ],
    },
  });

  fs.writeFileSync(
    path.join(bin, 'maestro'),
    `#!/bin/sh\nprintf '${maestroVersion}\\n'\n`,
    { mode: 0o755 },
  );
  fs.writeFileSync(
    path.join(bin, 'xcrun'),
    `#!/bin/sh
printf '%s\\n' "$*" >> '${calls}'
case "$*" in
  *'list devices --json'*) cat <<'JSON'
${devices}
JSON
  ;;
esac
exit 0
`,
    { mode: 0o755 },
  );

  const result = spawnSync(process.execPath, [SCRIPT], {
    encoding: 'utf8',
    env: {
      ...process.env,
      E2E_PLATFORM: 'ios',
      CI: '',
      GITHUB_ACTIONS: '',
      E2E_SKIP_SIM_REBOOT: '',
      PATH: [bin, process.env.PATH].join(path.delimiter),
      ...extraEnv,
    },
  });
  result.simctlCalls = fs.existsSync(calls) ? fs.readFileSync(calls, 'utf8') : '';
  return result;
}

test('reboots the booted simulator before handing off to Maestro', () => {
  const result = runIosCheck();

  expect(result.status).toBe(0);
  expect(result.simctlCalls).toContain('simctl shutdown UDID-1');
  expect(result.simctlCalls).toContain('simctl bootstatus UDID-1 -b');
  // Shutdown must precede the boot-and-wait, or the run starts on the old session.
  expect(result.simctlCalls.indexOf('shutdown UDID-1')).toBeLessThan(
    result.simctlCalls.indexOf('bootstatus UDID-1'),
  );
});

test('E2E_SKIP_SIM_REBOOT=1 leaves the simulator alone', () => {
  const result = runIosCheck({ env: { E2E_SKIP_SIM_REBOOT: '1' } });

  expect(result.status).toBe(0);
  expect(result.simctlCalls).not.toContain('shutdown');
  expect(result.stdout).toContain('Skipping the pre-run simulator reboot.');
});

test('CI skips the reboot because each job boots its own simulator', () => {
  const result = runIosCheck({ env: { CI: 'true' } });

  expect(result.status).toBe(0);
  expect(result.simctlCalls).not.toContain('shutdown');
});
