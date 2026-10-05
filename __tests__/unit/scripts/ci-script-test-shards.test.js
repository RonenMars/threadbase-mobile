/**
 * @jest-environment node
 */

'use strict';

const path = require('path');

const shards = require('../../../scripts/ci-script-test-shards.json');
const { listTests, resolveShards } = require('../../../scripts/ci-test-shards');

const repoRoot = path.resolve(__dirname, '../../..');
const discovered = listTests(repoRoot, '__tests__/unit/scripts', /\.test\.(js|ts)$/);
const resolved = resolveShards(shards, discovered);

describe('ci-script-test-shards.json', () => {
  it('assigns every script test file to exactly one shard', () => {
    const assigned = Object.values(resolved).flat().sort();
    expect(assigned).toEqual(discovered);
    expect(new Set(assigned).size).toBe(assigned.length);
  });

  it('isolates the slowest suites on separate shards', () => {
    expect(resolved['1']).toEqual(['__tests__/unit/scripts/commit-msg-hook.test.js']);
    expect(resolved['2']).toContain('__tests__/unit/scripts/land-version-bump.test.js');
    expect(resolved['3']).toEqual([
      '__tests__/unit/scripts/check-story-coverage.test.js',
      '__tests__/unit/scripts/run-android-ci-device-guard.test.js',
    ]);
    expect(resolved['4']).toContain('__tests__/unit/scripts/maestro-flow-env.test.js');
  });
});

describe('resolveShards', () => {
  it('sends a file no shard lists to the rest shard, and pattern matches to their shard', () => {
    const manifest = {
      1: { pattern: '/Heavy\\.' },
      2: { files: ['t/pinned.test.js'] },
      3: { rest: true },
    };
    const files = ['t/Heavy.new.test.js', 't/brand-new.test.js', 't/pinned.test.js'];

    expect(resolveShards(manifest, files)).toEqual({
      1: ['t/Heavy.new.test.js'],
      2: ['t/pinned.test.js'],
      3: ['t/brand-new.test.js'],
    });
  });
});
