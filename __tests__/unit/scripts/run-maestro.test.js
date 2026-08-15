/**
 * @jest-environment node
 *
 * Exercises the Maestro crash guard as a subprocess with a fake Maestro
 * executable and throwaway diagnostic-report directories. No simulator,
 * Xcode installation, or global Maestro installation is required.
 */

'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SCRIPT = path.resolve(__dirname, '../../../e2e/run-maestro.js');

function matchingReport() {
  return JSON.stringify({
    exception: {
      type: 'EXC_BAD_ACCESS',
      subtype: 'KERN_INVALID_ADDRESS at 0x0000000000000020',
    },
    faultingThread: 0,
    threads: [
      {
        triggered: true,
        frames: [
          {
            symbol: '__66-[XCTAutomationSession initWithAccessibilityFramework:dataSource:]_block_invoke',
            imageIndex: 0,
          },
        ],
      },
    ],
    usedImages: [{ CFBundleIdentifier: 'com.apple.dt.XCTAutomationSupport' }],
  });
}

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'run-maestro-'));
  const reports = path.join(root, 'DiagnosticReports');
  const retired = path.join(reports, 'Retired');
  const artifacts = path.join(root, 'artifacts');
  const fakeMaestro = path.join(root, 'fake-maestro.js');
  fs.mkdirSync(retired, { recursive: true });
  fs.writeFileSync(
    fakeMaestro,
    [
      '#!/usr/bin/env node',
      "'use strict';",
      "const { spawn } = require('child_process');",
      "const fs = require('fs');",
      "if (process.env.FAKE_ARGS_PATH) fs.writeFileSync(process.env.FAKE_ARGS_PATH, JSON.stringify(process.argv.slice(2)));",
      "if (process.env.FAKE_PARTIAL_REPORT_DELAY_MS) {",
      "  fs.writeFileSync(process.env.FAKE_REPORT_PATH, '{\\\"app_name\\\":\\\"SpringBoard\\\"}\\n');",
      "  spawn(process.execPath, ['-e', 'setTimeout(() => require(\\'fs\\').writeFileSync(process.argv[1], process.argv[2]), Number(process.argv[3]))', process.env.FAKE_REPORT_PATH, process.env.FAKE_REPORT_CONTENT, process.env.FAKE_PARTIAL_REPORT_DELAY_MS], { detached: true, stdio: 'ignore' }).unref();",
      "} else if (process.env.FAKE_ASYNC_REPORT_DELAY_MS) {",
      "  spawn(process.execPath, ['-e', 'setTimeout(() => require(\\'fs\\').writeFileSync(process.argv[1], process.argv[2]), Number(process.argv[3]))', process.env.FAKE_REPORT_PATH, process.env.FAKE_REPORT_CONTENT, process.env.FAKE_ASYNC_REPORT_DELAY_MS], { detached: true, stdio: 'ignore' }).unref();",
      "} else if (process.env.FAKE_REPORT_PATH) {",
      "  fs.writeFileSync(process.env.FAKE_REPORT_PATH, process.env.FAKE_REPORT_CONTENT);",
      "}",
      'process.exit(Number(process.env.FAKE_EXIT_CODE || 0));',
      '',
    ].join('\n'),
    { mode: 0o755 },
  );
  return { root, reports, retired, artifacts, fakeMaestro };
}

function runGuard(fixture, options = {}) {
  return spawnSync(process.execPath, [SCRIPT, ...(options.args || ['test', 'e2e/example.yaml'])], {
    encoding: 'utf8',
    env: {
      ...process.env,
      MAESTRO_BIN: fixture.fakeMaestro,
      E2E_XCTEST_DIAGNOSTIC_DIRS: [fixture.reports, fixture.retired].join(path.delimiter),
      E2E_XCTEST_CRASH_ARTIFACT_DIR: fixture.artifacts,
      E2E_XCTEST_CRASH_GRACE_MS: '30',
      E2E_XCTEST_CRASH_POLL_MS: '5',
      ...options.env,
    },
  });
}

let fixture;

afterEach(() => {
  if (fixture) fs.rmSync(fixture.root, { recursive: true, force: true });
  fixture = undefined;
});

test('a new matching XCTest crash invalidates a successful Maestro run', () => {
  fixture = makeFixture();
  const reportPath = path.join(fixture.reports, 'Threadbase-new.ips');

  const result = runGuard(fixture, {
    env: { FAKE_REPORT_PATH: reportPath, FAKE_REPORT_CONTENT: matchingReport() },
  });

  expect(result.status).not.toBe(0);
  expect(result.stderr).toMatch(/iOS XCTest infrastructure crash/i);
  expect(result.stderr).toMatch(/Maestro result is invalid/i);
  expect(result.stderr).toMatch(/hierarchy-based acceptance testing must stop/i);
  expect(result.stderr).toMatch(/Maestro #3494/i);
  expect(fs.readdirSync(fixture.artifacts)).toHaveLength(1);
});

test('a matching report that predates the run is ignored', () => {
  fixture = makeFixture();
  fs.writeFileSync(path.join(fixture.reports, 'SpringBoard-old.ips'), matchingReport());

  const result = runGuard(fixture);

  expect(result.status).toBe(0);
  expect(result.stderr).not.toMatch(/Maestro result is invalid/i);
  expect(fs.existsSync(fixture.artifacts)).toBe(false);
});

test('an unrelated EXC_BAD_ACCESS report is ignored', () => {
  fixture = makeFixture();
  const unrelated = JSON.parse(matchingReport());
  unrelated.threads[0].frames[0].symbol = 'objc_msgSend';
  const reportPath = path.join(fixture.reports, 'Unrelated-new.ips');

  const result = runGuard(fixture, {
    env: { FAKE_REPORT_PATH: reportPath, FAKE_REPORT_CONTENT: JSON.stringify(unrelated) },
  });

  expect(result.status).toBe(0);
  expect(result.stderr).not.toMatch(/Maestro result is invalid/i);
  expect(fs.existsSync(fixture.artifacts)).toBe(false);
});

test('a malformed or partially written report warns without crashing the guard', () => {
  fixture = makeFixture();
  const reportPath = path.join(fixture.reports, 'Partial-new.ips');

  const result = runGuard(fixture, {
    env: { FAKE_REPORT_PATH: reportPath, FAKE_REPORT_CONTENT: '{"exception":' },
  });

  expect(result.status).toBe(0);
  expect(result.stderr).toMatch(/Warning: could not parse new diagnostic report/i);
  expect(result.stderr).not.toMatch(/Maestro crash guard failed/i);
});

test('a matching report created under Retired is detected', () => {
  fixture = makeFixture();
  const reportPath = path.join(fixture.retired, 'SafariViewService-new.ips');

  const result = runGuard(fixture, {
    env: { FAKE_REPORT_PATH: reportPath, FAKE_REPORT_CONTENT: matchingReport() },
  });

  expect(result.status).not.toBe(0);
  expect(result.stderr).toMatch(/Maestro result is invalid/i);
  expect(fs.readdirSync(fixture.artifacts)).toHaveLength(1);
});

test('a nonzero Maestro exit status is preserved', () => {
  fixture = makeFixture();
  const reportPath = path.join(fixture.reports, 'Threadbase-failed-run.ips');

  const result = runGuard(fixture, {
    env: {
      FAKE_EXIT_CODE: '7',
      FAKE_REPORT_PATH: reportPath,
      FAKE_REPORT_CONTENT: matchingReport(),
    },
  });

  expect(result.status).toBe(7);
  expect(result.stderr).toMatch(/Maestro result is invalid/i);
});

test('caller arguments reach Maestro unmangled, without shell re-parsing', () => {
  fixture = makeFixture();
  const argsPath = path.join(fixture.root, 'args.json');
  const args = ['test', '--env', 'VALUE=a b;$(touch nope)', 'e2e/flow with spaces.yaml'];

  const result = runGuard(fixture, { args, env: { FAKE_ARGS_PATH: argsPath } });

  expect(result.status).toBe(0);

  // run-maestro injects `-e E2E_MOCK_SERVER_URL=...` after the subcommand, so the
  // received list is not identical to the caller's. What this test is about is
  // that nothing is re-parsed by a shell: every argument the caller passed must
  // arrive verbatim and in order around that injection.
  const received = JSON.parse(fs.readFileSync(argsPath, 'utf8'));
  expect(received[0]).toBe('test');
  expect(received[1]).toBe('-e');
  expect(received[2]).toMatch(/^E2E_MOCK_SERVER_URL=/);
  expect(received.slice(3)).toEqual(args.slice(1));

  expect(fs.existsSync(path.join(fixture.root, 'nope'))).toBe(false);
});

test('a matching report written after Maestro exits is found during the grace period', () => {
  fixture = makeFixture();
  const reportPath = path.join(fixture.reports, 'SpringBoard-delayed.ips');

  const result = runGuard(fixture, {
    env: {
      E2E_XCTEST_CRASH_GRACE_MS: '200',
      FAKE_ASYNC_REPORT_DELAY_MS: '20',
      FAKE_REPORT_PATH: reportPath,
      FAKE_REPORT_CONTENT: matchingReport(),
    },
  });

  expect(result.status).not.toBe(0);
  expect(result.stderr).toMatch(/Maestro result is invalid/i);
});

test('a header-only partial report is retried until its crash body is complete', () => {
  fixture = makeFixture();
  const reportPath = path.join(fixture.reports, 'SpringBoard-partial.ips');

  const result = runGuard(fixture, {
    env: {
      E2E_XCTEST_CRASH_GRACE_MS: '200',
      FAKE_PARTIAL_REPORT_DELAY_MS: '20',
      FAKE_REPORT_PATH: reportPath,
      FAKE_REPORT_CONTENT: matchingReport(),
    },
  });

  expect(result.status).not.toBe(0);
  expect(result.stderr).toMatch(/Maestro result is invalid/i);
});
