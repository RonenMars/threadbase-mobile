// Makes the localized iOS permission dialogs (Face ID, camera, photos,
// microphone, speech recognition, local network) survive `expo prebuild
// --clean`, which deletes and regenerates `ios/` from scratch.
//
// The other five permission strings are safe without this plugin: their
// config plugins (expo-camera, expo-image-picker, expo-speech-recognition,
// and the raw `ios.infoPlist` merge for Face ID) re-inject them from
// app.json on every prebuild. NSLocalNetworkUsageDescription has no
// app.json-backed option, so a clean prebuild falls through to
// expo-dev-launcher's own default copy, which names a tool users have never
// heard of (node_modules/expo-dev-launcher/plugin/src/withDevLauncher.ts,
// `withLocalNetworkPermission`: `if (!config.modResults.NSLocalNetworkUsageDescription) { ...set default... }`).
// And nothing regenerates the hand-added en/he/ar/ru.lproj/InfoPlist.strings
// files or their PBXVariantGroup wiring at all — --clean just deletes them.
//
// Ordering between this plugin's InfoPlist mod and expo-dev-launcher's does
// not matter: dev-launcher's is a fill-only-if-empty guard, and this plugin
// writes the key unconditionally, so it wins whichever one runs first in the
// mods.ios.infoPlist chain. Confirmed with a real `expo prebuild --clean` run
// (see the commit/PR that introduced this file for the transcript) rather
// than trusted from reading config-plugins' mod-composition code alone.
//
// File writes and pbxproj wiring share one withXcodeProject mod, mirroring
// withLiveActivityLogo.js. Unlike that plugin, nothing here actually forces
// the choice — no other plugin in this app.json deletes and regenerates
// ios/Threadbase/ wholesale the way expo-widgets nukes ios/ExpoWidgetsTarget/
// on every prebuild, so a plain dangerous mod would have been just as safe
// for the file writes. withXcodeProject is used anyway to keep the .lproj
// writes and the PBXVariantGroup wiring that depends on them together in one
// mod, the same way the logo plugin keeps its asset-catalog write next to
// the pbxproj link that depends on it.

const fs = require('fs');
const path = require('path');

const expoPkgPath = require.resolve('expo/package.json');
const configPluginsEntry = require.resolve('@expo/config-plugins', { paths: [expoPkgPath] });
const { withInfoPlist, withXcodeProject } = require(configPluginsEntry);

// Resolved through @expo/config-plugins' own dependency on `xcode` (its
// package.json pins "xcode": "^3.0.1") rather than a bare `require('xcode')`,
// so PBXFileReference objects built here come from the same `xcode` version
// that parsed `cfg.modResults` in the first place.
const xcodePkgPath = require.resolve('xcode/package.json', { paths: [path.dirname(configPluginsEntry)] });
const PbxFile = require(path.join(path.dirname(xcodePkgPath), 'lib', 'pbxFile'));

const TAG = 'localized-permission-strings';
const APP_TARGET_DIR = 'Threadbase';
const VARIANT_GROUP_NAME = 'InfoPlist.strings';
const LOCALES = ['en', 'he', 'ar', 'ru'];

const LOCAL_NETWORK_USAGE_DESCRIPTION =
  'Threadbase uses the local network to find and connect to your paired computer.';

// Source of truth: ios/Threadbase/{en,he,ar,ru}.lproj/InfoPlist.strings, as
// committed. Embedded rather than read from disk because a --clean prebuild
// wipes those files before this plugin's mods run, so by the time we could
// read them they would already be gone. Keep this in sync by hand if the
// committed .strings files change — there is no build step that does it.
const LOCALIZED_INFO_PLIST_STRINGS = {
  en: [
    ["NSFaceIDUsageDescription", "Threadbase uses Face ID to protect access to your conversations."],
    ["NSCameraUsageDescription", "Used for QR code scanning during server setup and for attaching photos to your coding sessions."],
    ["NSPhotoLibraryUsageDescription", "Used to attach photos from your library to your coding sessions."],
    ["NSMicrophoneUsageDescription", "Threadbase needs the microphone to dictate prompts."],
    ["NSSpeechRecognitionUsageDescription", "Threadbase converts your speech to text on-device."],
    ["NSLocalNetworkUsageDescription", "Threadbase uses the local network to find and connect to your paired computer."],
  ],
  he: [
    ["NSFaceIDUsageDescription", "Threadbase משתמש ב-Face ID כדי להגן על הגישה לשיחות שלך."],
    ["NSCameraUsageDescription", "משמש לסריקת קוד QR בהגדרת שרת ולצירוף תמונות לסשני הקוד שלך."],
    ["NSPhotoLibraryUsageDescription", "משמש לצירוף תמונות מהגלריה שלך לסשני הקוד שלך."],
    ["NSMicrophoneUsageDescription", "Threadbase זקוק למיקרופון כדי להכתיב פרומפטים."],
    ["NSSpeechRecognitionUsageDescription", "Threadbase ממיר את הדיבור שלך לטקסט ישירות על המכשיר."],
    ["NSLocalNetworkUsageDescription", "Threadbase משתמש ברשת המקומית כדי למצוא ולהתחבר למחשב המקושר שלך."],
  ],
  ar: [
    ["NSFaceIDUsageDescription", "يستخدم Threadbase تقنية Face ID لحماية الوصول إلى محادثاتك."],
    ["NSCameraUsageDescription", "يُستخدم لمسح رمز QR أثناء إعداد الخادم ولإرفاق الصور بجلسات الكود الخاصة بك."],
    ["NSPhotoLibraryUsageDescription", "يُستخدم لإرفاق صور من مكتبتك بجلسات الكود الخاصة بك."],
    ["NSMicrophoneUsageDescription", "يحتاج Threadbase إلى الميكروفون لإملاء البرومبتات."],
    ["NSSpeechRecognitionUsageDescription", "يحوّل Threadbase كلامك إلى نص مباشرة على الجهاز."],
    ["NSLocalNetworkUsageDescription", "يستخدم Threadbase الشبكة المحلية للعثور على الكمبيوتر المقترن بك والاتصال به."],
  ],
  ru: [
    ["NSFaceIDUsageDescription", "Threadbase использует Face ID для защиты доступа к вашим беседам."],
    ["NSCameraUsageDescription", "Используется для сканирования QR-кода при настройке сервера и для прикрепления фото к сессиям кодирования."],
    ["NSPhotoLibraryUsageDescription", "Используется для прикрепления фото из вашей библиотеки к сессиям кодирования."],
    ["NSMicrophoneUsageDescription", "Threadbase требуется микрофон для надиктовки промптов."],
    ["NSSpeechRecognitionUsageDescription", "Threadbase преобразует вашу речь в текст прямо на устройстве."],
    ["NSLocalNetworkUsageDescription", "Threadbase использует локальную сеть, чтобы найти ваш привязанный компьютер и подключиться к нему."],
  ],
};

function escapeStringsValue(value) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function serializeInfoPlistStrings(entries) {
  return entries.map(([key, value]) => `"${key}" = "${escapeStringsValue(value)}";`).join('\n') + '\n';
}

function unquote(value) {
  return typeof value === 'string' ? value.replace(/^"|"$/g, '') : value;
}

// The app's own PBXGroup, identified by name plus its Info.plist child
// rather than name alone: this project has a second, unrelated group also
// named "Threadbase" (an ExpoModulesProviders subgroup), so name matching by
// itself is ambiguous.
function findAppGroupKey(project) {
  const groups = project.hash.project.objects.PBXGroup || {};
  for (const key of Object.keys(groups)) {
    if (key.endsWith('_comment')) continue;
    const group = groups[key];
    if (!group || unquote(group.name) !== APP_TARGET_DIR) continue;
    if ((group.children || []).some((child) => child.comment === 'Info.plist')) return key;
  }
  return null;
}

function ensureVariantGroup(project) {
  const existing = project.findPBXVariantGroupKey({ name: VARIANT_GROUP_NAME });
  if (existing) return existing;
  return project.pbxCreateVariantGroup(VARIANT_GROUP_NAME);
}

function ensureGroupChild(project, parentKey, childKey, childComment) {
  const parent = project.getPBXGroupByKey(parentKey);
  if (parent.children.some((child) => child.value === childKey)) return false;
  parent.children.push({ value: childKey, comment: childComment });
  return true;
}

function ensureResourcesBuildFile(project, variantGroupKey) {
  const buildFiles = project.hash.project.objects.PBXBuildFile || {};
  const alreadyWired = Object.keys(buildFiles).some(
    (key) => !key.endsWith('_comment') && buildFiles[key] && buildFiles[key].fileRef === variantGroupKey,
  );
  if (alreadyWired) return false;

  const buildFile = {
    uuid: project.generateUuid(),
    fileRef: variantGroupKey,
    basename: VARIANT_GROUP_NAME,
    group: 'Resources', // only feeds the "X in Resources" build-file comment
  };
  project.addToPbxBuildFileSection(buildFile);
  project.addToPbxResourcesBuildPhase(buildFile);
  return true;
}

function ensureLocaleFileReference(project, variantGroupKey, locale) {
  const variantGroup = project.getPBXVariantGroupByKey(variantGroupKey);
  const relativePath = `${locale}.lproj/InfoPlist.strings`;
  const alreadyPresent = variantGroup.children.some((child) => {
    const fileRef = project.pbxFileReferenceSection()[child.value];
    return fileRef && unquote(fileRef.path) === relativePath;
  });
  if (alreadyPresent) return false;

  const file = new PbxFile(relativePath);
  file.fileRef = project.generateUuid();
  project.addToPbxFileReferenceSection(file);

  // addToPbxFileReferenceSection() defaults `name` to the basename
  // ("InfoPlist.strings") for every locale; Xcode's own localization
  // tooling instead names each variant by its region, which is what lets
  // the file inspector group them as one localized resource.
  const fileRefObj = project.pbxFileReferenceSection()[file.fileRef];
  fileRefObj.name = locale;
  project.pbxFileReferenceSection()[`${file.fileRef}_comment`] = locale;

  project.addToPbxVariantGroup(file, variantGroupKey);
  const child = variantGroup.children.find((c) => c.value === file.fileRef);
  if (child) child.comment = locale;
  return true;
}

function writeLocalizedStringsFiles(targetDirectory) {
  for (const locale of LOCALES) {
    const dir = path.join(targetDirectory, `${locale}.lproj`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'InfoPlist.strings'),
      serializeInfoPlistStrings(LOCALIZED_INFO_PLIST_STRINGS[locale]),
    );
  }
}

const withLocalNetworkUsageDescription = (config) =>
  withInfoPlist(config, (cfg) => {
    cfg.modResults.NSLocalNetworkUsageDescription = LOCAL_NETWORK_USAGE_DESCRIPTION;
    return cfg;
  });

const withLocalizedInfoPlistStringsFiles = (config) =>
  withXcodeProject(config, (cfg) => {
    const targetDirectory = path.join(cfg.modRequest.platformProjectRoot, APP_TARGET_DIR);
    writeLocalizedStringsFiles(targetDirectory);

    const project = cfg.modResults;
    const appGroupKey = findAppGroupKey(project);
    if (!appGroupKey) {
      throw new Error(
        `[${TAG}] Could not find the '${APP_TARGET_DIR}' group (the one containing Info.plist) in project.pbxproj.`,
      );
    }

    const variantGroupKey = ensureVariantGroup(project);
    ensureGroupChild(project, appGroupKey, variantGroupKey, VARIANT_GROUP_NAME);
    ensureResourcesBuildFile(project, variantGroupKey);
    for (const locale of LOCALES) {
      ensureLocaleFileReference(project, variantGroupKey, locale);
    }
    // addKnownRegion() already checks hasKnownRegion() before pushing, so no
    // extra idempotency guard is needed here.
    for (const locale of LOCALES) {
      if (locale !== 'en') project.addKnownRegion(locale);
    }

    return cfg;
  });

const withLocalizedPermissionStrings = (config) => {
  config = withLocalNetworkUsageDescription(config);
  config = withLocalizedInfoPlistStringsFiles(config);
  return config;
};

module.exports = withLocalizedPermissionStrings;
// Exposed for __tests__/unit/scripts/localized-permission-strings.test.js:
// driving these directly avoids standing up a full Expo config context.
module.exports.serializeInfoPlistStrings = serializeInfoPlistStrings;
module.exports.findAppGroupKey = findAppGroupKey;
module.exports.ensureVariantGroup = ensureVariantGroup;
module.exports.ensureGroupChild = ensureGroupChild;
module.exports.ensureResourcesBuildFile = ensureResourcesBuildFile;
module.exports.ensureLocaleFileReference = ensureLocaleFileReference;
module.exports.LOCALIZED_INFO_PLIST_STRINGS = LOCALIZED_INFO_PLIST_STRINGS;
module.exports.LOCAL_NETWORK_USAGE_DESCRIPTION = LOCAL_NETWORK_USAGE_DESCRIPTION;
module.exports.LOCALES = LOCALES;
module.exports.VARIANT_GROUP_NAME = VARIANT_GROUP_NAME;
