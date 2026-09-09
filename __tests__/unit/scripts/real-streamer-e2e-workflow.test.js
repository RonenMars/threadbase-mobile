/**
 * @jest-environment node
 */

'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const YAML = require('yaml');

const REPO_ROOT = path.resolve(__dirname, '../../..');
const WORKFLOW = path.join(REPO_ROOT, '.github/workflows/real-streamer-e2e.yml');
const ANDROID_RUNNER = path.join(REPO_ROOT, 'e2e/run-android-ci.sh');

function workflow() {
  return YAML.parse(fs.readFileSync(WORKFLOW, 'utf8'));
}

function step(job, name) {
  const found = job.steps.find((candidate) => candidate.name === name);
  expect(found).toBeDefined();
  return found;
}

describe('real-streamer E2E workflow', () => {
  it('is dispatch-only and defaults to an immutable streamer commit', () => {
    const config = workflow();
    expect(Object.keys(config.on)).toEqual(['workflow_dispatch']);
    expect(config.on.workflow_dispatch.inputs.streamer_sha.default).toMatch(/^[0-9a-f]{40}$/);
  });

  it('builds the checked-out streamer demo target with BuildKit caching', () => {
    const job = workflow().jobs['real-streamer-e2e'];
    const checkout = step(job, 'Check out pinned streamer');
    expect(checkout.with).toMatchObject({
      repository: 'RonenMars/threadbase-streamer',
      path: '.ci/threadbase-streamer',
      ref: '${{ inputs.streamer_sha }}',
    });

    const build = step(job, 'Build deterministic streamer demo image');
    expect(build.uses).toMatch(/^docker\/build-push-action@/);
    expect(build.with).toMatchObject({
      context: '.ci/threadbase-streamer',
      file: '.ci/threadbase-streamer/docker/Dockerfile',
      target: 'demo',
      load: true,
      'cache-from': expect.stringContaining('type=gha'),
      'cache-to': expect.stringContaining('type=gha'),
    });
  });

  it('probes the real backend and records reproducibility metadata', () => {
    const job = workflow().jobs['real-streamer-e2e'];
    const start = step(job, 'Start and probe streamer');
    expect(start.run).toContain('127.0.0.1:8766:8080');
    expect(start.run).toContain('/healthz');
    expect(start.run).toContain('/api/info');
    expect(start.run).toContain('Authorization: Bearer');
    for (const field of ['Container ID', 'Streamer commit', 'Image ID', 'Health response']) {
      expect(start.run).toContain(field);
    }
    expect(start.run).toContain('GITHUB_STEP_SUMMARY');
  });

  it('passes split URLs and a container path to the Android matrix', () => {
    const job = workflow().jobs['real-streamer-e2e'];
    const emulator = step(job, 'Install APK and run real-streamer matrix on Android API 35');
    expect(emulator.env).toMatchObject({
      E2E_PLATFORM: 'android',
      REAL_STREAMER_CONTROL_URL: 'http://127.0.0.1:8766',
      REAL_STREAMER_APP_URL: 'http://10.0.2.2:8766',
      REAL_STREAMER_SESSION_PATH: '/home/demo/projects/threadbase-mobile',
    });
    expect(emulator.with.script).toBe('bash e2e/run-android-ci.sh');
  });

  it('uploads both streamer and Maestro evidence on failure and always tears down exact resources', () => {
    const job = workflow().jobs['real-streamer-e2e'];
    const artifacts = step(job, 'Upload failure artifacts');
    expect(artifacts.if).toContain('failure()');
    expect(artifacts.with.path).toContain('e2e/_artifacts/streamer.log');
    expect(artifacts.with.path).toContain('e2e/_artifacts/debug');

    const cleanup = step(job, 'Stop streamer');
    expect(cleanup.if).toContain('always()');
    expect(cleanup.run).toContain('docker rm --force "$CONTAINER_NAME"');
    expect(cleanup.run).toContain('docker volume rm "$VOLUME_NAME"');
  });
});

describe('run-android-ci.sh real-streamer branch', () => {
  it('runs the leave-navigation controller without starting the mock suite', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'real-streamer-android-'));
    const bin = path.join(dir, 'bin');
    const apk = path.join(dir, 'app-release.apk');
    const nodeLog = path.join(dir, 'node.log');
    const npmLog = path.join(dir, 'npm.log');
    fs.mkdirSync(bin);
    fs.writeFileSync(apk, 'apk');
    fs.writeFileSync(
      path.join(bin, 'adb'),
      `#!/bin/bash
        case "$*" in
          *"getprop sys.boot_completed"*) echo 1 ;;
        esac
        exit 0
      `,
      { mode: 0o755 },
    );
    fs.writeFileSync(path.join(bin, 'node'), `#!/bin/bash\nprintf '%s\\n' "$*" >> "${nodeLog}"\n`, {
      mode: 0o755,
    });
    fs.writeFileSync(path.join(bin, 'npm'), `#!/bin/bash\nprintf '%s\\n' "$*" >> "${npmLog}"\n`, {
      mode: 0o755,
    });

    const result = spawnSync('/bin/bash', [ANDROID_RUNNER], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${bin}:/usr/bin:/bin`,
        E2E_RELEASE_APK: apk,
        REAL_STREAMER_CONTROL_URL: 'http://127.0.0.1:8766',
      },
    });

    try {
      expect(result.status).toBe(0);
      expect(fs.readFileSync(nodeLog, 'utf8').trim()).toBe('e2e/run-leave-nav.js');
      expect(fs.existsSync(npmLog)).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
