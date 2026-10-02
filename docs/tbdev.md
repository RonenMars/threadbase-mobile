# TbDev — the QA app that installs beside Threadbase

TbDev is the binary the Firebase QA pipeline ships.
It is the same code as Threadbase with different identifiers, name and icon, so a tester keeps the App Store, TestFlight or Play build and the QA build on one device.
How to ship one is in [`deployment.md`](./deployment.md) → "Firebase QA"; this file records how the variant is built, what exists outside the repo, and what was learned setting it up (2026-10-02, PRs [#1219](https://github.com/RonenMars/threadbase-mobile/pull/1219) and [#1220](https://github.com/RonenMars/threadbase-mobile/pull/1220), issue [#1199](https://github.com/RonenMars/threadbase-mobile/issues/1199)).

## Identifiers

| | Threadbase | TbDev |
|---|---|---|
| iOS bundle ID / Android package | `com.ronenmars.threadbase` | `com.ronenmars.threadbase.dev` |
| iOS widget extension | `com.ronenmars.threadbase.widgets` | `com.ronenmars.threadbase.dev.widgets` |
| App Group | `group.com.ronenmars.threadbase` | `group.com.ronenmars.threadbase.dev` |
| Display name | Threadbase | TbDev |
| Icon | `AppIcon` | `AppIconDev` (the same icon with an orange DEV band) |
| Distributed by | App Store, TestFlight, Play | Firebase App Distribution |

The two apps share no data: separate keychain, AsyncStorage, App Group and push token.
A server paired in one is not paired in the other.

## How the variant is built

`ios/` and `android/` are committed and no ship path runs `expo prebuild`, so an `app.config.js` variant would never reach a build.
The variant is instead a set of build-time inputs that default to Threadbase, which leaves every other build path byte-for-byte unchanged.

**iOS** — three Xcode build settings, passed on the `xcodebuild` command line by `scripts/ship-qa.sh`:

| Setting | TbDev value | Read by |
|---|---|---|
| `TB_BUNDLE_ID_SUFFIX` | `.dev` | `PRODUCT_BUNDLE_IDENTIFIER` of both targets, the URL scheme and `ExpoWidgetsAppGroupIdentifier` in `Info.plist`, the App Group in both `.entitlements` files |
| `TB_APPICON_SUFFIX` | `Dev` | `ASSETCATALOG_COMPILER_APPICON_NAME = "AppIcon$(TB_APPICON_SUFFIX)"` |
| `TB_DISPLAY_NAME` | `TbDev` | `CFBundleDisplayName`; defaults to `Threadbase` in the project file |

Xcode expands `$(…)` in `Info.plist` and in entitlements files, and an unset setting expands to nothing, which is why the suffixes need no default.
Command-line settings apply to every target at once, which is fine here because both targets want the same suffix; it is the per-target provisioning profile that cannot go on the command line, and `ship-qa.sh` handles that through `ExportOptions` and its profile lookup.

`scripts/select-dev-profile.py` reads the `.entitlements` files to decide which entitlements a dev profile must grant.
It strips `$(…)` before parsing, so device builds through `dev-device.sh` still match the plain Threadbase App Group.

**Android** — one Gradle property, `-PtbVariant=dev`, read in `android/app/build.gradle`:

- `applicationIdSuffix '.dev'`
- `sourceSets.release.res.srcDirs += 'src/tbdev/res'`, which overrides `app_name` and the adaptive-icon foreground.

Launchers older than Android 8 do not use the adaptive icon and show the normal one.

**Icons** — generated from the 1024 px Threadbase icon with a band drawn `sourceAtop`, so the band follows the icon's shape.
To regenerate after an icon change, redraw the band on the new source, then `sips` for the iOS PNG and `cwebp` for the five Android densities.

## What exists outside the repo

Checked 2026-10-02.

**Apple Developer** — two Ad Hoc profiles, both expiring 2027-05-31:

| Profile | Portal ID | UUID |
|---|---|---|
| TbDev AdHoc | `B246LUUBQ5` | `43df0538-1fd8-47d2-919e-3d3edf7cab52` |
| TbDev Widgets AdHoc | `U6465JQH5N` | `71113849-6906-405f-aaaf-24816e7e6a1b` |

Local copies live in `~/.config/threadbase/profiles/`.
They were created through the App Store Connect API (`POST /v1/profiles`, type `IOS_APP_ADHOC`) rather than the portal.
Registering a new test device means regenerating both and re-uploading `IOS_ADHOC_PROFILE_B64` and `IOS_WIDGET_ADHOC_PROFILE_B64`; a regenerated profile keeps its portal ID and gets a new UUID.
The two Ad Hoc profiles for the plain Threadbase identifiers (`FV3KNY2MVF`, `RBNKN3T836`) are still in the portal and no longer used by anything.

**Firebase** (project `threadbase-10d42`):

| App | App ID | State |
|---|---|---|
| TbDev iOS | `1:863079924487:ios:710948614c0bdb1694bba2` | active |
| TbDev Android | `1:863079924487:android:6bcca99438cce17094bba2` | active |
| Threadbase Android | `1:863079924487:android:7f46048c12a1b34394bba2` | active, kept on purpose |
| Threadbase iOS | `1:863079924487:ios:50d9c7198b1374e094bba2` | removed, restorable until 2026-11-01 |

Threadbase Android stays because Firebase is where its FCM configuration comes from: the Play build cannot obtain a push token without `google-services.json`, and Android push did not work at all before that file was added.
Threadbase iOS had no such role — iOS push goes through APNs, not Firebase — so it existed only for App Distribution and was removed once TbDev replaced it.

**GitHub** — `FIREBASE_APP_ID_IOS` and `FIREBASE_APP_ID_ANDROID` point at the TbDev apps, the two profile secrets hold the TbDev profiles, and `GOOGLE_SERVICES_JSON_B64` holds one `google-services.json` with both Android clients.
Deploy checks that file for `com.ronenmars.threadbase`, QA for `com.ronenmars.threadbase.dev`.

**Expo** (`@ronenmars/threadbase-mobile`) — the app registers with `getExpoPushTokenAsync()` and the streamer sends through Expo, so Expo needs credentials per identifier:

| Platform | Identifier | State |
|---|---|---|
| iOS | `com.ronenmars.threadbase` | APNs key `VP6ZKX6L6N` |
| iOS | `com.ronenmars.threadbase.dev` | the same APNs key, added 2026-10-02 |
| Android | both packages | FCM V1 key set |

## Open items

- **No push has been sent to TbDev yet**, so delivery is configured but unproven on both platforms.
- **No Deploy run has used the two-client `GOOGLE_SERVICES_JSON_B64` yet.** The QA side is proven: the "Write Firebase config" step passed in [run 37058935537](https://github.com/RonenMars/threadbase-mobile/actions/runs/37058935537).
- **TbDev Android has not been installed on a device.** The iOS build is confirmed side by side with Threadbase on an iPhone.
- **Both apps register `threadbase://`**, so with both installed the system picks which one opens a deep link.

## Traps found on the way

- **`plutil -extract` splits its key path on dots.** `Entitlements.com.apple.security.application-groups` reports the key missing from a profile that has it. Extract the parent (`plutil -extract Entitlements xml1 -o - file`) and grep.
- **`jq -e '.client[] | … == "x"'` answers for the last element only.** The filter emits one boolean per client and the exit status follows the last one, so a two-client file passes or fails by order. Use `any(.client[]; … == "x")`.
- **`bundle exec pod install` fails in a fresh worktree** with `Could not find gem 'fastlane'`, because the gems are vendored in the main checkout. Set `BUNDLE_PATH=<main checkout>/vendor/bundle`.
- **A local Gradle build leaves `android/app/src/main/assets/modules.json` untracked.** Delete it before staging.
- **Expo's Android wizard files the Firebase key in the wrong slot.** Its service-account step stores the JSON as "Google service account key for EAS Submit" and leaves "FCM V1 service account key" empty, which is the one push uses. Open the identifier afterwards and assign it under FCM V1 → "Choose saved key".
- **Remove a Firebase app with `{"immediate": false}`.** `POST …/iosApps/{id}:remove` then keeps it restorable for 30 days; `immediate: true` deletes it for good.
