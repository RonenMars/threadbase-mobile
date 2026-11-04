# QA update experience

## Firebase binary updates (PR #1241)

TbDev observes native `UIScene.didActivateNotification`, including the first scene activation after launch, without overriding Expo lifecycle forwarding.
The presenter comes from a foreground-active scene’s key window, matching the integration branch’s scene lifecycle.
There is no separate launch request.
Checks run at most once every five minutes per process, with one request in flight and one update alert at a time.
Firebase configuration runs only if the default app is not already configured; the SDK's existing sign-in behavior is unchanged.
The callback returns to the main queue before touching state or UIKit.
An inactive app, hidden/non-key window, unloaded root view, modal, or transitioning root controller prevents presentation; a skipped result is checked again on a later eligible activation, without timers or queued alerts.

The alert retains the release version, build, release notes, and Later / Update actions.
It explains that iOS installs externally, may close TbDev, and that the tester should reopen it afterward.
Later persists a one-hour cooldown for that version/build, including across process restarts.
Update persists the same cooldown only after the URL-open completion reports success; this confirms opening, not installation.
If iOS refuses to open the URL, TbDev shows an error and does not start the release cooldown.
A different release is eligible after the normal five-minute check interval.
Update opens Firebase's existing URL; TbDev never terminates or relaunches itself.
An interrupted or cancelled installation can be offered again after the cooldown.

All Firebase state and lifecycle code remain inside `canImport(FirebaseAppDistribution)`.
The existing Podfile adds the pinned Swift package only for `TB_QA_APP_DISTRIBUTION=1` and removes it for ordinary installs.
`ship-qa.sh` supplies that switch and the Firebase plist build settings only when QA credentials are available.
Signing, provisioning, authentication, workflow configuration, and dependencies are unchanged by this improvement.

### Physical-device acceptance checks

- Cold launch with a newer build: finish Google sign-in if needed; verify one alert, version/build, full release notes, guidance, and both actions.
- Background/foreground during sign-in or a slow request: verify no concurrent request or overlapping alert.
- Choose Later, foreground repeatedly, and restart TbDev: verify no same-release prompt for one hour; after expiry and an eligible activation, verify it returns.
- Refuse URL opening: verify an error appears after the update alert dismisses and no release cooldown is stored.
- Choose Update: complete or cancel Firebase's external installation, return/reopen, and verify no immediate same-release prompt; verify the installed build is current after successful installation.
- Upload a different build during the cooldown: after five minutes and foregrounding, verify it is offered.
- Background during a request, or show another modal: verify no background/overlapping presentation; retry on a later eligible activation.
- Exercise no release, SDK error/offline, missing configuration, and signed-out cases; check that app use remains available.
- Build a normal App Store archive after a normal pod install and inspect linked frameworks/symbols to confirm Firebase App Distribution is absent.

## EAS Update feasibility (assessment only)

### Repository evidence at PR head 8c775af3

- `package.json` includes `expo-updates`, but iOS `Supporting/Expo.plist` sets `EXUpdatesEnabled=false` and Android's manifest sets `expo.modules.updates.ENABLED=false`.
- `app.json` has an EAS project ID, but no `updates.url` or `runtimeVersion`; `app.config.js` only applies diagnostics/Sentry configuration.
- `eas.json` has development, preview, and production build profiles with no update channels or runtime policy; remote build-number management is not a runtime compatibility strategy.
- The iOS release delegate loads the embedded `main.jsbundle` directly rather than selecting an OTA bundle through the updates controller.
- QA workflows distribute native binaries through `scripts/ship-qa.sh`; store workflows use native archive/upload scripts. There is no EAS Update publishing workflow.

Installed tooling and an EAS project ID do not constitute a configured OTA deployment.
No EAS Update configuration is introduced here.

### What could ship OTA

JavaScript/TypeScript, React Native UI/business logic, and bundled assets can ship OTA when they use only native capabilities already present in the target binary.
Swift/Objective-C changes, native dependencies, Expo SDK upgrades with native changes, and configuration requiring recompilation need a new binary through Firebase for QA (and the existing store path for production).
This PR's lifecycle change therefore requires a binary regardless of OTA adoption.
See Expo's [runtime compatibility guidance](https://docs.expo.dev/eas-update/runtime-versions/).

### Required work for a future pilot

1. Configure the existing EAS project update URL, a QA-only channel, and a runtime policy; enable updates only in QA native builds, leaving store builds disabled unless separately approved.
2. Integrate `expo-updates` bundle selection into the existing custom Expo delegate using the installed SDK's supported controller integration; verify the embedded bundle still works offline. Because native projects are tracked, changing app config alone is insufficient.
3. Prefer a native fingerprint runtime policy, computed consistently for both binary builds and OTA exports. Include QA native dependencies/configuration in the fingerprint; a fingerprint computed before the QA-only Firebase package is added could describe the wrong runtime. Alternatively assign an explicit runtime ID for every native change and enforce it in CI. Do not use the constant app version `1.0.0` as the sole compatibility boundary.
4. Add an explicitly authorized CI publishing job with Expo credentials, a fixed source ref, QA environment variables matching the binary, tests/export checks, runtime validation, and Sentry source-map/release attribution for the OTA update ID. Record both binary build and OTA update IDs in QA reports so a Firebase build number no longer ambiguously identifies the executing JS.
5. Define activation timing (prefer next launch), release ownership, access controls, rollback procedure, and monitoring before testers depend on OTA. Keep Firebase binary prompts separate from OTA activation; do not add a second update dialog.

Expo [setup documentation](https://docs.expo.dev/eas-update/getting-started/) describes the URL/runtime/channel configuration.
A pilot requires a new Firebase binary before any OTA can reach existing testers.

### Compatibility, rollback, and cost

Publish only to the matching native runtime and QA channel; never send a bundle requiring new native APIs to an older runtime.
Use a known-good compatible update or a rollback to the embedded bundle, and test recovery offline as well as online.
A rollback cannot undo native changes or side effects such as incompatible persisted-data migrations; keep those changes backward compatible.
See Expo's [rollback options](https://docs.expo.dev/eas-update/rollbacks/).

OTA can shorten JS-only QA iterations and avoid repeated binary installations, but adds another release surface: credentials, hosting/usage costs, runtime bookkeeping, environment parity, source maps, update provenance, and rollback drills.
It also makes reproducing a reported issue depend on two versions rather than just the installed binary.

**Recommendation:** retain Firebase-only QA delivery for now and finish validating the native installation experience.
Consider a separate QA-only EAS Update pilot if frequent JS-only iterations make archive/install time a demonstrated bottleneck.
The potential speed benefit is real, but the current disabled native configuration and custom bundle loader make adoption a separate integration project rather than a small addition to PR #1241.

## Verification before the integration rebase

- Swift frontend parsing, Ruby Podfile syntax, shell syntax, and `git diff --check` passed.
- All 11 existing `ship-qa.test.js` tests passed using the repository's script-test Jest configuration.
- A temporary Swift executable exercised the actual QA methods extracted from AppDelegate with mocked UIKit/Firebase types: activation deduplication, in-flight exclusion, callback dispatch to main, alert content/actions, overlap prevention, persisted Later/Update cooldown, different-release eligibility, cooldown expiry, inactive completion, no-release retry throttling, presenter guards, and single Firebase configuration all passed.
- Source assertions confirmed no launch-time request remains, Expo lifecycle forwarding remains unchanged, all new code stays inside the Firebase compilation guard, the conditional package add/remove logic remains, and OTA stays disabled.
- These are bounded source/mock checks, not a native SDK build or device test. No archive, install, sign-in, native alert rendering, or App Store binary inspection was performed. The physical-device/archive checks above remain required; JavaScript app suites were not run because no JavaScript application code changed.

## Integration rebase

The branch was rebased onto `integration/2026-11-02-local` at `8e616042`.
That branch already includes PR #1241 and adopts the scene lifecycle, so the restored uncommitted changes observe scene activation and use a scene-owned key window rather than AppDelegate’s window.
Swift parsing and the 11 QA shipping-script tests were rerun after this adaptation.
The temporary harness was updated to model scene activation and scene window lookup; its checks remain mock checks, not native SDK or physical-device verification.
