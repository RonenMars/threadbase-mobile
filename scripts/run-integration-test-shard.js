#!/usr/bin/env node
'use strict';

/**
 * Run one CI integration-test shard from scripts/ci-integration-test-shards.json.
 *
 * Usage:
 *   node scripts/run-integration-test-shard.js <shard-id>
 *
 * Set INTEGRATION_COVERAGE=1 to collect Istanbul output (main-branch CI only).
 */

const { execFileSync } = require('child_process');
const path = require('path');

const shards = require('./ci-integration-test-shards.json');
const shardId = process.argv[2];
const shard = shards[shardId];

if (!shard?.files?.length) {
  console.error(`Unknown or empty integration-test shard: ${shardId}`);
  console.error('Known shards:', Object.keys(shards).join(', '));
  process.exit(1);
}

const repoRoot = process.cwd();
const jestBin = path.join(repoRoot, 'node_modules', '.bin', 'jest');
const jestArgs = ['--ci', '--forceExit'];

if (shard.runInBand) {
  jestArgs.push('--runInBand');
}

if (process.env.INTEGRATION_COVERAGE === '1') {
  jestArgs.push('--coverage', `--coverageDirectory=coverage/integration-shard-${shardId}`);
}

jestArgs.push(...shard.files);

execFileSync(jestBin, jestArgs, { stdio: 'inherit', cwd: repoRoot });
