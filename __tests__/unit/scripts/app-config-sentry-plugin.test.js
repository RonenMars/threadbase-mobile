/**
 * @jest-environment node
 *
 * `@sentry/react-native/expo` warns unless organization/project are plugin
 * props. app.config.js forwards SENTRY_ORG / SENTRY_PROJECT so a local .env
 * silences that warning without committing account details in app.json.
 */

'use strict';

const appConfig = require('../../../app.config.js');
const { expo } = require('../../../app.json');

const SENTRY_PLUGIN = '@sentry/react-native/expo';

function pluginName(entry) {
  return Array.isArray(entry) ? entry[0] : entry;
}

describe('app.config.js Sentry plugin props', () => {
  const originalOrg = process.env.SENTRY_ORG;
  const originalProject = process.env.SENTRY_PROJECT;

  afterEach(() => {
    if (originalOrg === undefined) delete process.env.SENTRY_ORG;
    else process.env.SENTRY_ORG = originalOrg;
    if (originalProject === undefined) delete process.env.SENTRY_PROJECT;
    else process.env.SENTRY_PROJECT = originalProject;
  });

  it('leaves the bare plugin when org/project are unset', () => {
    delete process.env.SENTRY_ORG;
    delete process.env.SENTRY_PROJECT;

    const result = appConfig({ config: { plugins: [SENTRY_PLUGIN] } });

    expect(result.plugins).toEqual([SENTRY_PLUGIN]);
  });

  it('forwards env slugs as plugin props when both are set', () => {
    process.env.SENTRY_ORG = 'ronen-mars';
    process.env.SENTRY_PROJECT = 'threadbase';

    const result = appConfig({ config: { plugins: [SENTRY_PLUGIN] } });

    expect(result.plugins).toEqual([
      [SENTRY_PLUGIN, { organization: 'ronen-mars', project: 'threadbase' }],
    ]);
  });

  it('keeps Live Activity plugin order from app.json after the rewrite', () => {
    process.env.SENTRY_ORG = 'ronen-mars';
    process.env.SENTRY_PROJECT = 'threadbase';

    const result = appConfig({ config: expo });
    const names = result.plugins.map(pluginName);
    const sentry = result.plugins.find((entry) => pluginName(entry) === SENTRY_PLUGIN);

    expect(sentry).toEqual([
      SENTRY_PLUGIN,
      { organization: 'ronen-mars', project: 'threadbase' },
    ]);
    expect(names.indexOf('expo-widgets')).toBeGreaterThan(
      names.indexOf('./plugins/withLiveActivityTarget'),
    );
    expect(names.indexOf('./plugins/withLiveActivityTarget')).toBeGreaterThan(
      names.indexOf('./plugins/withLiveActivityLogo'),
    );
  });
});
