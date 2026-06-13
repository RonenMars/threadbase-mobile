/**
 * @jest-environment node
 *
 * Tests for scripts/promote-android.js
 */

'use strict';

const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const SCRIPT = path.resolve(__dirname, '../../../scripts/promote-android.js');

const FAKE_PRIVATE_KEY = [
  '-----BEGIN RSA PRIVATE KEY-----',
  'MIIBOgIBAAJBALRiMLAHudeSA/xKl1oFnNGFSbDhFnFrUuSZ4U8S1ICkHBvyWZjz',
  'hEJHJfYsYaIcSuqFn5jqrW5FEi7f/8GCBT0CAwEAAQJAKypKQBDZMJBn0UHnbhLe',
  'dWsfrm7IA5FDR7LqWkIECiNMRGQGm4vO2hzKGaFr4HPjLbXCqEoGCfXt8jKwKIih',
  'AQIhANi6MwYMbjjGQep0pzGXJ+bm78RL6NVITaHJH2WZ4r6ZAiEA1OqTJKVlqrNz',
  '2gZg8TdSGRPfpBhfGLNHaFoIJjXo5vECIBvtK4vqwvzJx2tgF6Sp7IA/l+8nXjMt',
  'EFrJHAi8sL2JAiEAhbpFVHRTqPSGHJfbhd0OFo+YMgDaZHUNExvfFPDgZbECIB1P',
  'BnXmAQI3Q9ZKuHjvSGiKAlnM2r0VuFG6NLFg4A1a',
  '-----END RSA PRIVATE KEY-----',
].join('\n');

function makeSaFile(override = {}) {
  const sa = {
    client_email: 'test@test-project.iam.gserviceaccount.com',
    private_key: FAKE_PRIVATE_KEY,
    ...override,
  };
  const tmpPath = path.join(os.tmpdir(), `sa-test-${process.pid}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(tmpPath, JSON.stringify(sa));
  return tmpPath;
}

function runScript(args /* string[] */) {
  try {
    const stdout = execFileSync('node', [SCRIPT, ...args], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
    });
    return { stdout, stderr: '', code: 0 };
  } catch (err) {
    return { stdout: err.stdout || '', stderr: err.stderr || '', code: err.status ?? 1 };
  }
}

describe('promote-android.js — argument validation', () => {
  it('exits non-zero and prints usage when called with no arguments', () => {
    const { code, stderr } = runScript([]);
    expect(code).not.toBe(0);
    expect(stderr).toContain('Usage:');
    expect(stderr).toContain('promote-android.js');
  });

  it('exits non-zero when SA file path does not exist', () => {
    const { code } = runScript(['com.example', '8', 'alpha', '/nonexistent/sa.json']);
    expect(code).not.toBe(0);
  });

  it('exits non-zero when SA file contains invalid JSON', () => {
    const tmpSa = path.join(os.tmpdir(), `sa-bad-${process.pid}.json`);
    fs.writeFileSync(tmpSa, 'not-json');
    try {
      const { code } = runScript(['com.example', '8', 'alpha', tmpSa]);
      expect(code).not.toBe(0);
    } finally {
      fs.unlinkSync(tmpSa);
    }
  });

  it('exits non-zero when too few positional arguments are provided', () => {
    const saPath = makeSaFile();
    try {
      const { code, stderr } = runScript(['com.example', '8', saPath]); // missing track
      expect(code).not.toBe(0);
      expect(stderr).toContain('Usage:');
    } finally {
      fs.unlinkSync(saPath);
    }
  });
});

describe('promote-android.js — track name acceptance', () => {
  // All four valid tracks should pass arg parsing and fail only at the OAuth
  // network call (no SA with real credentials in test env).
  const validTracks = ['internal', 'alpha', 'beta', 'production'];

  validTracks.forEach(track => {
    it(`accepts track="${track}" (fails at network, not arg parsing)`, () => {
      const saPath = makeSaFile();
      try {
        const { stderr } = runScript(['com.example', '8', track, saPath]);
        expect(stderr).not.toContain('Usage:');
        // Should attempt OAuth, not reject on track name
        expect(stderr).not.toContain('must be one of');
      } finally {
        fs.unlinkSync(saPath);
      }
    });
  });
});

describe('promote-android.js — SA file parsing', () => {
  it('reads client_email and private_key from SA JSON', () => {
    const saPath = makeSaFile({ client_email: 'custom@project.iam.gserviceaccount.com' });
    try {
      // Will fail at network but should not fail at SA parsing
      const { stderr } = runScript(['com.example', '8', 'alpha', saPath]);
      expect(stderr).not.toContain('JSON');
      expect(stderr).not.toContain('Usage:');
    } finally {
      fs.unlinkSync(saPath);
    }
  });
});
