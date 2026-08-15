'use strict';

// Snapshots `git status --porcelain` before the suite runs, so globalTeardown
// can fail loudly if any test in jest.config.scripts.js left the working
// tree dirtier than it found it (see #712 — test:scripts used to bump
// versionCode in app.json/build.gradle and delete node_modules/.bin).
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const GIT = fs.existsSync('/opt/homebrew/bin/git') ? '/opt/homebrew/bin/git' : 'git';
const SNAPSHOT_PATH = path.join(__dirname, '.git-status-before.txt');

module.exports = async () => {
  const status = execFileSync(GIT, ['status', '--porcelain'], {
    cwd: path.resolve(__dirname, '../../..'),
    encoding: 'utf8',
  });
  fs.writeFileSync(SNAPSHOT_PATH, status);
};
