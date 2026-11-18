/**
 * @jest-environment node
 *
 * Tests for scripts/ship-qa.sh's refusals, which all run before any build or
 * network call. The CI refusal is the one that protects store builds: on a
 * runner that outlives the job, the Metro cache survives and would carry the
 * enforced flag forward.
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
 * past every refusal stops at the first build step instead of building; it exits
 * 43 instead when EXPO_PUBLIC_SENTRY_DSN reached its environment.
 *
 * Firebase REST calls are handled by a stub `curl`. The group listing is
 * `groups.json` from `files`, or one `qa` group with a tester, and exits with
 * the status in `groups.status` from `files`, or 0.
 */
function run(args, vars = {}, files = {}) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'ship-qa-'));
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(cwd, name), content);
  const bin = path.join(cwd, 'bin');
  fs.mkdirSync(bin);

  const npx = [
    '#!/bin/sh',
    '[ -n "$EXPO_PUBLIC_SENTRY_DSN" ] && exit 43',
    'exit 42',
  ];
  fs.writeFileSync(path.join(bin, 'npx'), `${npx.join('\n')}\n`, { mode: 0o755 });

  const curl = [
    '#!/bin/sh',
    'case "$*" in',
    '  *"/groups")',
    '    cat groups.json 2>/dev/null || echo \'{"groups":[{"name":"projects/1/groups/qa","testerCount":1}]}\'',
    '    exit "$(cat groups.status 2>/dev/null || echo 0)"',
    '    ;;',
    'esac',
    'exit 0',
  ];
  fs.writeFileSync(path.join(bin, 'curl'), `${curl.join('\n')}\n`, { mode: 0o755 });

  return spawnSync('/bin/bash', [SCRIPT, ...args], {
    cwd,
    env: {
      PATH: `${bin}:${process.env.PATH}`,
      FIREBASE_ACCESS_TOKEN: 'test-access-token',
      FIREBASE_API_KEY_IOS: 'test-api-key',
      FIREBASE_PROJECT_ID: 'test-project',
      ...vars,
    },
    encoding: 'utf8',
  });
}

describe('ship-qa.sh', () => {
  it('rejects a missing or unknown platform', () => {
    expect(run([]).status).toBe(2);
    expect(run(['--platform', 'web']).status).toBe(2);
  });

  it.each([
    ['an unknown', {}],
    ['a self-hosted', { RUNNER_ENVIRONMENT: 'self-hosted' }],
  ])('refuses to run under CI on %s runner', (_label, runner) => {
    const vars = { CI: 'true', FIREBASE_APP_ID_IOS: 'app', ...runner };
    const res = run(['--platform', 'ios'], vars);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('only on a GitHub-hosted runner');
  });

  it('runs under CI on a GitHub-hosted runner', () => {
    const res = run(['--platform', 'ios'], { CI: 'true', RUNNER_ENVIRONMENT: 'github-hosted', FIREBASE_APP_ID_IOS: 'app' });
    expect(res.status).toBe(42);
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

  // expo-updates' native build step evaluates app.config.js without loading .env,
  // so the enforced-tracking check there only sees what the script exported.
  it('exports .env to the build', () => {
    const res = run(['--platform', 'ios'], { FIREBASE_APP_ID_IOS: 'app' }, { '.env': 'EXPO_PUBLIC_SENTRY_DSN=dsn\n' });
    expect(res.status).toBe(43);
  });

  it('refuses a tester group with no testers', () => {
    const groups = JSON.stringify({ groups: [{ name: 'projects/1/groups/qa' }] });
    const res = run(['--platform', 'ios'], { FIREBASE_APP_ID_IOS: 'app' }, { 'groups.json': groups });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("group 'qa' is missing or has no testers");
  });

  it('prints the Firebase error when the group lookup fails', () => {
    const error = JSON.stringify({ error: { message: 'The caller does not have permission' } });
    const res = run(['--platform', 'ios'], { FIREBASE_APP_ID_IOS: 'app' }, { 'groups.json': error, 'groups.status': '1' });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('Firebase tester group lookup failed');
    expect(res.stderr).toContain('The caller does not have permission');
  });

  it('requires the Android signing env before building', () => {
    const res = run(['--platform', 'android'], { FIREBASE_APP_ID_ANDROID: 'app' });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('.env.signing.android missing');
  });

  describe('iOS in-app update check', () => {
    const ios = { FIREBASE_APP_ID_IOS: 'app' };

    it.each([
      [{ FIREBASE_API_KEY_IOS: '' }, 'FIREBASE_API_KEY_IOS'],
      [{ FIREBASE_PROJECT_ID: '' }, 'FIREBASE_PROJECT_ID'],
    ])('refuses a build that would have no update banner (%j)', (missing, name) => {
      const res = run(['--platform', 'ios'], { ...ios, ...missing });
      expect(res.status).toBe(1);
      expect(res.stderr).toContain(`${name}`);
      expect(res.stderr).toContain('no in-app update banner');
    });

    it('takes the project from GOOGLE_CLOUD_QUOTA_PROJECT', () => {
      const res = run(['--platform', 'ios'], { ...ios, FIREBASE_PROJECT_ID: '', GOOGLE_CLOUD_QUOTA_PROJECT: 'p' });
      expect(res.status).toBe(42);
    });

    it('reads the key from .env', () => {
      const res = run(['--platform', 'ios'], { ...ios, FIREBASE_API_KEY_IOS: '' }, { '.env': 'FIREBASE_API_KEY_IOS=k\n' });
      expect(res.status).toBe(42);
    });

    it('builds without the check only when asked', () => {
      const res = run(['--platform', 'ios', '--no-update-check'], { ...ios, FIREBASE_API_KEY_IOS: '', FIREBASE_PROJECT_ID: '' });
      expect(res.status).toBe(42);
    });

    it('does not apply to android', () => {
      const res = run(['--platform', 'android'], { FIREBASE_APP_ID_ANDROID: 'app', FIREBASE_API_KEY_IOS: '', FIREBASE_PROJECT_ID: '' }, { '.env.signing.android': '' });
      expect(res.stderr).not.toContain('update banner');
    });
  });
});
