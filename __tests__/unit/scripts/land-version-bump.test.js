/**
 * @jest-environment node
 *
 * Guard + light integration tests for scripts/land-version-bump.sh and
 * scripts/admin-merge-pr.sh. Uses a temp git repo + stubbed `gh` — no network.
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
const GIT = fs.existsSync('/opt/homebrew/bin/git')
  ? '/opt/homebrew/bin/git'
  : '/usr/bin/git';

function run(script, args, env = {}, opts = {}) {
  try {
    const stdout = execFileSync(BASH, [script, ...args], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: opts.timeout ?? 15000,
      cwd: opts.cwd,
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

function expectOk(result) {
  if (result.code !== 0) {
    throw new Error(
      `expected exit 0, got ${result.code}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
  }
}

function git(cwd, args, env = {}) {
  return execFileSync(GIT, args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
      ...env,
    },
  });
}

/** Prepend stub bin; clear CI flags so land-version-bump takes the local path. */
function localEnv(binDir, extra = {}) {
  return {
    PATH: `${binDir}${path.delimiter}${process.env.PATH || '/usr/bin:/bin'}`,
    GITHUB_ACTIONS: '',
    CI: '',
    // GHA runners have no user.email; land-version-bump runs bare `git commit`.
    GIT_AUTHOR_NAME: 'Test',
    GIT_AUTHOR_EMAIL: 'test@example.com',
    GIT_COMMITTER_NAME: 'Test',
    GIT_COMMITTER_EMAIL: 'test@example.com',
    ...extra,
  };
}

function installGhStub(binDir, { createFail = false, mergeFail = false } = {}) {
  const logFile = path.join(binDir, 'gh.log');
  fs.writeFileSync(logFile, '');
  // Quote paths for the embedded bash stub.
  const logQ = JSON.stringify(logFile);
  const script = `#!/bin/bash
set -euo pipefail
LOG=${logQ}
{
  echo "CMD $*"
  echo "GH_TOKEN=\${GH_TOKEN-}"
} >> "$LOG"
if [[ "\${1:-}" == "pr" && "\${2:-}" == "create" ]]; then
  if [[ "${createFail ? '1' : '0'}" == "1" ]]; then
    echo "GraphQL: already exists" >&2
    exit 1
  fi
  exit 0
fi
if [[ "\${1:-}" == "pr" && "\${2:-}" == "merge" ]]; then
  if [[ "${mergeFail ? '1' : '0'}" == "1" ]]; then
    echo "GraphQL: merge refused" >&2
    exit 1
  fi
  exit 0
fi
echo "unexpected gh invocation: $*" >&2
exit 99
`;
  fs.writeFileSync(path.join(binDir, 'gh'), script, { mode: 0o755 });
  return logFile;
}

function readLog(logFile) {
  return fs.readFileSync(logFile, 'utf8');
}

/**
 * Bare remote + clone on main with app.json (and optional android/ios files).
 * Returns { root, remote, work, binDir }.
 */
function makeShipRepo({ withAndroid = false, withIosLock = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'land-bump-'));
  const remote = path.join(root, 'remote.git');
  const work = path.join(root, 'work');
  const binDir = path.join(root, 'bin');
  fs.mkdirSync(binDir);
  fs.mkdirSync(remote);
  // -c init.defaultBranch=main: GHA git still defaults bare repos to master.
  git(root, ['-c', 'init.defaultBranch=main', 'init', '--bare', remote]);
  git(root, ['clone', '-q', remote, work]);
  // Ensure branch is main (older git / empty clone may still be master).
  try {
    git(work, ['checkout', '-q', '-b', 'main']);
  } catch {
    /* already on main */
  }
  git(work, ['config', 'user.name', 'Test']);
  git(work, ['config', 'user.email', 'test@example.com']);
  fs.writeFileSync(
    path.join(work, 'app.json'),
    JSON.stringify(
      {
        expo: {
          version: '1.0.0',
          ios: { buildNumber: '10' },
          android: { versionCode: 10 },
        },
      },
      null,
      2,
    ) + '\n',
  );
  if (withAndroid) {
    fs.mkdirSync(path.join(work, 'android', 'app'), { recursive: true });
    fs.writeFileSync(
      path.join(work, 'android', 'app', 'build.gradle'),
      'android {\n    defaultConfig {\n        versionCode 10\n        versionName "1.0.0"\n    }\n}\n',
    );
  }
  if (withIosLock) {
    fs.mkdirSync(path.join(work, 'ios'), { recursive: true });
    fs.writeFileSync(path.join(work, 'ios', 'Podfile.lock'), 'PODS:\n  - Expo (1.0.0)\n');
  }
  git(work, ['add', '-A']);
  git(work, ['commit', '-m', 'chore: initial']);
  git(work, ['push', '-q', '-u', 'origin', 'main']);
  return { root, remote, work, binDir };
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
      { GITHUB_ACTIONS: 'true', CI: '' },
    );
    expect(code).toBe(0);
    expect(stdout).toContain('skipping (CI)');
  });

  it('exits 0 under CI=true without committing', () => {
    const { code, stdout } = run(
      LAND,
      ['--platform', 'android', '--version-code', '1', '--version-bumped', '1'],
      { CI: 'true', GITHUB_ACTIONS: '' },
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

describe('admin-merge-pr.sh — stubbed gh', () => {
  let binDir;
  let logFile;

  afterEach(() => {
    // best-effort cleanup of the whole temp tree (binDir parent)
    if (binDir) {
      try {
        fs.rmSync(path.dirname(binDir), { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  });

  function freshStub(opts) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-merge-'));
    binDir = path.join(root, 'bin');
    fs.mkdirSync(binDir);
    logFile = installGhStub(binDir, opts);
    return localEnv(binDir);
  }

  it('creates a PR then admin squash-merges', () => {
    const env = freshStub();
    const { code, stdout } = run(
      MERGE,
      ['chore/bump-ios-version-140', 'chore(ios): bump build number to 140 [skip-ci]', 'body text'],
      env,
    );
    expect(code).toBe(0);
    expect(stdout).toContain("merged 'chore/bump-ios-version-140'");
    const log = readLog(logFile);
    expect(log).toContain('CMD pr create --base main --head chore/bump-ios-version-140');
    expect(log).toContain('--title chore(ios): bump build number to 140 [skip-ci]');
    expect(log).toContain('CMD pr merge chore/bump-ios-version-140 --squash --delete-branch --admin');
  });

  it('still merges when pr create fails (PR already exists)', () => {
    const env = freshStub({ createFail: true });
    const { code, stdout } = run(
      MERGE,
      ['chore/bump-android-version-20', 'chore(android): bump version code to 20 [skip-ci]', 'body'],
      env,
    );
    expect(code).toBe(0);
    expect(stdout).toContain('PR already exists');
    expect(stdout).toContain("merged 'chore/bump-android-version-20'");
    const log = readLog(logFile);
    expect(log).toContain('CMD pr create');
    expect(log).toContain('CMD pr merge chore/bump-android-version-20 --squash --delete-branch --admin');
  });

  it('fails loudly when merge is refused', () => {
    const env = freshStub({ mergeFail: true });
    const { code, stderr } = run(
      MERGE,
      ['chore/bump-ios-version-1', 'title', 'body'],
      env,
    );
    expect(code).not.toBe(0);
    expect(stderr).toContain('merge refused');
  });

  it('uses GH_PUSH_TOKEN for merge when set', () => {
    const env = freshStub();
    env.GH_TOKEN = 'create-token';
    env.GH_PUSH_TOKEN = 'merge-pat';
    const { code } = run(MERGE, ['branch-x', 'title-x', 'body'], env);
    expect(code).toBe(0);
    const log = readLog(logFile);
    const lines = log.trim().split('\n');
    // Find GH_TOKEN line after the merge CMD
    const mergeIdx = lines.findIndex((l) => l.startsWith('CMD pr merge'));
    expect(mergeIdx).toBeGreaterThanOrEqual(0);
    expect(lines[mergeIdx + 1]).toBe('GH_TOKEN=merge-pat');
  });

  it('uses GH_MERGE_TOKEN over GH_PUSH_TOKEN for merge', () => {
    const env = freshStub();
    env.GH_TOKEN = 'create-token';
    env.GH_PUSH_TOKEN = 'push-pat';
    env.GH_MERGE_TOKEN = 'merge-explicit';
    const { code } = run(MERGE, ['branch-y', 'title-y', 'body'], env);
    expect(code).toBe(0);
    const log = readLog(logFile);
    const lines = log.trim().split('\n');
    const mergeIdx = lines.findIndex((l) => l.startsWith('CMD pr merge'));
    expect(lines[mergeIdx + 1]).toBe('GH_TOKEN=merge-explicit');
  });
});

describe('land-version-bump.sh — local land (stubbed gh)', () => {
  let repo;

  afterEach(() => {
    if (repo) {
      try {
        fs.rmSync(repo.root, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  });

  it('skips bump commit when --version-bumped 0', () => {
    repo = makeShipRepo();
    const logFile = installGhStub(repo.binDir);
    const { code, stdout } = run(
      LAND,
      ['--platform', 'ios', '--build-number', '11', '--version-bumped', '0'],
      localEnv(repo.binDir),
      { cwd: repo.work },
    );
    expect(code).toBe(0);
    expect(stdout).toContain('no bump commit needed');
    expect(readLog(logFile)).toBe('');
  });

  it('commits ios bump with Podfile.lock, pushes branch, and admin-merges', () => {
    repo = makeShipRepo({ withIosLock: true });
    const logFile = installGhStub(repo.binDir);

    // Dirty version files as a post-ship working tree would be.
    const appPath = path.join(repo.work, 'app.json');
    const app = JSON.parse(fs.readFileSync(appPath, 'utf8'));
    app.expo.ios.buildNumber = '140';
    fs.writeFileSync(appPath, JSON.stringify(app, null, 2) + '\n');
    fs.appendFileSync(path.join(repo.work, 'ios', 'Podfile.lock'), '  - Extra (1.0.0)\n');

    const iosResult = run(
      LAND,
      ['--platform', 'ios', '--build-number', '140', '--version-bumped', '1'],
      localEnv(repo.binDir),
      { cwd: repo.work },
    );
    expectOk(iosResult);
    const { stdout } = iosResult;
    expect(stdout).toContain("bumped and pushed on branch 'chore/bump-ios-version-140'");
    expect(stdout).toContain("merged 'chore/bump-ios-version-140'");

    const subject = git(repo.work, [
      'log',
      '-1',
      '--format=%s',
      'origin/chore/bump-ios-version-140',
    ]).trim();
    expect(subject).toBe('chore(ios): bump build number to 140 [skip-ci]');

    const files = git(repo.work, [
      'show',
      '--name-only',
      '--pretty=',
      'origin/chore/bump-ios-version-140',
    ])
      .trim()
      .split('\n')
      .filter(Boolean)
      .sort();
    expect(files).toEqual(['app.json', 'ios/Podfile.lock']);

    const log = readLog(logFile);
    expect(log).toContain('CMD pr create --base main --head chore/bump-ios-version-140');
    expect(log).toContain('--title chore(ios): bump build number to 140 [skip-ci]');
    expect(log).toContain(
      'CMD pr merge chore/bump-ios-version-140 --squash --delete-branch --admin',
    );
  });

  it('commits android bump including build.gradle', () => {
    repo = makeShipRepo({ withAndroid: true });
    const logFile = installGhStub(repo.binDir);

    const appPath = path.join(repo.work, 'app.json');
    const app = JSON.parse(fs.readFileSync(appPath, 'utf8'));
    app.expo.android.versionCode = 20;
    fs.writeFileSync(appPath, JSON.stringify(app, null, 2) + '\n');
    fs.writeFileSync(
      path.join(repo.work, 'android', 'app', 'build.gradle'),
      'android {\n    defaultConfig {\n        versionCode 20\n        versionName "1.0.0"\n    }\n}\n',
    );

    const androidResult = run(
      LAND,
      ['--platform', 'android', '--version-code', '20', '--version-bumped', '1'],
      localEnv(repo.binDir),
      { cwd: repo.work },
    );
    expectOk(androidResult);
    const { stdout } = androidResult;
    expect(stdout).toContain("bumped and pushed on branch 'chore/bump-android-version-20'");

    const subject = git(repo.work, [
      'log',
      '-1',
      '--format=%s',
      'origin/chore/bump-android-version-20',
    ]).trim();
    expect(subject).toBe('chore(android): bump version code to 20 [skip-ci]');

    const files = git(repo.work, [
      'show',
      '--name-only',
      '--pretty=',
      'origin/chore/bump-android-version-20',
    ])
      .trim()
      .split('\n')
      .filter(Boolean)
      .sort();
    expect(files).toEqual(['android/app/build.gradle', 'app.json']);

    const log = readLog(logFile);
    expect(log).toContain(
      'CMD pr merge chore/bump-android-version-20 --squash --delete-branch --admin',
    );
  });

  it('lands leftover dirty tracked files on a post-ship cleanup branch', () => {
    repo = makeShipRepo();
    const logFile = installGhStub(repo.binDir);

    // Tracked file modified during the pipeline, unrelated to the version bump.
    fs.writeFileSync(path.join(repo.work, 'pipeline.txt'), 'before\n');
    git(repo.work, ['add', 'pipeline.txt']);
    git(repo.work, ['commit', '-m', 'chore: track pipeline file']);
    git(repo.work, ['push']);
    fs.writeFileSync(path.join(repo.work, 'pipeline.txt'), 'after ship\n');

    const cleanupResult = run(
      LAND,
      ['--platform', 'ios', '--build-number', '10', '--version-bumped', '0'],
      localEnv(repo.binDir),
      { cwd: repo.work },
    );
    expectOk(cleanupResult);
    const { stdout } = cleanupResult;
    expect(stdout).toContain('post-ship');
    expect(stdout).toContain("merged 'chore/post-ship-ios-10'");

    const subject = git(repo.work, [
      'log',
      '-1',
      '--format=%s',
      'origin/chore/post-ship-ios-10',
    ]).trim();
    expect(subject).toBe('chore(ios): post-ship cleanup [skip-ci]');

    const log = readLog(logFile);
    expect(log).toContain('CMD pr create --base main --head chore/post-ship-ios-10');
    expect(log).toContain('CMD pr merge chore/post-ship-ios-10 --squash --delete-branch --admin');
  });
});
