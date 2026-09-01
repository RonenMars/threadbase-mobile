/**
 * @jest-environment node
 */

'use strict';

const fs = require('fs');
const path = require('path');

const shards = require('../../../scripts/ci-script-test-shards.json');
const scriptsDir = path.resolve(__dirname);

describe('ci-script-test-shards.json', () => {
  it('assigns every script test file to exactly one shard', () => {
    const discovered = fs
      .readdirSync(scriptsDir)
      .filter((name) => /\.test\.(js|ts)$/.test(name))
      .map((name) => path.join('__tests__/unit/scripts', name))
      .sort();

    const assigned = Object.values(shards).flat().sort();
    expect(assigned).toEqual(discovered);
    expect(new Set(assigned).size).toBe(assigned.length);
  });

  it('isolates the slowest suites on separate shards', () => {
    expect(shards['1']).toEqual(['__tests__/unit/scripts/commit-msg-hook.test.js']);
    expect(shards['2']).toContain('__tests__/unit/scripts/land-version-bump.test.js');
    expect(shards['3']).toEqual([
      '__tests__/unit/scripts/check-story-coverage.test.js',
      '__tests__/unit/scripts/run-android-ci-device-guard.test.js',
    ]);
    expect(shards['4']).toContain('__tests__/unit/scripts/maestro-flow-env.test.js');
  });
});
