'use strict';

// Runs a real script from scripts/ in a throwaway cwd + HOME with credential
// variables blanked (#712, #718). On a machine that has run the credential
// bootstrap, a script under test otherwise finds cached Play/App Store
// credentials and runs past the failure the test relies on, into real API
// calls and writes to the real tree. Add the next credential variable a script
// learns to read to BLANKED_ENV.
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BLANKED_ENV = [
  'GOOGLE_APPLICATION_CREDENTIALS',
  'PLAY_SA_JSON_B64',
  'ASC_AUTH_KEY_B64',
  'ASC_ISSUER_ID',
  'ASC_KEY_ID',
  'ASC_KEY_PATH',
  'ASC_TEAM_ID',
  'IOS_DIST_CERT_P12_B64',
  'IOS_DIST_CERT_PASSWORD',
  'IOS_PROVISION_PROFILE_B64',
  'IOS_PROVISION_PROFILE_UUID',
  'IOS_WIDGET_PROVISION_PROFILE_B64',
  'IOS_WIDGET_PROVISION_PROFILE_UUID',
  'SENTRY_AUTH_TOKEN',
  'SENTRY_ORG',
  'SENTRY_PROJECT',
];

/**
 * `git: true` is for scripts that read `git rev-parse HEAD` before they reach
 * the code under test; a bare temp dir would fail them first.
 */
function runScript(script, args, { interpreter = 'bash', timeout = 10000, git = false, env = {} } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'run-script-'));
  const sandboxEnv = {
    ...process.env,
    ...Object.fromEntries(BLANKED_ENV.map(name => [name, ''])),
    HOME: dir,
    ...env,
  };
  try {
    if (git) {
      execFileSync('git', ['init', '-q'], { cwd: dir, env: sandboxEnv });
      execFileSync(
        'git',
        ['-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '--allow-empty', '-m', 'init'],
        { cwd: dir, env: sandboxEnv },
      );
    }
    const stdout = execFileSync(interpreter, [script, ...args], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout,
      cwd: dir,
      env: sandboxEnv,
    });
    return { stdout, stderr: '', code: 0 };
  } catch (err) {
    return { stdout: err.stdout || '', stderr: err.stderr || '', code: err.status ?? 1 };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

module.exports = { runScript, BLANKED_ENV };
