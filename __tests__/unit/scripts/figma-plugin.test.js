/**
 * @jest-environment node
 *
 * Structural checks on design/figma-plugin/code.js.
 *
 * The plugin only ever runs inside Figma, against a `figma` global this process
 * does not have, so none of it can be executed here. It is also outside every
 * other net the repo has: `npm run lint` globs .ts/.tsx plus two .js paths, and
 * there is no type checking, so a broken edit is otherwise discovered by
 * importing the plugin into Figma by hand.
 *
 * These read the file as text and assert the things that rot silently.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '../../..');
const PLUGIN = path.join(ROOT, 'design/figma-plugin/code.js');
const src = fs.readFileSync(PLUGIN, 'utf8');

/** The `const SOURCES = { ... };` object literal, as raw text. */
function sourcesBlock() {
  const start = src.indexOf('\nconst SOURCES = {');
  expect(start).toBeGreaterThan(-1);
  const end = src.indexOf('\n};', start);
  expect(end).toBeGreaterThan(start);
  return src.slice(start, end + 3);
}

describe('figma plugin: code.js', () => {
  it('parses as JavaScript', () => {
    // Never linted or type-checked; a syntax error would otherwise surface only
    // when someone imports the plugin into Figma.
    expect(() => new vm.Script(src, { filename: PLUGIN })).not.toThrow();
  });

  it('points every SOURCES entry at a file that exists', () => {
    const block = sourcesBlock();
    const entries = [...block.matchAll(/^\s+([A-Za-z0-9_$]+):\s*'([^']+)',?$/gm)];
    // Guard against the regex silently matching nothing after a reformat.
    expect(entries.length).toBeGreaterThan(100);

    const missing = entries
      .map(([, name, file]) => ({ name, file }))
      .filter(({ file }) => !fs.existsSync(path.join(ROOT, file)));

    expect(missing).toEqual([]);
  });

  it('has no duplicate SOURCES keys', () => {
    // An object literal keeps the last of a repeated key, so a duplicate drops
    // one component's documentation link with no error anywhere.
    const names = [...sourcesBlock().matchAll(/^\s+([A-Za-z0-9_$]+):\s*'/gm)].map((m) => m[1]);
    const seen = new Set();
    const duplicates = names.filter((n) => (seen.has(n) ? true : (seen.add(n), false)));

    expect(duplicates).toEqual([]);
  });

  it('defines every builder named in the build steps', () => {
    const line = src.split('\n').find((l) => l.includes('const steps = [['));
    expect(line).toBeDefined();

    const referenced = [...line.matchAll(/,\s*([A-Za-z0-9_$]+)\]/g)].map((m) => m[1]);
    expect(referenced.length).toBeGreaterThan(50);

    const undefinedFns = referenced.filter(
      (fn) => !new RegExp(`(async )?function ${fn}\\s*\\(`).test(src),
    );

    expect(undefinedFns).toEqual([]);
  });
});
