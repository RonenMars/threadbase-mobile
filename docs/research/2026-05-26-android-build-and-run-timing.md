# Android build & run timing — 2026-05-26

Measurement of `expo run:android` end-to-end on a clean Mac state (no other emulators, no iOS Simulator, no Gradle/Kotlin daemons resident). Goal: measure each phase so we know where time goes when starting an Android dev session.

## Environment
- Host: macOS 25.5.0, Apple Silicon, 32 GB RAM
- Node 24.15.0, Java 22, NDK 27.1.12297006, Gradle 9.0.0
- Expo SDK 56.0.4 / react-native 0.85.3 / new-architecture (Fabric + bridgeless)
- AVD: `Medium_Phone_API_36.1` (API 36, arm64-v8a) — chose this over Pixel_9 after Pixel_9 caused system-wide ANR on a memory-thrashed Mac (free RAM <100 MB, 20M swapouts; see "Lessons learned")
- Gradle/Kotlin daemons, iOS Simulator, prior emulators all stopped before run

## Headline numbers

| Phase | Time | What ran |
|---|---|---|
| Emulator boot (snapshot restore → `sys.boot_completed=1`) | **10 s** | Snapshot itself: 4.2 s per `emulator.log` |
| Gradle build (warm cache, `assembleDebug`) | **44 s** | 27 / 604 tasks executed; 577 UP-TO-DATE |
| APK install (`adb install -r`) | **2 s** | 99 MB streamed install |
| Bundle fetch from Metro (cached) | **2 s** | Metro had bundled cold earlier (5476 modules / 25.7 s); deep-link reuse was instant |
| JS `Running "main"` after deep-link | **5 s** | Bridgeless + Fabric init |
| First interactive frame (onboarding screen visible) | **~13 s after deep-link** | "Pull a thread. Watch it weave." onboarding card |
| **Total: build → onboarding visible** | **~60 s** | dominated by Gradle (44 s) |

### Pure incremental dev iteration
Once everything is warm (Metro running, emulator booted, APK installed), a typical change-and-reload cycle is **~10–13 s**:
- Metro re-bundle (incremental): single-digit seconds
- JS reload + first frame: ~5–8 s

## Per-phase detail

### 1. Emulator boot — 10 s
- `EMU_START=17:54:43` → `EMU_READY=17:54:53`
- Snapshot `default_boot` restored in 4235 ms (per emulator.log)
- Remaining ~6 s = adb wait-for-device + polling `sys.boot_completed`

### 2. Gradle build — 44 s (warm cache)
- `BUILD SUCCESSFUL in 44s`
- `604 actionable tasks: 27 executed, 577 up-to-date`
- React-native codegen, CMake outputs, dex, and most Kotlin/Java compiles all served from incremental cache
- No daemon was running at start → first ~10 s was Gradle daemon spin-up

### 3. APK install — 2 s
- `expo run:android`'s built-in install step silently failed (likely raced the still-booting device — `pm list packages` after build showed no `com.ronenmars.threadbase`)
- Manual `adb install -r` succeeded in 2 s; this is the actual install cost
- **Action item:** add a 5 s sleep or explicit `adb wait-for-device` before the install step in our local ship/run helper, or just retry once.

### 4. App cold launch — ~13 s
Sequence after `am start -a VIEW -d "exp+threadbase-mobile://..."`:
- `DEEPLINK=18:04:45.360`
- `BUNDLE_READY=18:04:47` — Metro served the incremental bundle in 2 s
- `JS_READY=18:04:52` — bridge initialized and JS thread logged `Running "main"` (5 s after deep-link)
- `APP_READY=18:05:33` — onboarding screen fully rendered and interactive (dismissed dev-menu, captured screen)

Most of the 13 s is JS module evaluation (5476 modules at cold start). On hot reload this drops to single-digit seconds.

## What we ran into (worth remembering)

### Memory pressure with Pixel_9
Pixel_9 AVD + iOS Simulator + Gradle/Kotlin daemons + Metro + Chrome/VS Code/Claude pushed the Mac to <100 MB free with 20M swapouts. Symptoms:
- "Pixel Launcher isn't responding" ANR dialog (system launcher, not our app)
- adb taps dropped silently
- JS thread emitted no logs after `Running "main"`
- White screens that looked like app bugs but were actually QEMU/system stutter

**Rule:** stop the emulator, Gradle daemons, and Kotlin daemon between sessions. Don't run iOS Sim + Android emulator simultaneously on this Mac.

### Hardcoded Metro port 8081
APK was built with `-PreactNativeDevServerPort=8081` baked in. Running Metro on a different port still serves the bundle, but the dev-support WebSocket fails (`Expected URL scheme 'http'` → DevLauncherErrorActivity). **Always use port 8081 unless you rebuild the APK.**

### expo run:android post-install race
The CLI prints `Installing app-debug.apk` then proceeds to `Opening exp+threadbase-mobile://...` even when the actual install hasn't taken. Confirm with `adb shell pm list packages | grep <id>` before relying on the deep-link.

## Reproduction script
```bash
# 0. ensure clean state
adb emu kill                 # stop any AVD
./android/gradlew --stop     # stop Gradle daemons
pkill -f KotlinCompileDaemon # stop Kotlin daemon

# 1. boot emulator
emulator -avd Medium_Phone_API_36.1 -no-snapshot-save -no-boot-anim &
adb wait-for-device
until [ "$(adb shell getprop sys.boot_completed | tr -d '\r')" = "1" ]; do sleep 1; done

# 2. build + install + launch
npx expo run:android --device Medium_Phone_API_36.1

# 3. if install silently failed, install manually:
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -a android.intent.action.VIEW \
  -d "exp+threadbase-mobile://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"
```

## Onboarding via Maestro on Android

We have `e2e/launch.yaml` for iOS but it doesn't translate cleanly to Android dev-client builds. Wrote `e2e/launch-android.yaml` to cover the same path. Key differences worth knowing:

### 1. `launchApp` opens the dev-launcher, not the JS app
On iOS, `launchApp: com.ronenmars.threadbase` cold-starts straight into our JS bundle. On Android, the dev-client APK's `MAIN/LAUNCHER` intent points at `DevLauncherActivity` (the server picker UI), so Maestro never sees onboarding. Workaround: deep-link with `adb am start` *before* invoking `maestro test`:

```bash
adb shell pm clear com.ronenmars.threadbase
adb shell am start -a android.intent.action.VIEW \
  -d 'exp+threadbase-mobile://expo-development-client/?url=http%3A%2F%2F<HOST>%3A8081' \
  com.ronenmars.threadbase
sleep 3
maestro test e2e/launch-android.yaml
```

The `launch-android.yaml` flow has `appId` set but does **not** call `launchApp` — it picks up the already-running JS process.

### 2. First-launch tutorial + dev-menu sheet block the UI
Right after the JS bundle initializes, Expo dev-client shows a one-time tutorial sheet ("This is the developer menu… Continue"). Tapping Continue *doesn't* close the modal — it transitions to the standard dev-menu (Reload / Go home / Toggle perf monitor / …) which keeps covering the JS surface. Both must be dismissed for tests to see app UI.

Dismissal in `launch-android.yaml`:
- `Continue` button → tap (only present on the first launch after install)
- Dev-menu sheet → `pressKey: Back` (tap-at-coordinates is unreliable — risks hitting the launcher's settings gear)

Both wrapped in a `repeat: times: 3` loop because the sheets animate in with variable delay.

### 3. Soft keyboard covers the Connect CTA
At the Connect step the on-screen keyboard sits on top of `onboarding-connect-handshake-cta`. iOS's `Done` button on the keyboard accessory dismisses it automatically when the secureTextEntry input loses focus; Android doesn't. Add `- hideKeyboard` before tapping the handshake CTA.

### 4. JS cold-start on Android can take 25-30s
After Continue + Back, the underlying JS thread needs ~25-30s to finish module evaluation (5476 modules) and render onboarding step 1. Use `extendedWaitUntil: timeout: 60000` for the `onboarding-welcome-cta` assertion — the default 10s isn't enough.

### Status as of this run
- Onboarding walked through steps 1-4 (Welcome → Theme → ValueProp → Connect URL/token input) successfully
- Connect step keyboard interaction fixed with `hideKeyboard`
- **Remaining flakiness:** dev-menu race — on some runs the tutorial doesn't appear, on others the dev-menu reappears mid-onboarding. Also occasionally the hub-screen renders before AuthGate's `router.replace('/onboarding')` redirect fires (effect runs inside `requestAnimationFrame` and `pm clear` doesn't always trigger the persist-store cold path)
- iOS flow (`e2e/launch.yaml`) is unaffected — these changes are isolated in `launch-android.yaml`

