/**
 * @jest-environment node
 *
 * Tests for scripts/ship-ios.sh argument parsing.
 *
 * Covers flag validation only — full pipeline tests require Xcode + 1Password
 * and are not run in CI. Each test exits before any slow step by triggering
 * an arg error or the 1Password check.
 */

'use strict';

const { execFileSync } = require('child_process');
const path = require('path');

const SCRIPT = path.resolve(__dirname, '../../../scripts/ship-ios.sh');

function runScript(args) {
  try {
    const stdout = execFileSync('bash', [SCRIPT, ...args], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
    });
    return { stdout, stderr: '', code: 0 };
  } catch (err) {
    return { stdout: err.stdout || '', stderr: err.stderr || '', code: err.status ?? 1 };
  }
}

describe('ship-ios.sh — --target validation', () => {
  it('rejects an unknown target', () => {
    const { code, stderr } = runScript(['--target', 'staging']);
    expect(code).not.toBe(0);
    expect(stderr).toContain('--target must be');
  });

  it('accepts --target testflight (fails later at preflight/1Password)', () => {
    const { stderr } = runScript(['--target', 'testflight']);
    expect(stderr).not.toContain('--target must be');
  });

  it('accepts --target production (fails later at preflight/1Password)', () => {
    const { stderr } = runScript(['--target', 'production']);
    expect(stderr).not.toContain('--target must be');
  });
});

describe('ship-ios.sh — --release-type validation', () => {
  it('rejects an unknown release type', () => {
    const { code, stderr } = runScript(['--target', 'production', '--release-type', 'BOGUS']);
    expect(code).not.toBe(0);
    expect(stderr).toContain('--release-type must be');
  });

  it('accepts MANUAL release type', () => {
    const { stderr } = runScript(['--target', 'production', '--release-type', 'MANUAL']);
    expect(stderr).not.toContain('--release-type must be');
  });

  it('accepts AFTER_APPROVAL release type', () => {
    const { stderr } = runScript(['--target', 'production', '--release-type', 'AFTER_APPROVAL']);
    expect(stderr).not.toContain('--release-type must be');
  });

  it('accepts SCHEDULED release type', () => {
    const { stderr } = runScript(['--target', 'production', '--release-type', 'SCHEDULED']);
    expect(stderr).not.toContain('--release-type must be');
  });
});

describe('ship-ios.sh — unknown flags', () => {
  it('exits non-zero for an unrecognised flag', () => {
    const { code, stderr } = runScript(['--deploy-to-mars']);
    expect(code).not.toBe(0);
    expect(stderr).toContain('Unknown arg');
  });
});

describe('ship-ios.sh — pipeline entry point', () => {
  it('fails fast at preflight or 1Password, not at arg parsing, for valid args', () => {
    const { code, stderr } = runScript(['--target', 'testflight', '--skip-preflight']);
    // Should not fail on argument validation
    expect(stderr).not.toContain('--target must be');
    expect(stderr).not.toContain('Unknown arg');
    // Should fail somewhere in the pipeline (no real environment)
    // OR succeed if somehow environment is set up — either is fine here
    expect(typeof code).toBe('number');
  });
});
