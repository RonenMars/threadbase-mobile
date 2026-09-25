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

/**
 * Runs from a fresh directory holding only `files`, with a clean env, so no real
 * .env.signing* or ambient CI leaks in. A stub `npx` exits 42, so a run that gets
 * past every refusal stops at the first build step instead of building.
 */
function run(args, vars = {}, files = {}) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'ship-qa-'));
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(cwd, name), content);
  const bin = path.join(cwd, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'npx'), '#!/bin/sh\nexit 42\n', { mode: 0o755 });
  return spawnSync('/bin/bash', [SCRIPT, ...args], {
    cwd,
    env: { PATH: `${bin}:${process.env.PATH}`, ...vars },
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
    const res = run(['--platform', platform], {}, { '.env.signing.android': '' });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(`${variable} is not set`);
  });

  it('reads the Firebase app id from .env.signing', () => {
    const res = run(['--platform', 'ios'], {}, { '.env.signing': 'export FIREBASE_APP_ID_IOS=app\n' });
    expect(res.stderr).not.toContain('is not set');
    expect(res.status).toBe(42);
  });

  it('requires the Android signing env before building', () => {
    const res = run(['--platform', 'android'], { FIREBASE_APP_ID_ANDROID: 'app' });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('.env.signing.android missing');
  });
});
