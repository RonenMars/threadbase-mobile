/**
 * @jest-environment node
 *
 * This build ships no Live Activity: the widget extension (and the App Group it
 * needs) must stay out of the iOS project. If the plugins return, restore the
 * ordering test from git history (expo-widgets must be registered after the
 * two local plugins, see plugins/withLiveActivityTarget.js).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const APP_JSON = path.resolve(__dirname, '../../../app.json');

describe('live activity plugins in app.json', () => {
  it('registers none of them', () => {
    const { plugins } = JSON.parse(fs.readFileSync(APP_JSON, 'utf8')).expo;
    const names = plugins.map((entry) => (Array.isArray(entry) ? entry[0] : entry));

    expect(names).not.toContain('expo-widgets');
    expect(names).not.toContain('./plugins/withLiveActivityLogo');
    expect(names).not.toContain('./plugins/withLiveActivityTarget');
  });
});
