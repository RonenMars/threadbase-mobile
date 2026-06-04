// Adds a `signingConfigs.release` block to android/app/build.gradle that
// reads the keystore + passwords from env vars (or gradle properties), and
// switches buildTypes.release to use it. Idempotent across `expo prebuild`.
//
// Env vars (set by scripts/bootstrap-android-signing.sh):
//   TB_MOBILE_UPLOAD_KEYSTORE          — absolute path to the .keystore file
//   TB_MOBILE_UPLOAD_KEYSTORE_PASSWORD
//   TB_MOBILE_UPLOAD_KEY_ALIAS         — default "upload"
//   TB_MOBILE_UPLOAD_KEY_PASSWORD

// @expo/config-plugins is not a top-level dep; it lives under expo. Resolve
// through expo so we always pick up the same copy expo prebuild itself uses.
const expoPkgPath = require.resolve('expo/package.json');
const configPluginsEntry = require.resolve('@expo/config-plugins', { paths: [expoPkgPath] });
const { withAppBuildGradle } = require(configPluginsEntry);
const { mergeContents } = require(require.resolve('@expo/config-plugins/build/utils/generateCode', { paths: [expoPkgPath] }));

const TAG = 'android-release-signing';

const RELEASE_SIGNING_BLOCK = `        release {
            def ksPath = findProperty('TB_MOBILE_UPLOAD_KEYSTORE') ?: System.getenv('TB_MOBILE_UPLOAD_KEYSTORE')
            def ksPass = findProperty('TB_MOBILE_UPLOAD_KEYSTORE_PASSWORD') ?: System.getenv('TB_MOBILE_UPLOAD_KEYSTORE_PASSWORD')
            def kAlias = findProperty('TB_MOBILE_UPLOAD_KEY_ALIAS') ?: System.getenv('TB_MOBILE_UPLOAD_KEY_ALIAS') ?: 'upload'
            def kPass  = findProperty('TB_MOBILE_UPLOAD_KEY_PASSWORD') ?: System.getenv('TB_MOBILE_UPLOAD_KEY_PASSWORD')
            if (gradle.startParameter.taskNames.any { it.toLowerCase().contains('release') } && (ksPath == null || ksPass == null || kPass == null)) {
                throw new GradleException('Release build requested but TB_MOBILE_UPLOAD_KEYSTORE / _PASSWORD / _KEY_PASSWORD env vars are not set. Source fastlane/.env.signing.android first.')
            }
            if (ksPath != null) {
                storeFile file(ksPath)
                storePassword ksPass
                keyAlias kAlias
                keyPassword kPass
            }
        }`;

function addReleaseSigningConfig(contents) {
  // mergeContents.addLines splits contents by '\n' and tests the anchor regex
  // against ONE line at a time (per @expo/config-plugins generateCode.js:81).
  // So the anchor must be a single-line regex, and `offset` shifts insertion
  // forward from that matched line.
  //
  // Template shape (Expo SDK 56, verified 2026-06-04):
  //     signingConfigs {
  //         debug {
  //             ...
  //             keyPassword 'android'    <- anchor (unique in the file)
  //         }
  //     }                                <- we want to insert BEFORE this line
  //     buildTypes {
  //
  // Anchor: the `keyPassword 'android'` line (unique). With offset 2, the
  // insertion lands at the line currently holding the outer `}` of
  // signingConfigs, pushing it down — i.e. right before the closing brace,
  // which puts our `release { ... }` block inside `signingConfigs { }`.
  const result = mergeContents({
    src: contents,
    newSrc: RELEASE_SIGNING_BLOCK,
    tag: TAG,
    anchor: /^\s+keyPassword 'android'\s*$/,
    offset: 2,
    comment: '//',
  });
  // mergeContents returns {didMerge:false, didClear:false} when the existing
  // @generated block already contains the same content hash — i.e. nothing
  // to do. That's a success, not a failure. We only fail when the file lacks
  // the tag AND mergeContents didn't merge (anchor didn't match).
  const alreadyApplied = contents.includes(`@generated begin ${TAG}`);
  if (!result.didMerge && !result.didClear && !alreadyApplied) {
    throw new Error(
      `[${TAG}] Failed to insert release signingConfig block. ` +
      `Anchor (keyPassword 'android' line) did not match. ` +
      `The Expo prebuild template for android/app/build.gradle may have changed.`,
    );
  }
  return result.contents;
}

function swapReleaseSigningConfig(contents) {
  // The line `signingConfig signingConfigs.debug` appears twice in the
  // template (debug and release buildTypes). We need to swap only the release
  // one. The release occurrence is uniquely preceded by a comment line
  // pointing to reactnative.dev/docs/signed-apk-android.
  //
  // Match the comment + the offending line together so we only swap once.
  const RELEASE_DEBUG_SIG = /(\/\/ see https:\/\/reactnative\.dev\/docs\/signed-apk-android\.\n\s+)signingConfig signingConfigs\.debug\b/;
  if (!RELEASE_DEBUG_SIG.test(contents)) {
    // Either the template changed, or we've already swapped on a prior
    // prebuild run. Check whether release is already wired to release config;
    // if so, this is idempotent re-entry and we silently succeed.
    if (/buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?signingConfig signingConfigs\.release/.test(contents)) {
      return contents;
    }
    throw new Error(
      `[${TAG}] Could not find the release buildType's 'signingConfig signingConfigs.debug' line ` +
      `(anchored on the reactnative.dev signed-apk-android comment). ` +
      `The Expo prebuild template may have changed.`,
    );
  }
  return contents.replace(RELEASE_DEBUG_SIG, '$1signingConfig signingConfigs.release');
}

const withAndroidReleaseSigning = (config) => {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error(
        `[${TAG}] Expected android/app/build.gradle to be Groovy, got ${cfg.modResults.language}.`,
      );
    }
    let contents = cfg.modResults.contents;
    contents = addReleaseSigningConfig(contents);
    contents = swapReleaseSigningConfig(contents);
    cfg.modResults.contents = contents;
    return cfg;
  });
};

module.exports = withAndroidReleaseSigning;
