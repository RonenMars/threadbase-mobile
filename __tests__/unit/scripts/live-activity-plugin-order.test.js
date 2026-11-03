/**
 * @jest-environment node
 *
 * @expo/config-plugins runs the *last*-registered withXcodeProject mod
 * *first* (each mod wraps the previously registered one as `nextMod` and
 * calls it after its own action completes) — so app.json's `plugins` array
 * order is the *reverse* of execution order for these three. expo-widgets
 * must execute first to create ExpoWidgetsTarget, so it must be listed
 * *after* the two local Live Activity plugins in the array. Getting this
 * backwards makes `expo prebuild --clean` throw
 * "Could not find native target 'ExpoWidgetsTarget'" — see
 * plugins/withLiveActivityLogo.js and plugins/withLiveActivityTarget.js.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const APP_JSON = path.resolve(__dirname, '../../../app.json');

function pluginArrayIndex(plugins, name) {
  return plugins.findIndex((entry) => (Array.isArray(entry) ? entry[0] : entry) === name);
}

describe('live activity plugin order in app.json', () => {
  it('registers the local Live Activity plugins before expo-widgets', () => {
    const { expo } = JSON.parse(fs.readFileSync(APP_JSON, 'utf8'));
    const { plugins } = expo;

    const logoIndex = pluginArrayIndex(plugins, './plugins/withLiveActivityLogo');
    const targetIndex = pluginArrayIndex(plugins, './plugins/withLiveActivityTarget');
    const widgetsIndex = pluginArrayIndex(plugins, 'expo-widgets');

    expect(logoIndex).toBeGreaterThan(-1);
    expect(targetIndex).toBeGreaterThan(-1);
    expect(widgetsIndex).toBeGreaterThan(-1);

    // Registration order (array order) is reverse of execution order, so
    // expo-widgets — which must run first to create the target — needs the
    // highest index of the three.
    expect(widgetsIndex).toBeGreaterThan(targetIndex);
    expect(widgetsIndex).toBeGreaterThan(logoIndex);
    // withLiveActivityTarget must execute before withLiveActivityLogo, so it
    // registers *later* (higher array index) — the last-registered mod runs
    // first.
    expect(targetIndex).toBeGreaterThan(logoIndex);
  });
});
