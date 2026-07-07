# The Expo Dev Launcher — what it is and why it blocks Maestro E2E

## What it is

Every Expo app built with `expo-dev-client` (which this project is — `expo-dev-client: ~55.0.32` in `package.json`) gets a **two-stage boot** in Debug builds:

```
┌─────────────────────────────────────┐
│ Native iOS binary (Threadbase.app)  │
│  ↓                                  │
│ Stage 1: Expo Dev Launcher          │  ← native SwiftUI screen
│  (asks: which JS bundle to load?)   │
│  ↓                                  │
│ Stage 2: Your actual React app      │  ← JS bundle running
│  (Threadbase onboarding/hub/etc.)   │
└─────────────────────────────────────┘
```

The launcher is its own SwiftUI module living inside `node_modules/expo-dev-launcher/ios/SwiftUI/`. It's not part of your app code, you didn't write it, and project rules don't apply to it. Expo ships it pre-built; you can't edit it.

**It only appears in `Debug` configuration.** That's the configuration `npx expo run:ios` builds by default — and what gets installed when you run the app locally for development.

## Why it exists

The launcher lets you do all of this without rebuilding the native binary:

- Switch between local Metro (your laptop), a teammate's Metro (LAN URL), or a published EAS Update channel
- Reload the JS bundle without killing the app
- Open the dev menu (shake gesture or 3-finger tap)
- Inspect bridge messages, perf, etc.

For day-to-day RN development, it's great. For **automated E2E testing**, it's an obstacle: every test run has to navigate it before the actual app shows up.

## What it looks like on the simulator

```
Threadbase                       [👤]
Development Build

DEVELOPMENT SERVERS                 INFO
┌──────────────────────────────────────┐
│ 🟢 Threadbase                     →  │
│    http://192.168.68.111:8081        │
└──────────────────────────────────────┘
> Enter URL manually
```

## Why "just tap through it" is harder than it looks

To automate the launcher, Maestro would need to either:

### (a) Tap the cached server card

`text: "Threadbase"` would match — *but* "Threadbase" also appears as the title on the actual onboarding screen, which would cause confusion later in the flow. Also the cached URL `http://192.168.68.111:8081` is the laptop's LAN IP from a previous session, which may not be reachable now (Wi-Fi changed, laptop sleeping, IP rotated). If the URL doesn't respond, the launcher just spins.

### (b) Tap "Enter URL manually" → type `http://localhost:8081` → tap Connect

This works conceptually, but:

- The "Connect" button on the launcher has the **exact same label** as the "Connect" button on the app's onboarding screen. Maestro can't disambiguate by text alone.
- It's SwiftUI text — usually accessible to Maestro but not always (a11y on SwiftUI is more brittle than UIKit/RN).
- We can't add `testID`s to SwiftUI code that lives in `node_modules`.
- It requires Metro to be alive on `localhost:8081`, adding another moving part to every test run.

### (c) Skip Stage 1 entirely (chosen path)

Use `npm run ios` (a thin wrapper around `npx expo run:ios`). `app.json` sets `"launchMode": "most-recent"` on the `expo-dev-client` plugin, which makes the Dev Client skip its launcher UI and load the last-opened bundle directly:

- Still a Debug build (fast rebuilds, JS reload-on-save)
- Skips the dev launcher screen entirely
- Boots straight into the onboarding screen
- Needs Metro running (`npm start` or `npm run ios` starts it)

This is Expo's documented `launchMode: "most-recent"` option for the `expo-dev-client` config plugin — see [`bypass-expo-dev-launcher-methods.md`](./bypass-expo-dev-launcher-methods.md) (Method 1) for this and the other bypass approaches we considered.

## The 192.168.68.111 detail

The cached URL is your **LAN IP** (192.168.68.x is a typical home router subnet), not `localhost`. That's because dev-client auto-discovers the Metro bundler that started it. When you originally ran `expo start`, Metro advertised your LAN IP, the launcher cached it, and the simulator is still trying to phone home to a Metro instance that may not exist anymore. The launcher's "green dot" is misleading — it means Bonjour saw something at some point, not that the server is currently up. This is exactly the flakiness `launchMode: "most-recent"` avoids by skipping the launcher's server-picker UI entirely.

## TL;DR

| | Debug build, default launcher | Debug build, `launchMode: "most-recent"` |
|---|---|---|
| Boots into dev launcher | Yes | No |
| Needs Metro running | Yes | Yes |
| JS reload-on-save | Yes | Yes |
| Good for daily dev | ✅ | ✅ |
| Good for E2E | ❌ (without ugly bypass) | ✅ |
| Build time | ~3-5 min | ~3-5 min |

## How to build and run

```bash
npm run ios
```

This runs `npx expo run:ios` against the sim, which builds/installs the Debug app and starts Metro. With `launchMode: "most-recent"` set in `app.json`, the app skips the launcher and loads the last-opened bundle directly.

To find a booted sim UDID (useful for `npm run ios -- --device <udid>`):

```bash
xcrun simctl list devices booted
```
