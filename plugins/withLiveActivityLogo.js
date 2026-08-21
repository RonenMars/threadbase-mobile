// Adds the Threadbase logo to the Live Activity widget extension's asset
// catalog so `<Image assetName="ThreadbaseLogo" />` resolves inside
// SessionLiveActivity.tsx. `Image(assetName)` (SwiftUI) looks the name up in
// the extension's own bundle, and expo-widgets does not create an .xcassets
// for the widget target — so this plugin creates one and links it into the
// target's Resources build phase.
//
// withWidgetSourceFiles (expo-widgets) deletes and regenerates the whole
// ExpoWidgetsTarget directory on every prebuild as a dangerous mod, and all
// dangerous mods across all plugins run before any other mod type. Writing
// the asset catalog from a dangerous mod of our own is therefore a race —
// depending on plugin resolution order it can run before expo-widgets' and
// get wiped. `withXcodeProject` mods run after every dangerous mod completes,
// so the file write happens there instead, right before the pbxproj wiring.
//
// Within the withXcodeProject chain, @expo/config-plugins runs the
// *last*-registered mod *first* (each mod wraps the previously registered
// one as `nextMod` and calls it after its own action). Registration order is
// app.json array order, so to have expo-widgets create ExpoWidgetsTarget
// before this plugin looks for it, this plugin must be listed BEFORE
// expo-widgets in app.json's `plugins` array — not after.

const fs = require('fs');
const path = require('path');

const expoPkgPath = require.resolve('expo/package.json');
const configPluginsEntry = require.resolve('@expo/config-plugins', { paths: [expoPkgPath] });
const { withXcodeProject, IOSConfig } = require(configPluginsEntry);

const WIDGET_TARGET = 'ExpoWidgetsTarget';
const ASSET_NAME = 'ThreadbaseLogo';
// eslint-disable-next-line no-undef -- CommonJS global, available at runtime; plugins/ isn't in eslint's node globals scope (same gap as scripts/*.js)
const SOURCE_LOGO = path.join(__dirname, 'assets', 'threadbase-logo.png');

function findNativeTargetUuid(project, name) {
  const targets = project.pbxNativeTargetSection();
  for (const [uuid, target] of Object.entries(targets)) {
    if (uuid.endsWith('_comment') || !target || !target.productType) continue;
    if (String(target.name).replace(/^"|"$/g, '') === name) return uuid;
  }
  return null;
}

function writeImageSet(targetDirectory) {
  const xcassetsDir = path.join(targetDirectory, 'Assets.xcassets');
  const imageSetDir = path.join(xcassetsDir, `${ASSET_NAME}.imageset`);
  fs.mkdirSync(imageSetDir, { recursive: true });

  fs.writeFileSync(
    path.join(xcassetsDir, 'Contents.json'),
    JSON.stringify({ info: { author: 'xcode', version: 1 } }, null, 2),
  );

  fs.copyFileSync(SOURCE_LOGO, path.join(imageSetDir, 'threadbase-logo.png'));
  fs.writeFileSync(
    path.join(imageSetDir, 'Contents.json'),
    JSON.stringify(
      {
        images: [
          { filename: 'threadbase-logo.png', idiom: 'universal', scale: '1x' },
          { filename: 'threadbase-logo.png', idiom: 'universal', scale: '2x' },
          { filename: 'threadbase-logo.png', idiom: 'universal', scale: '3x' },
        ],
        info: { author: 'xcode', version: 1 },
      },
      null,
      2,
    ),
  );

  return xcassetsDir;
}

const withLiveActivityLogo = (config) => {
  return withXcodeProject(config, (cfg) => {
    const targetDirectory = path.join(cfg.modRequest.platformProjectRoot, WIDGET_TARGET);
    writeImageSet(targetDirectory);

    const project = cfg.modResults;
    const targetUuid = findNativeTargetUuid(project, WIDGET_TARGET);
    if (!targetUuid) {
      throw new Error(
        `[live-activity-logo] Could not find native target '${WIDGET_TARGET}' in project.pbxproj.`,
      );
    }

    // addFileToGroupAndLink (inside addResourceFileToGroup) already skips
    // re-adding a file whose basename is already a child of the group, so this
    // is safe to run on every prebuild without checking first.
    IOSConfig.XcodeUtils.addResourceFileToGroup({
      filepath: 'Assets.xcassets',
      groupName: WIDGET_TARGET,
      project,
      targetUuid,
    });

    return cfg;
  });
};

module.exports = withLiveActivityLogo;
