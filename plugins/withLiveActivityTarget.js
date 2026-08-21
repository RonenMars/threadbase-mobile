// Keeps the widget extension's build-phase order and manual-signing settings
// intact across `expo prebuild`.
//
// expo-widgets appends the embed phase LAST, after these script phases:
//   [Expo Dev Launcher] Strip Local Network Keys for Release
//   [CP] Embed Pods Frameworks
//   Upload Debug Symbols to Sentry
//
// Those scripts consume Threadbase.app/Info.plist, whose ProcessInfoPlistFile
// command Xcode orders AFTER the PlugIns copy. So the copy transitively depends
// on itself and the build dies with "Cycle inside Threadbase". Moving the embed
// phase to its conventional slot right after Resources breaks the loop.
//
// Without this plugin the reorder is a hand edit to project.pbxproj that the
// next prebuild silently reverts — and it breaks for whoever runs prebuild, not
// whoever introduced it. See issue #424.
//
// This mod needs ExpoWidgetsTarget (and its embed phase) to already exist, and
// @expo/config-plugins runs the *last*-registered withXcodeProject mod *first*
// — so this plugin must be listed BEFORE expo-widgets in app.json's `plugins`
// array, not after. See withLiveActivityLogo.js for the same constraint.

// @expo/config-plugins is not a top-level dep; it lives under expo. Resolve
// through expo so we always pick up the same copy expo prebuild itself uses.
const expoPkgPath = require.resolve('expo/package.json');
const configPluginsEntry = require.resolve('@expo/config-plugins', { paths: [expoPkgPath] });
const { withXcodeProject } = require(configPluginsEntry);

const TAG = 'live-activity-embed-order';
const SIGNING_TAG = 'live-activity-signing';

const APP_TARGET = 'Threadbase';
const WIDGET_TARGET = 'ExpoWidgetsTarget';
const EMBED_PHASE = 'Embed Foundation Extensions';
const ANCHOR_PHASE = 'Resources';
const RELEASE_CONFIGURATION = 'Release';
const DEBUG_CONFIGURATION = 'Debug';
const PROFILE_VARIABLE_BY_TARGET = {
  [APP_TARGET]: 'IOS_PROVISION_PROFILE_UUID',
  [WIDGET_TARGET]: 'IOS_WIDGET_PROVISION_PROFILE_UUID',
};

function findNativeTarget(project, name) {
  const targets = project.pbxNativeTargetSection();
  for (const [key, target] of Object.entries(targets)) {
    if (key.endsWith('_comment') || !target || !target.productType) continue;
    // xcode quotes some string values; `name` may arrive as "Threadbase".
    if (String(target.name).replace(/^"|"$/g, '') === name) return target;
  }
  return null;
}

function indexOfPhase(buildPhases, comment) {
  return buildPhases.findIndex((phase) => phase.comment === comment);
}

function reorderEmbedPhase(project) {
  const target = findNativeTarget(project, APP_TARGET);
  if (!target) {
    throw new Error(
      `[${TAG}] Could not find native target '${APP_TARGET}' in project.pbxproj. ` +
        `If the app target was renamed, update APP_TARGET in plugins/withLiveActivityTarget.js.`,
    );
  }

  const buildPhases = target.buildPhases;
  const embedIndex = indexOfPhase(buildPhases, EMBED_PHASE);
  if (embedIndex === -1) {
    throw new Error(
      `[${TAG}] Target '${APP_TARGET}' has no '${EMBED_PHASE}' build phase. ` +
        `expo-widgets should have added it — check that the expo-widgets plugin runs before this one in app.json.`,
    );
  }

  const anchorIndex = indexOfPhase(buildPhases, ANCHOR_PHASE);
  if (anchorIndex === -1) {
    throw new Error(
      `[${TAG}] Target '${APP_TARGET}' has no '${ANCHOR_PHASE}' build phase to anchor on. ` +
        `The Expo prebuild template may have changed.`,
    );
  }

  const desiredIndex = anchorIndex + 1;
  // Idempotent: a second prebuild finds the phase already in place and does
  // nothing, rather than shifting it again.
  if (embedIndex === desiredIndex) return false;
  if (embedIndex < anchorIndex) {
    throw new Error(
      `[${TAG}] '${EMBED_PHASE}' sits at ${embedIndex}, before '${ANCHOR_PHASE}' at ${anchorIndex}. ` +
        `That is not the layout this plugin was written for; the cycle fix needs re-deriving before it can be trusted.`,
    );
  }

  const [phase] = buildPhases.splice(embedIndex, 1);
  buildPhases.splice(desiredIndex, 0, phase);
  return true;
}

function configurationBuildSettings(project, targetName, configurationName) {
  const target = findNativeTarget(project, targetName);
  if (!target) {
    throw new Error(`[${SIGNING_TAG}] Could not find native target '${targetName}'.`);
  }

  const configurationList = project.pbxXCConfigurationList()[target.buildConfigurationList];
  const reference = configurationList?.buildConfigurations?.find(
    (configuration) => configuration.comment === configurationName,
  );
  const configuration = reference
    ? project.pbxXCBuildConfigurationSection()[reference.value]
    : null;
  if (!configuration?.buildSettings) {
    throw new Error(
      `[${SIGNING_TAG}] Could not find '${configurationName}' settings for '${targetName}'.`,
    );
  }

  return configuration.buildSettings;
}

function configureProvisioningProfiles(project) {
  let changed = false;

  // Both configurations, not just Release. The app and the widget each need their
  // own profile, and xcodebuild applies command-line build settings to every
  // target at once — so the per-target mapping has to live here, in the project.
  //
  // Debug still ships with CODE_SIGN_STYLE = Automatic, so this is inert by
  // default: an unset IOS_*_PROVISION_PROFILE_UUID leaves the specifier empty and
  // automatic signing behaves exactly as before. A device build opts in by
  // supplying the UUIDs and CODE_SIGN_STYLE = Manual (see scripts/dev-device.sh),
  // which is the only way to get App Groups onto a development profile — Xcode's
  // auto-managed "iOS Team Provisioning Profile" does not carry them, so an
  // on-device Debug build of this app fails to sign without it.
  for (const configurationName of [RELEASE_CONFIGURATION, DEBUG_CONFIGURATION]) {
    for (const [targetName, variable] of Object.entries(PROFILE_VARIABLE_BY_TARGET)) {
      const buildSettings = configurationBuildSettings(project, targetName, configurationName);
      const desired = `"$(${variable})"`;
      if (buildSettings.PROVISIONING_PROFILE_SPECIFIER !== desired) {
        buildSettings.PROVISIONING_PROFILE_SPECIFIER = desired;
        changed = true;
      }
    }
  }

  return changed;
}

const withLiveActivityTarget = (config) => {
  return withXcodeProject(config, (cfg) => {
    reorderEmbedPhase(cfg.modResults);
    configureProvisioningProfiles(cfg.modResults);
    return cfg;
  });
};

module.exports = withLiveActivityTarget;
// Exposed for __tests__/unit/scripts/withLiveActivityTarget.test.js: driving the
// mutations directly avoids standing up a full Expo config context just to reach them.
module.exports.configureProvisioningProfiles = configureProvisioningProfiles;
module.exports.reorderEmbedPhase = reorderEmbedPhase;
