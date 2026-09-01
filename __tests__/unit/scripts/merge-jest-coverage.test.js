/**
 * @jest-environment node
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const SCRIPT = path.resolve(__dirname, '../../../scripts/merge-jest-coverage.js');

function writeCoverage(dir, payload) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'coverage-final.json'), JSON.stringify(payload));
}

describe('merge-jest-coverage.js', () => {
  let tmp;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-coverage-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('merges coverage-final.json files from nested shard directories', () => {
    writeCoverage(path.join(tmp, 'shard-1'), {
      '/repo/a.ts': {
        path: '/repo/a.ts',
        statementMap: { 0: { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } } },
        s: { 0: 1 },
        fnMap: {},
        f: {},
        branchMap: {},
        b: {},
      },
    });
    writeCoverage(path.join(tmp, 'shard-2'), {
      '/repo/b.ts': {
        path: '/repo/b.ts',
        statementMap: { 0: { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } } },
        s: { 0: 0 },
        fnMap: {},
        f: {},
        branchMap: {},
        b: {},
      },
    });

    const outDir = path.join(tmp, 'merged');
    execFileSync(process.execPath, [SCRIPT, outDir, tmp], { encoding: 'utf8' });

    const merged = JSON.parse(
      fs.readFileSync(path.join(outDir, 'coverage-final.json'), 'utf8'),
    );
    expect(Object.keys(merged).sort()).toEqual(['/repo/a.ts', '/repo/b.ts']);
  });
});
