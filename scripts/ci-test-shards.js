'use strict';

/**
 * Resolve a CI test-shard manifest against the test files that exist on disk.
 *
 * A shard claims files one of three ways:
 *   { "files": [...] }      explicit pins
 *   { "pattern": "regex" }  every discovered file matching the regex
 *   { "rest": true }        every discovered file no other shard claimed
 *
 * The `rest` shard is why adding a test file needs no manifest edit: only
 * suites that must be isolated or run serially are ever listed.
 */

const fs = require('fs');
const path = require('path');

function listTests(repoRoot, dir, fileRegex) {
  const walk = (current) =>
    fs.readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        return walk(fullPath);
      }
      return fileRegex.test(entry.name) ? [fullPath] : [];
    });

  return walk(path.join(repoRoot, dir))
    .map((file) => path.relative(repoRoot, file).replace(/\\/g, '/'))
    .sort();
}

function resolveShards(shards, discovered) {
  const resolved = {};
  for (const [id, shard] of Object.entries(shards)) {
    if (shard.rest) {
      continue;
    }
    if (shard.pattern) {
      const regex = new RegExp(shard.pattern);
      resolved[id] = discovered.filter((file) => regex.test(file));
    } else {
      resolved[id] = shard.files;
    }
  }

  const claimed = new Set(Object.values(resolved).flat());
  for (const [id, shard] of Object.entries(shards)) {
    if (shard.rest) {
      resolved[id] = discovered.filter((file) => !claimed.has(file));
    }
  }
  return resolved;
}

module.exports = { listTests, resolveShards };
