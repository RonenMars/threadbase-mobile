/**
 * @jest-environment node
 *
 * Tests for scripts/check-story-coverage.js. Uses a throwaway git repo — no
 * CocoaPods, no network.
 */

'use strict';

const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const SCRIPT = path.join(ROOT, 'scripts/check-story-coverage.js');
const GIT = fs.existsSync('/opt/homebrew/bin/git')
  ? '/opt/homebrew/bin/git'
  : '/usr/bin/git';

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
  repo = fs.mkdtempSync(path.join(os.tmpdir(), 'story-coverage-'));
  git(repo, ['init', '-q', '-b', 'main']);
  fs.mkdirSync(path.join(repo, 'components/ui'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'scripts/git-hooks'), { recursive: true });
  fs.copyFileSync(SCRIPT, path.join(repo, 'scripts', path.basename(SCRIPT)));
  git(repo, ['add', '.']);
  git(repo, ['commit', '-qm', 'init']);
});

afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

function writeFile(relPath, contents = 'export {}\n') {
  const full = path.join(repo, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, contents);
}

function runScript() {
  return execFileSync('node', [path.join(repo, 'scripts/check-story-coverage.js')], {
    cwd: repo,
    encoding: 'utf8',
  });
}

function runScriptCombined() {
  const result = spawnSync('node', [path.join(repo, 'scripts/check-story-coverage.js')], {
    cwd: repo,
    encoding: 'utf8',
  });
  return `${result.stdout}${result.stderr}`;
}

test('blocks a new component with no story', () => {
  writeFile('components/ui/Widget.tsx');
  git(repo, ['add', 'components/ui/Widget.tsx']);
  expect(() => runScript()).toThrow(/new component.*require a story/is);
});

test('allows a new component with a matching story', () => {
  writeFile('components/ui/Widget.tsx');
  writeFile('components/ui/Widget.stories.tsx');
  git(repo, ['add', 'components/ui/Widget.tsx', 'components/ui/Widget.stories.tsx']);
  expect(() => runScript()).not.toThrow();
});

test('warns but does not block a modified component with no story', () => {
  writeFile('components/ui/Widget.tsx', 'export {}\n');
  git(repo, ['add', 'components/ui/Widget.tsx']);
  git(repo, ['commit', '-qm', 'add widget']);

  writeFile('components/ui/Widget.tsx', 'export const x = 1\n');
  git(repo, ['add', 'components/ui/Widget.tsx']);
  const output = runScriptCombined();
  expect(output).toMatch(/no story/i);
});

test('respects an exemption listed in story-exempt.txt', () => {
  writeFile('scripts/git-hooks/story-exempt.txt', 'components/ui/Widget.tsx\n');
  writeFile('components/ui/Widget.tsx');
  git(repo, ['add', '.']);
  expect(() => runScript()).not.toThrow();
});

test('ignores non-component files', () => {
  writeFile('components/ui/Widget.test.tsx');
  writeFile('components/ui/helpers.ts');
  git(repo, ['add', '.']);
  expect(() => runScript()).not.toThrow();
});
