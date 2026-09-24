/**
 * @jest-environment node
 *
 * Tests for scripts/check-sentry-env.sh — the branch that decides whether the
 * sentry-cli credentials are required. Inverting it either fails every E2E
 * build or ships an unsymbolicated release, so it gets a check.
 */

'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SCRIPT = path.resolve(__dirname, '../../../scripts/check-sentry-env.sh');
const CREDS = {
  SENTRY_AUTH_TOKEN: 'token',
  SENTRY_ORG: 'org',
  SENTRY_PROJECT: 'project',
};

/** Runs the script with a clean env plus `vars` — never the ambient SENTRY_* —
 * from an empty directory, so a developer's own .env never leaks in. */
function run(vars, envFile) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'check-sentry-env-'));
  if (envFile) fs.writeFileSync(path.join(cwd, '.env'), envFile);
  return spawnSync('/bin/bash', [SCRIPT], {
    cwd,
    env: { PATH: process.env.PATH, ...vars },
    encoding: 'utf8',
  });
}

describe('check-sentry-env.sh', () => {
  it('passes silently in production when all three credentials are present', () => {
    const res = run({ APP_ENV: 'production', ...CREDS });
    expect(res.status).toBe(0);
    expect(res.stdout).toBe('');
  });

  it('names the missing credentials and fails in production', () => {
    const res = run({ APP_ENV: 'production', SENTRY_AUTH_TOKEN: 'token' });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('SENTRY_ORG');
    expect(res.stderr).toContain('SENTRY_PROJECT');
    expect(res.stderr).not.toContain('missing: SENTRY_AUTH_TOKEN');
  });

  it('defaults to production when APP_ENV is unset', () => {
    expect(run({}).status).toBe(1);
  });

  it('skips the upload in development with no credentials at all', () => {
    const res = run({ APP_ENV: 'development' });
    expect(res.status).toBe(0);
    expect(res.stdout.trim()).toBe('SENTRY_DISABLE_AUTO_UPLOAD=true');
  });

  it('rejects an unrecognised APP_ENV rather than guessing', () => {
    const res = run({ APP_ENV: 'develpoment', ...CREDS });
    expect(res.status).toBe(2);
    expect(res.stderr).toContain('develpoment');
  });

  it('refuses a production build with enforced tracking in the shell env', () => {
    const res = run({ APP_ENV: 'production', ...CREDS, EXPO_PUBLIC_ENFORCE_SENTRY_TRACKING: '1' });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('EXPO_PUBLIC_ENFORCE_SENTRY_TRACKING');
  });

  it('refuses a production build with enforced tracking in .env', () => {
    const res = run({ APP_ENV: 'production', ...CREDS }, 'EXPO_PUBLIC_SENTRY_DSN=x\nEXPO_PUBLIC_ENFORCE_SENTRY_TRACKING=1\n');
    expect(res.status).toBe(1);
  });

  it('refuses the flag spelled true, in the shell env and in .env', () => {
    expect(run({ APP_ENV: 'production', ...CREDS, EXPO_PUBLIC_ENFORCE_SENTRY_TRACKING: 'TRUE' }).status).toBe(1);
    expect(run({ APP_ENV: 'production', ...CREDS }, 'EXPO_PUBLIC_ENFORCE_SENTRY_TRACKING="true"\n').status).toBe(1);
  });

  it('allows the flag set to 0', () => {
    expect(run({ APP_ENV: 'production', ...CREDS }, 'EXPO_PUBLIC_ENFORCE_SENTRY_TRACKING=0\n').status).toBe(0);
  });

  it('ignores a commented-out enforced-tracking line', () => {
    const res = run({ APP_ENV: 'production', ...CREDS }, '# EXPO_PUBLIC_ENFORCE_SENTRY_TRACKING=1\n');
    expect(res.status).toBe(0);
  });
});
