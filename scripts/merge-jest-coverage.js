#!/usr/bin/env node
'use strict';

/**
 * Merge Istanbul coverage-final.json files produced by sharded Jest runs.
 *
 * Usage:
 *   node scripts/merge-jest-coverage.js <outDir> <searchRoot> [<searchRoot> ...]
 */

const fs = require('fs');
const path = require('path');
const { createCoverageMap } = require('istanbul-lib-coverage');

function collectCoverageFiles(root) {
  const files = [];
  if (!fs.existsSync(root)) {
    return files;
  }

  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (entry.name === 'coverage-final.json') {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function main() {
  const [, , outDir, ...searchRoots] = process.argv;
  if (!outDir || searchRoots.length === 0) {
    console.error(
      'Usage: node scripts/merge-jest-coverage.js <outDir> <searchRoot> [<searchRoot> ...]',
    );
    process.exit(1);
  }

  const coverageFiles = searchRoots.flatMap((root) => collectCoverageFiles(root));
  if (coverageFiles.length === 0) {
    console.error('No coverage-final.json files found under:', searchRoots.join(', '));
    process.exit(1);
  }

  const map = createCoverageMap({});
  for (const file of coverageFiles) {
    const raw = fs.readFileSync(file, 'utf8');
    map.merge(JSON.parse(raw));
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'coverage-final.json'),
    JSON.stringify(map.toJSON()),
  );

  console.log(
    `Merged ${coverageFiles.length} coverage file(s) into ${path.join(outDir, 'coverage-final.json')}`,
  );
}

main();
