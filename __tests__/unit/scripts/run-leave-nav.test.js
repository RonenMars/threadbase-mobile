/**
 * @jest-environment node
 *
 * Black-box coverage for the real-streamer leave-navigation controller. The
 * fixture is a separate process because the controller itself is also spawned;
 * that keeps HTTP behavior real while the deterministic Maestro executable
 * stands in for device automation.
 */

'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../../..');
const RUNNER = path.join(REPO_ROOT, 'e2e/run-leave-nav.js');

function waitForLine(child) {
  return new Promise((resolve, reject) => {
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
      const newline = output.indexOf('\n');
      if (newline !== -1) resolve(output.slice(0, newline));
    });
    child.once('error', reject);
    child.once('exit', (code) => reject(new Error(`fixture exited before ready (${code})`)));
  });
}

async function startFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'leave-nav-fixture-'));
  const serverPath = path.join(dir, 'server.js');
  fs.writeFileSync(
    serverPath,
    `
      const http = require('http');
      const sessions = new Map([
        ['pre-existing', { id: 'pre-existing', status: 'waiting_input', ptyAttached: true }],
      ]);
      const state = { starts: [], detailPolls: 0, stopped: [] };
      function json(res, status, value) {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(value));
      }
      const server = http.createServer((req, res) => {
        let raw = '';
        req.on('data', (chunk) => { raw += chunk; });
        req.on('end', () => {
          const url = new URL(req.url, 'http://fixture');
          if (req.headers.authorization !== 'Bearer test-key' && !url.pathname.startsWith('/test/')) {
            json(res, 401, { error: 'unauthorized' });
            return;
          }
          if (req.method === 'GET' && url.pathname === '/api/info') {
            json(res, 200, { name: 'fixture-streamer' });
            return;
          }
          if (req.method === 'POST' && url.pathname === '/api/sessions/start') {
            state.starts.push(JSON.parse(raw));
            sessions.set('pending-owned', { id: 'pending-owned', status: 'running', ptyAttached: false });
            json(res, 202, { id: 'pending-owned', status: 'pending' });
            return;
          }
          if (req.method === 'GET' && url.pathname === '/api/sessions/pending-owned') {
            state.detailPolls += 1;
            const session = sessions.get('pending-owned');
            if (state.detailPolls >= 2) Object.assign(session, { status: 'waiting_input', ptyAttached: true });
            json(res, 200, session);
            return;
          }
          if (req.method === 'GET' && url.pathname === '/api/sessions') {
            json(res, 200, [...sessions.values()]);
            return;
          }
          const stop = /^\\/api\\/sessions\\/([^/]+)\\/stop$/.exec(url.pathname);
          if (req.method === 'POST' && stop) {
            const id = decodeURIComponent(stop[1]);
            state.stopped.push(id);
            const session = sessions.get(id);
            if (session) Object.assign(session, { status: 'idle', ptyAttached: false });
            json(res, 200, { ok: true });
            return;
          }
          if (req.method === 'POST' && url.pathname === '/test/create') {
            sessions.set('flow-owned', { id: 'flow-owned', status: 'waiting_input', ptyAttached: true });
            json(res, 201, { id: 'flow-owned' });
            return;
          }
          if (req.method === 'GET' && url.pathname === '/test/state') {
            json(res, 200, state);
            return;
          }
          json(res, 404, { error: 'not found' });
        });
      });
      server.listen(0, '127.0.0.1', () => console.log(server.address().port));
      process.on('SIGTERM', () => server.close(() => process.exit(0)));
    `,
  );

  const child = spawn(process.execPath, [serverPath], { stdio: ['ignore', 'pipe', 'inherit'] });
  const port = await waitForLine(child);
  return {
    child,
    dir,
    url: `http://127.0.0.1:${port}`,
    async state() {
      return fetch(`http://127.0.0.1:${port}/test/state`).then((res) => res.json());
    },
  };
}

function createMaestroStub(dir) {
  const stub = path.join(dir, 'maestro-stub.js');
  const log = path.join(dir, 'maestro-argv.jsonl');
  fs.writeFileSync(
    stub,
    `#!/usr/bin/env node
      const fs = require('fs');
      const args = process.argv.slice(2);
      fs.appendFileSync(process.env.MAESTRO_ARGV_LOG, JSON.stringify(args) + '\\n');
      if (args.includes('SESSION_MODE=new')) {
        fetch(process.env.FIXTURE_URL + '/test/create', { method: 'POST' })
          .then((res) => { if (!res.ok) throw new Error(String(res.status)); })
          .then(() => process.exit(0), (err) => { console.error(err); process.exit(1); });
      }
    `,
    { mode: 0o755 },
  );
  return { stub, log };
}

function runRunner(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [RUNNER, ...args], {
      cwd: REPO_ROOT,
      env: { ...process.env, E2E_XCTEST_CRASH_GRACE_MS: '0', ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('exit', (status) => resolve({ status, stdout, stderr }));
  });
}

describe('run-leave-nav real-streamer controller', () => {
  let fixture;
  let maestro;

  beforeEach(async () => {
    fixture = await startFixture();
    maestro = createMaestroStub(fixture.dir);
  });

  afterEach(async () => {
    fixture.child.kill('SIGTERM');
    await new Promise((resolve) => fixture.child.once('exit', resolve));
    fs.rmSync(fixture.dir, { recursive: true, force: true });
  });

  function environment(overrides = {}) {
    return {
      E2E_SERVER_TOKEN: 'test-key',
      E2E_MOCK_SERVER_URL: fixture.url,
      REAL_STREAMER_CONTROL_URL: fixture.url,
      REAL_STREAMER_APP_URL: 'http://10.0.2.2:8766',
      REAL_STREAMER_SESSION_PATH: '/home/demo/projects/threadbase-mobile',
      REAL_STREAMER_READY_TIMEOUT_MS: '2000',
      REAL_STREAMER_READY_POLL_MS: '10',
      MAESTRO_BIN: maestro.stub,
      MAESTRO_ARGV_LOG: maestro.log,
      FIXTURE_URL: fixture.url,
      ...overrides,
    };
  }

  it('uses the control URL for HTTP and passes the app URL to Maestro', async () => {
    const result = await runRunner(['new/leave'], environment());

    expect(result.status).toBe(0);
    const [argv] = fs.readFileSync(maestro.log, 'utf8').trim().split('\n').map(JSON.parse);
    expect(argv).toContain('E2E_MOCK_SERVER_URL=http://10.0.2.2:8766');
  });

  it('polls a 202 start at the explicit server path until the session is ready', async () => {
    const result = await runRunner(['resumed/leave'], environment());

    expect(result.status).toBe(0);
    const state = await fixture.state();
    expect(state.starts).toEqual([
      { path: '/home/demo/projects/threadbase-mobile', projectName: 'threadbase-mobile' },
    ]);
    expect(state.detailPolls).toBeGreaterThanOrEqual(2);
  });

  it('stops invocation-owned sessions without stopping a pre-existing live session', async () => {
    const result = await runRunner(['new/leave'], environment());

    expect(result.status).toBe(0);
    const state = await fixture.state();
    expect(state.stopped).toEqual(['flow-owned']);
  });
});
