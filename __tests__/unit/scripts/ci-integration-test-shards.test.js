/**
 * @jest-environment node
 */

'use strict';

const path = require('path');

const shards = require('../../../scripts/ci-integration-test-shards.json');
const { listTests, resolveShards } = require('../../../scripts/ci-test-shards');

const repoRoot = path.resolve(__dirname, '../../..');
const discovered = listTests(repoRoot, '__tests__/integration', /\.test\.(tsx|ts)$/);
const resolved = resolveShards(shards, discovered);

describe('ci-integration-test-shards.json', () => {
  it('assigns every integration test file to exactly one shard', () => {
    const assigned = Object.values(resolved).flat().sort();

    expect(assigned).toEqual(discovered);
    expect(new Set(assigned).size).toBe(assigned.length);
  });

  it('runs SessionScreen suites serially on shard 1', () => {
    expect(shards['1'].runInBand).toBe(true);
    expect(resolved['1'].length).toBeGreaterThan(0);
    expect(discovered.filter((file) => file.includes('SessionScreen.'))).toEqual(resolved['1']);
  });

  it('runs heavy component suites serially on shard 3', () => {
    expect(shards['3'].runInBand).toBe(true);
    expect(resolved['3']).not.toContain(
      '__tests__/integration/components/PairDeepLinkScreen.test.tsx',
    );
  });
});
