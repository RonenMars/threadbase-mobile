/**
 * @jest-environment node
 *
 * iOS 27 traps at launch (_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption)
 * unless the app adopts the UIScene life cycle. The SDK 57 prebuild template does not
 * generate a scene delegate, so the committed ios/ project carries it by hand and these
 * assertions keep a prebuild or hand edit from silently dropping it. See issue #1383.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('iOS scene life cycle', () => {
  it('declares a scene manifest pointing at SceneDelegate', () => {
    const plist = read('ios/Threadbase/Info.plist');
    expect(plist).toMatch(
      /<key>UIApplicationSceneManifest<\/key>[\s\S]*<key>UISceneDelegateClassName<\/key>\s*<string>\$\(PRODUCT_MODULE_NAME\)\.SceneDelegate<\/string>/,
    );
  });

  it('compiles a SceneDelegate built on ExpoAppSceneDelegate', () => {
    expect(read('ios/Threadbase/SceneDelegate.swift')).toMatch(
      /class SceneDelegate: ExpoAppSceneDelegate/,
    );
    expect(read('ios/Threadbase.xcodeproj/project.pbxproj')).toMatch(
      /\/\* SceneDelegate\.swift in Sources \*\/,/,
    );
  });

  it('leaves window creation to the scene delegate', () => {
    const appDelegate = read('ios/Threadbase/AppDelegate.swift');
    expect(appDelegate).toMatch(/class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider/);
    expect(appDelegate).not.toMatch(/UIWindow\(/);
  });
});
