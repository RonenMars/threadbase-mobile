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

const { listTests, resolveShards } = require('./ci-test-shards');
const shards = require('./ci-integration-test-shards.json');

const repoRoot = process.cwd();
const shardId = process.argv[2];
const shard = shards[shardId];
const files = resolveShards(
  shards,
  listTests(repoRoot, '__tests__/integration', /\.test\.(tsx|ts)$/),
)[shardId];

if (!files?.length) {
  console.error(`Unknown or empty integration-test shard: ${shardId}`);
  console.error('Known shards:', Object.keys(shards).join(', '));
  process.exit(1);
}

const jestBin = path.join(repoRoot, 'node_modules', '.bin', 'jest');
const jestArgs = ['--ci', '--forceExit', '--testTimeout=10000'];

if (shard.runInBand) {
  jestArgs.push('--runInBand');
}

if (process.env.INTEGRATION_COVERAGE === '1') {
  jestArgs.push('--coverage', `--coverageDirectory=coverage/integration-shard-${shardId}`);
}

jestArgs.push(...files);

execFileSync(jestBin, jestArgs, { stdio: 'inherit', cwd: repoRoot });
