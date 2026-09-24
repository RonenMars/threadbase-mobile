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
 * These parse the file, evaluate its prelude without calling Figma, and assert
 * the structural contracts that otherwise rot silently.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '../../..');
const PLUGIN = path.join(ROOT, 'design/figma-plugin/code.js');
const src = fs.readFileSync(PLUGIN, 'utf8');

function catalogRuntime() {
  const entry = src.indexOf('// ---------- plugin entry ----------');
  expect(entry).toBeGreaterThan(-1);
  const sandbox = {};
  const expose = `
globalThis.catalog = CATALOG;
globalThis.steps = buildSteps();
globalThis.assets = sourceAssets();
`;
  new vm.Script(src.slice(0, entry) + expose, { filename: PLUGIN }).runInNewContext(sandbox);
  return sandbox;
}

describe('figma plugin: code.js', () => {
  it('parses as JavaScript', () => {
    // Never linted or type-checked; a syntax error would otherwise surface only
    // when someone imports the plugin into Figma.
    expect(() => new vm.Script(src, { filename: PLUGIN })).not.toThrow();
  });

  it('catalogs every build job with valid organization metadata', () => {
    const { catalog, steps } = catalogRuntime();
    const allowedPages = [
      '20 Core & Shared',
      '30 Sessions',
      '40 Conversation & Terminal',
      '50 Connectivity',
      '60 Product Experience',
      '70 Patterns',
    ];
    const jobs = catalog.filter(({ builder }) => builder);

    expect(steps).toHaveLength(100);
    expect(steps[0][0]).toBe('icons');
    expect(steps.at(-1)[0]).toBe('Onboarding');
    expect(jobs.map(({ buildName }) => buildName)).toEqual(steps.map(([name]) => name));
    expect(new Set(jobs.map(({ buildName }) => buildName)).size).toBe(jobs.length);
    expect(jobs.filter(({ builder }) => typeof builder !== 'function')).toEqual([]);
    expect(jobs.filter(({ page }) => !allowedPages.includes(page))).toEqual([]);
    expect(jobs.filter(({ group }) => typeof group !== 'string' || group.length === 0)).toEqual([]);
    expect(jobs.filter(({ kind }) => !['asset', 'component', 'pattern'].includes(kind))).toEqual([]);
    expect(jobs.filter(({ status }) => status !== 'stable')).toEqual([]);
  });

  it('catalogs every source-linked public asset exactly once', () => {
    const { assets } = catalogRuntime();
    const names = assets.map(({ name }) => name);
    const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
    const missing = assets.filter(({ source }) => !fs.existsSync(path.join(ROOT, source)));

    expect(assets).toHaveLength(114);
    expect(duplicates).toEqual([]);
    expect(missing).toEqual([]);
    expect(assets.filter(({ page, group, kind, status }) => (
      !page || !group || !kind || !status
    ))).toEqual([]);
  });

  it('feeds the build and source-link paths from the catalog', () => {
    expect(src).toContain('const steps = buildSteps();');
    expect(src).toContain('for (const entry of sourceAssets()) {');
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
