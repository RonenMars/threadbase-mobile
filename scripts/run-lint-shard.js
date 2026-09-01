#!/usr/bin/env node
'use strict';

/**
 * Run one CI lint shard from scripts/ci-lint-shards.json.
 *
 * Usage:
 *   node scripts/run-lint-shard.js <shard-id>
 */

const { execFileSync } = require('child_process');
const path = require('path');

const shards = require('./ci-lint-shards.json');
const shardId = process.argv[2];
const paths = shards[shardId];

if (!paths?.length) {
  console.error(`Unknown or empty lint shard: ${shardId}`);
  console.error('Known shards:', Object.keys(shards).join(', '));
  process.exit(1);
}

const repoRoot = process.cwd();
const eslintBin = path.join(repoRoot, 'node_modules', '.bin', 'eslint');
const cacheFile = path.join(repoRoot, `.eslintcache-shard-${shardId}`);

execFileSync(
  eslintBin,
  [
    ...paths,
    '--max-warnings=0',
    '--cache',
    '--cache-location',
    cacheFile,
  ],
  { stdio: 'inherit', cwd: repoRoot },
);
