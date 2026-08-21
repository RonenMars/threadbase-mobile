#!/usr/bin/env node
'use strict'
// check-native-strings.js — catch iOS permission-string drift across the
// four places that have to agree: app.json (the source), the committed
// ios/Threadbase/Info.plist (what ships when a plugin doesn't own the key),
// the four ios/Threadbase/<lang>.lproj/InfoPlist.strings files (what iOS
// actually shows per device locale), and the LOCALIZED_INFO_PLIST_STRINGS
// literal in plugins/withLocalizedPermissionStrings.js (what a `--clean`
// prebuild regenerates, since that wipes the .lproj files first — the
// plugin's own header names this as a hazard nothing else catches).
//
// __tests__/unit/scripts/ios-permission-strings.test.js already asserts
// app.json's four plugin-owned strings plus NSFaceIDUsageDescription match
// Info.plist, and that none of the plugin-owned keys are also declared
// under ios.infoPlist. This script does not re-run that assertion; it walks
// the locale-file and plugin-literal side that test never touches.

const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

function resolveRoot() {
  if (process.env.NATIVE_STRINGS_CHECK_ROOT) return process.env.NATIVE_STRINGS_CHECK_ROOT
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
}

const ROOT = resolveRoot()
const TARGET_DIR = path.join(ROOT, 'ios/Threadbase')
const INFO_PLIST = path.join(TARGET_DIR, 'Info.plist')
const APP_JSON = path.join(ROOT, 'app.json')
const PLUGIN_FILE = path.join(ROOT, 'plugins/withLocalizedPermissionStrings.js')
const LOCALES = ['en', 'he', 'ar', 'ru']
const REFERENCE = 'en'

// The app.json-owned permission strings, and how to find each one — the
// same five keys __tests__/unit/scripts/ios-permission-strings.test.js
// checks against Info.plist. NSLocalNetworkUsageDescription has no
// app.json-backed option (see the plugin file header) so it is not here.
const APP_JSON_SOURCES = [
  { plistKey: 'NSFaceIDUsageDescription', infoPlistPath: ['ios', 'infoPlist', 'NSFaceIDUsageDescription'] },
  { plistKey: 'NSCameraUsageDescription', pluginName: 'expo-camera', optionName: 'cameraPermission' },
  { plistKey: 'NSPhotoLibraryUsageDescription', pluginName: 'expo-image-picker', optionName: 'photosPermission' },
  {
    plistKey: 'NSMicrophoneUsageDescription',
    pluginName: 'expo-speech-recognition',
    optionName: 'microphonePermission',
  },
  {
    plistKey: 'NSSpeechRecognitionUsageDescription',
    pluginName: 'expo-speech-recognition',
    optionName: 'speechRecognitionPermission',
  },
]

function pluginOption(appJson, pluginName, optionName) {
  const entry = (appJson.expo.plugins || []).find(
    (candidate) => Array.isArray(candidate) && candidate[0] === pluginName
  )
  return entry?.[1]?.[optionName]
}

function appJsonValue(appJson, source) {
  if (source.infoPlistPath) {
    return source.infoPlistPath.reduce((obj, key) => obj?.[key], appJson.expo)
  }
  return pluginOption(appJson, source.pluginName, source.optionName)
}

function parsePlistUsageKeys(contents) {
  const pairs = {}
  const re = /<key>([A-Za-z]+UsageDescription)<\/key>\s*<string>([^<]*)<\/string>/g
  let match
  while ((match = re.exec(contents))) {
    pairs[match[1]] = match[2]
  }
  return pairs
}

function parseInfoPlistStrings(contents) {
  const pairs = {}
  const re = /"([^"]+)"\s*=\s*"((?:[^"\\]|\\.)*)";/g
  let match
  while ((match = re.exec(contents))) {
    pairs[match[1]] = match[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  }
  return pairs
}

function readLocaleStrings(locale) {
  const file = path.join(TARGET_DIR, `${locale}.lproj`, 'InfoPlist.strings')
  return parseInfoPlistStrings(fs.readFileSync(file, 'utf8'))
}

function loadPluginStrings() {
  delete require.cache[require.resolve(PLUGIN_FILE)]
  return require(PLUGIN_FILE).LOCALIZED_INFO_PLIST_STRINGS
}

function check() {
  const findings = []

  const appJson = JSON.parse(fs.readFileSync(APP_JSON, 'utf8'))
  const plistKeys = parsePlistUsageKeys(fs.readFileSync(INFO_PLIST, 'utf8'))
  const localeStrings = Object.fromEntries(LOCALES.map((locale) => [locale, readLocaleStrings(locale)]))
  const pluginStrings = loadPluginStrings()

  // 1. Every *UsageDescription key shipped in Info.plist must exist in
  // every locale's InfoPlist.strings.
  for (const key of Object.keys(plistKeys)) {
    for (const locale of LOCALES) {
      if (!(key in localeStrings[locale])) {
        findings.push(`${key} is in Info.plist but missing from ${locale}.lproj/InfoPlist.strings`)
      }
    }
  }

  // 2. Every key en.lproj carries must exist in every other locale — catches
  // a key added to the locale files without ever reaching Info.plist.
  for (const key of Object.keys(localeStrings[REFERENCE])) {
    for (const locale of LOCALES) {
      if (locale === REFERENCE) continue
      if (!(key in localeStrings[locale])) {
        findings.push(`${key} is in ${REFERENCE}.lproj but missing from ${locale}.lproj/InfoPlist.strings`)
      }
    }
  }

  // 3. app.json's own permission strings must match what actually shipped
  // in Info.plist (complements, doesn't repeat, ios-permission-strings.test.js).
  for (const source of APP_JSON_SOURCES) {
    const expected = appJsonValue(appJson, source)
    const actual = plistKeys[source.plistKey]
    if (expected !== actual) {
      findings.push(
        `${source.plistKey}: app.json says "${expected}" but Info.plist says "${actual}"`
      )
    }
  }

  // 4. The plugin's embedded LOCALIZED_INFO_PLIST_STRINGS literal — the only
  // thing a --clean prebuild regenerates from — must match the committed
  // .lproj files it is meant to reproduce.
  for (const locale of LOCALES) {
    const pluginEntries = pluginStrings[locale] || []
    const pluginPairs = Object.fromEntries(pluginEntries)
    const committed = localeStrings[locale]

    for (const [key, value] of Object.entries(pluginPairs)) {
      if (!(key in committed)) {
        findings.push(`${key} is embedded in withLocalizedPermissionStrings.js for ${locale} but not in ${locale}.lproj/InfoPlist.strings`)
      } else if (committed[key] !== value) {
        findings.push(
          `${key} (${locale}): plugin literal "${value}" does not match ${locale}.lproj/InfoPlist.strings "${committed[key]}"`
        )
      }
    }
    for (const key of Object.keys(committed)) {
      if (!(key in pluginPairs)) {
        findings.push(`${key} is in ${locale}.lproj/InfoPlist.strings but not embedded in withLocalizedPermissionStrings.js`)
      }
    }
  }

  if (findings.length === 0) {
    console.log('Native permission strings OK — app.json, Info.plist, all four locales and the prebuild plugin agree.')
    return
  }

  console.error(`${findings.length} native permission string issue(s) found:`)
  for (const finding of findings) {
    console.error(`  ${finding}`)
  }
  process.exit(1)
}

check()
