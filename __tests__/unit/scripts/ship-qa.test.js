/**
 * @jest-environment node
 *
 * Tests for scripts/ship-qa.sh's refusals, which all run before any build or
 * network call. The CI refusal is the one that protects store builds: under CI
 * the Metro cache survives, and it would carry the enforced flag forward.
 */

'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SCRIPT = path.resolve(__dirname, '../../../scripts/ship-qa.sh');

/** Runs from an empty directory with a clean env, so no .env.signing* or ambient CI leaks in. */
function run(args, vars = {}) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'ship-qa-'));
  return spawnSync('/bin/bash', [SCRIPT, ...args], {
    cwd,
    env: { PATH: process.env.PATH, ...vars },
    encoding: 'utf8',
  });
}

describe('ship-qa.sh', () => {
  it('rejects a missing or unknown platform', () => {
    expect(run([]).status).toBe(2);
    expect(run(['--platform', 'web']).status).toBe(2);
  });

  it('refuses to run under CI', () => {
    const res = run(['--platform', 'ios'], { CI: 'true', FIREBASE_APP_ID_IOS: 'app' });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('does not run under CI');
  });

  it.each([
    ['ios', 'FIREBASE_APP_ID_IOS'],
    ['android', 'FIREBASE_APP_ID_ANDROID'],
  ])('names the missing Firebase app id for %s', (platform, variable) => {
    const res = run(['--platform', platform]);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(`${variable} is not set`);
  });

  it('requires the Android signing env before building', () => {
    const res = run(['--platform', 'android'], { FIREBASE_APP_ID_ANDROID: 'app' });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('.env.signing.android missing');
  });
});
