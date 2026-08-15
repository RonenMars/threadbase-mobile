'use strict';

// Companion to _globalSetup.js: fails the run if the working tree is dirtier
// after the suite than it was before. See #712.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const GIT = fs.existsSync('/opt/homebrew/bin/git') ? '/opt/homebrew/bin/git' : 'git';
const SNAPSHOT_PATH = path.join(__dirname, '.git-status-before.txt');
const REPO_ROOT = path.resolve(__dirname, '../../..');

module.exports = async () => {
  const before = fs.existsSync(SNAPSHOT_PATH) ? fs.readFileSync(SNAPSHOT_PATH, 'utf8') : '';
  fs.rmSync(SNAPSHOT_PATH, { force: true });

  const after = execFileSync(GIT, ['status', '--porcelain'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  const beforeLines = new Set(before.split('\n').filter(Boolean));
  const newLines = after.split('\n').filter(line => line && !beforeLines.has(line));

  if (newLines.length > 0) {
    throw new Error(
      'test:scripts left the working tree dirtier than it found it ' +
        '(see #712 — a script test is writing to the real repo instead of a temp fixture):\n' +
        newLines.join('\n'),
    );
  }
};
