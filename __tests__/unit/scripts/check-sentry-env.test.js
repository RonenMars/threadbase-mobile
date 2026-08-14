/**
 * @jest-environment node
 *
 * Tests for scripts/check-sentry-env.sh — the branch that decides whether the
 * sentry-cli credentials are required. Inverting it either fails every E2E
 * build or ships an unsymbolicated release, so it gets a check.
 */

'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const SCRIPT = path.resolve(__dirname, '../../../scripts/check-sentry-env.sh');
const CREDS = {
  SENTRY_AUTH_TOKEN: 'token',
  SENTRY_ORG: 'org',
  SENTRY_PROJECT: 'project',
};

/** Runs the script with a clean env plus `vars` — never the ambient SENTRY_*. */
function run(vars) {
  return spawnSync('/bin/bash', [SCRIPT], {
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
});
