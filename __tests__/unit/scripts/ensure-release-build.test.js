/**
 * @jest-environment node
 *
 * Tests for e2e/ensure-release-build.js's staleness guard (issue #598): the
 * script must never silently reuse a build that predates the current source
 * tree. Runs the real script as a subprocess against a throwaway git repo,
 * with `xcrun`/`npx` stubbed out — no simulator, no real build, no network.
 */

'use strict';

const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SCRIPT = path.resolve(__dirname, '../../../e2e/ensure-release-build.js');
const SENTRY_GUARD = path.resolve(__dirname, '../../../scripts/check-sentry-env.sh');
const GIT = fs.existsSync('/opt/homebrew/bin/git') ? '/opt/homebrew/bin/git' : '/usr/bin/git';

function git(cwd, args) {
  return execFileSync(GIT, args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
    },
  });
}

function appDirFor(repo) {
  return path.join(repo, 'ios/build/Build/Products/Release-iphonesimulator/Threadbase.app');
}

function stampPathFor(repo) {
  return `${appDirFor(repo)}.build-stamp.json`;
}

/** A fresh throwaway repo with the script + a gitignore matching the real repo's `ios/build/` rule. */
function makeRepo() {
  // realpath: on macOS os.tmpdir() is under a /var -> /private/var symlink, and
  // Node resolves __dirname (which findReleaseBuild() derives paths from) to the
  // real path — so comparisons against the raw mkdtemp path would mismatch.
  const repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ensure-release-build-')));
  git(repo, ['init', '-q', '-b', 'main']);
  fs.mkdirSync(path.join(repo, 'e2e'));
  fs.copyFileSync(SCRIPT, path.join(repo, 'e2e', 'ensure-release-build.js'));
  // buildFresh() resolves the Sentry build env through the real guard script.
  fs.mkdirSync(path.join(repo, 'scripts'));
  fs.copyFileSync(SENTRY_GUARD, path.join(repo, 'scripts', 'check-sentry-env.sh'));
  fs.writeFileSync(path.join(repo, 'package.json'), '{"name":"fixture"}\n');
  fs.writeFileSync(path.join(repo, '.gitignore'), 'ios/build/\n');
  git(repo, ['add', '.']);
  git(repo, ['commit', '-qm', 'init']);
  const sha = git(repo, ['rev-parse', 'HEAD']).trim();
  return { repo, sha };
}

function writeStub(binDir, name, body) {
  fs.writeFileSync(path.join(binDir, name), `#!/bin/bash\n${body}\nexit 0\n`, { mode: 0o755 });
}

const tmpDirs = [];

/** Runs the copied script as a real subprocess with xcrun/npx stubbed and git real. */
function runScript(repo, { allowStale = false, platform } = {}) {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'ensure-release-bin-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ensure-release-home-'));
  tmpDirs.push(bin, home);

  const xcrunLog = path.join(bin, 'xcrun.log');
  const npxLog = path.join(bin, 'npx.log');

  writeStub(bin, 'xcrun', 'echo "$@" >> "$XCRUN_LOG"');
  writeStub(
    bin,
    'npx',
    [
      'echo "$@" >> "$NPX_LOG"',
      'if [ "$1" = "expo" ] && [ "$2" = "run:ios" ]; then',
      '  echo "SENTRY_DISABLE_AUTO_UPLOAD=$SENTRY_DISABLE_AUTO_UPLOAD" >> "$NPX_LOG"',
      '  mkdir -p "$APP_DIR"',
      '  echo fake > "$APP_DIR/Info.plist"',
      'fi',
    ].join('\n'),
  );

  const env = {
    PATH: [bin, path.dirname(GIT), '/usr/bin', '/bin'].join(path.delimiter),
    HOME: home,
    XCRUN_LOG: xcrunLog,
    NPX_LOG: npxLog,
    APP_DIR: appDirFor(repo),
  };
  if (allowStale) env.E2E_ALLOW_STALE_BUILD = '1';
  if (platform) env.E2E_PLATFORM = platform;

  const result = spawnSync(process.execPath, [path.join(repo, 'e2e/ensure-release-build.js')], {
    cwd: repo,
    env,
    encoding: 'utf8',
  });

  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    xcrunLog: fs.existsSync(xcrunLog) ? fs.readFileSync(xcrunLog, 'utf8') : '',
    npxLog: fs.existsSync(npxLog) ? fs.readFileSync(npxLog, 'utf8') : '',
  };
}

let repo;

afterEach(() => {
  if (repo) fs.rmSync(repo, { recursive: true, force: true });
  repo = undefined;
  while (tmpDirs.length) fs.rmSync(tmpDirs.pop(), { recursive: true, force: true });
});

test('a build stamped for the current HEAD is reused without rebuilding', () => {
  const made = makeRepo();
  repo = made.repo;
  fs.mkdirSync(appDirFor(repo), { recursive: true });
  fs.writeFileSync(stampPathFor(repo), JSON.stringify({ sha: made.sha }));

  const result = runScript(repo);

  expect(result.status).toBe(0);
  expect(result.npxLog).toBe(''); // never rebuilt
  expect(result.xcrunLog).toContain(`simctl install booted ${appDirFor(repo)}`);
  expect(result.xcrunLog).toContain('simctl launch booted com.ronenmars.threadbase');
  expect(result.stdout).toMatch(/current/i);
});

// A stale build must fail loudly rather than trigger an automatic rebuild:
// `expo run:ios --configuration Release` is documented to hang holding Metro
// open once the build finishes, and a dirty tree — the common case here —
// would otherwise hit that blocking rebuild on every routine run.

test('an existing build with no stamp is treated as stale and fails loudly, without rebuilding', () => {
  const made = makeRepo();
  repo = made.repo;
  fs.mkdirSync(appDirFor(repo), { recursive: true }); // build present, but never stamped — the pre-fix bug shape

  const result = runScript(repo);

  expect(result.status).not.toBe(0);
  expect(result.npxLog).toBe(''); // never attempts the blocking rebuild
  expect(result.xcrunLog).toBe(''); // never installs the unverified build either
  expect(result.stderr).toMatch(/stale/i);
  expect(result.stderr).toMatch(/no freshness stamp/i);
  expect(result.stderr).toMatch(/E2E_ALLOW_STALE_BUILD=1/);
});

test('a build stamped for an old commit is treated as stale and fails loudly, without rebuilding', () => {
  const made = makeRepo();
  repo = made.repo;
  fs.mkdirSync(appDirFor(repo), { recursive: true });
  fs.writeFileSync(stampPathFor(repo), JSON.stringify({ sha: '0'.repeat(40) }));

  const result = runScript(repo);

  expect(result.status).not.toBe(0);
  expect(result.npxLog).toBe('');
  expect(result.stderr).toMatch(/stale/i);
  expect(result.stderr).toContain('0000000');
});

test('a dirty working tree is always stale, even if the stamp matches HEAD, and fails loudly', () => {
  const made = makeRepo();
  repo = made.repo;
  fs.mkdirSync(appDirFor(repo), { recursive: true });
  fs.writeFileSync(stampPathFor(repo), JSON.stringify({ sha: made.sha }));
  fs.writeFileSync(path.join(repo, 'package.json'), '{"name":"fixture","dirty":true}\n'); // uncommitted change

  const result = runScript(repo);

  expect(result.status).not.toBe(0);
  expect(result.npxLog).toBe('');
  expect(result.stderr).toMatch(/uncommitted changes/i);
});

test('a build fails loudly, without rebuilding, when git state cannot be determined at all', () => {
  // No `git init` — the copied script + app dir live outside any git repo.
  repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ensure-release-build-nogit-')));
  fs.mkdirSync(path.join(repo, 'e2e'));
  fs.copyFileSync(SCRIPT, path.join(repo, 'e2e', 'ensure-release-build.js'));
  fs.mkdirSync(appDirFor(repo), { recursive: true });
  fs.writeFileSync(stampPathFor(repo), JSON.stringify({ sha: 'deadbeef'.repeat(5) }));

  const result = runScript(repo);

  expect(result.status).not.toBe(0);
  expect(result.npxLog).toBe('');
  expect(result.stderr).toMatch(/could not determine git state/i);
});

test('E2E_ALLOW_STALE_BUILD=1 reuses a stale build but warns loudly instead of silently passing', () => {
  const made = makeRepo();
  repo = made.repo;
  fs.mkdirSync(appDirFor(repo), { recursive: true }); // stale: no stamp

  const result = runScript(repo, { allowStale: true });

  expect(result.status).toBe(0);
  expect(result.npxLog).toBe(''); // escape hatch skips the rebuild
  expect(result.xcrunLog).toContain(`simctl install booted ${appDirFor(repo)}`);
  expect(result.stderr + result.stdout).toMatch(/warning.*not verified current/i);
  expect(result.stderr + result.stdout).toMatch(/E2E_ALLOW_STALE_BUILD=1/);
});

test('no existing build at all still builds fresh, same as before the staleness guard', () => {
  const made = makeRepo();
  repo = made.repo;

  const result = runScript(repo);

  expect(result.status).toBe(0);
  expect(result.npxLog).toContain('expo run:ios --configuration Release');
  // Without this the Sentry Xcode phase fails the build for anyone with no
  // upload credentials — which is every local run of the mock suite.
  expect(result.npxLog).toContain('SENTRY_DISABLE_AUTO_UPLOAD=true');
  expect(result.xcrunLog).toContain(`simctl install booted ${appDirFor(repo)}`);
  // A stamp for the current commit should now exist, so a second run reuses it without rebuilding.
  const second = runScript(repo);
  expect(second.npxLog).toBe('');
  expect(second.stdout).toMatch(/current/i);
});

test('Android CI leaves build and installation to the workflow', () => {
  const made = makeRepo();
  repo = made.repo;

  const result = runScript(repo, { platform: 'android' });

  expect(result.status).toBe(0);
  expect(result.stdout).toContain('Android Release APK was installed by the E2E runner');
  expect(result.npxLog).toBe('');
  expect(result.xcrunLog).toBe('');
});

// The repo built here has no .app anywhere, which is exactly the CI shape: the
// workflow builds into `-derivedDataPath build/ios-ci`, a location
// `findReleaseBuild` does not probe. Before E2E_PLATFORM=ios was honoured that
// put the script on the first-run path and it shelled out to `expo run:ios`,
// which holds Metro open and never returns — run 31927177499 burned its whole
// 75-minute budget there without executing a flow. `npxLog` staying empty is
// the assertion that matters.
test('iOS CI leaves build and installation to the workflow', () => {
  const made = makeRepo();
  repo = made.repo;

  const result = runScript(repo, { platform: 'ios' });

  expect(result.status).toBe(0);
  expect(result.stdout).toContain('iOS Release build was installed by the E2E runner');
  expect(result.npxLog).toBe('');
  expect(result.xcrunLog).toBe('');
});
