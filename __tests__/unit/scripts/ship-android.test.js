/**
 * @jest-environment node
 *
 * Tests for scripts/ship-android.sh argument parsing and --promote fast path.
 *
 * These tests only exercise argument validation and the promote fast-path
 * (which exits before running Gradle or calling Play). Full pipeline tests
 * would require mocked signing secrets + Play API and are out of scope here.
 *
 * Run with cwd + HOME pointed at a throwaway temp dir (see #712): on a
 * machine with real Google Play credentials cached at
 * ~/.config/threadbase/play-console-sa.json, the un-sandboxed script used to
 * sail past credential setup into check-version-code.sh, which bumped the
 * real app.json + android/app/build.gradle, and then into `npm ci`, which
 * the 10s execFileSync timeout killed mid-reinstall, deleting
 * node_modules/.bin. Sandboxing HOME makes the cache lookup miss, so every
 * case here still fails at credential setup exactly as the comments say.
 */

'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SCRIPT = path.resolve(__dirname, '../../../scripts/ship-android.sh');

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ship-android-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function runScript(args) {
  try {
    const stdout = execFileSync('bash', [SCRIPT, ...args], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
      cwd: tmpDir,
      env: {
        ...process.env,
        HOME: tmpDir,
        GOOGLE_APPLICATION_CREDENTIALS: '',
        PLAY_SA_JSON_B64: '',
      },
    });
    return { stdout, stderr: '', code: 0 };
  } catch (err) {
    return { stdout: err.stdout || '', stderr: err.stderr || '', code: err.status ?? 1 };
  }
}

describe('ship-android.sh — --track validation', () => {
  it('rejects an unknown track name', () => {
    const { code, stderr } = runScript(['--track', 'staging']);
    expect(code).not.toBe(0);
    expect(stderr).toContain('--track must be one of');
  });

  const validTracks = ['internal', 'alpha', 'beta', 'production'];
  validTracks.forEach(track => {
    it(`accepts --track ${track} (fails later at credential setup, not arg parsing)`, () => {
      const { stderr } = runScript(['--track', track]);
      expect(stderr).not.toContain('--track must be one of');
    });
  });
});

describe('ship-android.sh — --promote fast path', () => {
  it('fails at credential setup, not at arg parsing, when --promote is given', () => {
    const { stderr } = runScript(['--promote', '8', '--track', 'alpha']);
    // Should reach credential setup, not fail on argument validation
    expect(stderr).not.toContain('--track must be one of');
    expect(stderr).not.toContain('Unknown arg');
  });

  it('reaches credential setup (does not fail on arg validation)', () => {
    const { stderr } = runScript(['--promote', '8', '--track', 'alpha']);
    // Should not fail on argument parsing — it either passes local credential
    // setup or fails there with a clear message, not an arg error.
    expect(stderr).not.toContain('Unknown arg');
    expect(stderr).not.toContain('--track must be one of');
  });

  it('rejects --promote with an invalid track', () => {
    const { code, stderr } = runScript(['--promote', '8', '--track', 'canary']);
    expect(code).not.toBe(0);
    expect(stderr).toContain('--track must be one of');
  });
});

describe('ship-android.sh — unknown flags', () => {
  it('exits non-zero for an unrecognised flag', () => {
    const { code, stderr } = runScript(['--frobnicate']);
    expect(code).not.toBe(0);
    expect(stderr).toContain('Unknown arg');
  });
});
