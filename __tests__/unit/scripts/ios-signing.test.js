/**
 * @jest-environment node
 *
 * Guards the manual-signing pipeline for the app + widget extension.
 */

'use strict';

/* global Buffer, __dirname */

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../../..');
const BOOTSTRAP = path.join(REPO_ROOT, 'scripts/bootstrap-ios-signing.sh');
const EXPORT_TEMPLATE = path.join(REPO_ROOT, 'scripts/ExportOptions.template.plist');
const ARCHIVE = path.join(REPO_ROOT, 'scripts/archive-and-upload.sh');
const BASH = '/bin/bash';

function run(script, cwd, env) {
  try {
    const stdout = execFileSync(BASH, [script], {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
    });
    return { stdout, stderr: '', code: 0 };
  } catch (error) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      code: error.status ?? 1,
    };
  }
}

function makeBootstrapFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ios-signing-'));
  const scripts = path.join(root, 'scripts');
  const bin = path.join(root, 'bin');
  fs.mkdirSync(scripts);
  fs.mkdirSync(bin);
  fs.mkdirSync(path.join(root, 'runner'));
  fs.copyFileSync(BOOTSTRAP, path.join(scripts, 'bootstrap-ios-signing.sh'));
  fs.copyFileSync(EXPORT_TEMPLATE, path.join(scripts, 'ExportOptions.template.plist'));
  fs.writeFileSync(path.join(bin, 'security'), '#!/bin/bash\nexit 0\n', { mode: 0o755 });
  return { root, bin };
}

function bootstrapEnv(root, bin, overrides = {}) {
  return {
    HOME: path.join(root, 'home'),
    RUNNER_TEMP: path.join(root, 'runner'),
    PATH: `${bin}${path.delimiter}${process.env.PATH}`,
    ASC_KEY_ID: 'key-id',
    ASC_ISSUER_ID: 'issuer-id',
    ASC_TEAM_ID: 'team-id',
    ASC_AUTH_KEY_B64: Buffer.from(
      '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n',
    ).toString('base64'),
    IOS_DIST_CERT_P12_B64: Buffer.from('certificate').toString('base64'),
    IOS_DIST_CERT_PASSWORD: 'password',
    IOS_PROVISION_PROFILE_B64: Buffer.from('app-profile').toString('base64'),
    IOS_PROVISION_PROFILE_UUID: 'app-profile-uuid',
    IOS_WIDGET_PROVISION_PROFILE_B64: Buffer.from('widget-profile').toString('base64'),
    IOS_WIDGET_PROVISION_PROFILE_UUID: 'widget-profile-uuid',
    ...overrides,
  };
}

describe('bootstrap-ios-signing.sh', () => {
  let fixture;

  afterEach(() => {
    if (fixture) fs.rmSync(fixture.root, { recursive: true, force: true });
  });

  it('installs and exports distinct app and widget provisioning profiles', () => {
    fixture = makeBootstrapFixture();
    const script = path.join(fixture.root, 'scripts/bootstrap-ios-signing.sh');
    const result = run(script, fixture.root, bootstrapEnv(fixture.root, fixture.bin));

    expect(result.code).toBe(0);
    const profiles = path.join(
      fixture.root,
      'home/Library/MobileDevice/Provisioning Profiles',
    );
    expect(fs.readFileSync(path.join(profiles, 'app-profile-uuid.mobileprovision'), 'utf8'))
      .toBe('app-profile');
    expect(fs.readFileSync(path.join(profiles, 'widget-profile-uuid.mobileprovision'), 'utf8'))
      .toBe('widget-profile');

    const exportOptions = fs.readFileSync(
      path.join(fixture.root, 'build/ExportOptions.plist'),
      'utf8',
    );
    expect(exportOptions).toContain(
      '<key>com.ronenmars.threadbase</key><string>app-profile-uuid</string>',
    );
    expect(exportOptions).toContain(
      '<key>com.ronenmars.threadbase.widgets</key><string>widget-profile-uuid</string>',
    );

    const signingEnv = fs.readFileSync(path.join(fixture.root, '.env.signing'), 'utf8');
    expect(signingEnv).toContain('IOS_PROVISION_PROFILE_UUID="app-profile-uuid"');
    expect(signingEnv).toContain(
      'IOS_WIDGET_PROVISION_PROFILE_UUID="widget-profile-uuid"',
    );
  });

  it('fails before archiving when the widget profile UUID is missing', () => {
    fixture = makeBootstrapFixture();
    const script = path.join(fixture.root, 'scripts/bootstrap-ios-signing.sh');
    const result = run(
      script,
      fixture.root,
      bootstrapEnv(fixture.root, fixture.bin, {
        IOS_WIDGET_PROVISION_PROFILE_UUID: '',
      }),
    );

    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain('IOS_WIDGET_PROVISION_PROFILE_UUID');
  });
});

describe('archive-and-upload.sh', () => {
  let root;

  afterEach(() => {
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  it('passes separate profile variables without a global profile override', () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'ios-archive-'));
    const bin = path.join(root, 'bin');
    const log = path.join(root, 'xcodebuild.log');
    fs.mkdirSync(bin);
    fs.writeFileSync(
      path.join(root, 'app.json'),
      JSON.stringify({ expo: { ios: { buildNumber: '175' } } }),
    );
    fs.writeFileSync(
      path.join(bin, 'xcodebuild'),
      '#!/bin/bash\nprintf "%s\\n" "$@" > "$XCODEBUILD_LOG"\nexit 65\n',
      { mode: 0o755 },
    );

    const result = run(ARCHIVE, root, {
      PATH: `${bin}${path.delimiter}${process.env.PATH}`,
      XCODEBUILD_LOG: log,
      ASC_KEY_ID: 'key-id',
      ASC_ISSUER_ID: 'issuer-id',
      ASC_TEAM_ID: 'team-id',
      ASC_KEY_PATH: '/tmp/key.p8',
      EXPORT_OPTIONS_PLIST: '/tmp/ExportOptions.plist',
      IOS_PROVISION_PROFILE_UUID: 'app-profile-uuid',
      IOS_WIDGET_PROVISION_PROFILE_UUID: 'widget-profile-uuid',
    });

    expect(result.code).toBe(65);
    const args = fs.readFileSync(log, 'utf8').trim().split('\n');
    expect(args).toContain('IOS_PROVISION_PROFILE_UUID=app-profile-uuid');
    expect(args).toContain('IOS_WIDGET_PROVISION_PROFILE_UUID=widget-profile-uuid');
    expect(args.some((arg) => arg.startsWith('PROVISIONING_PROFILE_SPECIFIER=')))
      .toBe(false);
  });
});
