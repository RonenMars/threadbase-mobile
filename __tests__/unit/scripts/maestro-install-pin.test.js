/**
 * @jest-environment node
 *
 * `MAESTRO_VERSION=... curl ... | bash` gives the version only to curl, so the
 * installer silently downloads its latest release. This test executes the
 * workflow's install block against a local installer stand-in and verifies
 * that the installer process receives the pinned version.
 */

'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../../..');
const WORKFLOW = path.join(REPO_ROOT, '.github/workflows/e2e.yml');

function maestroInstallScript() {
  const source = fs.readFileSync(WORKFLOW, 'utf8');
  const start = source.indexOf('      - name: Install Maestro CLI\n');
  expect(start).toBeGreaterThan(-1);

  const step = source.slice(start);
  const match = step.match(/^        run: \|\n((?:          .*\n)+)/m);
  expect(match).not.toBeNull();
  return match[1].replace(/^          /gm, '');
}

function writeFakeCurl(binDirectory, installedVersion) {
  const curlPath = path.join(binDirectory, 'curl');
  fs.writeFileSync(
    curlPath,
    `#!/bin/sh
cat <<'INSTALLER'
printf '%s' "\${MAESTRO_VERSION:-}" > "$OUTPUT_FILE"
mkdir -p "$HOME/.maestro/bin"
printf '%s\\n' '#!/bin/sh' 'echo "${installedVersion}"' > "$HOME/.maestro/bin/maestro"
chmod +x "$HOME/.maestro/bin/maestro"
INSTALLER
`,
  );
  fs.chmodSync(curlPath, 0o755);
}

function runInstallStep(installedVersion) {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-install-pin-'));
  const binDirectory = path.join(tempDirectory, 'bin');
  const outputFile = path.join(tempDirectory, 'installer-version');
  fs.mkdirSync(binDirectory);
  writeFakeCurl(binDirectory, installedVersion);

  const env = {
    ...process.env,
    PATH: `${binDirectory}:${process.env.PATH}`,
    HOME: tempDirectory,
    OUTPUT_FILE: outputFile,
    GITHUB_PATH: path.join(tempDirectory, 'github-path'),
  };
  delete env.MAESTRO_VERSION;

  const result = childProcess.spawnSync('/bin/bash', ['-e'], {
    cwd: REPO_ROOT,
    env,
    input: maestroInstallScript(),
    encoding: 'utf8',
  });

  return { outputFile, result, tempDirectory };
}

test('passes the pinned version to the Maestro installer process', () => {
  const { outputFile, result, tempDirectory } = runInstallStep('2.8.0');

  try {
    expect(result.status).toBe(0);
    expect(fs.readFileSync(outputFile, 'utf8')).toBe('2.8.0');
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
});

test('stops setup when the installed Maestro version differs from the pin', () => {
  const { result, tempDirectory } = runInstallStep('2.9.0');

  try {
    expect(result.status).not.toBe(0);
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
});
