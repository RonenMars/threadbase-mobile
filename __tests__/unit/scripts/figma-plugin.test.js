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
  const pages = [];
  const root = {
    children: pages,
    findAll(predicate) {
      return pages.flatMap((page) => page.children || []).filter(predicate);
    },
  };
  const sandbox = {
    figma: {
      root,
      createPage() {
        const page = { type: 'PAGE', name: '', children: [] };
        pages.push(page);
        return page;
      },
      setCurrentPageAsync: jest.fn(async (page) => {
        sandbox.figma.currentPage = page;
      }),
    },
  };
  const expose = `
globalThis.catalog = CATALOG;
globalThis.steps = buildSteps();
globalThis.assets = sourceAssets();
globalThis.requiredPages = CATALOG_PAGE_ORDER;
globalThis.ensurePages = ensureCatalogPages;
globalThis.findComponent = findComp;
globalThis.runJob = runBuildJob;
globalThis.runPageJobs = runBuildPage;
globalThis.tagBuildNode = tagBuildNode;
globalThis.applySourceLinks = linkSources;
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

  it('applies repository links to every cataloged public asset', async () => {
    const runtime = catalogRuntime();
    const page = { type: 'PAGE', name: 'Components', children: [] };
    runtime.figma.root.children.push(page);
    for (const { name } of runtime.assets) {
      page.children.push({ type: 'COMPONENT', name, documentationLinks: [] });
    }

    await runtime.applySourceLinks();

    const badge = page.children.find(({ name }) => name === 'Badge');
    expect(badge.documentationLinks).toEqual([{
      uri: 'https://github.com/RonenMars/threadbase-mobile/blob/main/components/ui/Badge.tsx',
    }]);
  });

  it('creates the complete page structure idempotently and keeps Screens separate from Visual QA', () => {
    const runtime = catalogRuntime();
    runtime.figma.root.children.push({ type: 'PAGE', name: '10 Foundations', children: [] });

    const first = runtime.ensurePages();
    const second = runtime.ensurePages();

    expect([...runtime.requiredPages]).toEqual([
      '00 Start Here',
      '10 Foundations',
      '20 Core & Shared',
      '30 Sessions',
      '40 Conversation & Terminal',
      '50 Connectivity',
      '60 Product Experience',
      '70 Patterns',
      '80 Screens',
      '90 Visual QA',
      '99 Deprecated',
    ]);
    expect(runtime.figma.root.children).toHaveLength(11);
    expect(second.get('10 Foundations')).toBe(first.get('10 Foundations'));
    expect(first.get('80 Screens')).not.toBe(first.get('90 Visual QA'));
  });

  it('finds components across pages and refuses ambiguous public names', () => {
    const runtime = catalogRuntime();
    const firstPage = { type: 'PAGE', name: 'First', children: [] };
    const secondPage = {
      type: 'PAGE',
      name: 'Second',
      children: [{ type: 'COMPONENT', name: 'Shared' }],
    };
    runtime.figma.root.children.push(firstPage, secondPage);

    expect(runtime.findComponent('Shared')).toBe(secondPage.children[0]);
    firstPage.children.push({ type: 'COMPONENT_SET', name: 'Shared' });
    expect(() => runtime.findComponent('Shared')).toThrow('Duplicate component name "Shared"');
  });

  it('runs a build job on its catalog page and tags generated nodes with its group', async () => {
    const runtime = catalogRuntime();
    const pages = runtime.ensurePages();
    const node = { setPluginData: jest.fn() };
    const job = {
      buildName: 'Example',
      builder: () => runtime.tagBuildNode(node),
      page: '40 Conversation & Terminal',
      group: 'Messages',
    };

    await runtime.runJob(job, pages);

    expect(runtime.figma.currentPage).toBe(pages.get('40 Conversation & Terminal'));
    expect(node.setPluginData).toHaveBeenCalledWith('threadbase-group', 'Messages');
  });

  it('switches pages once when running multiple jobs for the same destination', async () => {
    const runtime = catalogRuntime();
    const pages = runtime.ensurePages();
    const page = pages.get('20 Core & Shared');
    const first = { setPluginData: jest.fn() };
    const second = { setPluginData: jest.fn() };
    runtime.figma.setCurrentPageAsync.mockClear();

    await runtime.runPageJobs([
      { builder: () => runtime.tagBuildNode(first), group: 'Feedback' },
      { builder: () => runtime.tagBuildNode(second), group: 'Actions' },
    ], page);

    expect(runtime.figma.setCurrentPageAsync).toHaveBeenCalledTimes(1);
    expect(runtime.figma.setCurrentPageAsync).toHaveBeenCalledWith(page);
    expect(first.setPluginData).toHaveBeenCalledWith('threadbase-group', 'Feedback');
    expect(second.setPluginData).toHaveBeenCalledWith('threadbase-group', 'Actions');
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
