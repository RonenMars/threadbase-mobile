/**
 * @jest-environment node
 */

'use strict';

const fs = require('fs');
const path = require('path');

const shards = require('../../../scripts/ci-lint-shards.json');

const REPO_ROOT = path.resolve(__dirname, '../../..');
const IGNORED_PREFIXES = ['.expo/', '.remember/', '.worktrees/', 'node_modules/', 'coverage/'];

function isLintTarget(filePath) {
  if (IGNORED_PREFIXES.some((prefix) => filePath.startsWith(prefix))) {
    return false;
  }
  if (/\.(ts|tsx)$/.test(filePath)) {
    return true;
  }
  if (/^e2e\/.*\.js$/.test(filePath)) {
    return true;
  }
  if (/^__tests__\/unit\/scripts\/.*\.js$/.test(filePath)) {
    return true;
  }
  return false;
}

function walkLintTargets(dir, files = []) {
  const absDir = path.isAbsolute(dir) ? dir : path.join(REPO_ROOT, dir);
  if (!fs.existsSync(absDir)) {
    return files;
  }

  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') {
      continue;
    }

    const rel = dir === '.' ? entry.name : path.posix.join(dir.replace(/\\/g, '/'), entry.name);
    if (IGNORED_PREFIXES.some((prefix) => rel.startsWith(prefix))) {
      continue;
    }

    if (entry.isDirectory()) {
      walkLintTargets(rel, files);
      continue;
    }

    if (isLintTarget(rel)) {
      files.push(rel);
    }
  }

  return files;
}

function expandShardPath(shardPath) {
  const absPath = path.join(REPO_ROOT, shardPath);
  if (fs.existsSync(absPath) && fs.statSync(absPath).isFile()) {
    return isLintTarget(shardPath) ? [shardPath] : [];
  }

  return walkLintTargets(shardPath).sort();
}

describe('ci-lint-shards.json', () => {
  it('assigns every lint target file to exactly one shard', () => {
    const discovered = walkLintTargets('.').sort();
    const assigned = Object.values(shards).flat().flatMap(expandShardPath).sort();

    expect(assigned).toEqual(discovered);
    expect(new Set(assigned).size).toBe(assigned.length);
  });

  it('isolates the slowest directories on dedicated shards', () => {
    expect(shards['1']).toEqual(['components']);
    expect(shards['2']).toEqual(['app']);
    expect(shards['3']).toContain('__tests__');
    expect(shards['3']).toContain('e2e');
  });
});
