internal import Expo
import React
import ReactAppDependencyProvider
#if canImport(FirebaseAppDistribution)
import FirebaseAppDistribution
import FirebaseCore
#endif

@main
class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

#if canImport(FirebaseAppDistribution)
    checkForQAUpdate()
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

#if canImport(FirebaseAppDistribution)
  // QA builds only: the pod is linked just when ship-qa.sh asks for it, and the
  // Info.plist values are empty in every other build.
  private func checkForQAUpdate() {
    let info = Bundle.main.infoDictionary
    guard let appID = info?["TBFirebaseAppID"] as? String, !appID.isEmpty,
          let apiKey = info?["TBFirebaseAPIKey"] as? String, !apiKey.isEmpty,
          let projectID = info?["TBFirebaseProjectID"] as? String, !projectID.isEmpty
    else { return }
    // A Firebase app ID is `1:<project number>:ios:<hash>`, and the project
    // number is the sender ID FirebaseOptions wants.
    let parts = appID.split(separator: ":")
    guard parts.count > 1 else { return }

    let options = FirebaseOptions(googleAppID: appID, gcmSenderID: String(parts[1]))
    options.apiKey = apiKey
    options.projectID = projectID
    FirebaseApp.configure(options: options)

    AppDistribution.appDistribution().checkForUpdate { [weak self] release, _ in
      guard let release else { return }
      let alert = UIAlertController(
        title: "New QA build \(release.displayVersion) (\(release.buildVersion))",
        message: release.releaseNotes,
        preferredStyle: .alert)
      alert.addAction(UIAlertAction(title: "Later", style: .cancel))
      alert.addAction(UIAlertAction(title: "Update", style: .default) { _ in
        UIApplication.shared.open(release.downloadURL)
      })
      self?.window?.rootViewController?.present(alert, animated: true)
    }
  }
#endif

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
