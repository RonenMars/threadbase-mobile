# Expo Web Support

Threadbase Mobile can run as a web app via Expo's `web` platform target, reusing the
same React Native codebase (Expo Router, Zustand stores, components) instead of a
separate web project.

## Prerequisites

`web` must be present in `app.json`'s `expo.platforms` array, and `react-dom`,
`react-native-web`, and `@expo/metro-runtime` must be installed:

```bash
npx expo install react-dom react-native-web @expo/metro-runtime
```

(Both are already done on the `feat/expo-web` branch — this is only needed if
starting from a checkout that predates it.)

## Running locally (dev server, live reload)

```bash
npx expo start --web
```

Starts the Metro dev server and opens `http://localhost:8081` in your default
browser (press `w` in the terminal if it doesn't open automatically). Code changes
hot-reload like any other Expo dev session — this is the normal way to work on web
features day to day.

## Running a static production build

Use this to sanity-check a real production bundle rather than the dev server (e.g.
before shipping, or to reproduce a bug that only shows up in the optimized build):

```bash
npx expo export --platform web   # bundles into ./dist
npx serve dist -p 4173           # serves ./dist at http://localhost:4173
```

`npx serve` is a one-off dev dependency install on first run; nothing to configure.

## Status: early spike, not full parity

`web` was added to `app.json`'s `platforms` array and the app boots and renders —
onboarding was verified end-to-end with zero console errors after the fix below.
Feature parity with iOS/Android has **not** been verified past onboarding.

### Fixed

- **`expo-secure-store` has no web implementation** and threw at runtime on load
  (`TypeError: n.default.getValueWithKeyAsync is not a function`), breaking
  `loadPersistedServers` and anything else touching stored servers/session
  names/drafts/device id.

  Fix: all `expo-secure-store` usage now imports from `services/secure-store.ts`
  instead of the package directly. That module re-exports the native SecureStore
  API; a sibling `services/secure-store.web.ts` (auto-resolved by Metro's platform
  extension convention) provides a `localStorage`-backed shim for web only. Native
  builds are unaffected.

- **`expo-widgets` (Live Activities) is iOS-only** and has no web counterpart —
  there is no browser surface equivalent to the Lock Screen or Dynamic Island.

  Fix: `services/live-activity.ts` is shadowed by `services/live-activity.web.ts`,
  which no-ops the same entry points via Metro's platform-extension resolution, so
  the web bundle never reaches `expo-widgets` or the `widgets/` layouts. Call sites
  need no platform check of their own.

### Known unverified blockers

These libraries are native-only or partially supported on web and have not been
exercised past the onboarding screen. Expect runtime errors or no-ops until each is
addressed:

| Dependency | Used for | Web status |
|---|---|---|
| `expo-local-authentication` | Face ID / biometric unlock | No web API — needs a stub or feature-gate |
| `expo-speech-recognition` | Voice-to-text prompt dictation | No/partial web support |
| `expo-camera` | QR code pairing | Partial web support (browser camera permissions differ) |
| `expo-notifications` | Push notifications | Entirely different model on web (service worker + browser push) |
| `react-native-keyboard-controller` | Keyboard-avoiding input | Mobile-keyboard-specific, likely no-op on web |
| `@gorhom/bottom-sheet` | Modals/sheets throughout the UI | Touch-gesture-first; needs visual/interaction testing on desktop |
| `react-native-draggable-flatlist` | Reorderable lists | Touch-gesture-first; needs testing with mouse input |

### Also unverified

- Layout: safe-area insets, bottom-sheet-driven navigation, and tab bars were
  designed mobile-first and have not been reworked for a wide desktop viewport.
- Backend compatibility: whether `tb-streamer` accepts browser-origin WebSocket/API
  connections (CORS, auth headers) has not been tested from a web client.

## Recommended next step

Walk the app past onboarding (server pairing → session list → session detail) in a
browser and fix blockers as they surface, in that order — that's the real usage path
and will surface the highest-priority native-only dependency first.
