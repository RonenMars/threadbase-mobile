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

Build the **Release** configuration of the app. Release builds:

- Embed the JS bundle into the `.app` itself (`main.jsbundle`)
- Skip the dev launcher (the launcher only inserts itself in Debug)
- Boot straight into the onboarding screen
- Don't need Metro running

This is what real production users see, and what every Maestro E2E setup typically does.

## The 192.168.68.111 detail

The cached URL is your **LAN IP** (192.168.68.x is a typical home router subnet), not `localhost`. That's because dev-client auto-discovers the Metro bundler that started it. When you originally ran `expo start`, Metro advertised your LAN IP, the launcher cached it, and the simulator is still trying to phone home to a Metro instance that may not exist anymore. The launcher's "green dot" is misleading — it means Bonjour saw something at some point, not that the server is currently up.

If you ever want to make Debug-mode E2E work, the cleanest path would be a `predev-launcher.yaml` fixture that clears that cached URL via the app's URL scheme (`threadbase://expo-go?url=http://localhost:8081`), then taps Connect. But that's a separate, optional improvement and not the default approach.

## TL;DR

| | Debug build | Release build |
|---|---|---|
| Boots into dev launcher | Yes | No |
| Needs Metro running | Yes | No |
| JS reload-on-save | Yes | No |
| Good for daily dev | ✅ | ❌ |
| Good for E2E | ❌ (without ugly bypass) | ✅ |
| Build time | ~3-5 min | ~6-12 min |
| Run time per test | Fast (HMR) | Same as prod |

## How to build a Release configuration

```bash
npx expo run:ios --configuration Release --device <booted-sim-udid>
```

To find a booted sim UDID:

```bash
xcrun simctl list devices booted
```

Or skip the install step (useful when you just want the `.app` artifact, e.g. to inspect or to install manually later):

```bash
npx expo run:ios --configuration Release --device <udid> --no-install --no-bundler
```

The built `.app` lands at:

```
~/Library/Developer/Xcode/DerivedData/Threadbase-<hash>/Build/Products/Release-iphonesimulator/Threadbase.app
```

Install it onto a booted sim manually:

```bash
xcrun simctl install booted /path/to/Threadbase.app
```

After install, launching it (either via Maestro's `launchApp` or `xcrun simctl launch booted com.ronenmars.threadbase`) drops you straight into the actual app, skipping the dev launcher entirely.
