/**
 * scripts/git-hooks/commit-msg — the tag must describe the BRANCH, not one commit.
 *
 * The amend case is the reason these exist. `git diff --cached` compares the
 * index against the commit being amended, so classifying the staged set alone
 * reports a doc-only file list for an amend onto a code commit, tags it, and —
 * because `gh pr create` defaults the PR title to the commit subject and the
 * gate greps that title — skips the whole suite on unverified code.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../../..');
const HOOK = path.join(REPO_ROOT, 'scripts/git-hooks/commit-msg');
const CI_PATHS = path.join(REPO_ROOT, 'scripts/git-hooks/ci-paths.txt');

const TAG = ['[skip', 'ci]'].join('-');

let tmp;

function git(...args) {
  return execFileSync('git', args, { cwd: tmp, encoding: 'utf8' }).trim();
}

function write(relPath, contents) {
  const abs = path.join(tmp, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, contents);
}

/** Runs the hook over a message and returns the (possibly rewritten) message. */
function runHook(subject) {
  const msgFile = path.join(tmp, '.git/COMMIT_EDITMSG_TEST');
  fs.writeFileSync(msgFile, `${subject}\n`);
  execFileSync(HOOK, [msgFile], { cwd: tmp, encoding: 'utf8' });
  return fs.readFileSync(msgFile, 'utf8');
}

/** Commits whatever is staged, bypassing hooks — the hook is the thing under test. */
function commit(subject) {
  git('commit', '--no-verify', '-q', '-m', subject);
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'commit-msg-hook-'));
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Test');

  fs.mkdirSync(path.join(tmp, 'scripts/git-hooks'), { recursive: true });
  fs.copyFileSync(CI_PATHS, path.join(tmp, 'scripts/git-hooks/ci-paths.txt'));
  write('docs/readme.md', 'seed\n');
  git('add', '-A');
  commit('chore: seed');

  // The hook forks its comparison from origin/main; a local ref is enough.
  git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  git('checkout', '-q', '-b', 'work');
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('tags a docs-only branch', () => {
  write('docs/notes.md', 'a\n');
  git('add', '-A');
  expect(runHook('docs: add notes')).toContain(TAG);
});

test('leaves a code change untagged', () => {
  write('lib/thing.ts', 'export const a = 1\n');
  git('add', '-A');
  expect(runHook('feat: add thing')).not.toContain(TAG);
});

test('does not tag an amend that stages only docs onto a code commit', () => {
  write('lib/thing.ts', 'export const a = 1\n');
  write('app/screen.tsx', 'export default null\n');
  git('add', '-A');
  commit('feat: add thing');

  // The amend: stage a doc file on top of the code commit. `git diff --cached`
  // now lists only that doc file, because it compares against the commit being
  // amended rather than against the branch point.
  write('docs/notes.md', 'a\n');
  git('add', '-A');
  expect(git('diff', '--cached', '--name-only')).toBe('docs/notes.md');

  expect(runHook('feat: add thing')).not.toContain(TAG);
});

test('does not tag a docs commit that rides on a branch already carrying code', () => {
  write('lib/thing.ts', 'export const a = 1\n');
  git('add', '-A');
  commit('feat: add thing');

  write('docs/notes.md', 'a\n');
  git('add', '-A');
  expect(runHook('docs: describe thing')).not.toContain(TAG);
});

test('still tags a docs commit on a branch of only docs commits', () => {
  write('docs/one.md', 'a\n');
  git('add', '-A');
  commit('docs: one');

  write('docs/two.md', 'b\n');
  git('add', '-A');
  expect(runHook('docs: two')).toContain(TAG);
});

test('leaves the message untagged when origin/main is unresolvable', () => {
  git('update-ref', '-d', 'refs/remotes/origin/main');
  write('docs/notes.md', 'a\n');
  git('add', '-A');
  // Fail toward running: a wrong tag ships unverified code, a missing one costs
  // a single CI run.
  expect(runHook('docs: add notes')).not.toContain(TAG);
});

test('is idempotent — an already-tagged message is left alone', () => {
  write('docs/notes.md', 'a\n');
  git('add', '-A');
  const subject = `chore(ios): bump build number to 1 ${TAG}`;
  const out = runHook(subject);
  expect(out.trim()).toBe(subject);
});

test('exits cleanly with nothing staged and nothing on the branch', () => {
  expect(() => runHook('chore: empty')).not.toThrow();
});
