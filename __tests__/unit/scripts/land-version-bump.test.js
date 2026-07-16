/**
 * @jest-environment node
 *
 * Guard/arg tests for scripts/land-version-bump.sh and scripts/admin-merge-pr.sh.
 * No network — covers CI no-op, missing args, and missing gh.
 */

'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const LAND = path.resolve(__dirname, '../../../scripts/land-version-bump.sh');
const MERGE = path.resolve(__dirname, '../../../scripts/admin-merge-pr.sh');

// Absolute path: tests may set PATH without /bin (e.g. missing-gh case).
const BASH = '/bin/bash';

function run(script, args, env = {}) {
  try {
    const stdout = execFileSync(BASH, [script, ...args], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
      env: { ...process.env, ...env },
    });
    return { stdout, stderr: '', code: 0 };
  } catch (err) {
    return {
      stdout: err.stdout || '',
      stderr: err.stderr || '',
      code: err.status ?? 1,
    };
  }
}

describe('land-version-bump.sh — args', () => {
  it('requires --platform', () => {
    const { code, stderr } = run(LAND, []);
    expect(code).not.toBe(0);
    expect(stderr).toContain('--platform required');
  });

  it('rejects unknown args', () => {
    const { code, stderr } = run(LAND, ['--platform', 'ios', '--nope']);
    expect(code).toBe(2);
    expect(stderr).toContain('Unknown arg');
  });
});

describe('land-version-bump.sh — CI no-op', () => {
  it('exits 0 under GITHUB_ACTIONS without committing', () => {
    const { code, stdout } = run(
      LAND,
      ['--platform', 'ios', '--build-number', '1', '--version-bumped', '1'],
      { GITHUB_ACTIONS: 'true', CI: undefined },
    );
    expect(code).toBe(0);
    expect(stdout).toContain('skipping (CI)');
  });

  it('exits 0 under CI=true without committing', () => {
    const { code, stdout } = run(
      LAND,
      ['--platform', 'android', '--version-code', '1', '--version-bumped', '1'],
      { CI: 'true', GITHUB_ACTIONS: undefined },
    );
    expect(code).toBe(0);
    expect(stdout).toContain('skipping (CI)');
  });
});

describe('admin-merge-pr.sh — args', () => {
  it('requires branch and title', () => {
    const { code, stderr } = run(MERGE, []);
    expect(code).toBe(2);
    expect(stderr).toContain('Usage:');
  });

  it('fails when gh is missing from PATH', () => {
    // GHA runners ship gh at /usr/bin/gh — use an empty PATH so command -v fails.
    const emptyBin = fs.mkdtempSync(path.join(os.tmpdir(), 'no-gh-'));
    const { code, stderr } = run(
      MERGE,
      ['chore/bump-ios-version-1', 'chore(ios): bump', 'body'],
      { PATH: emptyBin },
    );
    expect(code).not.toBe(0);
    expect(stderr).toContain('gh CLI required');
  });
});
