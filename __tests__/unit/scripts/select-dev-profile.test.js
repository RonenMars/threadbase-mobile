/**
 * @jest-environment node
 *
 * Tests for scripts/select-dev-profile.py, which dev-device.sh uses to pick the
 * provisioning profile per target. Fixtures are bare plists (the script accepts
 * them as well as CMS-wrapped profiles), so this runs without `security`.
 */

'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../../..');
const SCRIPT = path.join(REPO_ROOT, 'scripts/select-dev-profile.py');
const APP_ENTITLEMENTS = path.join(REPO_ROOT, 'ios/Threadbase/Threadbase.entitlements');
const WIDGET_ENTITLEMENTS = path.join(REPO_ROOT, 'ios/ExpoWidgetsTarget/ExpoWidgetsTarget.entitlements');
const APP = 'com.ronenmars.threadbase';
const WIDGET = 'com.ronenmars.threadbase.widgets';
const TIME_SENSITIVE = 'com.apple.developer.usernotifications.time-sensitive';

function plistValue(value) {
  if (value === true) return '<true/>';
  if (value === false) return '<false/>';
  if (value instanceof Date) return `<date>${value.toISOString().replace(/\.\d+Z$/, 'Z')}</date>`;
  if (Array.isArray(value)) return `<array>${value.map(plistValue).join('')}</array>`;
  if (typeof value === 'object') {
    return `<dict>${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `<key>${k}</key>${plistValue(v)}`)
      .join('')}</dict>`;
  }
  return `<string>${value}</string>`;
}

const days = (n) => new Date(Date.now() + n * 86400000);

/** A development profile for the app granting everything it declares; override per case. */
function profile({ uuid, bundle = APP, created = days(-10), expires = days(300), entitlements = {}, ...rest }) {
  return {
    UUID: uuid,
    Name: `Profile ${uuid}`,
    CreationDate: created,
    ExpirationDate: expires,
    ProvisionedDevices: ['00008150-00115DEA1A40401C'],
    ...rest,
    Entitlements: {
      'application-identifier': `GUW6BN8X57.${bundle}`,
      'get-task-allow': true,
      'aps-environment': 'development',
      'com.apple.security.application-groups': ['group.com.ronenmars.threadbase'],
      [TIME_SENSITIVE]: true,
      ...entitlements,
    },
  };
}

function run(bundle, entitlements, profiles) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'select-dev-profile-'));
  for (const p of profiles) {
    const body = `<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0">${plistValue(p)}</plist>\n`;
    fs.writeFileSync(path.join(dir, `${p.UUID}.mobileprovision`), body);
  }
  const res = spawnSync('python3', [SCRIPT, bundle, entitlements, dir], { encoding: 'utf8' });
  return { status: res.status, uuid: res.stdout.trim(), stderr: res.stderr };
}

describe('select-dev-profile.py', () => {
  it('picks the regenerated profile over a stale one missing Time Sensitive', () => {
    const res = run(APP, APP_ENTITLEMENTS, [
      profile({ uuid: 'old', created: days(-60), entitlements: { [TIME_SENSITIVE]: undefined } }),
      profile({ uuid: 'new', created: days(-1) }),
    ]);
    expect(res).toMatchObject({ status: 0, uuid: 'new' });
  });

  it('picks Development over a newer Ad Hoc profile that also lists devices', () => {
    const res = run(APP, APP_ENTITLEMENTS, [
      profile({ uuid: 'adhoc', created: days(-1), entitlements: { 'get-task-allow': false } }),
      profile({ uuid: 'dev', created: days(-30) }),
    ]);
    expect(res).toMatchObject({ status: 0, uuid: 'dev' });
  });

  it('picks the newest of several valid profiles regardless of file order', () => {
    const profiles = [
      profile({ uuid: 'b-middle', created: days(-20) }),
      profile({ uuid: 'c-newest', created: days(-2) }),
      profile({ uuid: 'a-oldest', created: days(-40) }),
    ];
    expect(run(APP, APP_ENTITLEMENTS, profiles).uuid).toBe('c-newest');
    expect(run(APP, APP_ENTITLEMENTS, [...profiles].reverse()).uuid).toBe('c-newest');
  });

  it('rejects an expired profile even when it is the newest', () => {
    const res = run(APP, APP_ENTITLEMENTS, [
      profile({ uuid: 'expired', created: days(-1), expires: days(-1) }),
      profile({ uuid: 'valid', created: days(-30) }),
    ]);
    expect(res.uuid).toBe('valid');
  });

  it('rejects an app profile missing Time Sensitive Notifications', () => {
    const res = run(APP, APP_ENTITLEMENTS, [profile({ uuid: 'no-ts', entitlements: { [TIME_SENSITIVE]: undefined } })]);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('Profile no-ts (no-ts): missing Time Sensitive Notifications');
  });

  it('accepts a widget profile without Time Sensitive, since the widget does not declare it', () => {
    const res = run(WIDGET, WIDGET_ENTITLEMENTS, [
      profile({ uuid: 'widget', bundle: WIDGET, entitlements: { [TIME_SENSITIVE]: undefined, 'aps-environment': undefined } }),
    ]);
    expect(res).toMatchObject({ status: 0, uuid: 'widget' });
  });

  it('rejects a profile for a different bundle, including the widget profile for the app', () => {
    const res = run(APP, APP_ENTITLEMENTS, [profile({ uuid: 'widget', bundle: WIDGET })]);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('1 other installed profiles: wrong bundle ID');
  });

  it('rejects an Xcode-managed profile, which manual signing refuses', () => {
    const res = run(APP, APP_ENTITLEMENTS, [profile({ uuid: 'managed', IsXcodeManaged: true })]);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('Xcode-managed');
  });

  it('explains every rejection when nothing qualifies', () => {
    const res = run(APP, APP_ENTITLEMENTS, [
      profile({ uuid: 'adhoc', entitlements: { 'get-task-allow': false } }),
      profile({ uuid: 'appstore', ProvisionedDevices: undefined, entitlements: { 'get-task-allow': false } }),
      profile({ uuid: 'expired', expires: days(-1) }),
      profile({ uuid: 'no-groups', entitlements: { 'com.apple.security.application-groups': undefined } }),
    ]);
    expect(res.status).toBe(1);
    expect(res.uuid).toBe('');
    expect(res.stderr).toContain(`No usable development profile for ${APP}.`);
    expect(res.stderr).toContain('Profile adhoc (adhoc): Ad Hoc instead of Development');
    expect(res.stderr).toContain('Profile appstore (appstore): App Store instead of Development');
    expect(res.stderr).toContain('Profile expired (expired): expired');
    expect(res.stderr).toContain('Profile no-groups (no-groups): missing App Groups');
    expect(res.stderr).toContain('Push Notifications, Time Sensitive Notifications, App Groups');
  });
});
