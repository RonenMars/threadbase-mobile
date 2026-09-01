/**
 * @jest-environment node
 */

'use strict';

const fs = require('fs');
const path = require('path');

const shards = require('../../../scripts/ci-integration-test-shards.json');
const integrationDir = path.resolve(__dirname, '../../integration');
const repoRoot = path.resolve(__dirname, '../../..');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return walk(fullPath);
    }
    return /\.test\.(tsx|ts)$/.test(entry.name) ? [fullPath] : [];
  });
}

describe('ci-integration-test-shards.json', () => {
  it('assigns every integration test file to exactly one shard', () => {
    const discovered = walk(integrationDir)
      .map((file) => path.relative(repoRoot, file).replace(/\\/g, '/'))
      .sort();

    const assigned = Object.values(shards)
      .flatMap((shard) => shard.files)
      .sort();

    expect(assigned).toEqual(discovered);
    expect(new Set(assigned).size).toBe(assigned.length);
  });

  it('runs SessionScreen suites serially on shard 1', () => {
    expect(shards['1'].runInBand).toBe(true);
    expect(shards['1'].files.every((file) => file.includes('SessionScreen.'))).toBe(true);
  });

  it('runs heavy component suites serially on shard 3', () => {
    expect(shards['3'].runInBand).toBe(true);
    expect(shards['3'].files).not.toContain(
      '__tests__/integration/components/PairDeepLinkScreen.test.tsx',
    );
  });
});
