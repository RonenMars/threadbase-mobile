import ExpoModulesCore

public class AppDistributionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AppDistribution")

    // expo-application can't make this call: it reads embedded.mobileprovision,
    // which TestFlight and App Store builds both lack. Only the receipt differs.
    Function("getDistribution") { () -> String in
      #if targetEnvironment(simulator)
      return "development"
      #else
      if Bundle.main.path(forResource: "embedded", ofType: "mobileprovision") != nil {
        return "development"
      }
      if Bundle.main.appStoreReceiptURL?.lastPathComponent == "sandboxReceipt" {
        return "staging"
      }
      return "production"
      #endif
    }

    // Written by AppDelegate's QA update check; read once, then cleared.
    Function("takeUpdateCheckResult") { () -> String? in
      let defaults = UserDefaults.standard
      let result = defaults.string(forKey: "qaUpdateCheckResult")
      defaults.removeObject(forKey: "qaUpdateCheckResult")
      return result
    }
  }
}
