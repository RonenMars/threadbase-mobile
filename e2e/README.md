# E2E tests (Maestro)

A minimal smoke-test suite for the Threadbase iOS app, driven by [Maestro](https://maestro.dev) against a local mock server.

## What it covers

Two flows:

- **`launch.yaml`** — the app boots and reaches the hub screen. Walks the 7-step onboarding carousel on first run; on subsequent runs the cached pairing credentials (in `expo-secure-store` / iOS Keychain) survive `clearState: true`, so the app lands on the hub directly. `setup.yaml` handles both paths.
- **`browse.yaml`** — from the hub, verify the hub chrome (`hub-screen`) is mounted and the filter/sort sheet opens. Does **not** navigate into a session detail; see "Known limits" below.

The full suite runs in **30–60 seconds** locally.

## What it does NOT cover

- WebSocket streaming. The mock can serve REST endpoints but not WS upgrades; testing real stream behavior needs a real backend.
- Filtering / sorting / multi-server / favorites / search. Out of scope for a smoke test.
- Push notifications, image attachments, settings screens.

## Prerequisites

### One-time install

```bash
brew install maestro
```

Verify (the suite is written for **Maestro 2.x** and uses a project-side crash guard):

```bash
maestro --version
```

### Build the app

Maestro drives the actual iOS binary, so it must be installed on a booted simulator.
**Use `npm run ios`, not a Debug build launched the default way.**

The default Debug build boots into the Expo Dev Launcher (a SwiftUI screen that asks which JS bundle to load) and there's no clean way for Maestro to get past it — see [`docs/expo-dev-launcher.md`](../docs/expo-dev-launcher.md) for the full explanation. `npm run ios` skips it: `app.json` sets `"launchMode": "most-recent"` on the `expo-dev-client` plugin, so the app loads the last-opened bundle directly instead of showing the launcher.

> **Use an iOS ≤ 26 simulator.** This is a compatibility ceiling, not a guarantee
> that XCTest teardown is healthy. Maestro 2.0.10's XCUITest driver raced/died during
> the `simctl uninstall/install` that `clearState: true` performs on **iOS 26.x**
> (Xcode 26), failing every flow with `Unable to clear state … Failed to connect to
> /127.0.0.1:7001`. Maestro 2.6.1 fixes this — `launchApp: clearState: true` was
> verified COMPLETED on an iPhone 17 / iOS 26.4 sim — but successful `clearState`
> support does not prove that the later automation-session teardown remained healthy.
> `e2e/check-sim.js` therefore allows iOS 26 and refuses only runtimes above it
> (override with `E2E_ALLOW_UNSUPPORTED_IOS=1`). When a newer iOS runtime is verified,
> bump `MAX_SUPPORTED_IOS_MAJOR` in `check-sim.js`.
>
> Maestro 2.8.0 is the latest official release as of 2026-08-11. The 2.7.0 notes add
> waiting for iOS crash reports and improved crash artifacts, but neither the
> [2.7.0/2.8.0 changelog](https://github.com/mobile-dev-inc/Maestro/blob/main/CHANGELOG.md)
> nor the still-open [Maestro #3494](https://github.com/mobile-dev-inc/Maestro/issues/3494)
> claims this XCTest crash is fixed. Upgrading is not treated as a substitute for the guard,
> and repository scripts never install, upgrade, or remove a developer's global Maestro.

```bash
# Boot a simulator on iOS 26 or older (iOS 17.x and iOS 26.x both work — see above).
xcrun simctl list devices available | grep -iE "iOS (1[78]|26)"
xcrun simctl boot <UDID>

# Build + install the app onto the booted sim, skipping the dev launcher
npm run ios
```

The first build takes 5–10 min. Incremental rebuilds are ~1–2 min.

> The `npm run ios` step tends to hang after install while tailing app logs. Once you see `Opening on iPhone 17 Pro`, the install is complete — Ctrl-C is safe.

## Run the suite

```bash
npm run test:e2e:mock
```

This:

1. Verifies a sim is booted (`e2e/check-sim.js`)
2. Starts `e2e/mock-server.js` on `:7071` in the background
3. Runs the configured flows through `node e2e/run-maestro.js test ...`
4. Kills the mock server on exit

## XCTest teardown crash guard

iOS 26 simulator runs can crash SpringBoard, SafariViewService, Threadbase, or another
automation-injected process inside Apple's `com.apple.dt.XCTAutomationSupport` after the
Maestro XCTest runner disconnects. The confirmed boundary is Apple XCTest automation
teardown; a stale/null accessibility-session state or teardown race is an inference, not a
confirmed root cause. Threadbase runtime/UI code is not implicated by this signature, and
the project guard does not prevent or repair the Apple framework defect.

A successful Maestro exit can still be invalid because macOS may write the `.ips` only
after the flow and XCTest runner have exited. Every repository-owned Maestro test and
recording path therefore goes through `e2e/run-maestro.js`, which:

1. snapshots existing `.ips` identities in readable user and system DiagnosticReports
   directories, including `~/Library/Logs/DiagnosticReports/Retired`;
2. runs Maestro with unchanged arguments and inherited stdio, forwarding termination signals;
3. polls for five seconds after Maestro exits and parses only newly observed reports;
4. matches the exact `EXC_BAD_ACCESS` / invalid `0x20` /
   `XCTAutomationSession initWithAccessibilityFramework:dataSource:` /
   `com.apple.dt.XCTAutomationSupport` signature for any simulator process;
5. preserves Maestro's own nonzero exit status, but exits nonzero when the signature appears
   after an otherwise successful run; and
6. copies matching reports to `e2e/_artifacts/xctest-crashes/`, which is git-ignored and is
   included in the CI failure artifact upload.

When the guard reports this crash, stop further hierarchy-based acceptance testing: the
current Maestro result and later evidence from that simulator session are not trustworthy.
Keep the copied report, then manually shut down and reboot the affected simulator before a
bounded retry. Do not erase or recreate the simulator as routine recovery. Track prevention
of the underlying crash in [Maestro #3494](https://github.com/mobile-dev-inc/Maestro/issues/3494).

## How it works

### Mock server

`e2e/mock-server.js` is a vanilla Node HTTP server (no deps) on port 7071. It serves a small set of REST endpoints from `fixtures/`:

| Endpoint | Purpose |
|---|---|
| `GET /api/info` | Server identity (returned to onboarding handshake) |
| `GET /api/profiles` | Pairing handshake (the app makes a real HTTP call) |
| `GET /api/sessions` | List of sessions (fixtures/sessions.json) |
| `GET /api/sessions/:id` | Single session (fixtures/session-detail.json) |
| `GET /api/sessions/:id/output` | Terminal output history |
| `GET /api/conversations` | Conversations list |
| `GET /api/conversations/count` | Conversation count |
| `GET /api/sessions/count` | Session count |

All requests require a Bearer token (any non-empty value works).

The app makes several other API calls that the mock currently 404s (e.g. `/api/sessions/names`, `/api/projects/popular`, `/ws`). The hub renders an error banner because of these failures, but the smoke flows still pass — the relevant UI elements (`hub-screen`, `session-row-*`) are still mounted.

### TestIDs the flows depend on

Added to source as part of E2E work:

- `onboarding-welcome-cta`, `onboarding-theme-cta`, `onboarding-valueprop-cta` — carousel step CTAs (WelcomeStep / ThemeStep / ValuePropStep)
- `onboarding-connect-paste-card` — "Paste credentials" mode card (ConnectStep)
- `onboarding-connect-url-input`, `onboarding-connect-token-input` — URL + token inputs
- `onboarding-connect-handshake-cta` — Open handshake button
- `onboarding-notifications-cta`, `onboarding-tour-cta`, `onboarding-done-cta` — remaining carousel CTAs

Pre-existing testIDs the flows rely on:

- `hub-screen` (app/index.tsx)
- `session-row-<id>` (components/sessions/hub/SessionRow.tsx) — keyed by session id from fixtures
- `session-detail-screen` (app/session/[id].tsx)

### Carousel state survival

`launchApp: clearState: true` wipes app sandbox storage (AsyncStorage, app caches, app preferences). It does **not** wipe iOS Keychain, where `expo-secure-store` lives — and the paired-server credentials live there.

So:
- **First run on a fresh sim:** Keychain empty → app shows onboarding → setup.yaml walks the carousel.
- **Every subsequent run:** Keychain has credentials → app skips onboarding → setup.yaml's `when: visible: id: "onboarding-welcome-cta"` block is skipped.

To force a true "first run" experience, manually erase the simulator (`xcrun simctl erase <udid>`) and reinstall the app.

### Save Password dialog

The token input uses `secureTextEntry`, which makes iOS occasionally pop up the "Save Password?" system dialog after handshake. The setup flow contains a `when: visible: "Not Now"` conditional tap to dismiss it. Won't fire if the dialog doesn't appear.

## Maestro 2.x notes

The suite was written/migrated against Maestro 2.0.10. Notable 2.x changes vs older docs:

- `assertVisible: { timeout: }` → not supported. Use bare `assertVisible` (7s auto-retry) or `extendedWaitUntil` for longer waits.
- `tapOn: { placeholder: }` → not supported. Target the element by `id` or `text` instead.
- `clearText` → renamed to `eraseText` (with optional character count, default 50, max 100).
- Conditional execution: `runFlow: { when: visible: <selector>, commands: [...] }` and `notVisible:` for the inverse.

## Debugging failed runs

Maestro writes screenshots + a UI hierarchy dump to `~/.maestro/tests/<timestamp>/` on every failure. The HTML report (`ai-report-*.html`) is the most useful starting point.

`npm run test:e2e:mock` also passes `--debug-output e2e/_artifacts/debug`, so every run (success or failure) drops a full debug bundle into the repo-relative `e2e/_artifacts/debug/` directory: per-command screenshots, view hierarchies, Maestro logs, device logs. The directory is git-ignored (`e2e/_artifacts/`).

Each flow additionally calls `takeScreenshot` at human-meaningful states (e.g. last message above the bottom bar, drag completed, multi-server tree headers rendered). Those go to `e2e/_artifacts/screenshots/<flow>-<step>.png` and serve as a visual baseline you can eyeball when debugging or update intentionally on UI changes.

To run a single flow with verbose output:

```bash
node e2e/mock-server.js &
node e2e/run-maestro.js test e2e/launch.yaml
kill %1
```

## Known limits

- **Session-detail navigation isn't tested.** The hub's project group rows are React Native `TouchableOpacity` components whose `testID` does not surface to iOS accessibility — iOS auto-aggregates the row's nested `<Text>` children into a single a11y element and drops the testID. We tried `accessible={true}` on the TouchableOpacity; no change. Three workarounds for future iteration:
  1. Wrap the row in a `View accessibilityRole="button" accessible testID="..."` instead of relying on the TouchableOpacity's prop forwarding.
  2. Use coordinate-based `tapOn: { point: "50%, 35%" }` — fragile across screen sizes.
  3. Run the suite on Android, where Maestro reads `testID` more reliably from the UIAutomator tree.
- **Background API errors.** The mock 404s on `/api/sessions/names`, `/api/projects/popular`, `/api/conversations/count`, `POST /api/push/register`, `/ws`. The hub renders an error banner because of these. Smoke tests still pass — those elements are below the banner and remain interactive.

## Future work

- Add the missing mock endpoints listed above to suppress the error banner.
- Add `/ws` WebSocket mock + a `stream-view.yaml` flow asserting a streamed message renders.
- Wrap project group row with a separate `<View testID accessible>` so Maestro can drive into session detail.
- Add EAS-cloud CI integration once the suite is stable locally (see `docs/expo-dev-launcher.md`).
