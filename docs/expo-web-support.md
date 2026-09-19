# Expo Web Support

Threadbase Mobile can run as a web app via Expo's `web` platform target, reusing the
same React Native codebase (Expo Router, Zustand stores, components) instead of a
separate web project.

Not to be confused with [Storybook](./storybook.md), which mounts one component at a
time via Vite for isolated dev/design work — no app shell, no stores hydration.

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
npm run web
```

Equivalent to `npx expo start --web`.

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

  Android resolves to `services/live-activity.android.ts`, which posts an ongoing
  notification instead. Note it is a *plain* ongoing notification, not the API 36
  promoted status-bar chip: `expo-notifications` exposes `sticky` (Android's
  `setOngoing`) but neither `setRequestPromotedOngoing` nor `setUsesChronometer`,
  so there is no chip and no ticking elapsed time. Elapsed is omitted rather than
  shown frozen. Reaching parity needs those two builder calls exposed upstream or
  a small native module.

- **Encrypted pairing is possible on web.** It used to be refused outright, because
  the only store was `localStorage`. The device static key now lives in IndexedDB as
  a non-extractable WebCrypto X25519 key (`services/e2ee/device-key.web.ts`), and sealed
  sockets carry their ticket as a WebSocket subprotocol
  (`services/e2ee/ticketed-socket.web.ts`). Requirements: a browser with WebCrypto
  X25519 and IndexedDB (checked before pairing), and a streamer that advertises
  `e2ee.wsTicketSubprotocol` on `GET /api/info` (read sealed, right after the exchange,
  before the server is saved). Either missing refuses encrypted pairing with a
  translated message; there is no plaintext fallback. Details and the hosted-build
  trust caveat: [`e2ee-client.md`](./e2ee-client.md) → "Web (browser) clients".
  **Not yet verified in a real browser against a real streamer** — unit tests only.

- **`expo-notifications` has no web implementation** for response listeners /
  cold-start response reads. Calling them threw and blocked the root layout.

  Fix: `app/_layout.tsx` skips `addNotificationResponseReceivedListener` and
  `getLastNotificationResponseAsync` when `Platform.OS === 'web'`. Deep links via
  `Linking.getInitialURL()` still work; push-tap routing remains native-only.

- **React Native Web rejects Yoga's `direction` style prop** (`Invalid style
  property of "direction". Did you mean "writingDirection"?`). RN Web maps
  `writingDirection` to CSS `direction`, which inherits for layout.

  Fix: `lib/rtl.ts` exposes `layoutDirectionStyle()` (and `textDirectionStyle` /
  `DirectionRoot` / call sites use it). Native still gets Yoga `direction`; web
  gets `writingDirection` only.

- **The phone layout stretched edge to edge on desktop screens** (list rows and
  the New session FAB spanned the whole 1440–2560px window).

  Fix: `WebFrame` in `app/_layout.tsx` caps the app at a centered 768px card
  (24px top/bottom gutter, rounded border) on web only (mobile-first: the phone
  layout is the base, wide screens get margins rather than a new layout). Windows
  768px or narrower stay full-bleed; native renders its children unwrapped.

- **Session-list chrome and FAB behaved like a phone on desktop.** The New session
  FAB hid on scroll-down (a touch pattern; a mouse user never scrolls back up to
  find it), and rows read sharp through the Now | Projects tabs because web has no
  Liquid Glass under the fading scrim.

  Fix: `hooks/useHideOnScrollDown.ts` never hides on web, and
  `components/sessions/shared/ChromeBackdrop.tsx` adds a CSS `backdrop-filter`
  blur on web in place of the glass.

### Known unverified blockers

These libraries are native-only or partially supported on web and have not been
exercised past the onboarding screen. Expect runtime errors or no-ops until each is
addressed:

| Dependency | Used for | Web status |
|---|---|---|
| `expo-local-authentication` | Face ID / biometric unlock | No web API — needs a stub or feature-gate |
| `expo-speech-recognition` | Voice-to-text prompt dictation | No/partial web support |
| `expo-camera` | QR code pairing | Partial web support (browser camera permissions differ) |
| `expo-notifications` | Push notifications | Listener cold-start gated off on web; browser push / service workers not implemented |
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
