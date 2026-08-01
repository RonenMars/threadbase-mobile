/**
 * @jest-environment node
 *
 * Guards plugins/withLiveActivityTarget.js against the build-phase dependency
 * cycle it exists to prevent. Runs against the real committed project.pbxproj,
 * so a prebuild-template change that moves the anchors fails here rather than
 * as an opaque "Cycle inside Threadbase" on someone's next build.
 */

/* global __dirname */

'use strict';

const path = require('path');

const xcode = require('xcode');

const {
  configureProvisioningProfiles,
  reorderEmbedPhase,
} = require('../../../plugins/withLiveActivityTarget');

const PBXPROJ = path.resolve(
  __dirname,
  '../../../ios/Threadbase.xcodeproj/project.pbxproj',
);

const EMBED_PHASE = 'Embed Foundation Extensions';
const ANCHOR_PHASE = 'Resources';

function parseProject() {
  const project = xcode.project(PBXPROJ);
  project.parseSync();
  return project;
}

function nativeTarget(project, name) {
  return Object.values(project.pbxNativeTargetSection()).find(
    (target) => target && target.name === name,
  );
}

function appTarget(project) {
  return nativeTarget(project, 'Threadbase');
}

function buildSettings(project, targetName, configurationName) {
  const target = nativeTarget(project, targetName);
  const configurationList = project.pbxXCConfigurationList()[target.buildConfigurationList];
  const ref = configurationList.buildConfigurations.find(
    (configuration) => configuration.comment === configurationName,
  );
  return project.pbxXCBuildConfigurationSection()[ref.value].buildSettings;
}

function releaseBuildSettings(project, targetName) {
  return buildSettings(project, targetName, 'Release');
}

function debugBuildSettings(project, targetName) {
  return buildSettings(project, targetName, 'Debug');
}

function phaseNames(target) {
  return target.buildPhases.map((phase) => phase.comment);
}

describe('withLiveActivityTarget', () => {
  it('keeps the embed phase ahead of the script phases that consume Info.plist', () => {
    const target = appTarget(parseProject());
    const names = phaseNames(target);
    const embed = names.indexOf(EMBED_PHASE);

    expect(embed).toBeGreaterThan(-1);
    // The cycle comes back if any of these three precede the embed phase.
    for (const script of [
      '[Expo Dev Launcher] Strip Local Network Keys for Release',
      '[CP] Embed Pods Frameworks',
      'Upload Debug Symbols to Sentry',
    ]) {
      expect(embed).toBeLessThan(names.indexOf(script));
    }
  });

  it('is a no-op when the committed order is already correct', () => {
    expect(reorderEmbedPhase(parseProject())).toBe(false);
  });

  it('moves the phase when prebuild has appended it last', () => {
    const project = parseProject();
    const target = appTarget(project);
    const [embed] = target.buildPhases.splice(
      phaseNames(target).indexOf(EMBED_PHASE),
      1,
    );
    target.buildPhases.push(embed);

    expect(reorderEmbedPhase(project)).toBe(true);
    const names = phaseNames(target);
    expect(names.indexOf(EMBED_PHASE)).toBe(names.indexOf(ANCHOR_PHASE) + 1);
  });

  it('is idempotent — a second pass changes nothing', () => {
    const project = parseProject();
    const target = appTarget(project);
    const [embed] = target.buildPhases.splice(
      phaseNames(target).indexOf(EMBED_PHASE),
      1,
    );
    target.buildPhases.push(embed);

    reorderEmbedPhase(project);
    const afterFirst = phaseNames(target);
    expect(reorderEmbedPhase(project)).toBe(false);
    expect(phaseNames(target)).toEqual(afterFirst);
  });

  it('throws loudly when the embed phase is missing', () => {
    const project = parseProject();
    const target = appTarget(project);
    target.buildPhases = target.buildPhases.filter((p) => p.comment !== EMBED_PHASE);

    expect(() => reorderEmbedPhase(project)).toThrow(
      /live-activity-embed-order.*Embed Foundation Extensions/s,
    );
  });

  it('throws loudly when the anchor phase is missing', () => {
    const project = parseProject();
    const target = appTarget(project);
    target.buildPhases = target.buildPhases.filter((p) => p.comment !== ANCHOR_PHASE);

    expect(() => reorderEmbedPhase(project)).toThrow(
      /live-activity-embed-order.*Resources/s,
    );
  });

  it('throws loudly when the app target cannot be found', () => {
    const project = parseProject();
    appTarget(project).name = 'RenamedApp';

    expect(() => reorderEmbedPhase(project)).toThrow(
      /live-activity-embed-order.*Could not find native target/s,
    );
  });

  it('keeps distinct app and widget profile variables in Release builds', () => {
    const project = parseProject();

    expect(releaseBuildSettings(project, 'Threadbase').PROVISIONING_PROFILE_SPECIFIER)
      .toBe('"$(IOS_PROVISION_PROFILE_UUID)"');
    expect(
      releaseBuildSettings(project, 'ExpoWidgetsTarget').PROVISIONING_PROFILE_SPECIFIER,
    ).toBe('"$(IOS_WIDGET_PROVISION_PROFILE_UUID)"');
  });

  it('keeps distinct app and widget profile variables in Debug builds', () => {
    // Debug needs the same per-target mapping as Release: xcodebuild applies
    // command-line build settings to every target at once, so an on-device Debug
    // build could not otherwise give the app and the widget different profiles.
    const project = parseProject();

    expect(debugBuildSettings(project, 'Threadbase').PROVISIONING_PROFILE_SPECIFIER)
      .toBe('"$(IOS_PROVISION_PROFILE_UUID)"');
    expect(
      debugBuildSettings(project, 'ExpoWidgetsTarget').PROVISIONING_PROFILE_SPECIFIER,
    ).toBe('"$(IOS_WIDGET_PROVISION_PROFILE_UUID)"');
  });

  it('leaves Debug on automatic signing so a plain build needs no profiles', () => {
    // The specifier above is inert until someone supplies the UUIDs. If this ever
    // flips to Manual in the committed project, every Debug build starts requiring
    // provisioning profiles that most machines will not have.
    const project = parseProject();

    expect(debugBuildSettings(project, 'Threadbase').CODE_SIGN_STYLE).not.toBe('Manual');
  });

  it('restores target-specific profile variables idempotently', () => {
    const project = parseProject();
    for (const settings of [
      releaseBuildSettings(project, 'Threadbase'),
      releaseBuildSettings(project, 'ExpoWidgetsTarget'),
      debugBuildSettings(project, 'Threadbase'),
      debugBuildSettings(project, 'ExpoWidgetsTarget'),
    ]) {
      delete settings.PROVISIONING_PROFILE_SPECIFIER;
    }

    expect(configureProvisioningProfiles(project)).toBe(true);
    expect(configureProvisioningProfiles(project)).toBe(false);
    for (const get of [releaseBuildSettings, debugBuildSettings]) {
      expect(get(project, 'Threadbase').PROVISIONING_PROFILE_SPECIFIER)
        .toBe('"$(IOS_PROVISION_PROFILE_UUID)"');
      expect(get(project, 'ExpoWidgetsTarget').PROVISIONING_PROFILE_SPECIFIER)
        .toBe('"$(IOS_WIDGET_PROVISION_PROFILE_UUID)"');
    }
  });
});
