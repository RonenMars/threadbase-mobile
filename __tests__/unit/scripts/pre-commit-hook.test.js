/**
 * @jest-environment node
 *
 * Tests for scripts/git-hooks/pre-commit. Uses a throwaway git repo — no
 * CocoaPods, no network.
 */

'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const HOOK = path.join(ROOT, 'scripts/git-hooks/pre-commit');
const RESET = path.join(ROOT, 'scripts/reset-podfile-lock-path-noise.sh');
const BASH = '/bin/bash';
const GIT = fs.existsSync('/opt/homebrew/bin/git')
  ? '/opt/homebrew/bin/git'
  : '/usr/bin/git';

const sha = (c) => c.repeat(40);

function lock({ hermes, reachability = sha('c') }) {
  return [
    'SPEC CHECKSUMS:',
    `  ReachabilitySwift: ${reachability}`,
    `  hermes-engine: ${hermes}`,
    '',
    'COCOAPODS: 1.16.2',
    '',
  ].join('\n');
}

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

let repo;
const COMMITTED = lock({ hermes: sha('b') });

beforeEach(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), 'precommit-'));
  git(repo, ['init', '-q', '-b', 'main']);
  fs.mkdirSync(path.join(repo, 'ios'));
  fs.mkdirSync(path.join(repo, 'scripts/git-hooks'), { recursive: true });
  fs.copyFileSync(RESET, path.join(repo, 'scripts', path.basename(RESET)));
  fs.chmodSync(path.join(repo, 'scripts', path.basename(RESET)), 0o755);
  fs.copyFileSync(HOOK, path.join(repo, 'scripts/git-hooks/pre-commit'));
  fs.writeFileSync(path.join(repo, 'ios/Podfile.lock'), COMMITTED);
  git(repo, ['add', '.']);
  git(repo, ['commit', '-qm', 'init']);
});

afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

const runHook = () =>
  execFileSync(BASH, [path.join(repo, 'scripts/git-hooks/pre-commit')], {
    cwd: repo,
    encoding: 'utf8',
  });

const readLock = () => fs.readFileSync(path.join(repo, 'ios/Podfile.lock'), 'utf8');
const writeLock = (contents) =>
  fs.writeFileSync(path.join(repo, 'ios/Podfile.lock'), contents);

test('drops a staged lockfile whose only drift is path noise', () => {
  writeLock(lock({ hermes: sha('2') }));
  git(repo, ['add', 'ios/Podfile.lock']);
  runHook();
  expect(readLock()).toBe(COMMITTED);
  expect(git(repo, ['status', '--short', 'ios/Podfile.lock'])).toBe('');
});

test('keeps a staged lockfile carrying a real pod change', () => {
  const real = lock({ hermes: sha('2'), reachability: sha('9') });
  writeLock(real);
  git(repo, ['add', 'ios/Podfile.lock']);
  runHook();
  expect(readLock()).toBe(real);
});

test('leaves unstaged lockfile drift alone', () => {
  const drifted = lock({ hermes: sha('2') });
  writeLock(drifted);
  runHook();
  expect(readLock()).toBe(drifted);
});
