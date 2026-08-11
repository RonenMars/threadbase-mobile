/**
 * @jest-environment node
 *
 * Tests for scripts/reset-podfile-lock-path-noise.sh. Uses a throwaway git repo —
 * no CocoaPods, no network.
 */

'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SCRIPT = path.resolve(
  __dirname,
  '../../../scripts/reset-podfile-lock-path-noise.sh',
);
const BASH = '/bin/bash';
const GIT = fs.existsSync('/opt/homebrew/bin/git')
  ? '/opt/homebrew/bin/git'
  : '/usr/bin/git';

const sha = (c) => c.repeat(40);

/** A minimal Podfile.lock tail: the entries the script may drop plus one it may not. */
function lock({
  expoModulesCore,
  hermes,
  rnSentry = sha('d'),
  reachability = sha('c'),
}) {
  return [
    'SPEC CHECKSUMS:',
    `  ExpoModulesCore: ${expoModulesCore}`,
    `  RNSentry: ${rnSentry}`,
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

beforeEach(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), 'podlock-'));
  git(repo, ['init', '-q', '-b', 'main']);
  fs.mkdirSync(path.join(repo, 'ios'));
  fs.mkdirSync(path.join(repo, 'scripts'));
  fs.copyFileSync(SCRIPT, path.join(repo, 'scripts', path.basename(SCRIPT)));
  fs.writeFileSync(
    path.join(repo, 'ios/Podfile.lock'),
    lock({ expoModulesCore: sha('a'), hermes: sha('b') }),
  );
  git(repo, ['add', '.']);
  git(repo, ['commit', '-qm', 'init']);
});

afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

function run() {
  return execFileSync(BASH, [path.join(repo, 'scripts', path.basename(SCRIPT))], {
    encoding: 'utf8',
  });
}

const readLock = () => fs.readFileSync(path.join(repo, 'ios/Podfile.lock'), 'utf8');
const writeLock = (contents) =>
  fs.writeFileSync(path.join(repo, 'ios/Podfile.lock'), contents);

test('reverts a diff limited to the path-dependent checksums', () => {
  writeLock(lock({ expoModulesCore: sha('1'), hermes: sha('2') }));
  run();
  expect(readLock()).toBe(lock({ expoModulesCore: sha('a'), hermes: sha('b') }));
});

test('reverts RNSentry drift alongside the others', () => {
  writeLock(lock({ expoModulesCore: sha('1'), hermes: sha('2'), rnSentry: sha('3') }));
  run();
  expect(readLock()).toBe(lock({ expoModulesCore: sha('a'), hermes: sha('b') }));
});

test('reverts RNSentry drift on its own', () => {
  writeLock(lock({ expoModulesCore: sha('a'), hermes: sha('b'), rnSentry: sha('3') }));
  run();
  expect(readLock()).toBe(lock({ expoModulesCore: sha('a'), hermes: sha('b') }));
});

test('keeps drift that also touches another pod', () => {
  const drifted = lock({
    expoModulesCore: sha('1'),
    hermes: sha('2'),
    reachability: sha('9'),
  });
  writeLock(drifted);
  run();
  expect(readLock()).toBe(drifted);
});

test('reverts staged noise too', () => {
  writeLock(lock({ expoModulesCore: sha('1'), hermes: sha('2') }));
  git(repo, ['add', 'ios/Podfile.lock']);
  run();
  expect(readLock()).toBe(lock({ expoModulesCore: sha('a'), hermes: sha('b') }));
  expect(git(repo, ['status', '--short', 'ios/Podfile.lock'])).toBe('');
});

test('resyncs Pods/Manifest.lock so the sandbox check still passes', () => {
  const drifted = lock({ expoModulesCore: sha('1'), hermes: sha('2') });
  fs.mkdirSync(path.join(repo, 'ios/Pods'));
  fs.writeFileSync(path.join(repo, 'ios/Pods/Manifest.lock'), drifted);
  writeLock(drifted);
  run();
  expect(fs.readFileSync(path.join(repo, 'ios/Pods/Manifest.lock'), 'utf8')).toBe(
    readLock(),
  );
});

test('is a no-op on a clean lockfile', () => {
  expect(run()).toBe('');
  expect(git(repo, ['status', '--short', 'ios/Podfile.lock'])).toBe('');
});
