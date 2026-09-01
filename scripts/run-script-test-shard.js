#!/usr/bin/env node
'use strict';

/**
 * Run one CI script-test shard from scripts/ci-script-test-shards.json.
 *
 * Usage:
 *   node scripts/run-script-test-shard.js <shard-id>
 */

const { execFileSync } = require('child_process');
const path = require('path');

const shards = require('./ci-script-test-shards.json');
const shardId = process.argv[2];
const files = shards[shardId];

if (!files || files.length === 0) {
  console.error(`Unknown or empty script-test shard: ${shardId}`);
  console.error('Known shards:', Object.keys(shards).join(', '));
  process.exit(1);
}

const repoRoot = process.cwd();
const jestBin = path.join(repoRoot, 'node_modules', '.bin', 'jest');

execFileSync(
  jestBin,
  ['--config', 'jest.config.scripts.js', '--ci', '--forceExit', ...files],
  { stdio: 'inherit', cwd: repoRoot },
);
