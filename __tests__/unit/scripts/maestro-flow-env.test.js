/**
 * @jest-environment node
 *
 * Two harness guards that fail silently and expensively when they regress.
 *
 * `run-maestro.js` must pass E2E_MOCK_SERVER_URL through with `-e`: Maestro
 * resolves `${VAR}` in a flow only from that flag, never from the environment,
 * so without it the app dials the literal host `undefined` and every onboarding
 * flow fails on a later, unrelated-looking assertion.
 *
 * `wait-for-mock.js` must fail loudly when nothing is listening, rather than
 * letting the suite run against a mock server that died during startup.
 */

'use strict';

const { spawnSync } = require('child_process');
const net = require('net');
const fs = require('fs');
const os = require('os');
const path = require('path');

const RUN_MAESTRO = path.resolve(__dirname, '../../../e2e/run-maestro.js');
const WAIT_FOR_MOCK = path.resolve(__dirname, '../../../e2e/wait-for-mock.js');

/** Runs run-maestro.js with a stub `maestro` that records its argv. */
function runWithStub(args, env) {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-stub-'));
  const argvLog = path.join(bin, 'argv.log');
  fs.writeFileSync(path.join(bin, 'maestro'), `#!/bin/bash\necho "$@" > "${argvLog}"\nexit 0\n`, {
    mode: 0o755,
  });

  const result = spawnSync(process.execPath, [RUN_MAESTRO, ...args], {
    env: { PATH: `${bin}:/usr/bin:/bin`, MAESTRO_BIN: path.join(bin, 'maestro'), ...env },
    encoding: 'utf8',
  });

  const argv = fs.existsSync(argvLog) ? fs.readFileSync(argvLog, 'utf8').trim() : '';
  fs.rmSync(bin, { recursive: true, force: true });
  return { ...result, argv };
}

describe('run-maestro.js flow variables', () => {
  it('passes E2E_MOCK_SERVER_URL to maestro with -e', () => {
    const { argv } = runWithStub(['test', 'e2e/launch.yaml'], {
      E2E_MOCK_SERVER_URL: 'http://10.0.2.2:7071',
    });
    expect(argv).toContain('-e E2E_MOCK_SERVER_URL=http://10.0.2.2:7071');
  });

  it('keeps the subcommand first and the flow paths last', () => {
    const { argv } = runWithStub(['test', 'e2e/a.yaml', 'e2e/b.yaml'], {
      E2E_MOCK_SERVER_URL: 'http://localhost:7071',
    });
    expect(argv.startsWith('test ')).toBe(true);
    expect(argv.endsWith('e2e/a.yaml e2e/b.yaml')).toBe(true);
  });

  it('falls back to localhost when the variable is unset', () => {
    const { argv } = runWithStub(['test', 'e2e/launch.yaml'], {});
    expect(argv).toContain('-e E2E_MOCK_SERVER_URL=http://localhost:7071');
  });

  it("does not override a caller's own -e for the same variable", () => {
    const { argv } = runWithStub(
      ['test', '-e', 'E2E_MOCK_SERVER_URL=http://explicit:1234', 'e2e/launch.yaml'],
      { E2E_MOCK_SERVER_URL: 'http://from-env:7071' },
    );
    expect(argv).toContain('http://explicit:1234');
    expect(argv).not.toContain('from-env');
  });

  it('passes MAESTRO_UDID to Maestro after the subcommand', () => {
    const { argv } = runWithStub(['test', 'e2e/launch.yaml'], {
      MAESTRO_UDID: '1CBE2E33-AFD5-4199-B0F1-B5BFBB09A7A3',
    });
    expect(argv.startsWith('test --udid 1CBE2E33-AFD5-4199-B0F1-B5BFBB09A7A3 ')).toBe(true);
  });

  it("does not override a caller's explicit --udid", () => {
    const { argv } = runWithStub(['test', '--udid', 'caller-chosen', 'e2e/launch.yaml'], {
      MAESTRO_UDID: 'environment-chosen',
    });
    expect(argv).toContain('--udid caller-chosen');
    expect(argv).not.toContain('environment-chosen');
  });
});

describe('mock-suite flow server URLs', () => {
  // The Android emulator's localhost is the emulator itself; the mock server
  // lives on the runner host and is reached only via E2E_MOCK_SERVER_URL
  // (http://10.0.2.2:7071 in CI). A hardcoded localhost in a mock-suite flow
  // pairs against nothing on Android and fails on an onboarding assertion that
  // looks unrelated — that is what E2E run #14's 07_conversation_scroll_gaps
  // failure was.
  it('does not hardcode localhost into the mock-suite pairing URL', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../../../package.json'), 'utf8'),
    );
    const script = packageJson.scripts['test:e2e:mock'];
    const flows = [...script.matchAll(/\be2e\/[\w.-]+\.yaml\b/g)].map((m) => m[0]);
    expect(flows.length).toBeGreaterThan(0);

    const offenders = [];
    for (const flow of flows) {
      const content = fs.readFileSync(path.resolve(__dirname, '../../..', flow), 'utf8');
      if (/inputText:\s*"http:\/\/localhost(?::\d+)?"/.test(content)) {
        offenders.push(flow);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('wait-for-mock.js', () => {
  it('exits 0 once something is listening', (done) => {
    const server = net.createServer().listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      const result = spawnSync(process.execPath, [WAIT_FOR_MOCK, String(port)], {
        encoding: 'utf8',
        env: { ...process.env, E2E_MOCK_WAIT_MS: '3000' },
      });
      server.close();
      expect(result.status).toBe(0);
      done();
    });
  });

  it('fails with an actionable message when nothing binds', () => {
    // Port 1 is privileged and never our mock server.
    const result = spawnSync(process.execPath, [WAIT_FOR_MOCK, '1'], {
      encoding: 'utf8',
      env: { ...process.env, E2E_MOCK_WAIT_MS: '300' },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/never accepted a connection/i);
    expect(result.stderr).toMatch(/EADDRINUSE/);
  });
});
