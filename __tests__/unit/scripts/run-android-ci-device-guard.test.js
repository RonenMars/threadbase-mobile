/**
 * @jest-environment node
 *
 * The device wait in e2e/run-android-ci.sh must be bounded.
 *
 * Its previous form — `adb wait-for-device` followed by a bare `until getprop`
 * loop — blocked forever and printed nothing when no device was attached. That
 * is the worst shape a CI failure can take: the job runs to its 75-minute
 * timeout and produces an empty log, so the next person has nothing to read.
 * A regression here is invisible until it has already burned a runner, which is
 * why it is worth a test.
 */

'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SCRIPT = path.resolve(__dirname, '../../../e2e/run-android-ci.sh');

/**
 * Runs the script with a stubbed `adb` in a throwaway cwd, so the artifacts it
 * creates and the failure trap it fires land in the temp dir, not the repo.
 */
function runWithStubbedAdb(adbBody, env = {}, extraStubs = {}) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'device-guard-')));
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'adb'), `#!/bin/bash\n${adbBody}\n`, { mode: 0o755 });
  for (const [name, body] of Object.entries(extraStubs)) {
    fs.writeFileSync(path.join(bin, name), `#!/bin/bash\n${body}\n`, { mode: 0o755 });
  }

  const result = spawnSync('/bin/bash', [SCRIPT], {
    cwd: dir,
    env: { PATH: `${bin}:/usr/bin:/bin`, HOME: dir, ...env },
    encoding: 'utf8',
    timeout: 60_000,
  });

  fs.rmSync(dir, { recursive: true, force: true });
  return result;
}

describe('run-android-ci.sh device wait', () => {
  it('fails within the deadline instead of hanging when no device ever boots', () => {
    // getprop never reports "1" — the shape of an emulator that died or never started.
    const started = Date.now();
    const result = runWithStubbedAdb('exit 0', { E2E_DEVICE_WAIT_SECONDS: '3' });
    const elapsedMs = Date.now() - started;

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/No booted Android device after 3s/);
    // Bounded, not merely eventual: well under the 60s spawn timeout above.
    expect(elapsedMs).toBeLessThan(30_000);
  });

  it('reports the attached devices so the failure is diagnosable', () => {
    const result = runWithStubbedAdb(
      'if [ "$1" = "devices" ]; then echo "List of devices attached"; fi\nexit 0',
      { E2E_DEVICE_WAIT_SECONDS: '2' },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/List of devices attached/);
  });

  it("preserves the real exit status when the failure trap's ls finds nothing", () => {
    // GNU `ls` exits 2 on a glob that matches nothing where BSD `ls` exits 1, so
    // this reproduces on a Mac what CI sees on Linux. Without `|| true` on that
    // assignment, `set -e` aborts the trap and the script reports ls's status
    // instead of its own — every CI failure gets the wrong exit code, and the
    // Maestro session directory is never copied into the artifacts.
    const result = runWithStubbedAdb('exit 0', { E2E_DEVICE_WAIT_SECONDS: '2' }, { ls: 'exit 2' });

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/No booted Android device/);
  });

  it('proceeds past the wait once the device reports booted', () => {
    // Reports booted immediately; the script then moves on to gradle, which is
    // absent from this stub PATH, so a *different* failure proves the wait passed.
    const result = runWithStubbedAdb(
      'if [ "$1" = "shell" ] && [ "$2" = "getprop" ]; then echo 1; fi\nexit 0',
      { E2E_DEVICE_WAIT_SECONDS: '30' },
    );

    expect(result.stderr).not.toMatch(/No booted Android device/);
  });
});
