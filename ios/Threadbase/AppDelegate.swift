internal import Expo
import React
import ReactAppDependencyProvider
#if canImport(FirebaseAppDistribution)
import FirebaseAppDistribution
import FirebaseCore
#endif

@main
class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {
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

    // SceneDelegate creates the window and starts React Native: iOS 27 traps at launch
    // unless the app adopts the scene life cycle.

#if canImport(FirebaseAppDistribution)
    qaActivationObserver = NotificationCenter.default.addObserver(
      forName: UIScene.didActivateNotification, object: nil, queue: .main
    ) { [weak self] _ in
      // First scene activation also covers launch, once its window is ready.
      DispatchQueue.main.async { [weak self] in
        self?.checkForQAUpdate()
      }
    }
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

#if canImport(FirebaseAppDistribution)
  private var qaActivationObserver: NSObjectProtocol?
  private var qaUpdateCheckInFlight = false
  private var lastQAUpdateCheck: Date?
  private weak var qaUpdateAlert: UIAlertController?

  private func qaUpdatePresenter() -> UIViewController? {
    guard UIApplication.shared.applicationState == .active,
          let window = UIApplication.shared.connectedScenes
            .filter({ $0.activationState == .foregroundActive })
            .compactMap({ ($0 as? UIWindowScene)?.keyWindow }).first,
          !window.isHidden,
          let controller = window.rootViewController,
          controller.viewIfLoaded?.window === window,
          controller.presentedViewController == nil,
          !controller.isBeingPresented, !controller.isBeingDismissed
    else { return nil }
    return controller
  }

  // QA builds only: ship-qa.sh links the package and supplies the plist values.
  // All state and UIKit access stay on the main queue, including SDK callbacks.
  private func checkForQAUpdate() {
    guard !qaUpdateCheckInFlight, qaUpdateAlert == nil,
          qaUpdatePresenter() != nil,
          lastQAUpdateCheck.map({ Date().timeIntervalSince($0) >= 5 * 60 }) ?? true
    else { return }
    let info = Bundle.main.infoDictionary
    guard let appID = info?["TBFirebaseAppID"] as? String, !appID.isEmpty,
          let apiKey = info?["TBFirebaseAPIKey"] as? String, !apiKey.isEmpty,
          let projectID = info?["TBFirebaseProjectID"] as? String, !projectID.isEmpty
    else { return }
    // A Firebase app ID is `1:<project number>:ios:<hash>`, and the project
    // number is the sender ID FirebaseOptions wants.
    let parts = appID.split(separator: ":")
    guard parts.count > 1 else { return }

    if FirebaseApp.app() == nil {
      let options = FirebaseOptions(googleAppID: appID, gcmSenderID: String(parts[1]))
      options.apiKey = apiKey
      options.projectID = projectID
      FirebaseApp.configure(options: options)
    }

    qaUpdateCheckInFlight = true
    lastQAUpdateCheck = Date()
    AppDistribution.appDistribution().checkForUpdate { [weak self] release, _ in
      DispatchQueue.main.async {
        guard let self else { return }
        self.qaUpdateCheckInFlight = false
        guard let release, self.qaUpdateAlert == nil,
              let presenter = self.qaUpdatePresenter()
        else { return }

        let releaseID = "\(release.displayVersion) (\(release.buildVersion))"
        let defaults = UserDefaults.standard
        // Persist the action cooldown so returning from installation (even after
        // process termination) or choosing Later does not immediately prompt again.
        if defaults.string(forKey: "qaUpdatePromptRelease") == releaseID,
           let date = defaults.object(forKey: "qaUpdatePromptDate") as? Date,
           Date().timeIntervalSince(date) < 60 * 60 { return }
        let deferPrompt = {
          defaults.set(releaseID, forKey: "qaUpdatePromptRelease")
          defaults.set(Date(), forKey: "qaUpdatePromptDate")
        }
        let guidance = "iOS installs this update outside TbDev and may close the app. Reopen TbDev when installation finishes."
        let notes = release.releaseNotes ?? ""
        let alert = UIAlertController(
          title: "New QA build \(releaseID)",
          message: notes.isEmpty ? guidance : "\(notes)\n\n\(guidance)",
          preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Later", style: .cancel) { _ in
          deferPrompt()
        })
        alert.addAction(UIAlertAction(title: "Update", style: .default) { [weak self] _ in
          // Finish dismissing this alert before presenting a possible open error.
          presenter.dismiss(animated: true) {
            UIApplication.shared.open(release.downloadURL, options: [:]) { opened in
              DispatchQueue.main.async {
                if opened {
                  deferPrompt()
                  return
                }
                guard let self, let presenter = self.qaUpdatePresenter() else { return }
                let error = UIAlertController(
                  title: "Couldn't open update",
                  message: "Please try again from the update prompt.",
                  preferredStyle: .alert)
                error.addAction(UIAlertAction(title: "OK", style: .default))
                self.qaUpdateAlert = error
                presenter.present(error, animated: true)
              }
            }
          }
        })
        self.qaUpdateAlert = alert
        presenter.present(alert, animated: true)
      }

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
