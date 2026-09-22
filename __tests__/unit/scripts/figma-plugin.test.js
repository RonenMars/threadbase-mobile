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

describe('figma plugin: bridge.mjs', () => {
  const { spawn } = require('child_process');
  const PORT = 7179;
  const BASE = `http://127.0.0.1:${PORT}`;
  const BRIDGE = path.join(ROOT, 'design/figma-plugin/bridge.mjs');

  let relay;
  let token;

  beforeAll(async () => {
    relay = spawn(process.execPath, [BRIDGE], {
      env: { ...process.env, BRIDGE_PORT: String(PORT) },
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    await new Promise((resolve, reject) => {
      relay.stdout.on('data', (c) => { if (String(c).includes('bridge on')) resolve(); });
      relay.on('error', reject);
      setTimeout(() => reject(new Error('relay did not start')), 10000);
    });
    token = fs.readFileSync(path.join(ROOT, 'design/figma-plugin/.bridge-token'), 'utf8').trim();
  }, 15000);

  afterAll(() => relay && relay.kill());

  it('mints a token with enough entropy to be unguessable', () => {
    expect(token).toMatch(/^[0-9a-f]{32}$/);
  });

  it('refuses /run without the token', async () => {
    // The whole point: a page in the user's browser can reach this port, and
    // /run executes whatever it sends inside the Figma document.
    const res = await fetch(`${BASE}/run`, { method: 'POST', body: 'figma.closePlugin()' });
    expect(res.status).toBe(403);
  });

  it('refuses /run with a wrong token, and /next and /result too', async () => {
    const bad = { 'x-bridge-token': 'f'.repeat(32) };
    const run = await fetch(`${BASE}/run`, { method: 'POST', headers: bad, body: 'x' });
    const next = await fetch(`${BASE}/next`, { headers: bad });
    const result = await fetch(`${BASE}/result`, { method: 'POST', headers: bad, body: '{}' });
    expect([run.status, next.status, result.status]).toEqual([403, 403, 403]);
  });

  it('does not let a preflight wave through arbitrary headers', async () => {
    // `Access-Control-Allow-Headers: *` would let any origin send the token
    // header name, which is what forces the preflight in the first place.
    const res = await fetch(`${BASE}/run`, { method: 'OPTIONS' });
    expect(res.headers.get('access-control-allow-headers')).not.toContain('*');
  });

  it('runs a job end to end for a caller holding the token', async () => {
    const auth = { 'x-bridge-token': token };
    const job = fetch(`${BASE}/run`, { method: 'POST', headers: auth, body: 'return 1 + 1' });

    const handed = await fetch(`${BASE}/next`, { headers: auth }).then((r) => r.json());
    expect(handed.code).toContain('return 1 + 1');

    await fetch(`${BASE}/result`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ id: handed.id, ok: true, value: 2 }),
    });

    await expect(job.then((r) => r.json())).resolves.toMatchObject({ ok: true, value: 2 });
  }, 15000);
});
