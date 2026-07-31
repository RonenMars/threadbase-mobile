# Troubleshooting Guide

Collected from fixed bugs, incidents, and session notes. Each section describes a symptom, its root cause, and the fix. Use this before digging into source.

---

## Terminal output / session display

### SSH passphrase prompt appears mid-conversation in the terminal view

**When:** A Claude Code session is started (via `POST /api/sessions/start`) on a Mac where the SSH agent is not running or the key is not loaded. The terminal output in the mobile app shows `Enter passphrase for key '/Users/<you>/.ssh/id_ed25519':` interspersed between conversation lines — visible as raw text in the streaming terminal view.

**What it looks like (mobile):** The session shows `Running · X prompts` but the terminal output contains a passphrase prompt mid-stream, e.g.:

```
Enter passphrase for key '/Users/ronenmars/.ssh/id_ed25519':
  Sonnet 4.6 | ~/Desktop/dev/ai-tools/tb-mobile  fix/ship-branch-sync-check ...
```

**Cause:** The SSH agent (`ssh-agent`) is not running or `SSH_AUTH_SOCK` is not set in the environment inherited by the PTY. When Claude Code (or git inside it) tries to authenticate over SSH, it falls through to directly prompting for the key passphrase. This prompt goes to stdout/stderr of the PTY, which tb-streamer captures and streams to the mobile client verbatim — there is no filtering for interactive passphrase prompts.

The underlying cause is usually one of:
- `~/.ssh/config` has `IdentityAgent` pointing to a stale external agent socket that no longer exists.
- The native macOS SSH agent is running (`com.openssh.ssh-agent` via launchd) but `SSH_AUTH_SOCK` is not exported in the shell, so `ssh-add` and PTY-spawned processes can't find it.
- The key exists but was never added to the keychain — so the agent restarts empty on every reboot.

**Fix (one-time, persists across restarts):**

1. Update `~/.ssh/config` to use the native macOS keychain:

```
Host *
  UseKeychain yes
  AddKeysToAgent yes
  IdentityFile ~/.ssh/id_ed25519
```

2. Start the agent and store the passphrase in Keychain:

```sh
eval "$(ssh-agent -s)"
ssh-add --apple-use-keychain ~/.ssh/id_ed25519
```

Enter the passphrase once — it is stored in macOS Keychain and never prompted again.

3. To ensure the agent starts automatically in every new shell, add to `~/.zshrc` (or the appropriate shell config):

```sh
if ! ssh-add -l &>/dev/null; then
  eval "$(ssh-agent -s)" &>/dev/null
fi
```

**Why this appears in the mobile app:** tb-streamer streams raw PTY output to the mobile client without filtering for interactive prompts. The passphrase request is just another line of terminal output. Once the SSH setup is fixed, it won't appear again — there is no mobile-side workaround.

**Related fix in tb-streamer:** see "SSH passphrase prompt leaks into streamed terminal output" in the tb-streamer troubleshooting guide.

---

## Running on a physical device

### `NativeModule.X is null` on a physical Android device (e.g. `RNCNetInfo is null`)

**When:** After adding or upgrading a *native* dependency, you restart Metro and reload the JS on the phone, but the app throws `NativeModule.RNCNetInfo is null` (or similar for any native module).

**Cause:** Native/JS version mismatch. The phone's installed APK predates the native module, while the fresh JS bundle (served over LAN or the `metro.rbv1000.win` tunnel) calls into it. The tunnel and Cloudflare only serve the JS bundle — never the native APK — so this is **not** a Metro or Cloudflare cache issue.

**Fix:** Rebuild the APK and reinstall it on the device (`npx expo run:android`), not clearing a bundle cache. Full walkthrough, plus HyperOS install gotchas, wireless adb, and log-watching: **[dev-on-physical-device-android.md](dev-on-physical-device-android.md)**. For iOS see **[dev-on-physical-device-ios.md](dev-on-physical-device-ios.md)**.

---

### `Cannot find native module 'ExpoDevice'` + `RNGestureHandlerModule.installUIRuntimeBindings is not a function` on iOS

**When:** On a dev build (Metro), opening the session screen logs `Cannot find native module 'ExpoDevice'` and repeated `RNGestureHandlerModule.installUIRuntimeBindings` / `setGestureHandlerConfig` → `undefined is not a function` (from `react-native-gesture-handler/src/v3/…`). Gestures and animations behave oddly and the screen may load slowly.

**Cause:** The same native/JS skew as the Android case above — the iOS dev-client binary running on the simulator/device predates native modules the fresh JS bundle expects (`expo-device`, and the gesture-handler v3 / Reanimated-4 worklets UI-runtime bindings). `package.json`, `node_modules`, and `ios/Podfile.lock` are all internally consistent; only the *installed binary* is stale. The `installUIRuntimeBindings`/`setGestureHandlerConfig` errors are caught by React Native's microtask shim (logged, not fatal) — they do **not** block the JS thread.

**Fix:** Rebuild and reinstall the iOS dev client (`npx expo run:ios`) — a JS reload is not enough, and this is not a Metro/Watchman cache issue. See **[dev-on-physical-device-ios.md](dev-on-physical-device-ios.md)**.

---

## Native builds / prebuild

### `expo prebuild` wiped the committed native config (SwiftUICore hook, gradle tuning) — SDK 57+

**When:** You run `npx expo prebuild` (or `expo prebuild --platform ios/android`) by hand on this repo after upgrading to Expo SDK 57, and the next build fails — e.g. the Xcode 26 SwiftUICore link error returns, or Android release builds OOM in R8/lint.

**Cause:** Since SDK 57, `expo prebuild` **defaults to `--clean`**: it clears and regenerates `ios/` and `android/` from scratch. This repo checks those directories into git with hand-maintained native config that prebuild does not reproduce:
- `ios/Podfile` post_install — Xcode 26 SwiftUICore linker workaround.
- `android/build.gradle` — bouncycastle version pins (JitPack metadata-timeout workaround).
- `android/gradle.properties` — `-Xmx6144m -XX:MaxMetaspaceSize=2048m` heap tuning for R8/lint.
- `plugins/withAndroidReleaseSigning.js` re-injects the signing block, but is template-shaped for a specific SDK.

**Fix:** Always run `npx expo prebuild --no-clean` on this repo so it patches the existing folders in place instead of regenerating them. If you already ran a clean prebuild, `git checkout -- ios android` to restore the committed config, then `cd ios && bundle exec pod install` (the `bundle exec` keeps CocoaPods on the Gemfile-pinned 1.16.2 — see [`CLAUDE.md`](../CLAUDE.md) → "Native Dependencies After Package Changes").

**Note:** The `ship-ios.sh` / `ship-android.sh` scripts are unaffected — they only prebuild when the native dir is missing (`[[ ! -d ios ]]`), where there is nothing to clean.

---

## Windows dev machine

### `spawn npx ENOENT` when running `npm run dev:metro` / `dev:android:js` on Windows

**When:** Running `npm run dev:metro` (or `dev:android:js`, which wraps the same `scripts/dev-metro.js`) on Windows throws immediately:

```
Error: spawn npx ENOENT
    at ChildProcess._handle.onexit (node:internal/child_process:287:19)
  errno: -4058,
  code: 'ENOENT',
  syscall: 'spawn npx',
```

**Cause:** `scripts/dev-metro.js` calls `spawn('npx', args, {...})` without `shell: true`. Node's `spawn()` talks directly to the Windows `CreateProcess` API and doesn't resolve `.cmd`/`.bat` shims — `npx` on Windows is `npx.cmd`, not a raw executable. `exec()` always goes through `cmd.exe` so it works; bare `spawn()` doesn't unless the shell is explicitly requested.

**Fix (workaround, no code change needed):** Skip the wrapper script and run Expo directly, setting the tunnel URL in the same shell so the child process inherits it:

```powershell
$env:EXPO_PACKAGER_PROXY_URL = "https://<your-tunnel-hostname>"
npx expo start --dev-client
```

### Fresh Windows checkout: `PluginError: Failed to resolve plugin for module "..."` on `expo start`

**When:** On a freshly cloned/pulled Windows checkout, `npx expo start` fails immediately with something like:

```
PluginError: Failed to resolve plugin for module "expo-local-authentication" relative to "<repo>". Do you have node modules installed?
```

even though the package is listed in `package.json` and `package-lock.json`.

**Cause:** The package is missing from `node_modules` despite being present in the lockfile — `npm ls <package>` shows it as absent (`node_modules` had drifted out of sync with the lockfile from an earlier partial/incomplete install).

**Fix:** `npm install` to reconcile `node_modules` with the lockfile, then retry `expo start`.

---

## Jest test suites

### `SessionScreen.*` suites fail in a batch but pass one at a time

**When:** Running the integration suites together — `npx jest`, `npm run test:integration`, or `npx jest --testPathPattern "SessionScreen"` — several `SessionScreen.*` suites fail, but re-running any one of them alone passes. The reported errors are often unrelated to each other and shift between runs.

**Cause:** Those suites each render the full session screen with fake timers, WebSocket stubs and long backstop timeouts, so they are heavy. Jest's default parallel workers oversubscribe the machine and the slower workers miss timing-dependent assertions. This is environmental, not a defect in the code under test.

**Fix:** Verify them serially:

```bash
npx jest --ci --runInBand --testPathPattern "SessionScreen"
```

**The trap runs both ways — do not use this to wave failures away.** A batch failure can be a load artifact *or* a real defect, and they look identical in the batch output. Always confirm by re-running the single suite in isolation:

- Passes alone → load artifact, ignore it.
- Fails alone → real defect, fix it.

During the 2026-07-22 integration snapshot, four genuinely broken suites were nearly dismissed as flakes on this basis, while two others really were load artifacts. Only the isolation re-run distinguished them.

### Suites known to be load-sensitive

These pass in isolation and on a green full run, but can fail under a loaded parallel run. Re-check in isolation before investigating:

| Suite | Typical symptom |
|---|---|
| `__tests__/e2e/feedback-flow.test.tsx` | exceeds the 5 s per-test timeout (also fails on `main`, Windows only) |
| `__tests__/unit/components/servers/CacheAlertModal.test.tsx` | assertion timeouts |
| `__tests__/integration/conversation-live-view.test.tsx` | streamed-event assertions |
| `__tests__/integration/conversation-detail-gating.test.tsx` | render timeouts |
| `__tests__/integration/conversation-search-anchor.test.tsx` | render timeouts |

### `npx jest` reports "No tests found" in a git worktree

**When:** A worktree created under `.claude/` (e.g. `.claude/worktrees/<name>`) reports `No tests found` with `0 matches`, and scripts like `npm run test:i18n` look broken even though they work in the main checkout.

**Cause:** `jest.config`'s `testPathIgnorePatterns` excludes `\\.claude\\`, so every test path inside such a worktree is filtered out. Nothing is wrong with the test or the script.

**Fix:** Create worktrees **outside** `.claude/` — e.g. `worktrees/<name>` alongside the repo. To run in place anyway, override the ignore list:

```bash
npx jest --testPathIgnorePatterns "/node_modules/"
```

Note that the override also re-enables `__tests__/unit/scripts/`, which the main config excludes deliberately (it runs under `jest.config.scripts.js` via `npm run test:scripts`) and which fails on Windows. Ignore those failures.

Each worktree needs its own `npm ci` — jest resolves modules from the worktree root, not the main checkout.

---

## iOS Simulator console noise

### `CHHapticPattern` / `CHHapticEngine` "hapticpatternlibrary.plist" errors flooding the log

**When:** Running the app in the iOS Simulator, the console fills with repeated `[CoreHaptics] CHHapticPattern.mm:487 +[CHHapticPattern patternForKey:error:]: Failed to read pattern library data` / `UIKBFeedbackGenerator: Error creating CHHapticPattern` errors whenever a haptic feedback call fires (e.g. `Haptics.impactAsync()`).

**Cause:** The Simulator doesn't ship the `hapticpatternlibrary.plist` that real devices have for the Core Haptics pattern library. Any `UIFeedbackGenerator` call hits this and logs the failure, but it's silently swallowed — no crash, no visible effect on the app. Simulator-only; doesn't happen on a real device (which has the physical Taptic Engine's pattern library).

**Fix:** None needed — don't add app code to suppress it. If it's genuinely annoying during dev, filter it at the terminal/log level instead: pipe `xcodebuild`/`simctl log stream` output through `grep -v CHHapticPattern` locally rather than touching the app.

---
